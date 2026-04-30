import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { ImapFlow } from "imapflow";
import { MessagingLocalSyncStatus } from "@/lib/db/prisma";
import type { MessagingCredentials } from "@/server/messaging";

let prisma: (typeof import("@/lib/db"))["prisma"];
let getMessagingLocalMessageByImapIdentity: typeof import("@/server/messaging-local-sync")["getMessagingLocalMessageByImapIdentity"];
let listMessagingMailboxLocalSyncStates: typeof import("@/server/messaging-local-sync")["listMessagingMailboxLocalSyncStates"];
let syncMessagingMailboxToLocalWithRuntime: typeof import("@/server/messaging-local-sync")["__testables"]["syncMessagingMailboxToLocalWithRuntime"];
let syncMessagingMailboxesToLocalWithRuntime: typeof import("@/server/messaging-local-sync")["__testables"]["syncMessagingMailboxesToLocalWithRuntime"];

let userId: string;

type SyncMailboxRuntime = Parameters<
  typeof syncMessagingMailboxToLocalWithRuntime
>[1];
type RuntimeWithImapClient = SyncMailboxRuntime["withImapClient"];
type RuntimeOpenMailbox = SyncMailboxRuntime["openMailbox"];
type RuntimeFetchRawMessages = SyncMailboxRuntime["fetchRawMessages"];
type RuntimeParseFetchedMailboxMessage =
  SyncMailboxRuntime["parseFetchedMailboxMessage"];
type SupportedMailbox = keyof MailboxFixtureMap;

type RemoteFixtureMessage = {
  uid: number;
  messageId?: string;
  subject?: string;
  fromAddress?: string;
  fromName?: string | null;
  toAddress?: string;
  internalDate?: string;
  sentAt?: string | null;
  flags?: string[];
  text?: string | null;
  html?: string | null;
  attachments?: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    contentId?: string | null;
    inline?: boolean;
  }>;
  fail?: boolean;
};

type MailboxFixture = {
  mailboxName?: string;
  uidValidity?: number;
  openError?: string;
  messages: RemoteFixtureMessage[];
};

type MailboxFixtureMap = Partial<
  Record<"inbox" | "sent" | "drafts" | "trash" | "spam", MailboxFixture>
>;

const describeMessagingLocalSyncMailboxes = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

function buildCredentials(): MessagingCredentials {
  return {
    fromEmail: "support@example.com",
    senderName: "Support",
    senderLogoUrl: null,
    imap: {
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "support@example.com",
      password: "secret",
    },
    smtp: null,
    spamFilterEnabled: true,
    trackingEnabled: true,
    autoForward: {
      enabled: false,
      recipients: [],
    },
    autoReply: {
      enabled: false,
      subject: "Auto reply",
      body: "Body",
    },
    vacation: {
      enabled: false,
      subject: "Vacation",
      message: "Away",
      startDate: null,
      endDate: null,
      backupEmail: null,
    },
  };
}

function buildEnvelope(message: RemoteFixtureMessage) {
  const fromAddress = message.fromAddress ?? `sender-${message.uid}@example.com`;
  const [fromMailbox, fromHost = "example.com"] = fromAddress.split("@");
  const toAddress = message.toAddress ?? `recipient-${message.uid}@example.com`;
  const [toMailbox, toHost = "example.com"] = toAddress.split("@");

  return {
    messageId: message.messageId ?? `<message-${message.uid}@example.com>`,
    subject: message.subject ?? `Sujet ${message.uid}`,
    from: [
      {
        name: message.fromName ?? `Sender ${message.uid}`,
        mailbox: fromMailbox,
        host: fromHost,
      },
    ],
    to: [
      {
        name: `Recipient ${message.uid}`,
        mailbox: toMailbox,
        host: toHost,
      },
    ],
  };
}

function parseSequenceRange(value: string, totalMessages: number) {
  const [rawStart, rawEnd] = value.split(":");
  const start = Math.max(1, Number.parseInt(rawStart ?? "1", 10) || 1);
  const end = Math.min(
    totalMessages,
    Number.parseInt(rawEnd ?? `${totalMessages}`, 10) || totalMessages,
  );
  return { start, end };
}

function parseUidRange(value: string) {
  const [rawStart, rawEnd] = value.split(":");
  const start = Math.max(1, Number.parseInt(rawStart ?? "1", 10) || 1);
  const end = Math.max(start, Number.parseInt(rawEnd ?? `${start}`, 10) || start);
  return { start, end };
}

