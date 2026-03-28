import {
  getEmailTrackingDetail,
  getEmailTrackingSummaries,
} from "@/server/email-tracking";
import {
  fetchMailboxMessages,
  fetchMessageDetail,
  resolveUserId,
  searchMailboxMessages,
  type Mailbox,
  type MailboxListItem,
  type MailboxPageResult,
  type MailboxSearchResult,
  type MessageDetail,
  type MessageParticipant,
} from "@/server/messaging";
import {
  hydrateMessagingLocalMessageFromDetail,
  MESSAGING_LOCAL_SYNC_POLICY,
  getMessagingLocalMessageByUid,
  getMessagingLocalSyncPreference,
  getMessagingMailboxLocalSyncState,
  isMessagingMailboxLocalSyncReadable,
  listMessagingLocalMessageSummaries,
  searchMessagingLocalMessageSummaries,
  type MessagingLocalMessageRecord,
  type MessagingLocalMessageSummaryRecord,
  type MessagingLocalParticipant,
  type MessagingMailboxLocalSyncStateRecord,
} from "@/server/messaging-local-sync";
import {
  isMessagingLocalSyncServerEnabled,
  recordMessagingLocalSyncActionObservation,
  recordMessagingLocalSyncFallback,
  recordMessagingLocalSyncHydration,
} from "@/server/messaging-local-sync-ops";
import {
  normalizeMailboxSearchQuery,
  type SearchableMailbox,
} from "@/lib/messaging/mailbox-search";

const DEFAULT_RECENT_WINDOW_PAGE_SIZE =
  MESSAGING_LOCAL_SYNC_POLICY.recentWindowSizeDefault;

type MessagingReadModeRuntime = {
  resolveUserId: typeof resolveUserId;
  fetchMailboxMessages: typeof fetchMailboxMessages;
  searchMailboxMessages: typeof searchMailboxMessages;
  fetchMessageDetail: typeof fetchMessageDetail;
  getMessagingLocalSyncPreference: typeof getMessagingLocalSyncPreference;
  isMessagingLocalSyncServerEnabled: typeof isMessagingLocalSyncServerEnabled;
  getMessagingMailboxLocalSyncState: typeof getMessagingMailboxLocalSyncState;
  listMessagingLocalMessageSummaries: typeof listMessagingLocalMessageSummaries;
  getMessagingLocalMessageByUid: typeof getMessagingLocalMessageByUid;
  searchMessagingLocalMessageSummaries: typeof searchMessagingLocalMessageSummaries;
  hydrateMessagingLocalMessageFromDetail: typeof hydrateMessagingLocalMessageFromDetail;
  recordMessagingLocalSyncFallback: typeof recordMessagingLocalSyncFallback;
  recordMessagingLocalSyncHydration: typeof recordMessagingLocalSyncHydration;
  getEmailTrackingSummaries: typeof getEmailTrackingSummaries;
  getEmailTrackingDetail: typeof getEmailTrackingDetail;
};

const defaultMessagingReadModeRuntime: MessagingReadModeRuntime = {
  resolveUserId,
  fetchMailboxMessages,
  searchMailboxMessages,
  fetchMessageDetail,
  getMessagingLocalSyncPreference,
  isMessagingLocalSyncServerEnabled,
  getMessagingMailboxLocalSyncState,
  listMessagingLocalMessageSummaries,
  getMessagingLocalMessageByUid,
  searchMessagingLocalMessageSummaries,
  hydrateMessagingLocalMessageFromDetail,
  recordMessagingLocalSyncFallback,
  recordMessagingLocalSyncHydration,
  getEmailTrackingSummaries,
  getEmailTrackingDetail,
};

type MailboxReadContext = {
  userId: string;
  localSyncEnabled: boolean;
  serverEnabled: boolean;
  state: MessagingMailboxLocalSyncStateRecord | null;
  localReadable: boolean;
  localPageReadable: boolean;
  localSearchReadable: boolean;
};

function hasFullLocalMailboxCoverage(
  state: MessagingMailboxLocalSyncStateRecord,
): boolean {
  if (state.remoteMessageCount === 0) {
    return true;
  }
  if (
    typeof state.remoteMessageCount !== "number" ||
    typeof state.localMessageCount !== "number"
  ) {
    return false;
  }
  return state.localMessageCount >= state.remoteMessageCount;
}

