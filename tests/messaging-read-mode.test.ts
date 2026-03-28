import { describe, expect, it, vi } from "vitest";
import { __testables as readModeTestables } from "@/server/messaging-read-mode";
import { MessagingLocalSyncStatus } from "@prisma/client";
import type {
  Mailbox,
  MailboxPageResult,
  MailboxSearchResult,
  MessageDetail,
} from "@/server/messaging";
import type {
  MessagingLocalMessageRecord,
  MessagingMailboxLocalSyncStateRecord,
} from "@/server/messaging-local-sync";

type ReadModeRuntime = Parameters<
  typeof readModeTestables.readMailboxPageWithRuntime
>[1];

function createMailboxState(
  overrides: Partial<MessagingMailboxLocalSyncStateRecord> = {},
): MessagingMailboxLocalSyncStateRecord {
  return {
    id: "state-1",
    userId: "user-1",
    mailbox: "inbox",
    remotePath: "INBOX",
    uidValidity: 42,
    lastKnownUidNext: 121,
    lastSyncedUid: 120,
    lastBackfilledUid: null,
    remoteMessageCount: 120,
    localMessageCount: 75,
    status: MessagingLocalSyncStatus.READY,
    lastSuccessfulSyncAt: "2026-03-26T09:30:00.000Z",
    lastAttemptedSyncAt: "2026-03-26T09:30:00.000Z",
    lastFullResyncAt: null,
    lastError: null,
    createdAt: "2026-03-26T09:00:00.000Z",
    updatedAt: "2026-03-26T09:30:00.000Z",
    ...overrides,
  };
}