function createRuntime(fixtures: MailboxFixtureMap): SyncMailboxRuntime {
  const credentials = buildCredentials();
  let activeMailbox: SupportedMailbox = "inbox";

  const fakeClient = {
    async *fetch(
      sequenceOrQuery: string | { uid: string },
    ) {
      const fixture = fixtures[activeMailbox] ?? {
        messages: [],
      };
      const sortedMessages = [...fixture.messages].sort((a, b) => a.uid - b.uid);

      if (typeof sequenceOrQuery === "string") {
        const { start, end } = parseSequenceRange(
          sequenceOrQuery,
          sortedMessages.length,
        );
        for (let index = start - 1; index < end; index += 1) {
          const message = sortedMessages[index];
          if (!message) {
            continue;
          }
          yield {
            uid: message.uid,
            envelope: buildEnvelope(message),
            internalDate: new Date(
              message.internalDate ??
                `2026-03-26T10:${String(message.uid % 60).padStart(2, "0")}:00.000Z`,
            ),
            flags: new Set(message.flags ?? []),
          };
        }
        return;
      }

      const { start, end } = parseUidRange(sequenceOrQuery.uid);
      for (const message of sortedMessages) {
        if (message.uid < start || message.uid > end) {
          continue;
        }
        yield {
          uid: message.uid,
          envelope: buildEnvelope(message),
          internalDate: new Date(
            message.internalDate ??
              `2026-03-26T10:${String(message.uid % 60).padStart(2, "0")}:00.000Z`,
          ),
          flags: new Set(message.flags ?? []),
        };
      }
    },
  } as unknown as ImapFlow;

  return {
    resolveUserId: async () => userId,
    getMessagingCredentials: async () => credentials,
    withImapClient: async (
      _config: Parameters<RuntimeWithImapClient>[0],
      fn: Parameters<RuntimeWithImapClient>[1],
    ) => fn(fakeClient),
    openMailbox: async (
      _client: Parameters<RuntimeOpenMailbox>[0],
      mailbox: Parameters<RuntimeOpenMailbox>[1],
    ) => {
      activeMailbox = mailbox;
      const fixture = fixtures[mailbox] ?? {
        messages: [],
      };
      if (fixture.openError) {
        throw new Error(fixture.openError);
      }
      const highestUid = fixture.messages.length
        ? Math.max(...fixture.messages.map((message) => message.uid))
        : 0;
      const mailboxName = fixture.mailboxName ?? mailbox.toUpperCase();

      return {
        name: mailboxName,
        info: {
          path: mailboxName,
          delimiter: "/",
          flags: new Set<string>(),
          exists: fixture.messages.length,
          uidNext: highestUid + 1,
          uidValidity: fixture.uidValidity ?? 9001,
        },
        release: () => undefined,
      } as unknown as Awaited<ReturnType<RuntimeOpenMailbox>>;
    },
    getMailboxCacheKey: () => "mailbox-test-cache-key",
    fetchRawMessages: async (
      _client: Parameters<RuntimeFetchRawMessages>[0],
      uids: Parameters<RuntimeFetchRawMessages>[1],
    ) => {
      const fixture = fixtures[activeMailbox] ?? {
        messages: [],
      };
      const messagesByUid = new Map(
        fixture.messages.map((message) => [message.uid, message]),
      );
      const prefetched = new Map();
      for (const uid of uids) {
        const message = messagesByUid.get(uid);
        if (!message) {
          continue;
        }
        prefetched.set(uid, {
          uid,
          envelope: buildEnvelope(message),
          source: `raw-${activeMailbox}-${uid}`,
          internalDate: new Date(
            message.internalDate ??
              `2026-03-26T10:${String(uid % 60).padStart(2, "0")}:00.000Z`,
          ),
        });
      }
      return prefetched;
    },
    parseFetchedMailboxMessage: async ({
      mailbox,
      uid,
    }: Parameters<RuntimeParseFetchedMailboxMessage>[0]) => {
      const fixture = fixtures[mailbox] ?? {
        messages: [],
      };
      const message = fixture.messages.find((entry) => entry.uid === uid);
      if (!message) {
        throw new Error(`Unknown fixture UID ${uid} for ${mailbox}`);
      }
      if (message.fail) {
        throw new Error(`Simulated parse failure for ${mailbox} UID ${uid}`);
      }
      const fromAddress = message.fromAddress ?? `sender-${uid}@example.com`;
      const toAddress = message.toAddress ?? `recipient-${uid}@example.com`;
      const text = message.text ?? `Contenu ${mailbox} ${uid}`;
      const html = message.html ?? null;

      return {
        messageId: message.messageId ?? `<message-${mailbox}-${uid}@example.com>`,
        subject: message.subject ?? `Sujet ${mailbox} ${uid}`,
        from: `${message.fromName ?? `Sender ${uid}`} <${fromAddress}>`,
        to: [toAddress],
        cc: [],
        bcc: [],
        replyTo: [],
        date:
          message.internalDate ??
          `2026-03-26T10:${String(uid % 60).padStart(2, "0")}:00.000Z`,
        sentAt: message.sentAt ?? message.internalDate ?? null,
        seen: (message.flags ?? []).includes("\\Seen"),
        answered: (message.flags ?? []).includes("\\Answered"),
        flagged: (message.flags ?? []).includes("\\Flagged"),
        draft: (message.flags ?? []).includes("\\Draft"),
        html,
        text,
        previewText: text.slice(0, 180),
        attachments: (message.attachments ?? []).map((attachment) => ({
          id: attachment.id,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          contentId: attachment.contentId ?? null,
          contentLocation: null,
          inline: attachment.inline ?? false,
        })),
        fromAddress: {
          name: message.fromName ?? `Sender ${uid}`,
          address: fromAddress,
        },
        toAddresses: [
          {
            name: `Recipient ${uid}`,
            address: toAddress,
          },
        ],
        ccAddresses: [],
        bccAddresses: [],
        replyToAddresses: [],
      };
    },
    now: () => new Date("2026-03-26T11:00:00.000Z"),
  } as unknown as SyncMailboxRuntime;
}