function isMailboxStateLocalReadable(
  state: MessagingMailboxLocalSyncStateRecord | null,
): state is MessagingMailboxLocalSyncStateRecord {
  return state ? isMessagingMailboxLocalSyncReadable(state) : false;
}

function canReadMailboxPageLocally(
  state: MessagingMailboxLocalSyncStateRecord,
  page: number,
  pageSize: number,
): boolean {
  if (!isMailboxStateLocalReadable(state)) {
    return false;
  }
  if (hasFullLocalMailboxCoverage(state)) {
    return true;
  }
  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.max(1, pageSize);
  return normalizedPage * normalizedPageSize <= DEFAULT_RECENT_WINDOW_PAGE_SIZE;
}

function canSearchMailboxLocally(
  state: MessagingMailboxLocalSyncStateRecord,
): boolean {
  if (!isMailboxStateLocalReadable(state)) {
    return false;
  }
  return hasFullLocalMailboxCoverage(state);
}

async function resolveMailboxReadContextWithRuntime(
  params: {
    mailbox: Mailbox;
    userId?: string;
    page?: number;
    pageSize?: number;
    requiresSearchCoverage?: boolean;
  },
  runtime: MessagingReadModeRuntime,
): Promise<MailboxReadContext> {
  const userId = await runtime.resolveUserId(params.userId);
  const localSyncEnabled = await runtime.getMessagingLocalSyncPreference(userId);
  const serverEnabled = runtime.isMessagingLocalSyncServerEnabled();
  if (!localSyncEnabled) {
    return {
      userId,
      localSyncEnabled,
      serverEnabled,
      state: null,
      localReadable: false,
      localPageReadable: false,
      localSearchReadable: false,
    };
  }

  if (!serverEnabled) {
    return {
      userId,
      localSyncEnabled,
      serverEnabled,
      state: null,
      localReadable: false,
      localPageReadable: false,
      localSearchReadable: false,
    };
  }

  const state = await runtime.getMessagingMailboxLocalSyncState({
    userId,
    mailbox: params.mailbox,
  });
  const localReadable = state ? isMessagingMailboxLocalSyncReadable(state) : false;
  const localPageReadable =
    localReadable &&
    Boolean(
      state &&
        canReadMailboxPageLocally(
          state,
          params.page ?? 1,
          params.pageSize ?? 20,
        ),
    );
  const localSearchReadable =
    localReadable &&
    Boolean(
      state &&
        (!params.requiresSearchCoverage || canSearchMailboxLocally(state)),
    );

  return {
    userId,
    localSyncEnabled,
    serverEnabled,
    state,
    localReadable,
    localPageReadable,
    localSearchReadable,
  };
}

function recordFallbackIfNeeded(
  runtime: MessagingReadModeRuntime,
  context: MailboxReadContext,
  mailbox: Mailbox,
  operation: "page" | "detail" | "snapshot",
  reason:
    | "server-disabled"
    | "mailbox-unreadable"
    | "page-coverage-incomplete"
    | "message-missing"
    | "body-missing",
) {
  if (!context.localSyncEnabled) {
    return;
  }
  runtime.recordMessagingLocalSyncFallback({
    userId: context.userId,
    mailbox,
    operation,
    reason,
  });
}

function recordSearchFallbackIfNeeded(
  runtime: MessagingReadModeRuntime,
  context: MailboxReadContext,
  mailbox: SearchableMailbox,
  reason:
    | "server-disabled"
    | "mailbox-unreadable"
    | "search-coverage-incomplete",
) {
  if (!context.localSyncEnabled) {
    return;
  }
  runtime.recordMessagingLocalSyncFallback({
    userId: context.userId,
    mailbox,
    operation: "search",
    reason,
  });
}

function formatLocalParticipantLabel(
  participant: MessagingLocalParticipant,
): string | null {
  const label = participant.label?.trim();
  if (label) {
    return label;
  }
  const name = participant.name?.trim();
  const address = participant.address?.trim();
  if (name && address) {
    return `${name} <${address}>`;
  }
  return address ?? name ?? null;
}

function toParticipantLabels(
  participants: MessagingLocalParticipant[],
): string[] {
  return participants
    .map((participant) => formatLocalParticipantLabel(participant))
    .filter((value): value is string => Boolean(value));
}

