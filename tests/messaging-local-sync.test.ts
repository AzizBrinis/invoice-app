import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MessagingLocalSyncStatus } from "@prisma/client";

let prisma: (typeof import("@/lib/prisma"))["prisma"];
let getMessagingLocalSyncPreference: typeof import("@/server/messaging-local-sync")["getMessagingLocalSyncPreference"];
let getMessagingLocalSyncOverview: typeof import("@/server/messaging-local-sync")["getMessagingLocalSyncOverview"];
let setMessagingLocalSyncPreference: typeof import("@/server/messaging-local-sync")["setMessagingLocalSyncPreference"];
let getMessagingMailboxLocalSyncState: typeof import("@/server/messaging-local-sync")["getMessagingMailboxLocalSyncState"];
let getMessagingLocalMessageByUid: typeof import("@/server/messaging-local-sync")["getMessagingLocalMessageByUid"];
let listMessagingLocalMessages: typeof import("@/server/messaging-local-sync")["listMessagingLocalMessages"];
let listMessagingMailboxLocalSyncStates: typeof import("@/server/messaging-local-sync")["listMessagingMailboxLocalSyncStates"];
let searchMessagingLocalMessages: typeof import("@/server/messaging-local-sync")["searchMessagingLocalMessages"];
let clearMessagingLocalMailboxMessages: typeof import("@/server/messaging-local-sync")["clearMessagingLocalMailboxMessages"];
let purgeMessagingLocalSyncData: typeof import("@/server/messaging-local-sync")["purgeMessagingLocalSyncData"];
let projectSentMailboxAppendToLocal: typeof import("@/server/messaging-local-sync")["projectSentMailboxAppendToLocal"];
let applyMessagingLocalMoveProjection: typeof import("@/server/messaging-local-sync")["applyMessagingLocalMoveProjection"];
let updateMessagingLocalMessageSeenState: typeof import("@/server/messaging-local-sync")["updateMessagingLocalMessageSeenState"];
let markMessagingMailboxLocalSyncStateDegraded: typeof import("@/server/messaging-local-sync")["markMessagingMailboxLocalSyncStateDegraded"];
let upsertMessagingLocalMessage: typeof import("@/server/messaging-local-sync")["upsertMessagingLocalMessage"];
let upsertMessagingMailboxLocalSyncState: typeof import("@/server/messaging-local-sync")["upsertMessagingMailboxLocalSyncState"];

let alphaUserId: string;
let betaUserId: string;

