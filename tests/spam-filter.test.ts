import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedMail } from "mailparser";
import type { ImapFlow } from "imapflow";

const TEST_USER_ID = "spam-user-id";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({
    id: TEST_USER_ID,
    email: "spam@test.dev",
    passwordHash: "hashed",
    role: "ADMIN",
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  getCurrentUser: vi.fn(async () => ({
    id: TEST_USER_ID,
    email: "spam@test.dev",
    passwordHash: "hashed",
    role: "ADMIN",
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
}));

type DetectionLog = {
  userId: string;
  mailbox: string;
  targetMailbox?: string;
  uid: number;
  subject?: string;
  sender?: string;
  score: number;
  reasons: string[];
  autoMoved: boolean;
  manual: boolean;
};

const detectionLogs: DetectionLog[] = [];
const senderStats = new Map<string, { spamCount: number; hamCount: number }>();

const prismaMocks = vi.hoisted(() => {
  return {
    spamDetectionLogFindFirst: vi.fn(),
    spamDetectionLogCreate: vi.fn(),
    spamSenderReputationFindUnique: vi.fn(),
    spamSenderReputationUpsert: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    spamDetectionLog: {
      findFirst: prismaMocks.spamDetectionLogFindFirst,
      create: prismaMocks.spamDetectionLogCreate,
    },
    spamSenderReputation: {
      findUnique: prismaMocks.spamSenderReputationFindUnique,
      upsert: prismaMocks.spamSenderReputationUpsert,
    },
  },
}));

import { analyzeAndHandleSpam, __testables } from "@/server/spam-detection";

class FakeImapClient {
  mailbox: { path: string; readOnly: boolean } | null = {
    path: "INBOX",
    readOnly: true,
  };
  moved: { uid: string; path: string } | null = null;
  fetchCount = 0;
  readonly openCalls: Array<{ path: string; readOnly: boolean }> = [];

  constructor(
    private readonly messages: Map<number, Record<string, unknown>>,
    private readonly folders: Array<{ path: string }> = [
      { path: "INBOX" },
      { path: "Spam" },
    ],
  ) {}

  async fetchOne(uid: number): Promise<Record<string, unknown> | null> {
    this.fetchCount += 1;
    return this.messages.get(uid) ?? null;
  }

  async list() {
    return this.folders;
  }

  async messageMove(uid: string, path: string) {
    this.moved = { uid, path };
  }

  async mailboxOpen(path: string, options?: { readOnly?: boolean }) {
    const readOnly = options?.readOnly ?? false;
    this.mailbox = { path, readOnly };
    this.openCalls.push({ path, readOnly });
  }
}

function createRawEmail(options: {
  from: string;
  to?: string;
  subject: string;
  body: string;
  replyTo?: string | null;
}): { source: string; envelope: Record<string, unknown> } {
  const [fromMailbox, fromHost] = options.from.split("@");
  const replyToAddress = options.replyTo ?? null;
  const headers = [
    `From: Sender <${options.from}>`,
    `To: Recipient <${options.to ?? "user@example.com"}>`,
    `Subject: ${options.subject}`,
    "Message-ID: <test-123@example.com>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=\"utf-8\"",
  ];
  if (replyToAddress) {
    headers.push(`Reply-To: reply <${replyToAddress}>`);
  }
  const source = `${headers.join("\r\n")}\r\n\r\n${options.body}`;
  const envelope = {
    subject: options.subject,
    from: [
      {
        name: "Sender",
        mailbox: fromMailbox,
        host: fromHost,
      },
    ],
    replyTo: replyToAddress
      ? [
          {
            name: null,
            mailbox: replyToAddress.split("@")[0],
            host: replyToAddress.split("@")[1],
          },
        ]
      : undefined,
  };
  return { source, envelope };
}

beforeEach(() => {
  detectionLogs.length = 0;
  senderStats.clear();

  prismaMocks.spamDetectionLogFindFirst.mockReset();
  prismaMocks.spamDetectionLogCreate.mockReset();
  prismaMocks.spamSenderReputationFindUnique.mockReset();
  prismaMocks.spamSenderReputationUpsert.mockReset();

  prismaMocks.spamDetectionLogFindFirst.mockImplementation(async ({ where }) => {
    const existing = detectionLogs.find(
      (log) =>
        log.userId === where.userId &&
        log.mailbox === where.mailbox &&
        log.uid === where.uid &&
        log.manual === where.manual,
    );
    return existing ?? null;
  });
  prismaMocks.spamDetectionLogCreate.mockImplementation(async ({ data }) => {
    detectionLogs.push(data as DetectionLog);
    return data;
  });
  prismaMocks.spamSenderReputationFindUnique.mockImplementation(
    async ({ where: { userId_domain } }: { where: { userId_domain: { userId: string; domain: string } } }) => {
      const key = `${userId_domain.userId}:${userId_domain.domain}`;
      const stats = senderStats.get(key);
      return stats
        ? {
            userId: userId_domain.userId,
            domain: userId_domain.domain,
            spamCount: stats.spamCount,
            hamCount: stats.hamCount,
          }
        : null;
    },
  );
  prismaMocks.spamSenderReputationUpsert.mockImplementation(
    async ({
      where: { userId_domain },
      create,
      update,
    }: {
      where: { userId_domain: { userId: string; domain: string } };
      create: { userId: string; domain: string; spamCount: number; hamCount: number };
      update: {
        spamCount?: { increment?: number };
        hamCount?: { increment?: number };
      };
    }) => {
      const key = `${userId_domain.userId}:${userId_domain.domain}`;
      const current = senderStats.get(key);
      if (!current) {
        senderStats.set(key, {
          spamCount: create.spamCount,
          hamCount: create.hamCount,
        });
        return;
      }
      senderStats.set(key, {
        spamCount: current.spamCount + (update.spamCount?.increment ?? 0),
        hamCount: current.hamCount + (update.hamCount?.increment ?? 0),
      });
    },
  );
});

describe("spam detection helpers", () => {
  it("detects blacklisted domains including subdomains", () => {
    const { isDomainBlacklisted } = __testables;
    expect(isDomainBlacklisted("spamtest.io")).toBe(true);
    expect(isDomainBlacklisted("offers.spamtest.io")).toBe(true);
    expect(isDomainBlacklisted("secure.mail.ru")).toBe(true);
    expect(isDomainBlacklisted("example.com")).toBe(false);
  });

  it("flags dangerous attachments by filename and mime type", () => {
    const { hasSuspiciousAttachments } = __testables;
    const attachments = [
      {
        filename: "facture.pdf",
        contentType: "application/pdf",
      },
      {
        filename: "document.exe",
        contentType: "application/x-msdownload",
      },
    ] as unknown as ParsedMail["attachments"];
    expect(hasSuspiciousAttachments(attachments)).toBe(true);

    const safeAttachments = [
      {
        filename: "rapport.pdf",
        contentType: "application/pdf",
      },
    ] as unknown as ParsedMail["attachments"];
    expect(hasSuspiciousAttachments(safeAttachments)).toBe(false);
  });
});

describe("analyzeAndHandleSpam", () => {
  it("moves high-scoring spam to the spam folder", async () => {
    const uid = 7;
    const raw = createRawEmail({
      from: "promo@offers.spamtest.io",
      subject: "Offre spéciale Bitcoin",
      body: [
        "Investissement garanti pour doubler vos gains sans risque.",
        "Découvrez comment gagner de l'argent avec la crypto dès maintenant.",
        "Suivez ce lien: https://scam-token.com/login et https://scam-token.com/wallet.",
      ].join("\n"),
    });
    const messages = new Map<number, Record<string, unknown>>([
      [
        uid,
        {
          envelope: raw.envelope,
          source: raw.source,
        },
      ],
    ]);
    const fakeClient = new FakeImapClient(messages);

    const result = await analyzeAndHandleSpam({
      client: fakeClient as unknown as ImapFlow,
      mailbox: "inbox",
      uid,
      spamFilteringEnabled: true,
    });

    expect(result.movedToSpam).toBe(true);
    expect(result.alreadyLogged).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.reasons).toContain("Domaine expéditeur sur liste noire");
    expect(fakeClient.moved).toEqual({
      uid: String(uid),
      path: "Spam",
    });
    expect(detectionLogs).toHaveLength(1);
    expect(detectionLogs[0]?.targetMailbox).toBe("spam");
    expect(senderStats.get(`${TEST_USER_ID}:offers.spamtest.io`)?.spamCount).toBe(1);
  });

  it("does not misclassify a legitimate message", async () => {
    const uid = 11;
    const raw = createRawEmail({
      from: "collaborateur@example.com",
      subject: "Compte-rendu de réunion",
      body:
        "Bonjour,\nVoici le compte-rendu de notre réunion hebdomadaire avec les actions à suivre.\nMerci.",
    });
    const messages = new Map<number, Record<string, unknown>>([
      [
        uid,
        {
          envelope: raw.envelope,
          source: raw.source,
        },
      ],
    ]);
    const fakeClient = new FakeImapClient(messages);

    const result = await analyzeAndHandleSpam({
      client: fakeClient as unknown as ImapFlow,
      mailbox: "inbox",
      uid,
      spamFilteringEnabled: true,
    });

    expect(result.movedToSpam).toBe(false);
    expect(result.score).toBeLessThan(70);
    expect(detectionLogs).toHaveLength(1);
    expect(detectionLogs[0]?.targetMailbox).toBeUndefined();
    expect(senderStats.size).toBe(0);
  });

  it("respects the spam filter toggle", async () => {
    const uid = 19;
    const raw = createRawEmail({
      from: "promo@offers.spamtest.io",
      subject: "Gagner de l'argent facilement",
      body: "Cliquez pour une offre exclusive.",
    });
    const messages = new Map<number, Record<string, unknown>>([
      [
        uid,
        {
          envelope: raw.envelope,
          source: raw.source,
        },
      ],
    ]);
    const fakeClient = new FakeImapClient(messages);

    const result = await analyzeAndHandleSpam({
      client: fakeClient as unknown as ImapFlow,
      mailbox: "inbox",
      uid,
      spamFilteringEnabled: false,
    });

    expect(result).toEqual({
      score: 0,
      reasons: [],
      movedToSpam: false,
      alreadyLogged: false,
    });
    expect(fakeClient.fetchCount).toBe(0);
    expect(detectionLogs).toHaveLength(0);
  });

  it("skips reprocessing when a spam log already exists", async () => {
    prismaMocks.spamDetectionLogFindFirst.mockResolvedValueOnce({
      score: 82,
      reasons: ["Déjà analysé"],
      targetMailbox: "spam",
    });
    const fakeClient = new FakeImapClient(new Map());

    const result = await analyzeAndHandleSpam({
      client: fakeClient as unknown as ImapFlow,
      mailbox: "inbox",
      uid: 25,
      spamFilteringEnabled: true,
    });

    expect(result.alreadyLogged).toBe(true);
    expect(result.movedToSpam).toBe(true);
    expect(result.score).toBe(82);
    expect(detectionLogs).toHaveLength(0);
    expect(fakeClient.fetchCount).toBe(0);
  });
});