function inferParticipantName(
  label: string | null | undefined,
  address: string | null | undefined,
): string | null {
  const normalizedLabel = label?.trim();
  const normalizedAddress = address?.trim();
  if (!normalizedLabel) {
    return null;
  }
  if (!normalizedAddress || normalizedLabel === normalizedAddress) {
    return null;
  }
  const suffix = `<${normalizedAddress}>`;
  if (normalizedLabel.endsWith(suffix)) {
    const name = normalizedLabel.slice(0, normalizedLabel.length - suffix.length).trim();
    return name.length > 0 ? name : null;
  }
  return normalizedLabel;
}

function toMessageParticipants(
  participants: MessagingLocalParticipant[],
): MessageParticipant[] {
  return participants.map((participant) => ({
    name: participant.name?.trim() || null,
    address: participant.address?.trim() || null,
  }));
}

function toLocalMailboxListItem(
  message: MessagingLocalMessageSummaryRecord,
): MailboxListItem {
  return {
    uid: message.uid,
    messageId: message.messageId,
    subject: message.subject ?? "(Sans objet)",
    from:
      message.fromLabel?.trim() ||
      message.fromAddress?.trim() ||
      "Expéditeur inconnu",
    to: toParticipantLabels(message.toRecipients),
    date: message.internalDate ?? message.sentAt ?? message.updatedAt,
    seen: message.seen,
    hasAttachments: message.hasAttachments,
    tracking: null,
  };
}

async function enrichLocalMailboxItemsWithTracking(
  userId: string,
  mailbox: Mailbox,
  items: MailboxListItem[],
  runtime: MessagingReadModeRuntime,
): Promise<MailboxListItem[]> {
  if (mailbox !== "sent" || items.length === 0) {
    return items;
  }

  const messageIds = Array.from(
    new Set(
      items
        .map((item) => item.messageId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  if (!messageIds.length) {
    return items;
  }

  const summaries = await runtime.getEmailTrackingSummaries({
    userId,
    messageIds,
  });

  return items.map((item) => {
    const summary = item.messageId ? summaries.get(item.messageId) ?? null : null;
    return {
      ...item,
      tracking: summary
        ? {
            enabled: summary.trackingEnabled,
            totalOpens: summary.totalOpens,
            totalClicks: summary.totalClicks,
          }
        : null,
    };
  });
}

function hasUsableLocalMessageBody(
  message: MessagingLocalMessageRecord,
): boolean {
  if (message.sanitizedHtml || message.normalizedText) {
    return true;
  }
  return message.bodyState !== "NONE";
}

async function toLocalMessageDetail(
  message: MessagingLocalMessageRecord,
  userId: string,
  runtime: MessagingReadModeRuntime,
): Promise<MessageDetail> {
  const tracking =
    message.mailbox === "sent" && message.messageId
      ? await runtime.getEmailTrackingDetail({
          userId,
          messageId: message.messageId,
        })
      : null;
  const fromAddressValue = message.fromAddress?.trim() || null;
  const fromName = inferParticipantName(
    message.fromLabel,
    message.fromAddress,
  );

  const fromAddress =
    fromAddressValue || fromName
      ? {
          name: fromName,
          address: fromAddressValue,
        }
      : null;

  return {
    mailbox: message.mailbox,
    uid: message.uid,
    messageId: message.messageId,
    subject: message.subject ?? "(Sans objet)",
    from:
      message.fromLabel?.trim() ||
      message.fromAddress?.trim() ||
      "Expéditeur inconnu",
    to: toParticipantLabels(message.toRecipients),
    cc: toParticipantLabels(message.ccRecipients),
    bcc: toParticipantLabels(message.bccRecipients),
    replyTo: toParticipantLabels(message.replyToRecipients),
    date: message.internalDate ?? message.sentAt ?? message.updatedAt,
    seen: message.seen,
    html: message.sanitizedHtml,
    text: message.normalizedText,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.attachmentId,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
    })),
    fromAddress,
    toAddresses: toMessageParticipants(message.toRecipients),
    ccAddresses: toMessageParticipants(message.ccRecipients),
    bccAddresses: toMessageParticipants(message.bccRecipients),
    replyToAddresses: toMessageParticipants(message.replyToRecipients),
    tracking,
  };
}