const describeMessagingLocalSync = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeMessagingLocalSync("messaging local sync foundation", () => {
  beforeAll(async () => {
    const prismaModule = await import("@/lib/prisma");
    const localSyncModule = await import("@/server/messaging-local-sync");

    prisma = prismaModule.prisma;
    getMessagingLocalSyncPreference =
      localSyncModule.getMessagingLocalSyncPreference;
    getMessagingLocalSyncOverview =
      localSyncModule.getMessagingLocalSyncOverview;
    setMessagingLocalSyncPreference =
      localSyncModule.setMessagingLocalSyncPreference;
    getMessagingMailboxLocalSyncState =
      localSyncModule.getMessagingMailboxLocalSyncState;
    getMessagingLocalMessageByUid =
      localSyncModule.getMessagingLocalMessageByUid;
    listMessagingLocalMessages = localSyncModule.listMessagingLocalMessages;
    listMessagingMailboxLocalSyncStates =
      localSyncModule.listMessagingMailboxLocalSyncStates;
    searchMessagingLocalMessages =
      localSyncModule.searchMessagingLocalMessages;
    clearMessagingLocalMailboxMessages =
      localSyncModule.clearMessagingLocalMailboxMessages;
    purgeMessagingLocalSyncData =
      localSyncModule.purgeMessagingLocalSyncData;
    projectSentMailboxAppendToLocal =
      localSyncModule.projectSentMailboxAppendToLocal;
    applyMessagingLocalMoveProjection =
      localSyncModule.applyMessagingLocalMoveProjection;
    updateMessagingLocalMessageSeenState =
      localSyncModule.updateMessagingLocalMessageSeenState;
    markMessagingMailboxLocalSyncStateDegraded =
      localSyncModule.markMessagingMailboxLocalSyncStateDegraded;
    upsertMessagingLocalMessage = localSyncModule.upsertMessagingLocalMessage;
    upsertMessagingMailboxLocalSyncState =
      localSyncModule.upsertMessagingMailboxLocalSyncState;

    const timestamp = Date.now();

    const [alphaUser, betaUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `messaging-local-sync-alpha-${timestamp}@example.com`,
          passwordHash: "hashed",
          name: "Messaging Local Sync Alpha",
        },
      }),
      prisma.user.create({
        data: {
          email: `messaging-local-sync-beta-${timestamp}@example.com`,
          passwordHash: "hashed",
          name: "Messaging Local Sync Beta",
        },
      }),
    ]);

    alphaUserId = alphaUser.id;
    betaUserId = betaUser.id;
  });

  afterAll(async () => {
    const userIds = [alphaUserId, betaUserId].filter(Boolean);
    if (!userIds.length) {
      return;
    }

    await prisma.messagingLocalMessage.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });
    await prisma.messagingMailboxLocalSyncState.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });
    await prisma.messagingSettings.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  });

  it("keeps the local sync preference disabled by default and scoped per account", async () => {
    await expect(getMessagingLocalSyncPreference(alphaUserId)).resolves.toBe(
      false,
    );
    await expect(getMessagingLocalSyncPreference(betaUserId)).resolves.toBe(
      false,
    );

    await expect(
      setMessagingLocalSyncPreference(true, alphaUserId),
    ).resolves.toEqual({
      userId: alphaUserId,
      localSyncEnabled: true,
    });

    await expect(getMessagingLocalSyncPreference(alphaUserId)).resolves.toBe(
      true,
    );
    await expect(getMessagingLocalSyncPreference(betaUserId)).resolves.toBe(
      false,
    );
  });

  it("builds a mailbox overview suitable for settings and mailbox status surfaces", async () => {
    await purgeMessagingLocalSyncData({
      userId: alphaUserId,
    });
    await setMessagingLocalSyncPreference(true, alphaUserId);
    await upsertMessagingMailboxLocalSyncState({
      userId: alphaUserId,
      mailbox: "inbox",
      remotePath: "INBOX",
      uidValidity: 700,
      status: MessagingLocalSyncStatus.READY,
      localMessageCount: 12,
      remoteMessageCount: 20,
      lastSuccessfulSyncAt: "2026-03-26T10:00:00.000Z",
    });

    const overview = await getMessagingLocalSyncOverview(alphaUserId);
    const inbox = overview.mailboxes.find((mailbox) => mailbox.mailbox === "inbox");
    const sent = overview.mailboxes.find((mailbox) => mailbox.mailbox === "sent");

    expect(overview).toMatchObject({
      enabled: true,
      serverEnabled: true,
      active: true,
      mode: "local-partial",
      anyReadable: true,
      allReadable: false,
      allBackfilled: false,
      lastSuccessfulSyncAt: "2026-03-26T10:00:00.000Z",
    });
    expect(inbox).toMatchObject({
      status: MessagingLocalSyncStatus.READY,
      readable: true,
      bootstrapComplete: true,
      backfillComplete: false,
      progressPercent: 60,
    });
    expect(sent?.status).toBe(MessagingLocalSyncStatus.DISABLED);
  });

  it("stores mailbox sync state per account and preserves the unique mailbox identity", async () => {
    await upsertMessagingMailboxLocalSyncState({
      userId: alphaUserId,
      mailbox: "inbox",
      remotePath: "INBOX",
      uidValidity: 42,
      lastSyncedUid: 100,
      status: MessagingLocalSyncStatus.BOOTSTRAPPING,
    });

    await upsertMessagingMailboxLocalSyncState({
      userId: alphaUserId,
      mailbox: "inbox",
      lastSyncedUid: 120,
      status: MessagingLocalSyncStatus.READY,
    });

    await upsertMessagingMailboxLocalSyncState({
      userId: betaUserId,
      mailbox: "inbox",
      remotePath: "INBOX",
      uidValidity: 11,
      lastSyncedUid: 5,
      status: MessagingLocalSyncStatus.ERROR,
      lastError: "Temporary IMAP failure",
    });

    const alphaStates = await listMessagingMailboxLocalSyncStates(alphaUserId);
    const betaState = await getMessagingMailboxLocalSyncState({
      userId: betaUserId,
      mailbox: "inbox",
    });

    expect(alphaStates).toHaveLength(1);
    expect(alphaStates[0]).toMatchObject({
      userId: alphaUserId,
      mailbox: "inbox",
      remotePath: "INBOX",
      uidValidity: 42,
      lastSyncedUid: 120,
      status: MessagingLocalSyncStatus.READY,
    });
    expect(betaState).toMatchObject({
      userId: betaUserId,
      mailbox: "inbox",
      remotePath: "INBOX",
      uidValidity: 11,
      lastSyncedUid: 5,
      status: MessagingLocalSyncStatus.ERROR,
      lastError: "Temporary IMAP failure",
    });

    const alphaStateCount = await prisma.messagingMailboxLocalSyncState.count({
      where: {
        userId: alphaUserId,
        mailbox: "INBOX",
      },
    });

    expect(alphaStateCount).toBe(1);
  });

  it(
    "updates an existing local message instead of duplicating it and keeps mailbox records isolated per account",
    async () => {
      await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "inbox",
        remotePath: "INBOX",
        uidValidity: 42,
        uid: 7001,
        messageId: "<alpha-7001@example.com>",
        subject: "First local sync subject",
        fromAddress: "sender@example.com",
        previewText: "Initial preview",
        normalizedText: "Initial normalized text",
        lastSyncedAt: "2026-03-26T09:00:00.000Z",
        attachments: [
          {
            attachmentId: "part-1",
            filename: "invoice.pdf",
            contentType: "application/pdf",
            size: 1234,
          },
        ],
      });

      const updatedAlphaMessage = await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "inbox",
        uidValidity: 42,
        uid: 7001,
        subject: "Updated local sync subject",
        seen: true,
      });

      await upsertMessagingLocalMessage({
        userId: betaUserId,
        mailbox: "inbox",
        remotePath: "INBOX",
        uidValidity: 42,
        uid: 7001,
        messageId: "<beta-7001@example.com>",
        subject: "Beta tenant message",
      });

      const alphaMessages = await listMessagingLocalMessages({
        userId: alphaUserId,
        mailbox: "inbox",
      });
      const betaMessages = await listMessagingLocalMessages({
        userId: betaUserId,
        mailbox: "inbox",
      });

      expect(updatedAlphaMessage).toMatchObject({
        userId: alphaUserId,
        mailbox: "inbox",
        remotePath: "INBOX",
        uidValidity: 42,
        uid: 7001,
        subject: "Updated local sync subject",
        seen: true,
        normalizedText: "Initial normalized text",
      });
      expect(updatedAlphaMessage.attachments).toHaveLength(1);
      expect(updatedAlphaMessage.attachments[0]).toMatchObject({
        attachmentId: "part-1",
        filename: "invoice.pdf",
      });

      expect(alphaMessages.total).toBe(1);
      expect(alphaMessages.items[0]?.subject).toBe(
        "Updated local sync subject",
      );
      expect(betaMessages.total).toBe(1);
      expect(betaMessages.items[0]?.subject).toBe("Beta tenant message");

      const alphaMessageCount = await prisma.messagingLocalMessage.count({
        where: {
          userId: alphaUserId,
          mailbox: "INBOX",
          uidValidity: 42,
          uid: 7001,
        },
      });

      expect(alphaMessageCount).toBe(1);
    },
    30000,
  );

  it("deduplicates duplicate attachment ids inside one local message write", async () => {
    const storedMessage = await upsertMessagingLocalMessage({
      userId: alphaUserId,
      mailbox: "inbox",
      remotePath: "INBOX",
      uidValidity: 84,
      uid: 9001,
      subject: "Duplicate attachment ids",
      attachments: [
        {
          attachmentId: "part-1",
          filename: "invoice-a.pdf",
          contentType: "application/pdf",
          size: 1234,
        },
        {
          attachmentId: "part-1",
          filename: "invoice-a-duplicate.pdf",
          contentType: "application/pdf",
          size: 1234,
        },
        {
          attachmentId: "part-2",
          filename: "invoice-b.pdf",
          contentType: "application/pdf",
          size: 4321,
        },
      ],
    });

    expect(storedMessage.attachments).toHaveLength(2);
    expect(
      storedMessage.attachments.map((attachment) => attachment.attachmentId),
    ).toEqual(["part-1", "part-2"]);
    expect(storedMessage.attachments[0]).toMatchObject({
      attachmentId: "part-1",
      filename: "invoice-a.pdf",
    });
  });

  it(
    "reads the current local message identity and tokenized search results from persisted data",
    async () => {
      await upsertMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "sent",
        remotePath: "Sent",
        uidValidity: 77,
        status: MessagingLocalSyncStatus.READY,
        remoteMessageCount: 2,
        localMessageCount: 2,
      });

      await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "sent",
        remotePath: "Sent",
        uidValidity: 76,
        uid: 9001,
        messageId: "<older-identity@example.com>",
        subject: "Ancienne version",
        fromAddress: "sales@example.com",
        normalizedText: "Version precedente de facture",
      });

      await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "sent",
        remotePath: "Sent",
        uidValidity: 77,
        uid: 9001,
        messageId: "<current-identity@example.com>",
        subject: "Facture client envoyee",
        fromAddress: "sales@example.com",
        normalizedText: "Facture envoyee au client principal",
      });

      await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "sent",
        remotePath: "Sent",
        uidValidity: 77,
        uid: 9002,
        messageId: "<other-message@example.com>",
        subject: "Relance fournisseur",
        fromAddress: "sales@example.com",
        normalizedText: "Suivi fournisseur secondaire",
      });

      const currentMessage = await getMessagingLocalMessageByUid({
        userId: alphaUserId,
        mailbox: "sent",
        uid: 9001,
      });
      const searchResults = await searchMessagingLocalMessages({
        userId: alphaUserId,
        mailbox: "sent",
        uidValidity: 77,
        query: "facture client",
        page: 1,
        pageSize: 20,
      });

      expect(currentMessage).toMatchObject({
        uidValidity: 77,
        uid: 9001,
        subject: "Facture client envoyee",
        messageId: "<current-identity@example.com>",
      });
      expect(searchResults.total).toBe(1);
      expect(searchResults.query).toBe("facture client");
      expect(searchResults.items[0]).toMatchObject({
        uidValidity: 77,
        uid: 9001,
        subject: "Facture client envoyee",
      });
    },
    30000,
  );

  it(
    "purges local sync messages and states idempotently without touching the preference row",
    async () => {
      await setMessagingLocalSyncPreference(false, alphaUserId);
      await purgeMessagingLocalSyncData({
        userId: alphaUserId,
      });
      await upsertMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "drafts",
        remotePath: "Drafts",
        uidValidity: 314,
        status: MessagingLocalSyncStatus.READY,
        localMessageCount: 1,
      });
      await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "drafts",
        remotePath: "Drafts",
        uidValidity: 314,
        uid: 19,
        messageId: "<draft-19@example.com>",
        subject: "Brouillon local",
      });

      const firstPurge = await purgeMessagingLocalSyncData({
        userId: alphaUserId,
      });
      const secondPurge = await purgeMessagingLocalSyncData({
        userId: alphaUserId,
      });
      const states = await listMessagingMailboxLocalSyncStates(alphaUserId);
      const messages = await listMessagingLocalMessages({
        userId: alphaUserId,
        mailbox: "drafts",
      });
      const localSyncEnabled = await getMessagingLocalSyncPreference(alphaUserId);

      expect(firstPurge.deletedMessages).toBe(1);
      expect(firstPurge.deletedStates).toBe(1);
      expect(secondPurge.deletedMessages).toBe(0);
      expect(secondPurge.deletedStates).toBe(0);
      expect(states).toHaveLength(0);
      expect(messages.total).toBe(0);
      expect(localSyncEnabled).toBe(false);
    },
    30000,
  );

  it(
    "projects sent append results into the local sent mailbox without duplicates and keeps state counts updated",
    async () => {
      await setMessagingLocalSyncPreference(true, alphaUserId);
      await clearMessagingLocalMailboxMessages({
        userId: alphaUserId,
        mailbox: "sent",
      });
      await upsertMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "sent",
        remotePath: "Sent",
        uidValidity: 501,
        status: MessagingLocalSyncStatus.READY,
        localMessageCount: 0,
      });

      await projectSentMailboxAppendToLocal({
        userId: alphaUserId,
        sentAppendResult: {
          message: {
            uid: 51,
            messageId: "<sent-51@example.com>",
            subject: "Facture envoyee",
            from: "Support <support@example.com>",
            to: ["Client <client@example.com>"],
            date: "2026-03-26T12:00:00.000Z",
            seen: true,
            hasAttachments: true,
            tracking: null,
          },
          totalMessages: 1,
          remotePath: "Sent",
          uidValidity: 501,
        },
        to: ["Client <client@example.com>"],
        subject: "Facture envoyee",
        text: "Bonjour,\nvoici votre facture.",
        html: "<p>Bonjour, voici votre facture.</p>",
        attachments: [
          {
            filename: "invoice.pdf",
            content: Buffer.from("pdf"),
            contentType: "application/pdf",
          },
        ],
        senderEmail: "support@example.com",
        senderName: "Support",
        sentAt: "2026-03-26T12:00:00.000Z",
      });

      await projectSentMailboxAppendToLocal({
        userId: alphaUserId,
        sentAppendResult: {
          message: {
            uid: 51,
            messageId: "<sent-51@example.com>",
            subject: "Facture envoyee mise a jour",
            from: "Support <support@example.com>",
            to: ["Client <client@example.com>"],
            date: "2026-03-26T12:00:00.000Z",
            seen: true,
            hasAttachments: true,
            tracking: null,
          },
          totalMessages: 1,
          remotePath: "Sent",
          uidValidity: 501,
        },
        to: ["Client <client@example.com>"],
        subject: "Facture envoyee mise a jour",
        text: "Bonjour,\nvoici votre facture mise a jour.",
        html: "<p>Bonjour, voici votre facture mise a jour.</p>",
        senderEmail: "support@example.com",
        senderName: "Support",
        sentAt: "2026-03-26T12:00:00.000Z",
      });

      const sentMessages = await listMessagingLocalMessages({
        userId: alphaUserId,
        mailbox: "sent",
        uidValidity: 501,
      });
      const sentState = await getMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "sent",
      });

      expect(sentMessages.total).toBe(1);
      expect(sentMessages.items[0]).toMatchObject({
        uid: 51,
        uidValidity: 501,
        messageId: "<sent-51@example.com>",
        subject: "Facture envoyee mise a jour",
        fromAddress: "support@example.com",
      });
      expect(sentMessages.items[0]?.attachments).toHaveLength(1);
      expect(sentState?.localMessageCount).toBe(1);
    },
    30000,
  );

  it(
    "moves a local message projection to the target mailbox using the mapped destination uid",
    async () => {
      await setMessagingLocalSyncPreference(true, alphaUserId);
      await clearMessagingLocalMailboxMessages({
        userId: alphaUserId,
        mailbox: "inbox",
      });
      await clearMessagingLocalMailboxMessages({
        userId: alphaUserId,
        mailbox: "trash",
      });
      await upsertMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "inbox",
        remotePath: "INBOX",
        uidValidity: 42,
        status: MessagingLocalSyncStatus.READY,
        localMessageCount: 1,
      });
      await upsertMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "trash",
        remotePath: "Trash",
        uidValidity: 77,
        status: MessagingLocalSyncStatus.READY,
        localMessageCount: 0,
      });
      await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "inbox",
        remotePath: "INBOX",
        uidValidity: 42,
        uid: 700,
        messageId: "<move-700@example.com>",
        subject: "Message a deplacer",
        fromAddress: "sender@example.com",
        normalizedText: "Texte original",
        sanitizedHtml: "<p>Texte original</p>",
        bodyState: "HTML_READY",
      });

      const firstMove = await applyMessagingLocalMoveProjection({
        userId: alphaUserId,
        mailbox: "inbox",
        target: "trash",
        uid: 700,
        sourceUidValidity: 42,
        targetUid: 1700,
        targetUidValidity: 77,
        targetPath: "Trash",
      });
      const secondMove = await applyMessagingLocalMoveProjection({
        userId: alphaUserId,
        mailbox: "inbox",
        target: "trash",
        uid: 700,
        sourceUidValidity: 42,
        targetUid: 1700,
        targetUidValidity: 77,
        targetPath: "Trash",
      });

      const inboxMessages = await listMessagingLocalMessages({
        userId: alphaUserId,
        mailbox: "inbox",
      });
      const trashMessages = await listMessagingLocalMessages({
        userId: alphaUserId,
        mailbox: "trash",
      });
      const inboxState = await getMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "inbox",
      });
      const trashState = await getMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "trash",
      });

      expect(firstMove).toMatchObject({
        moved: true,
        targetProjected: true,
      });
      expect(secondMove).toMatchObject({
        moved: false,
        targetProjected: false,
      });
      expect(inboxMessages.total).toBe(0);
      expect(trashMessages.total).toBe(1);
      expect(trashMessages.items[0]).toMatchObject({
        uid: 1700,
        uidValidity: 77,
        subject: "Message a deplacer",
      });
      expect(inboxState?.localMessageCount).toBe(0);
      expect(trashState?.localMessageCount).toBe(1);
    },
    30000,
  );

  it(
    "updates local seen state and marks the mailbox sync state degraded without deleting the message",
    async () => {
      await setMessagingLocalSyncPreference(true, alphaUserId);
      await clearMessagingLocalMailboxMessages({
        userId: alphaUserId,
        mailbox: "spam",
      });
      await upsertMessagingMailboxLocalSyncState({
        userId: alphaUserId,
        mailbox: "spam",
        remotePath: "Spam",
        uidValidity: 91,
        status: MessagingLocalSyncStatus.READY,
        localMessageCount: 1,
      });
      await upsertMessagingLocalMessage({
        userId: alphaUserId,
        mailbox: "spam",
        remotePath: "Spam",
        uidValidity: 91,
        uid: 9100,
        messageId: "<spam-9100@example.com>",
        subject: "A verifier",
        fromAddress: "suspicious@example.com",
        seen: false,
      });

      const seenUpdate = await updateMessagingLocalMessageSeenState({
        userId: alphaUserId,
        mailbox: "spam",
        uid: 9100,
        seen: true,
      });
      const degradedState = await markMessagingMailboxLocalSyncStateDegraded({
        userId: alphaUserId,
        mailbox: "spam",
        lastError: "Flag write-back failed",
      });
      const message = await getMessagingLocalMessageByUid({
        userId: alphaUserId,
        mailbox: "spam",
        uid: 9100,
        uidValidity: 91,
      });

      expect(seenUpdate.updated).toBe(true);
      expect(message?.seen).toBe(true);
      expect(degradedState).toMatchObject({
        status: MessagingLocalSyncStatus.DEGRADED,
        lastError: "Flag write-back failed",
      });
    },
    30000,
  );
});
