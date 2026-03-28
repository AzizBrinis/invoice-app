const LOCAL_SYNC_SERVER_ENABLED_ENV =
  "MESSAGING_LOCAL_SYNC_SERVER_ENABLED";

const FALSE_ENV_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

type MessagingLocalSyncMailboxName =
  | "inbox"
  | "sent"
  | "drafts"
  | "trash"
  | "spam";

type MessagingLocalSyncFallbackOperation =
  | "page"
  | "search"
  | "detail"
  | "snapshot";

type MessagingLocalSyncFallbackReason =
  | "server-disabled"
  | "mailbox-unreadable"
  | "page-coverage-incomplete"
  | "search-coverage-incomplete"
  | "message-missing"
  | "body-missing";

export type MessagingLocalSyncObservedOperation =
  | "page"
  | "search"
  | "detail"
  | "attachment"
  | "refresh";

export type MessagingLocalSyncObservedSource =
  | "local-db"
  | "local-cache"
  | "live-imap"
  | "sync";

export type MessagingLocalSyncOperationMetrics = {
  count: number;
  successCount: number;
  errorCount: number;
  localHitCount: number;
  remoteHitCount: number;
  cacheHitCount: number;
  totalDurationMs: number;
  lastDurationMs: number | null;
};

type MessagingLocalSyncMailboxMetrics = {
  syncCompleted: number;
  syncFailed: number;
  totalSyncDurationMs: number;
  messagesSynced: number;
  failedMessages: number;
  hydrationCount: number;
  fallbackCount: number;
  lastLocalMessageCount: number | null;
  lastRemoteMessageCount: number | null;
};

export type MessagingLocalSyncMetricsSnapshot = {
  serverEnabled: boolean;
  syncCompleted: number;
  syncFailed: number;
  totalSyncDurationMs: number;
  messagesSynced: number;
  failedMessages: number;
  hydrationCount: number;
  fallbackCount: number;
  operations: Partial<
    Record<MessagingLocalSyncObservedOperation, MessagingLocalSyncOperationMetrics>
  >;
  localHitRatePercent: number | null;
  fallbackReasons: Partial<Record<MessagingLocalSyncFallbackReason, number>>;
  mailboxes: Partial<
    Record<MessagingLocalSyncMailboxName, MessagingLocalSyncMailboxMetrics>
  >;
};

function createOperationMetrics(): MessagingLocalSyncOperationMetrics {
  return {
    count: 0,
    successCount: 0,
    errorCount: 0,
    localHitCount: 0,
    remoteHitCount: 0,
    cacheHitCount: 0,
    totalDurationMs: 0,
    lastDurationMs: null,
  };
}

function createMailboxMetrics(): MessagingLocalSyncMailboxMetrics {
  return {
    syncCompleted: 0,
    syncFailed: 0,
    totalSyncDurationMs: 0,
    messagesSynced: 0,
    failedMessages: 0,
    hydrationCount: 0,
    fallbackCount: 0,
    lastLocalMessageCount: null,
    lastRemoteMessageCount: null,
  };
}

function createMetricsSnapshot(): MessagingLocalSyncMetricsSnapshot {
  return {
    serverEnabled: true,
    syncCompleted: 0,
    syncFailed: 0,
    totalSyncDurationMs: 0,
    messagesSynced: 0,
    failedMessages: 0,
    hydrationCount: 0,
    fallbackCount: 0,
    operations: {},
    localHitRatePercent: null,
    fallbackReasons: {},
    mailboxes: {},
  };
}

let metricsSnapshot = createMetricsSnapshot();

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function normalizeCounter(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value ?? 0));
}

function shouldEmitMessagingLocalSyncLogs() {
  return process.env.NODE_ENV !== "test";
}

function getMailboxMetrics(
  mailbox: MessagingLocalSyncMailboxName,
): MessagingLocalSyncMailboxMetrics {
  const existing = metricsSnapshot.mailboxes[mailbox];
  if (existing) {
    return existing;
  }
  const created = createMailboxMetrics();
  metricsSnapshot.mailboxes[mailbox] = created;
  return created;
}