async function readMailboxPageWithRuntime(
  params: {
    mailbox: Mailbox;
    page?: number;
    pageSize?: number;
    userId?: string;
  },
  runtime: MessagingReadModeRuntime,
): Promise<MailboxPageResult> {
  const startedAt = Date.now();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 20);
  const context = await resolveMailboxReadContextWithRuntime(
    {
      mailbox: params.mailbox,
      page,
      pageSize,
      userId: params.userId,
    },
    runtime,
  );

  if (!context.localPageReadable) {
    recordFallbackIfNeeded(
      runtime,
      context,
      params.mailbox,
      "page",
      !context.serverEnabled
        ? "server-disabled"
        : !context.localReadable
          ? "mailbox-unreadable"
          : "page-coverage-incomplete",
    );
    try {
      const result = await runtime.fetchMailboxMessages({
        ...params,
        page,
        pageSize,
        userId: context.userId,
      });
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "page",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return result;
    } catch (error) {
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "page",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: false,
      });
      throw error;
    }
  }

  try {
    const localPage = await runtime.listMessagingLocalMessageSummaries({
      userId: context.userId,
      mailbox: params.mailbox,
      page,
      pageSize,
      uidValidity: context.state?.uidValidity ?? undefined,
    });
    const messages = await enrichLocalMailboxItemsWithTracking(
      context.userId,
      params.mailbox,
      localPage.items.map(toLocalMailboxListItem),
      runtime,
    );

    recordMessagingLocalSyncActionObservation({
      userId: context.userId,
      mailbox: params.mailbox,
      operation: "page",
      source: "local-db",
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return {
      mailbox: params.mailbox,
      page: localPage.page,
      pageSize: localPage.pageSize,
      totalMessages: localPage.total,
      hasMore: localPage.page * localPage.pageSize < localPage.total,
      messages,
    };
  } catch (error) {
    recordMessagingLocalSyncActionObservation({
      userId: context.userId,
      mailbox: params.mailbox,
      operation: "page",
      source: "local-db",
      durationMs: Date.now() - startedAt,
      success: false,
    });
    throw error;
  }
}

async function readMailboxSearchWithRuntime(
  params: {
    mailbox: SearchableMailbox;
    query: string;
    page?: number;
    pageSize?: number;
    userId?: string;
  },
  runtime: MessagingReadModeRuntime,
): Promise<MailboxSearchResult> {
  const startedAt = Date.now();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 20);
  const normalizedQuery = normalizeMailboxSearchQuery(params.query);
  const context = await resolveMailboxReadContextWithRuntime(
    {
      mailbox: params.mailbox,
      page,
      pageSize,
      userId: params.userId,
      requiresSearchCoverage: true,
    },
    runtime,
  );

  if (!context.localSearchReadable) {
    recordSearchFallbackIfNeeded(
      runtime,
      context,
      params.mailbox,
      !context.serverEnabled
        ? "server-disabled"
        : !context.localReadable
          ? "mailbox-unreadable"
          : "search-coverage-incomplete",
    );
    try {
      const result = await runtime.searchMailboxMessages({
        ...params,
        query: normalizedQuery,
        page,
        pageSize,
        userId: context.userId,
      });
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "search",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return result;
    } catch (error) {
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "search",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: false,
      });
      throw error;
    }
  }

  try {
    const localSearch = await runtime.searchMessagingLocalMessageSummaries({
      userId: context.userId,
      mailbox: params.mailbox,
      query: normalizedQuery,
      page,
      pageSize,
      uidValidity: context.state?.uidValidity ?? undefined,
    });
    const messages = await enrichLocalMailboxItemsWithTracking(
      context.userId,
      params.mailbox,
      localSearch.items.map(toLocalMailboxListItem),
      runtime,
    );

    recordMessagingLocalSyncActionObservation({
      userId: context.userId,
      mailbox: params.mailbox,
      operation: "search",
      source: "local-db",
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return {
      mailbox: params.mailbox,
      query: localSearch.query,
      page: localSearch.page,
      pageSize: localSearch.pageSize,
      totalMessages: localSearch.total,
      hasMore: localSearch.page * localSearch.pageSize < localSearch.total,
      messages,
    };
  } catch (error) {
    recordMessagingLocalSyncActionObservation({
      userId: context.userId,
      mailbox: params.mailbox,
      operation: "search",
      source: "local-db",
      durationMs: Date.now() - startedAt,
      success: false,
    });
    throw error;
  }
}

async function readMessageDetailWithRuntime(
  params: {
    mailbox: Mailbox;
    uid: number;
    userId?: string;
  },
  runtime: MessagingReadModeRuntime,
): Promise<MessageDetail> {
  const startedAt = Date.now();
  const context = await resolveMailboxReadContextWithRuntime(
    {
      mailbox: params.mailbox,
      userId: params.userId,
    },
    runtime,
  );

  if (!context.localReadable) {
    recordFallbackIfNeeded(
      runtime,
      context,
      params.mailbox,
      "detail",
      !context.serverEnabled ? "server-disabled" : "mailbox-unreadable",
    );
    try {
      const result = await runtime.fetchMessageDetail({
        ...params,
        userId: context.userId,
      });
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "detail",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return result;
    } catch (error) {
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "detail",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: false,
      });
      throw error;
    }
  }

  const localMessage = await runtime.getMessagingLocalMessageByUid({
    userId: context.userId,
    mailbox: params.mailbox,
    uid: params.uid,
    uidValidity: context.state?.uidValidity ?? undefined,
  });

  if (!localMessage || !hasUsableLocalMessageBody(localMessage)) {
    recordFallbackIfNeeded(
      runtime,
      context,
      params.mailbox,
      "detail",
      localMessage ? "body-missing" : "message-missing",
    );
    try {
      const detail = await runtime.fetchMessageDetail({
        ...params,
        userId: context.userId,
      });
      if (localMessage) {
        await runtime.hydrateMessagingLocalMessageFromDetail({
          userId: context.userId,
          mailbox: params.mailbox,
          uid: params.uid,
          uidValidity: context.state?.uidValidity ?? localMessage.uidValidity,
          remotePath: localMessage.remotePath ?? context.state?.remotePath,
          detail,
          existingMessage: localMessage,
        });
        runtime.recordMessagingLocalSyncHydration({
          userId: context.userId,
          mailbox: params.mailbox,
          uid: params.uid,
          attachmentCount: detail.attachments.length,
        });
      }
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "detail",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return detail;
    } catch (error) {
      recordMessagingLocalSyncActionObservation({
        userId: context.userId,
        mailbox: params.mailbox,
        operation: "detail",
        source: "live-imap",
        durationMs: Date.now() - startedAt,
        success: false,
      });
      throw error;
    }
  }

  try {
    const detail = await toLocalMessageDetail(localMessage, context.userId, runtime);
    recordMessagingLocalSyncActionObservation({
      userId: context.userId,
      mailbox: params.mailbox,
      operation: "detail",
      source: "local-db",
      durationMs: Date.now() - startedAt,
      success: true,
    });
    return detail;
  } catch (error) {
    recordMessagingLocalSyncActionObservation({
      userId: context.userId,
      mailbox: params.mailbox,
      operation: "detail",
      source: "local-db",
      durationMs: Date.now() - startedAt,
      success: false,
    });
    throw error;
  }
}

