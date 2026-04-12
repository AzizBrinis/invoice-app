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
let getMessagingMailboxLocalSyncState: typeof import("@/server/messaging-local-sync")["getMessagingMailboxLocalSyncState"];
let getMessagingLocalMessageByImapIdentity: typeof import("@/server/messaging-local-sync")["getMessagingLocalMessageByImapIdentity"];
let listMessagingLocalMessages: typeof import("@/server/messaging-local-sync")["listMessagingLocalMessages"];
let syncInboxMailboxToLocalWithRuntime: typeof import("@/server/messaging-local-sync")["__testables"]["syncInboxMailboxToLocalWithRuntime"];

let userId: string;

type SyncInboxRuntime = Parameters<
  typeof syncInboxMailboxToLocalWithRuntime
>[1];

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

const describeMessagingLocalSyncInbox = process.env.TEST_DATABASE_URL
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

function createFakeClient(messages: RemoteFixtureMessage[]): ImapFlow {
  return {
    async *fetch() {
      for (const message of messages) {
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
}

function createRuntime(
  messages: RemoteFixtureMessage[],
  options?: {
    uidValidity?: number;
    mailboxName?: string;
  },
): SyncInboxRuntime {
  const credentials = buildCredentials();
  const fakeClient = createFakeClient(messages);
  const messagesByUid = new Map(messages.map((message) => [message.uid, message]));
  const uidValidity = options?.uidValidity ?? 9001;
  const mailboxName = options?.mailboxName ?? "INBOX";
  const highestUid = messages.length
    ? Math.max(...messages.map((message) => message.uid))
    : 0;

  return {
    resolveUserId: async () => userId,
    getMessagingCredentials: async () => credentials,
    withImapClient: async (_config: MessagingCredentials["imap"], fn: (client: ImapFlow) => Promise<unknown>) =>
      fn(fakeClient),
    openMailbox: async () => ({
      name: mailboxName,
      info: {
        path: mailboxName,
        delimiter: "/",
        flags: new Set<string>(),
        exists: messages.length,
        uidNext: highestUid + 1,
        uidValidity,
      },
      release: () => undefined,
    }),
    getMailboxCacheKey: () => "test-cache-key",
    fetchRawMessages: async (_client: ImapFlow, uids: number[]) => {
      const prefetched = new Map();
      for (const uid of uids) {
        const message = messagesByUid.get(uid);
        if (!message) {
          continue;
        }
        prefetched.set(uid, {
          uid,
          envelope: buildEnvelope(message),
          source: `raw-${uid}`,
          internalDate: new Date(
            message.internalDate ??
              `2026-03-26T10:${String(uid % 60).padStart(2, "0")}:00.000Z`,
          ),
        });
      }
      return prefetched;
    },
    parseFetchedMailboxMessage: async ({ uid }: { uid: number }) => {
      const message = messagesByUid.get(uid);
      if (!message) {
        throw new Error(`Unknown fixture UID ${uid}`);
      }
      if (message.fail) {
        throw new Error(`Simulated parse failure for UID ${uid}`);
      }
      const fromAddress = message.fromAddress ?? `sender-${uid}@example.com`;
      const toAddress = message.toAddress ?? `recipient-${uid}@example.com`;
      const subject = message.subject ?? `Sujet ${uid}`;
      const text = message.text ?? `Contenu ${uid}`;
      const html = message.html ?? null;
      const attachments = message.attachments ?? [];

      return {
        messageId: message.messageId ?? `<message-${uid}@example.com>`,
        subject,
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
        previewText: text?.slice(0, 180) ?? null,
        attachments: attachments.map((attachment) => ({
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
    now: () => new Date("2026-03-26T09:30:00.000Z"),
  } as unknown as SyncInboxRuntime;
}

describeMessagingLocalSyncInbox("messaging local inbox sync", () => {
  beforeAll(async () => {
    const prismaModule = await import("@/lib/db");
    const localSyncModule = await import("@/server/messaging-local-sync");

    prisma = prismaModule.prisma;
    getMessagingMailboxLocalSyncState =
      localSyncModule.getMessagingMailboxLocalSyncState;
    getMessagingLocalMessageByImapIdentity =
      localSyncModule.getMessagingLocalMessageByImapIdentity;
    listMessagingLocalMessages = localSyncModule.listMessagingLocalMessages;
    syncInboxMailboxToLocalWithRuntime =
      localSyncModule.__testables.syncInboxMailboxToLocalWithRuntime;

    const timestamp = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `messaging-local-sync-inbox-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Messaging Local Sync Inbox",
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
    "bootstraps an empty local inbox working set and records cursor state",
    async () => {
      const result = await syncInboxMailboxToLocalWithRuntime(
        {
          userId,
          bootstrapWindowSize: 10,
        },
        createRuntime([
          {
            uid: 101,
            subject: "Nouveau message 101",
            text: "Contenu 101",
            attachments: [
              {
                id: "attachment-101",
                filename: "invoice-101.pdf",
                contentType: "application/pdf",
                size: 4096,
              },
            ],
          },
          {
            uid: 100,
            subject: "Nouveau message 100",
            html: "<p>Bonjour 100</p>",
            text: "Bonjour 100",
          },
        ]),
      );

      const state = await getMessagingMailboxLocalSyncState({
        userId,
        mailbox: "inbox",
      });
      const messages = await listMessagingLocalMessages({
        userId,
        mailbox: "inbox",
      });

      expect(result).toMatchObject({
        userId,
        mailbox: "inbox",
        remotePath: "INBOX",
        uidValidity: 9001,
        remoteMessageCount: 2,
        localMessageCount: 2,
        fetchedCount: 2,
        syncedCount: 2,
        failedCount: 0,
        lastSyncedUid: 101,
        lastBackfilledUid: 100,
        status: MessagingLocalSyncStatus.READY,
      });
      expect(state).toMatchObject({
        userId,
        mailbox: "inbox",
        remotePath: "INBOX",
        uidValidity: 9001,
        lastKnownUidNext: 102,
        lastSyncedUid: 101,
        lastBackfilledUid: 100,
        remoteMessageCount: 2,
        localMessageCount: 2,
        status: MessagingLocalSyncStatus.READY,
        lastError: null,
      });
      expect(state?.lastSuccessfulSyncAt).toBeTruthy();
      expect(messages.total).toBe(2);
      expect(messages.items[0]?.uid).toBe(101);
      expect(messages.items[0]?.attachments).toHaveLength(1);
      expect(messages.items[1]?.bodyState).toBe("HTML_READY");
    },
    30000,
  );

  it(
    "updates existing inbox rows on re-sync instead of duplicating them",
    async () => {
      await syncInboxMailboxToLocalWithRuntime(
        {
          userId,
          bootstrapWindowSize: 10,
        },
        createRuntime([
          {
            uid: 101,
            subject: "Sujet initial 101",
            text: "Texte initial 101",
          },
          {
            uid: 100,
            subject: "Sujet initial 100",
            text: "Texte initial 100",
          },
        ]),
      );

      const secondRun = await syncInboxMailboxToLocalWithRuntime(
        {
          userId,
          bootstrapWindowSize: 10,
        },
        createRuntime([
          {
            uid: 101,
            subject: "Sujet mis à jour 101",
            text: "Texte mis à jour 101",
            flags: ["\\Seen", "\\Answered"],
          },
          {
            uid: 100,
            subject: "Sujet initial 100",
            text: "Texte initial 100",
          },
        ]),
      );

      const count = await prisma.messagingLocalMessage.count({
        where: {
          userId,
          mailbox: "INBOX",
          uidValidity: 9001,
        },
      });
      const updatedMessage = await getMessagingLocalMessageByImapIdentity({
        userId,
        mailbox: "inbox",
        uidValidity: 9001,
        uid: 101,
      });

      expect(secondRun.status).toBe(MessagingLocalSyncStatus.READY);
      expect(secondRun.syncedCount).toBe(2);
      expect(count).toBe(2);
      expect(updatedMessage).toMatchObject({
        userId,
        mailbox: "inbox",
        uidValidity: 9001,
        uid: 101,
        subject: "Sujet mis à jour 101",
        seen: true,
        answered: true,
      });
    },
    30000,
  );

  it(
    "keeps previously synced data intact when a later sync is only partially successful",
    async () => {
      await syncInboxMailboxToLocalWithRuntime(
        {
          userId,
          bootstrapWindowSize: 10,
        },
        createRuntime([
          {
            uid: 101,
            subject: "Sujet stable 101",
            text: "Texte stable 101",
          },
          {
            uid: 100,
            subject: "Sujet stable 100",
            text: "Texte stable 100",
          },
        ]),
      );

      const degradedRun = await syncInboxMailboxToLocalWithRuntime(
        {
          userId,
          bootstrapWindowSize: 10,
        },
        createRuntime([
          {
            uid: 101,
            subject: "Sujet cassé 101",
            text: "Texte cassé 101",
            fail: true,
          },
          {
            uid: 100,
            subject: "Sujet mis à jour 100",
            text: "Texte mis à jour 100",
            flags: ["\\Seen"],
          },
        ]),
      );

      const state = await getMessagingMailboxLocalSyncState({
        userId,
        mailbox: "inbox",
      });
      const preservedMessage = await getMessagingLocalMessageByImapIdentity({
        userId,
        mailbox: "inbox",
        uidValidity: 9001,
        uid: 101,
      });
      const updatedMessage = await getMessagingLocalMessageByImapIdentity({
        userId,
        mailbox: "inbox",
        uidValidity: 9001,
        uid: 100,
      });
      const count = await prisma.messagingLocalMessage.count({
        where: {
          userId,
          mailbox: "INBOX",
          uidValidity: 9001,
        },
      });

      expect(degradedRun.status).toBe(MessagingLocalSyncStatus.DEGRADED);
      expect(degradedRun.syncedCount).toBe(1);
      expect(degradedRun.failedCount).toBe(1);
      expect(degradedRun.errors[0]?.uid).toBe(101);
      expect(state?.status).toBe(MessagingLocalSyncStatus.DEGRADED);
      expect(state?.lastError).toContain("UID 101");
      expect(count).toBe(2);
      expect(preservedMessage?.subject).toBe("Sujet stable 101");
      expect(updatedMessage).toMatchObject({
        uid: 100,
        subject: "Sujet mis à jour 100",
        seen: true,
      });
    },
    30000,
  );
});