describeMessagingLocalSyncMailboxes("messaging local mailbox sync engine", () => {
  beforeAll(async () => {
    const prismaModule = await import("@/lib/db");
    const localSyncModule = await import("@/server/messaging-local-sync");

    prisma = prismaModule.prisma;
    getMessagingLocalMessageByImapIdentity =
      localSyncModule.getMessagingLocalMessageByImapIdentity;
    listMessagingMailboxLocalSyncStates =
      localSyncModule.listMessagingMailboxLocalSyncStates;
    syncMessagingMailboxToLocalWithRuntime =
      localSyncModule.__testables.syncMessagingMailboxToLocalWithRuntime;
    syncMessagingMailboxesToLocalWithRuntime =
      localSyncModule.__testables.syncMessagingMailboxesToLocalWithRuntime;

    const timestamp = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `messaging-local-sync-mailboxes-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Messaging Local Sync Mailboxes",
      },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await prisma.messagingLocalMessage.deleteMany({
      where: { userId },
    });
    await prisma.messagingMailboxLocalSyncState.deleteMany({
      where: { userId },
    });
    await prisma.messagingSettings.deleteMany({
      where: { userId },
    });
  });

  afterAll(async () => {
    if (!userId) {
      return;
    }
    await prisma.messagingLocalMessage.deleteMany({
      where: { userId },
    });
    await prisma.messagingMailboxLocalSyncState.deleteMany({
      where: { userId },
    });
    await prisma.messagingSettings.deleteMany({
      where: { userId },
    });
    await prisma.user.delete({
      where: { id: userId },
    });
  });

  it(
    "bootstraps the five supported mailboxes independently and preserves sent message ids",
    async () => {
      const result = await syncMessagingMailboxesToLocalWithRuntime(
        {
          userId,
        },
        createRuntime({
          inbox: {
            mailboxName: "INBOX",
            messages: [{ uid: 11, subject: "Inbox 11" }],
          },
          sent: {
            mailboxName: "Sent Items",
            messages: [
              {
                uid: 21,
                messageId: "<sent-21@example.com>",
                subject: "Sent 21",
              },
            ],
          },
          drafts: {
            mailboxName: "Drafts",
            messages: [{ uid: 31, subject: "Draft 31", flags: ["\\Draft"] }],
          },
          trash: {
            mailboxName: "Trash",
            messages: [{ uid: 41, subject: "Trash 41" }],
          },
          spam: {
            mailboxName: "Spam",
            messages: [{ uid: 51, subject: "Spam 51" }],
          },
        }),
      );

      const states = await listMessagingMailboxLocalSyncStates(userId);
      const sentMessage = await getMessagingLocalMessageByImapIdentity({
        userId,
        mailbox: "sent",
        uidValidity: 9001,
        uid: 21,
      });

      expect(result.failures).toEqual([]);
      expect(result.results).toHaveLength(5);
      expect(result.states).toHaveLength(5);
      expect(states).toHaveLength(5);
      expect(states.every((state) => state.status === MessagingLocalSyncStatus.READY)).toBe(
        true,
      );
      expect(sentMessage).toMatchObject({
        userId,
        mailbox: "sent",
        uidValidity: 9001,
        uid: 21,
        messageId: "<sent-21@example.com>",
        subject: "Sent 21",
      });
    },
    30000,
  );

  it(
    "keeps the recent window readable while full backfill progresses in smaller batches",
    async () => {
      const firstRun = await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "trash",
          recentWindowSize: 2,
          backfillBatchSize: 2,
        },
        createRuntime({
          trash: {
            mailboxName: "Trash",
            messages: [
              { uid: 1, subject: "Trash 1" },
              { uid: 2, subject: "Trash 2" },
              { uid: 3, subject: "Trash 3" },
              { uid: 4, subject: "Trash 4" },
              { uid: 5, subject: "Trash 5" },
            ],
          },
        }),
      );

      const secondRun = await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "trash",
          recentWindowSize: 2,
          backfillBatchSize: 2,
        },
        createRuntime({
          trash: {
            mailboxName: "Trash",
            messages: [
              { uid: 1, subject: "Trash 1" },
              { uid: 2, subject: "Trash 2" },
              { uid: 3, subject: "Trash 3" },
              { uid: 4, subject: "Trash 4" },
              { uid: 5, subject: "Trash 5" },
            ],
          },
        }),
      );

      expect(firstRun).toMatchObject({
        mailbox: "trash",
        remoteMessageCount: 5,
        localMessageCount: 4,
        recentFetchedCount: 2,
        backfillFetchedCount: 2,
        bootstrapComplete: true,
        backfillComplete: false,
        lastBackfilledUid: 2,
        status: MessagingLocalSyncStatus.READY,
      });
      expect(secondRun).toMatchObject({
        mailbox: "trash",
        remoteMessageCount: 5,
        localMessageCount: 5,
        bootstrapComplete: true,
        backfillComplete: true,
        lastBackfilledUid: 1,
        status: MessagingLocalSyncStatus.READY,
      });
    },
    30000,
  );

  it(
    "applies delta sync incrementally without reparsing the recent window",
    async () => {
      const firstRun = await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "inbox",
          recentWindowSize: 3,
          backfillBatchSize: 0,
          includeBackfill: false,
        },
        createRuntime({
          inbox: {
            mailboxName: "INBOX",
            messages: [
              { uid: 1, subject: "Inbox 1" },
              { uid: 2, subject: "Inbox 2" },
              { uid: 3, subject: "Inbox 3" },
            ],
          },
        }),
      );

      const secondRun = await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "inbox",
          recentWindowSize: 3,
          backfillBatchSize: 0,
          includeBackfill: false,
        },
        createRuntime({
          inbox: {
            mailboxName: "INBOX",
            messages: [
              { uid: 1, subject: "Inbox 1" },
              { uid: 2, subject: "Inbox 2" },
              { uid: 3, subject: "Inbox 3" },
              { uid: 4, subject: "Inbox 4" },
            ],
          },
        }),
      );

      expect(firstRun).toMatchObject({
        mailbox: "inbox",
        remoteMessageCount: 3,
        localMessageCount: 3,
        syncedCount: 3,
      });
      expect(secondRun).toMatchObject({
        mailbox: "inbox",
        remoteMessageCount: 4,
        localMessageCount: 4,
        recentFetchedCount: 1,
        syncedCount: 1,
        status: MessagingLocalSyncStatus.READY,
      });
    },
    30000,
  );

  it(
    "continues priority backfill for inbox during delta runs so search coverage converges faster",
    async () => {
      const firstRun = await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "inbox",
          recentWindowSize: 2,
          includeBackfill: true,
          backfillBatchSize: 2,
        },
        createRuntime({
          inbox: {
            mailboxName: "INBOX",
            messages: [
              { uid: 1, subject: "Inbox 1", html: "<p>Inbox 1</p>" },
              { uid: 2, subject: "Inbox 2", html: "<p>Inbox 2</p>" },
              { uid: 3, subject: "Inbox 3", html: "<p>Inbox 3</p>" },
              { uid: 4, subject: "Inbox 4", html: "<p>Inbox 4</p>" },
              { uid: 5, subject: "Inbox 5", html: "<p>Inbox 5</p>" },
              { uid: 6, subject: "Inbox 6", html: "<p>Inbox 6</p>" },
            ],
          },
        }),
      );

      const secondRun = await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "inbox",
          recentWindowSize: 2,
          includeBackfill: false,
          continuePriorityBackfill: true,
          backfillBatchSize: 2,
        },
        createRuntime({
          inbox: {
            mailboxName: "INBOX",
            messages: [
              { uid: 1, subject: "Inbox 1", html: "<p>Inbox 1</p>" },
              { uid: 2, subject: "Inbox 2", html: "<p>Inbox 2</p>" },
              { uid: 3, subject: "Inbox 3", html: "<p>Inbox 3</p>" },
              { uid: 4, subject: "Inbox 4", html: "<p>Inbox 4</p>" },
              { uid: 5, subject: "Inbox 5", html: "<p>Inbox 5</p>" },
              { uid: 6, subject: "Inbox 6", html: "<p>Inbox 6</p>" },
            ],
          },
        }),
      );

      const backfilledMessage = await getMessagingLocalMessageByImapIdentity({
        userId,
        mailbox: "inbox",
        uidValidity: 9001,
        uid: 2,
      });

      expect(firstRun).toMatchObject({
        mailbox: "inbox",
        remoteMessageCount: 6,
        localMessageCount: 4,
        backfillFetchedCount: 2,
        backfillComplete: false,
      });
      expect(secondRun).toMatchObject({
        mailbox: "inbox",
        remoteMessageCount: 6,
        localMessageCount: 6,
        recentFetchedCount: 0,
        backfillFetchedCount: 2,
        backfillComplete: true,
        status: MessagingLocalSyncStatus.READY,
      });
      expect(backfilledMessage).toMatchObject({
        uid: 2,
        subject: "Inbox 2",
        normalizedText: "Contenu inbox 2",
        sanitizedHtml: null,
        bodyState: "TEXT_READY",
      });
    },
    30000,
  );

  it(
    "resets stale local rows when uid validity changes on the remote mailbox",
    async () => {
      await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "spam",
        },
        createRuntime({
          spam: {
            mailboxName: "Spam",
            uidValidity: 9001,
            messages: [{ uid: 1, subject: "Old spam identity" }],
          },
        }),
      );

      const secondRun = await syncMessagingMailboxToLocalWithRuntime(
        {
          userId,
          mailbox: "spam",
        },
        createRuntime({
          spam: {
            mailboxName: "Spam",
            uidValidity: 9002,
            messages: [{ uid: 1, subject: "New spam identity" }],
          },
        }),
      );

      const staleMessage = await getMessagingLocalMessageByImapIdentity({
        userId,
        mailbox: "spam",
        uidValidity: 9001,
        uid: 1,
      });
      const currentMessage = await getMessagingLocalMessageByImapIdentity({
        userId,
        mailbox: "spam",
        uidValidity: 9002,
        uid: 1,
      });
      const spamState = (
        await listMessagingMailboxLocalSyncStates(userId)
      ).find((state) => state.mailbox === "spam");

      expect(secondRun).toMatchObject({
        mailbox: "spam",
        uidValidity: 9002,
        localMessageCount: 1,
        remoteMessageCount: 1,
        status: MessagingLocalSyncStatus.READY,
      });
      expect(staleMessage).toBeNull();
      expect(currentMessage).toMatchObject({
        mailbox: "spam",
        uidValidity: 9002,
        uid: 1,
        subject: "New spam identity",
      });
      expect(spamState).toMatchObject({
        mailbox: "spam",
        uidValidity: 9002,
        localMessageCount: 1,
      });
    },
    30000,
  );

  it(
    "does not let one mailbox failure block the others and persists per-mailbox status",
    async () => {
      const result = await syncMessagingMailboxesToLocalWithRuntime(
        {
          userId,
          mailboxes: ["sent", "spam"],
        },
        createRuntime({
          sent: {
            openError: "Sent mailbox unavailable",
            messages: [],
          },
          spam: {
            mailboxName: "Spam",
            messages: [{ uid: 71, subject: "Spam 71" }],
          },
        }),
      );

      const states = await listMessagingMailboxLocalSyncStates(userId);
      const sentState = states.find((state) => state.mailbox === "sent");
      const spamState = states.find((state) => state.mailbox === "spam");

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.mailbox).toBe("spam");
      expect(result.failures).toEqual([
        {
          mailbox: "sent",
          message: "Sent mailbox unavailable",
        },
      ]);
      expect(sentState).toMatchObject({
        mailbox: "sent",
        status: MessagingLocalSyncStatus.ERROR,
      });
      expect(sentState?.lastError).toContain("Sent mailbox unavailable");
      expect(spamState).toMatchObject({
        mailbox: "spam",
        status: MessagingLocalSyncStatus.READY,
      });
    },
    30000,
  );
});