async function shouldUseSnapshotRefreshWithRuntime(
  params: {
    mailbox: Mailbox;
    userId?: string;
  },
  runtime: MessagingReadModeRuntime,
): Promise<boolean> {
  const context = await resolveMailboxReadContextWithRuntime(
    params,
    runtime,
  );
  if (context.localSyncEnabled && !context.localReadable) {
    recordFallbackIfNeeded(
      runtime,
      context,
      params.mailbox,
      "snapshot",
      !context.serverEnabled ? "server-disabled" : "mailbox-unreadable",
    );
  }
  return context.localReadable;
}

export async function readMailboxPage(params: {
  mailbox: Mailbox;
  page?: number;
  pageSize?: number;
  userId?: string;
}): Promise<MailboxPageResult> {
  return readMailboxPageWithRuntime(params, defaultMessagingReadModeRuntime);
}

export async function readMailboxSearch(params: {
  mailbox: SearchableMailbox;
  query: string;
  page?: number;
  pageSize?: number;
  userId?: string;
}): Promise<MailboxSearchResult> {
  return readMailboxSearchWithRuntime(params, defaultMessagingReadModeRuntime);
}

export async function readMessageDetail(params: {
  mailbox: Mailbox;
  uid: number;
  userId?: string;
}): Promise<MessageDetail> {
  return readMessageDetailWithRuntime(params, defaultMessagingReadModeRuntime);
}

export async function shouldUseMailboxSnapshotRefresh(params: {
  mailbox: Mailbox;
  userId?: string;
}): Promise<boolean> {
  return shouldUseSnapshotRefreshWithRuntime(
    params,
    defaultMessagingReadModeRuntime,
  );
}

export const __testables = {
  canReadMailboxPageLocally,
  canSearchMailboxLocally,
  hasFullLocalMailboxCoverage,
  readMailboxPageWithRuntime,
  readMailboxSearchWithRuntime,
  readMessageDetailWithRuntime,
  shouldUseSnapshotRefreshWithRuntime,
};