function createLocalMessage(
  overrides: Partial<MessagingLocalMessageRecord> = {},
): MessagingLocalMessageRecord {
  return {
    id: "local-message-1",
    userId: "user-1",
    mailbox: "inbox",
    remotePath: "INBOX",
    uidValidity: 42,
    uid: 100,
    messageId: "<message-100@example.com>",
    subject: "Sujet local",
    fromLabel: "Alice Example <alice@example.com>",
    fromAddress: "alice@example.com",
    toRecipients: [
      {
        name: "Support",
        address: "support@example.com",
        label: "Support <support@example.com>",
      },
    ],
    ccRecipients: [],
    bccRecipients: [],
    replyToRecipients: [],
    internalDate: "2026-03-26T10:00:00.000Z",
    sentAt: "2026-03-26T10:00:00.000Z",
    seen: false,
    answered: false,
    flagged: false,
    draft: false,
    hasAttachments: true,
    previewText: "Apercu local",
    normalizedText: "Texte local detail",
    sanitizedHtml: "<p>Texte local detail</p>",
    searchText: "Sujet local Alice Example support@example.com",
    bodyState: "HTML_READY",
    lastSyncedAt: "2026-03-26T10:05:00.000Z",
    hydratedAt: "2026-03-26T10:05:00.000Z",
    createdAt: "2026-03-26T10:00:00.000Z",
    updatedAt: "2026-03-26T10:05:00.000Z",
    attachments: [
      {
        id: "attachment-record-1",
        attachmentId: "part-1",
        filename: "invoice.pdf",
        contentType: "application/pdf",
        size: 1234,
        contentId: null,
        contentLocation: null,
        inline: false,
        cachedBlobKey: null,
        cachedAt: null,
        createdAt: "2026-03-26T10:00:00.000Z",
        updatedAt: "2026-03-26T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function createLivePageResult(
  mailbox: Mailbox,
  overrides: Partial<MailboxPageResult> = {},
): MailboxPageResult {
  return {
    mailbox,
    page: 1,
    pageSize: 20,
    totalMessages: 1,
    hasMore: false,
    messages: [
      {
        uid: 900,
        messageId: "<live-900@example.com>",
        subject: "Sujet IMAP",
        from: "Live Sender <live@example.com>",
        to: ["support@example.com"],
        date: "2026-03-26T11:00:00.000Z",
        seen: true,
        hasAttachments: false,
        tracking: null,
      },
    ],
    ...overrides,
  };
}

function createLiveSearchResult(
  mailbox: "inbox" | "sent",
  overrides: Partial<MailboxSearchResult> = {},
): MailboxSearchResult {
  return {
    mailbox,
    query: "live query",
    page: 1,
    pageSize: 20,
    totalMessages: 1,
    hasMore: false,
    messages: createLivePageResult(mailbox).messages,
    ...overrides,
  };
}

function createLiveDetail(
  mailbox: Mailbox,
  overrides: Partial<MessageDetail> = {},
): MessageDetail {
  return {
    mailbox,
    uid: 900,
    messageId: "<live-900@example.com>",
    subject: "Sujet detail IMAP",
    from: "Live Sender <live@example.com>",
    to: ["support@example.com"],
    cc: [],
    bcc: [],
    replyTo: [],
    date: "2026-03-26T11:00:00.000Z",
    seen: true,
    html: "<p>Live body</p>",
    text: "Live body",
    attachments: [],
    fromAddress: {
      name: "Live Sender",
      address: "live@example.com",
    },
    toAddresses: [
      {
        name: "Support",
        address: "support@example.com",
      },
    ],
    ccAddresses: [],
    bccAddresses: [],
    replyToAddresses: [],
    tracking: null,
    ...overrides,
  };
}

function createRuntime(options?: {
  localSyncEnabled?: boolean;
  serverEnabled?: boolean;
  state?: MessagingMailboxLocalSyncStateRecord | null;
  localPageItems?: MessagingLocalMessageRecord[];
  localDetail?: MessagingLocalMessageRecord | null;
  localSearchItems?: MessagingLocalMessageRecord[];
  livePageResult?: MailboxPageResult;
  liveSearchResult?: MailboxSearchResult;
  liveDetailResult?: MessageDetail;
}): ReadModeRuntime {
  const localSyncEnabled = options?.localSyncEnabled ?? false;
  const serverEnabled = options?.serverEnabled ?? true;
  const state = options?.state ?? null;
  const localPageItems = options?.localPageItems ?? [];
  const localDetail = options?.localDetail ?? null;
  const localSearchItems = options?.localSearchItems ?? [];
  const livePageResult = options?.livePageResult ?? createLivePageResult("inbox");
  const liveSearchResult =
    options?.liveSearchResult ?? createLiveSearchResult("inbox");
  const liveDetailResult =
    options?.liveDetailResult ?? createLiveDetail("inbox");

  return {
    resolveUserId: vi.fn(async () => "user-1"),
    fetchMailboxMessages: vi.fn(async () => livePageResult),
    searchMailboxMessages: vi.fn(async () => liveSearchResult),
    fetchMessageDetail: vi.fn(async () => liveDetailResult),
    getMessagingLocalSyncPreference: vi.fn(async () => localSyncEnabled),
    isMessagingLocalSyncServerEnabled: vi.fn(() => serverEnabled),
    getMessagingMailboxLocalSyncState: vi.fn(async () => state),
    listMessagingLocalMessageSummaries: vi.fn(async ({ page, pageSize }) => ({
      items: localPageItems,
      total: localPageItems.length,
      page: page ?? 1,
      pageSize: pageSize ?? 20,
    })),
    getMessagingLocalMessageByUid: vi.fn(async () => localDetail),
    searchMessagingLocalMessageSummaries: vi.fn(async ({ query, page, pageSize }) => ({
      items: localSearchItems,
      total: localSearchItems.length,
      page: page ?? 1,
      pageSize: pageSize ?? 20,
      query,
    })),
    hydrateMessagingLocalMessageFromDetail: vi.fn(async ({ detail }) =>
      createLocalMessage({
        normalizedText: detail.text ?? null,
        sanitizedHtml: detail.html ?? null,
        bodyState: detail.html
          ? "HTML_READY"
          : detail.text
            ? "TEXT_READY"
            : "NONE",
      })
    ),
    recordMessagingLocalSyncFallback: vi.fn(),
    recordMessagingLocalSyncHydration: vi.fn(),
    getEmailTrackingSummaries: vi.fn(async () => new Map()),
    getEmailTrackingDetail: vi.fn(async () => null),
  };
}

describe("messaging read mode", () => {
  it("keeps the live IMAP page path when local sync is disabled", async () => {
    const runtime = createRuntime({
      localSyncEnabled: false,
    });

    const result = await readModeTestables.readMailboxPageWithRuntime(
      {
        mailbox: "inbox",
        page: 1,
        pageSize: 20,
      },
      runtime,
    );

    expect(result).toEqual(createLivePageResult("inbox"));
    expect(runtime.fetchMailboxMessages).toHaveBeenCalledOnce();
    expect(runtime.listMessagingLocalMessageSummaries).not.toHaveBeenCalled();
  });

  it("uses local mailbox pages for ready recent-window reads and preserves sent tracking", async () => {
    const localSentMessage = createLocalMessage({
      mailbox: "sent",
      remotePath: "Sent",
      uid: 88,
      messageId: "<sent-88@example.com>",
      subject: "Sent local subject",
    });
    const runtime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState({
        mailbox: "sent",
        remotePath: "Sent",
        remoteMessageCount: 120,
        localMessageCount: 75,
        status: MessagingLocalSyncStatus.READY,
      }),
      localPageItems: [localSentMessage],
      livePageResult: createLivePageResult("sent"),
    });
    (runtime.getEmailTrackingSummaries as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([
        [
          "<sent-88@example.com>",
          {
            emailId: "tracked-email-1",
            messageId: "<sent-88@example.com>",
            trackingEnabled: true,
            sentAt: "2026-03-26T10:00:00.000Z",
            subject: "Sent local subject",
            totalOpens: 3,
            totalClicks: 1,
            recipients: [],
          },
        ],
      ]),
    );

    const result = await readModeTestables.readMailboxPageWithRuntime(
      {
        mailbox: "sent",
        page: 1,
        pageSize: 20,
      },
      runtime,
    );

    expect(runtime.fetchMailboxMessages).not.toHaveBeenCalled();
    expect(runtime.listMessagingLocalMessageSummaries).toHaveBeenCalledOnce();
    expect(result.messages).toEqual([
      expect.objectContaining({
        uid: 88,
        subject: "Sent local subject",
        tracking: {
          enabled: true,
          totalOpens: 3,
          totalClicks: 1,
        },
      }),
    ]);
  });

  it("falls back to IMAP pages when the requested page is outside guaranteed local coverage", async () => {
    const runtime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState({
        remoteMessageCount: 120,
        localMessageCount: 75,
        status: MessagingLocalSyncStatus.READY,
      }),
    });

    const result = await readModeTestables.readMailboxPageWithRuntime(
      {
        mailbox: "inbox",
        page: 5,
        pageSize: 20,
      },
      runtime,
    );

    expect(result).toEqual(createLivePageResult("inbox"));
    expect(runtime.fetchMailboxMessages).toHaveBeenCalledOnce();
    expect(runtime.listMessagingLocalMessageSummaries).not.toHaveBeenCalled();
    expect(runtime.recordMessagingLocalSyncFallback).toHaveBeenCalledWith({
      userId: "user-1",
      mailbox: "inbox",
      operation: "page",
      reason: "page-coverage-incomplete",
    });
  });

  it("forces the live path when the server rollout guard disables local sync", async () => {
    const runtime = createRuntime({
      localSyncEnabled: true,
      serverEnabled: false,
      state: createMailboxState(),
    });

    const result = await readModeTestables.readMailboxPageWithRuntime(
      {
        mailbox: "inbox",
        page: 1,
        pageSize: 20,
      },
      runtime,
    );

    expect(result).toEqual(createLivePageResult("inbox"));
    expect(runtime.fetchMailboxMessages).toHaveBeenCalledOnce();
    expect(runtime.listMessagingLocalMessageSummaries).not.toHaveBeenCalled();
    expect(runtime.recordMessagingLocalSyncFallback).toHaveBeenCalledWith({
      userId: "user-1",
      mailbox: "inbox",
      operation: "page",
      reason: "server-disabled",
    });
  });

  it("keeps mailbox pages local when the mailbox is degraded but the page is still locally covered", async () => {
    const runtime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState({
        status: MessagingLocalSyncStatus.DEGRADED,
      }),
      localPageItems: [createLocalMessage()],
    });

    const result = await readModeTestables.readMailboxPageWithRuntime(
      {
        mailbox: "inbox",
        page: 1,
        pageSize: 20,
      },
      runtime,
    );

    expect(runtime.fetchMailboxMessages).not.toHaveBeenCalled();
    expect(runtime.listMessagingLocalMessageSummaries).toHaveBeenCalledOnce();
    expect(result.messages[0]).toEqual(
      expect.objectContaining({
        uid: 100,
        subject: "Sujet local",
      }),
    );
  });

  it("uses local detail when a readable local record is present and falls back when it is missing", async () => {
    const runtime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState({
        status: MessagingLocalSyncStatus.DEGRADED,
      }),
      localDetail: createLocalMessage(),
      liveDetailResult: createLiveDetail("inbox"),
    });

    const localResult = await readModeTestables.readMessageDetailWithRuntime(
      {
        mailbox: "inbox",
        uid: 100,
      },
      runtime,
    );

    expect(runtime.fetchMessageDetail).not.toHaveBeenCalled();
    expect(localResult).toEqual(
      expect.objectContaining({
        mailbox: "inbox",
        uid: 100,
        subject: "Sujet local",
        text: "Texte local detail",
        html: "<p>Texte local detail</p>",
        attachments: [
          {
            id: "part-1",
            filename: "invoice.pdf",
            contentType: "application/pdf",
            size: 1234,
          },
        ],
      }),
    );

    (runtime.getMessagingLocalMessageByUid as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createLocalMessage({
        normalizedText: null,
        sanitizedHtml: null,
        bodyState: "NONE",
      }),
    );

    const fallbackResult =
      await readModeTestables.readMessageDetailWithRuntime(
        {
          mailbox: "inbox",
          uid: 100,
        },
        runtime,
      );

    expect(runtime.fetchMessageDetail).toHaveBeenCalledOnce();
    expect(fallbackResult).toEqual(createLiveDetail("inbox"));
  });

  it("hydrates an incomplete local detail once and uses the hydrated local record afterwards", async () => {
    let localDetailRecord = createLocalMessage({
      uid: 101,
      normalizedText: null,
      sanitizedHtml: null,
      bodyState: "NONE",
    });
    const liveDetail = createLiveDetail("inbox", {
      uid: 101,
      messageId: "<hydrated-101@example.com>",
      subject: "Hydrated detail",
      text: "Hydrated text",
      html: "<p>Hydrated text</p>",
    });
    const runtime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState(),
      localDetail: localDetailRecord,
      liveDetailResult: liveDetail,
    });

    (
      runtime.getMessagingLocalMessageByUid as ReturnType<typeof vi.fn>
    ).mockImplementation(async () => localDetailRecord);
    (
      runtime.hydrateMessagingLocalMessageFromDetail as ReturnType<
        typeof vi.fn
      >
    ).mockImplementation(async ({ detail }) => {
      localDetailRecord = createLocalMessage({
        uid: 101,
        messageId: detail.messageId,
        subject: detail.subject,
        normalizedText: detail.text ?? null,
        sanitizedHtml: detail.html ?? null,
        bodyState: detail.html ? "HTML_READY" : "TEXT_READY",
      });
      return localDetailRecord;
    });

    const firstResult = await readModeTestables.readMessageDetailWithRuntime(
      {
        mailbox: "inbox",
        uid: 101,
      },
      runtime,
    );
    const secondResult = await readModeTestables.readMessageDetailWithRuntime(
      {
        mailbox: "inbox",
        uid: 101,
      },
      runtime,
    );

    expect(firstResult).toEqual(liveDetail);
    expect(secondResult).toEqual(
      expect.objectContaining({
        uid: 101,
        subject: "Hydrated detail",
        text: "Hydrated text",
        html: "<p>Hydrated text</p>",
      }),
    );
    expect(runtime.fetchMessageDetail).toHaveBeenCalledOnce();
    expect(
      runtime.hydrateMessagingLocalMessageFromDetail,
    ).toHaveBeenCalledOnce();
    expect(runtime.recordMessagingLocalSyncHydration).toHaveBeenCalledWith({
      userId: "user-1",
      mailbox: "inbox",
      uid: 101,
      attachmentCount: 0,
    });
  });

  it("uses local search only when the mailbox coverage is complete", async () => {
    const runtime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState({
        mailbox: "sent",
        remotePath: "Sent",
        remoteMessageCount: 40,
        localMessageCount: 40,
        status: MessagingLocalSyncStatus.DEGRADED,
      }),
      localSearchItems: [
        createLocalMessage({
          mailbox: "sent",
          remotePath: "Sent",
          uid: 55,
          messageId: "<sent-search@example.com>",
          subject: "Facture envoyee",
        }),
      ],
      liveSearchResult: createLiveSearchResult("sent"),
    });

    const localResult = await readModeTestables.readMailboxSearchWithRuntime(
      {
        mailbox: "sent",
        query: "  facture envoyee  ",
        page: 1,
        pageSize: 20,
      },
      runtime,
    );

    expect(runtime.searchMessagingLocalMessageSummaries).toHaveBeenCalledOnce();
    expect(runtime.searchMailboxMessages).not.toHaveBeenCalled();
    expect(localResult).toEqual(
      expect.objectContaining({
        mailbox: "sent",
        query: "facture envoyee",
        totalMessages: 1,
      }),
    );

    const incompleteRuntime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState({
        remoteMessageCount: 120,
        localMessageCount: 75,
        status: MessagingLocalSyncStatus.READY,
      }),
      liveSearchResult: createLiveSearchResult("inbox"),
    });

    const fallbackResult =
      await readModeTestables.readMailboxSearchWithRuntime(
        {
          mailbox: "inbox",
          query: "facture",
          page: 1,
          pageSize: 20,
        },
        incompleteRuntime,
      );

    expect(incompleteRuntime.searchMailboxMessages).toHaveBeenCalledOnce();
    expect(
      incompleteRuntime.searchMessagingLocalMessageSummaries,
    ).not.toHaveBeenCalled();
    expect(fallbackResult).toEqual(createLiveSearchResult("inbox"));
    expect(incompleteRuntime.recordMessagingLocalSyncFallback).toHaveBeenCalledWith({
      userId: "user-1",
      mailbox: "inbox",
      operation: "search",
      reason: "search-coverage-incomplete",
    });
  });

  it("signals snapshot refresh for locally readable mailboxes", async () => {
    const readableRuntime = createRuntime({
      localSyncEnabled: true,
      state: createMailboxState({
        status: MessagingLocalSyncStatus.DEGRADED,
      }),
    });

    await expect(
      readModeTestables.shouldUseSnapshotRefreshWithRuntime(
        {
          mailbox: "inbox",
        },
        readableRuntime,
      ),
    ).resolves.toBe(true);

    const liveRuntime = createRuntime({
      localSyncEnabled: false,
    });

    await expect(
      readModeTestables.shouldUseSnapshotRefreshWithRuntime(
        {
          mailbox: "inbox",
        },
        liveRuntime,
      ),
    ).resolves.toBe(false);
  });
});