function getOperationMetrics(
  operation: MessagingLocalSyncObservedOperation,
): MessagingLocalSyncOperationMetrics {
  const existing = metricsSnapshot.operations[operation];
  if (existing) {
    return existing;
  }
  const created = createOperationMetrics();
  metricsSnapshot.operations[operation] = created;
  return created;
}

function computeLocalHitRatePercent(
  operations: Partial<
    Record<MessagingLocalSyncObservedOperation, MessagingLocalSyncOperationMetrics>
  >,
): number | null {
  let localHits = 0;
  let remoteHits = 0;

  (["page", "search", "detail", "attachment"] as const).forEach((operation) => {
    const metrics = operations[operation];
    if (!metrics) {
      return;
    }
    localHits += metrics.localHitCount;
    remoteHits += metrics.remoteHitCount;
  });

  const total = localHits + remoteHits;
  if (total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((localHits / total) * 100)));
}

export function isMessagingLocalSyncServerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const rawValue = env[LOCAL_SYNC_SERVER_ENABLED_ENV]?.trim().toLowerCase();
  if (!rawValue) {
    return true;
  }
  return !FALSE_ENV_VALUES.has(rawValue);
}

export function recordMessagingLocalSyncSyncCompleted(params: {
  userId: string;
  mailbox: MessagingLocalSyncMailboxName;
  status: string;
  durationMs: number;
  syncedCount: number;
  failedCount: number;
  localMessageCount: number;
  remoteMessageCount: number;
  bootstrapComplete: boolean;
  backfillComplete: boolean;
}) {
  const durationMs = normalizeDurationMs(params.durationMs);
  const syncedCount = normalizeCounter(params.syncedCount);
  const failedCount = normalizeCounter(params.failedCount);
  const mailboxMetrics = getMailboxMetrics(params.mailbox);
  const hadFailures =
    failedCount > 0 || params.status === "DEGRADED" || params.status === "ERROR";

  metricsSnapshot.serverEnabled = isMessagingLocalSyncServerEnabled();
  metricsSnapshot.syncCompleted += 1;
  if (hadFailures) {
    metricsSnapshot.syncFailed += 1;
  }
  metricsSnapshot.totalSyncDurationMs += durationMs;
  metricsSnapshot.messagesSynced += syncedCount;
  metricsSnapshot.failedMessages += failedCount;

  mailboxMetrics.syncCompleted += 1;
  if (hadFailures) {
    mailboxMetrics.syncFailed += 1;
  }
  mailboxMetrics.totalSyncDurationMs += durationMs;
  mailboxMetrics.messagesSynced += syncedCount;
  mailboxMetrics.failedMessages += failedCount;
  mailboxMetrics.lastLocalMessageCount = params.localMessageCount;
  mailboxMetrics.lastRemoteMessageCount = params.remoteMessageCount;

  if (shouldEmitMessagingLocalSyncLogs()) {
    console.info("[messaging-local-sync] sync completed", {
      userId: params.userId,
      mailbox: params.mailbox,
      status: params.status,
      durationMs,
      syncedCount,
      failedCount,
      localMessageCount: params.localMessageCount,
      remoteMessageCount: params.remoteMessageCount,
      bootstrapComplete: params.bootstrapComplete,
      backfillComplete: params.backfillComplete,
    });
  }
}

export function recordMessagingLocalSyncSyncFailed(params: {
  userId: string;
  mailbox: MessagingLocalSyncMailboxName;
  durationMs: number;
  error: string;
}) {
  const durationMs = normalizeDurationMs(params.durationMs);
  const mailboxMetrics = getMailboxMetrics(params.mailbox);

  metricsSnapshot.serverEnabled = isMessagingLocalSyncServerEnabled();
  metricsSnapshot.syncFailed += 1;
  metricsSnapshot.totalSyncDurationMs += durationMs;

  mailboxMetrics.syncFailed += 1;
  mailboxMetrics.totalSyncDurationMs += durationMs;

  if (shouldEmitMessagingLocalSyncLogs()) {
    console.warn("[messaging-local-sync] sync failed", {
      userId: params.userId,
      mailbox: params.mailbox,
      durationMs,
      error: params.error,
    });
  }
}

export function recordMessagingLocalSyncHydration(params: {
  userId: string;
  mailbox: MessagingLocalSyncMailboxName;
  uid: number;
  attachmentCount: number;
}) {
  const mailboxMetrics = getMailboxMetrics(params.mailbox);

  metricsSnapshot.serverEnabled = isMessagingLocalSyncServerEnabled();
  metricsSnapshot.hydrationCount += 1;
  mailboxMetrics.hydrationCount += 1;

  if (shouldEmitMessagingLocalSyncLogs()) {
    console.info("[messaging-local-sync] detail hydrated", {
      userId: params.userId,
      mailbox: params.mailbox,
      uid: params.uid,
      attachmentCount: normalizeCounter(params.attachmentCount),
    });
  }
}

export function recordMessagingLocalSyncFallback(params: {
  userId: string;
  mailbox: MessagingLocalSyncMailboxName;
  operation: MessagingLocalSyncFallbackOperation;
  reason: MessagingLocalSyncFallbackReason;
}) {
  const mailboxMetrics = getMailboxMetrics(params.mailbox);

  metricsSnapshot.serverEnabled = isMessagingLocalSyncServerEnabled();
  metricsSnapshot.fallbackCount += 1;
  metricsSnapshot.fallbackReasons[params.reason] =
    (metricsSnapshot.fallbackReasons[params.reason] ?? 0) + 1;
  mailboxMetrics.fallbackCount += 1;

  if (shouldEmitMessagingLocalSyncLogs()) {
    console.info("[messaging-local-sync] fallback to live imap", {
      userId: params.userId,
      mailbox: params.mailbox,
      operation: params.operation,
      reason: params.reason,
    });
  }
}

export function recordMessagingLocalSyncActionObservation(params: {
  userId: string;
  mailbox: MessagingLocalSyncMailboxName;
  operation: MessagingLocalSyncObservedOperation;
  source: MessagingLocalSyncObservedSource;
  durationMs: number;
  success: boolean;
}) {
  const durationMs = normalizeDurationMs(params.durationMs);
  const operationMetrics = getOperationMetrics(params.operation);

  metricsSnapshot.serverEnabled = isMessagingLocalSyncServerEnabled();
  operationMetrics.count += 1;
  operationMetrics.totalDurationMs += durationMs;
  operationMetrics.lastDurationMs = durationMs;

  if (params.success) {
    operationMetrics.successCount += 1;
  } else {
    operationMetrics.errorCount += 1;
  }

  if (params.source === "local-db") {
    operationMetrics.localHitCount += 1;
  } else if (params.source === "local-cache") {
    operationMetrics.localHitCount += 1;
    operationMetrics.cacheHitCount += 1;
  } else if (params.source === "live-imap") {
    operationMetrics.remoteHitCount += 1;
  }
}

export function getMessagingLocalSyncMetricsSnapshot(): MessagingLocalSyncMetricsSnapshot {
  const operations = Object.fromEntries(
    Object.entries(metricsSnapshot.operations).map(([operation, metrics]) => [
      operation,
      { ...metrics },
    ]),
  ) as MessagingLocalSyncMetricsSnapshot["operations"];

  return {
    serverEnabled: isMessagingLocalSyncServerEnabled(),
    syncCompleted: metricsSnapshot.syncCompleted,
    syncFailed: metricsSnapshot.syncFailed,
    totalSyncDurationMs: metricsSnapshot.totalSyncDurationMs,
    messagesSynced: metricsSnapshot.messagesSynced,
    failedMessages: metricsSnapshot.failedMessages,
    hydrationCount: metricsSnapshot.hydrationCount,
    fallbackCount: metricsSnapshot.fallbackCount,
    operations,
    localHitRatePercent: computeLocalHitRatePercent(operations),
    fallbackReasons: { ...metricsSnapshot.fallbackReasons },
    mailboxes: Object.fromEntries(
      Object.entries(metricsSnapshot.mailboxes).map(([mailbox, metrics]) => [
        mailbox,
        { ...metrics },
      ]),
    ) as MessagingLocalSyncMetricsSnapshot["mailboxes"],
  };
}

function resetMessagingLocalSyncMetrics() {
  metricsSnapshot = createMetricsSnapshot();
}

export const __testables = {
  LOCAL_SYNC_SERVER_ENABLED_ENV,
  resetMessagingLocalSyncMetrics,
};
