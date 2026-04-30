import type {
  BackgroundJobHandlers,
  EnqueueJobResult,
  ProcessJobQueueResult,
} from "@/server/background-jobs";
import { enqueueJob, processJobQueue } from "@/server/background-jobs";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { runScheduledEmailDispatchCycle } from "@/server/messaging-scheduled";
import {
  AUTO_FORWARD_INBOX_MESSAGE_JOB_TYPE,
  forwardInboxMessageForUser,
  runAutoForwardSweepForUser,
  runAutomatedReplySweepForUser,
} from "@/server/messaging";
import {
  DOCUMENT_EMAIL_JOB_TYPES,
  documentEmailJobHandlers,
} from "@/server/document-email-jobs";
import {
  MESSAGING_LOCAL_SYNC_MAILBOX_VALUES,
  getMessagingLocalSyncPreference,
  listMessagingMailboxLocalSyncStates,
  purgeMessagingLocalSyncData,
  syncMessagingMailboxToLocal,
  syncMessagingMailboxesToLocal,
  type MessagingLocalSyncMailbox,
  type MessagingMailboxLocalSyncStateRecord,
} from "@/server/messaging-local-sync";
import { isMessagingLocalSyncServerEnabled } from "@/server/messaging-local-sync-ops";

const DISPATCH_JOB_TYPE = "messaging.dispatchScheduledEmails";
const AUTO_REPLY_JOB_TYPE = "messaging.syncInboxAutoReplies";
const AUTO_FORWARD_SWEEP_JOB_TYPE = "messaging.syncInboxAutoForwards";
export const LOCAL_SYNC_BOOTSTRAP_JOB_TYPE =
  "messaging.localSyncBootstrap";
export const LOCAL_SYNC_DELTA_JOB_TYPE = "messaging.localSyncDelta";
export const LOCAL_SYNC_RECONCILE_JOB_TYPE =
  "messaging.localSyncReconcile";
export const LOCAL_SYNC_MANUAL_MAILBOX_JOB_TYPE =
  "messaging.localSyncManualMailbox";
export const LOCAL_SYNC_PURGE_JOB_TYPE = "messaging.localSyncPurge";

const SCHEDULED_EMAIL_INTERVAL_MS = 60 * 1000;
const AUTO_REPLY_INTERVAL_MS = 60 * 1000;
const AUTO_FORWARD_INTERVAL_MS = 60 * 1000;
const AUTO_REPLY_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const AUTO_FORWARD_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const LOCAL_SYNC_BOOTSTRAP_INTERVAL_MS = 60 * 1000;
const LOCAL_SYNC_DELTA_INTERVAL_MS = 3 * 60 * 1000;
const LOCAL_SYNC_RECONCILE_INTERVAL_MS = 30 * 60 * 1000;
const LOCAL_SYNC_PURGE_INTERVAL_MS = 60 * 1000;
const LOCAL_SYNC_MANUAL_DEDUPE_WINDOW_MS = 30 * 1000;
const LOCAL_SYNC_RETRY_BACKOFF_MS = 2 * 60 * 1000;

const LOCAL_SYNC_BOOTSTRAP_PRIORITY = 180;
const LOCAL_SYNC_DELTA_PRIORITY = 130;
const LOCAL_SYNC_RECONCILE_PRIORITY = 120;
const LOCAL_SYNC_MANUAL_PRIORITY = 220;
const LOCAL_SYNC_PURGE_PRIORITY = 210;

const LOCAL_SYNC_JOB_TYPES = [
  LOCAL_SYNC_BOOTSTRAP_JOB_TYPE,
  LOCAL_SYNC_DELTA_JOB_TYPE,
  LOCAL_SYNC_RECONCILE_JOB_TYPE,
  LOCAL_SYNC_MANUAL_MAILBOX_JOB_TYPE,
  LOCAL_SYNC_PURGE_JOB_TYPE,
] as const;
const EMAIL_CRON_JOB_TYPES = [
  DISPATCH_JOB_TYPE,
  AUTO_REPLY_JOB_TYPE,
  AUTO_FORWARD_SWEEP_JOB_TYPE,
  AUTO_FORWARD_INBOX_MESSAGE_JOB_TYPE,
  ...DOCUMENT_EMAIL_JOB_TYPES,
] as const;
export const DEFAULT_MESSAGING_CRON_SCOPE = "email";

export type MessagingCronScope = "email" | "local-sync" | "all";

type MessagingLocalSyncJobPayload = {
  userId: string;
  mailbox?: MessagingLocalSyncMailbox;
  reason?: string | null;
};

type MessagingAutoForwardJobPayload = {
  userId: string;
  mailbox: "inbox";
  uidValidity: number;
  uid: number;
};

type MessagingJobAutoReplyCandidate = {
  userId: string;
  autoReplyEnabled: boolean;
  vacationModeEnabled: boolean;
  vacationStartDate: Date | null;
  vacationEndDate: Date | null;
};

type MessagingLocalSyncStateSummary = Pick<
  MessagingMailboxLocalSyncStateRecord,
  "userId" | "mailbox" | "status" | "lastSuccessfulSyncAt"
>;

type MessagingLocalSyncJobScheduleSummary = {
  requested: number;
  enqueued: number;
  deduped: number;
};

type MessagingLocalSyncScheduleSummary = {
  enabledUsers: number;
  bootstrap: MessagingLocalSyncJobScheduleSummary;
  delta: MessagingLocalSyncJobScheduleSummary;
  reconcile: MessagingLocalSyncJobScheduleSummary;
  purge: MessagingLocalSyncJobScheduleSummary;
};

type MessagingJobQueueResult = {
  jobId: string;
  deduped: boolean;
};

type RunManualMessagingLocalSyncResult = MessagingJobQueueResult & {
  queue: ProcessJobQueueResult;
};

type MessagingCronScheduleSummary = {
  scheduledEmails?: MessagingJobQueueResult;
  autoReplies?: {
    requested: number;
    enqueued: number;
    deduped: number;
  };
  autoForwards?: {
    requested: number;
    enqueued: number;
    deduped: number;
  };
  localSync?: MessagingLocalSyncScheduleSummary;
};

type MessagingCronTickSummary = {
  scope: MessagingCronScope;
  scheduled: MessagingCronScheduleSummary;
  timestamp: string;
};

type MessagingJobsRuntime = {
  enqueueJob: typeof enqueueJob;
  processJobQueue: typeof processJobQueue;
  runScheduledEmailDispatchCycle: typeof runScheduledEmailDispatchCycle;
  runAutomatedReplySweepForUser: typeof runAutomatedReplySweepForUser;
  runAutoForwardSweepForUser: typeof runAutoForwardSweepForUser;
  forwardInboxMessageForUser: typeof forwardInboxMessageForUser;
  isMessagingLocalSyncServerEnabled: typeof isMessagingLocalSyncServerEnabled;
  getMessagingLocalSyncPreference: typeof getMessagingLocalSyncPreference;
  listMessagingMailboxLocalSyncStates: typeof listMessagingMailboxLocalSyncStates;
  syncMessagingMailboxToLocal: typeof syncMessagingMailboxToLocal;
  syncMessagingMailboxesToLocal: typeof syncMessagingMailboxesToLocal;
  purgeMessagingLocalSyncData: typeof purgeMessagingLocalSyncData;
  findAutoReplyCandidates: () => Promise<MessagingJobAutoReplyCandidate[]>;
  findAutoForwardCandidates: () => Promise<string[]>;
  findEnabledLocalSyncUsers: () => Promise<string[]>;
  findLocalSyncStatesForUsers: (
    userIds: string[],
  ) => Promise<MessagingLocalSyncStateSummary[]>;
  findUsersWithLocalSyncData: () => Promise<string[]>;
  findLocalSyncSettings: (
    userIds: string[],
  ) => Promise<Array<{ userId: string; localSyncEnabled: boolean }>>;
};

const defaultMessagingJobsRuntime: MessagingJobsRuntime = {
  enqueueJob,
  processJobQueue,
  runScheduledEmailDispatchCycle,
  runAutomatedReplySweepForUser,
  runAutoForwardSweepForUser,
  forwardInboxMessageForUser,
  isMessagingLocalSyncServerEnabled,
  getMessagingLocalSyncPreference,
  listMessagingMailboxLocalSyncStates,
  syncMessagingMailboxToLocal,
  syncMessagingMailboxesToLocal,
  purgeMessagingLocalSyncData,
  async findAutoReplyCandidates() {
    return prisma.messagingSettings.findMany({
      where: {
        OR: [
          { autoReplyEnabled: true },
          {
            vacationModeEnabled: true,
            vacationStartDate: { not: null },
            vacationEndDate: { not: null },
          },
        ],
        imapHost: { not: null },
        smtpHost: { not: null },
      },
      select: {
        userId: true,
        autoReplyEnabled: true,
        vacationModeEnabled: true,
        vacationStartDate: true,
        vacationEndDate: true,
      },
    });
  },
  async findAutoForwardCandidates() {
    const rows = await prisma.$queryRaw<Array<{ userId: string }>>(
      Prisma.sql`
        SELECT "userId"
        FROM public."MessagingSettings"
        WHERE
          "autoForwardEnabled" = true
          AND jsonb_array_length(COALESCE("autoForwardRecipients", '[]'::jsonb)) > 0
          AND "imapHost" IS NOT NULL
          AND "imapPort" IS NOT NULL
          AND "imapUser" IS NOT NULL
          AND "imapPassword" IS NOT NULL
          AND "smtpHost" IS NOT NULL
          AND "smtpPort" IS NOT NULL
          AND "smtpUser" IS NOT NULL
          AND "smtpPassword" IS NOT NULL
      `,
    );
    return rows.map((row) => row.userId);
  },
  async findEnabledLocalSyncUsers() {
    const settings = await prisma.messagingSettings.findMany({
      where: {
        localSyncEnabled: true,
        imapHost: { not: null },
        imapPort: { not: null },
        imapUser: { not: null },
        imapPassword: { not: null },
      },
      select: {
        userId: true,
      },
    });
    return settings.map((entry) => entry.userId);
  },
  async findLocalSyncStatesForUsers(userIds) {
    if (!userIds.length) {
      return [];
    }
    const states = await prisma.messagingMailboxLocalSyncState.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      select: {
        userId: true,
        mailbox: true,
        status: true,
        lastSuccessfulSyncAt: true,
      },
    });

    return states.map((state) => ({
      userId: state.userId,
      mailbox: state.mailbox.toLowerCase() as MessagingLocalSyncMailbox,
      status: state.status,
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt?.toISOString() ?? null,
    }));
  },
  async findUsersWithLocalSyncData() {
    // The serverless runtime uses a single pooled Postgres connection. Keep
    // these maintenance scans sequential so cron scheduling cannot block while
    // waiting for a second connection from the pooler.
    const stateUsers = await prisma.messagingMailboxLocalSyncState.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });
    const messageUsers = await prisma.messagingLocalMessage.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });

    return Array.from(
      new Set([
        ...stateUsers.map((entry) => entry.userId),
        ...messageUsers.map((entry) => entry.userId),
      ]),
    );
  },
  async findLocalSyncSettings(userIds) {
    if (!userIds.length) {
      return [];
    }
    return prisma.messagingSettings.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      select: {
        userId: true,
        localSyncEnabled: true,
      },
    });
  },
};

function createMessagingJobHandlers(
  runtime: MessagingJobsRuntime = defaultMessagingJobsRuntime,
): BackgroundJobHandlers {
  return {
    ...documentEmailJobHandlers,
    [DISPATCH_JOB_TYPE]: async () => {
      await runtime.runScheduledEmailDispatchCycle();
    },
    [AUTO_REPLY_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseAutoReplyPayload(job.type, payload);
      await runtime.runAutomatedReplySweepForUser(parsed.userId, {
        bootstrapMode: parsed.bootstrapMode,
      });
    },
    [AUTO_FORWARD_SWEEP_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseAutoReplyPayload(job.type, payload);
      await runtime.runAutoForwardSweepForUser(parsed.userId, {
        bootstrapMode: parsed.bootstrapMode,
      });
    },
    [AUTO_FORWARD_INBOX_MESSAGE_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseAutoForwardMessagePayload(job.type, payload);
      await runtime.forwardInboxMessageForUser(parsed);
    },
    [LOCAL_SYNC_BOOTSTRAP_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseLocalSyncJobPayload(job.type, payload);
      if (!runtime.isMessagingLocalSyncServerEnabled()) {
        return;
      }
      if (!(await runtime.getMessagingLocalSyncPreference(parsed.userId))) {
        return;
      }
      if (shouldProcessCronLocalSyncIncrementally(parsed.reason)) {
        await runSingleCronLocalSyncMailbox(runtime, parsed.userId, "bootstrap");
        return;
      }
      await runtime.syncMessagingMailboxesToLocal({
        userId: parsed.userId,
        includeBackfill: true,
      });
    },
    [LOCAL_SYNC_DELTA_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseLocalSyncJobPayload(job.type, payload);
      if (!runtime.isMessagingLocalSyncServerEnabled()) {
        return;
      }
      if (!(await runtime.getMessagingLocalSyncPreference(parsed.userId))) {
        return;
      }
      if (shouldProcessCronLocalSyncIncrementally(parsed.reason)) {
        await runSingleCronLocalSyncMailbox(runtime, parsed.userId, "delta");
        return;
      }
      await runtime.syncMessagingMailboxesToLocal({
        userId: parsed.userId,
        includeBackfill: false,
        continuePriorityBackfill: true,
      });
    },
    [LOCAL_SYNC_RECONCILE_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseLocalSyncJobPayload(job.type, payload);
      if (!runtime.isMessagingLocalSyncServerEnabled()) {
        return;
      }
      if (!(await runtime.getMessagingLocalSyncPreference(parsed.userId))) {
        return;
      }
      if (shouldProcessCronLocalSyncIncrementally(parsed.reason)) {
        await runSingleCronLocalSyncMailbox(runtime, parsed.userId, "reconcile");
        return;
      }
      await runtime.syncMessagingMailboxesToLocal({
        userId: parsed.userId,
        includeBackfill: true,
      });
    },
    [LOCAL_SYNC_MANUAL_MAILBOX_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseLocalSyncJobPayload(job.type, payload, {
        mailboxRequired: true,
      });
      if (!runtime.isMessagingLocalSyncServerEnabled()) {
        return;
      }
      if (!(await runtime.getMessagingLocalSyncPreference(parsed.userId))) {
        return;
      }
      await runtime.syncMessagingMailboxToLocal({
        userId: parsed.userId,
        mailbox: parsed.mailbox,
        includeBackfill: true,
      });
    },
    [LOCAL_SYNC_PURGE_JOB_TYPE]: async ({ job, payload }) => {
      const parsed = parseLocalSyncJobPayload(job.type, payload);
      await runtime.purgeMessagingLocalSyncData({
        userId: parsed.userId,
      });
    },
  };
}

type CronLocalSyncMode = "bootstrap" | "delta" | "reconcile";

async function runSingleCronLocalSyncMailbox(
  runtime: MessagingJobsRuntime,
  userId: string,
  mode: CronLocalSyncMode,
) {
  const mailbox = selectCronLocalSyncMailbox(
    await runtime.listMessagingMailboxLocalSyncStates(userId),
    mode,
  );
  if (!mailbox) {
    return;
  }

  if (mode === "delta") {
    await runtime.syncMessagingMailboxToLocal({
      userId,
      mailbox,
      includeBackfill: false,
      continuePriorityBackfill: true,
    });
    return;
  }

  await runtime.syncMessagingMailboxToLocal({
    userId,
    mailbox,
    includeBackfill: true,
  });
}

function shouldProcessCronLocalSyncIncrementally(
  reason?: string | null,
): boolean {
  return (
    reason === "bootstrap" ||
    reason === "delta" ||
    reason === "reconcile"
  );
}

function selectCronLocalSyncMailbox(
  states: MessagingMailboxLocalSyncStateRecord[],
  mode: CronLocalSyncMode,
): MessagingLocalSyncMailbox | null {
  const statesByMailbox = new Map(
    states.map((state) => [state.mailbox, state]),
  );

  if (mode === "bootstrap") {
    for (const mailbox of MESSAGING_LOCAL_SYNC_MAILBOX_VALUES) {
      const state = statesByMailbox.get(mailbox);
      if (
        !state ||
        !state.lastSuccessfulSyncAt ||
        state.status === "DISABLED" ||
        state.status === "BOOTSTRAPPING" ||
        state.status === "ERROR"
      ) {
        return mailbox;
      }
    }
    return null;
  }

  const orderedMailboxes = MESSAGING_LOCAL_SYNC_MAILBOX_VALUES.map(
    (mailbox, order) => ({
      mailbox,
      order,
      state: statesByMailbox.get(mailbox),
    }),
  );

  orderedMailboxes.sort((left, right) => {
    if (mode === "reconcile") {
      const leftMissingFullResync = !left.state?.lastFullResyncAt;
      const rightMissingFullResync = !right.state?.lastFullResyncAt;
      if (leftMissingFullResync !== rightMissingFullResync) {
        return leftMissingFullResync ? -1 : 1;
      }
      const fullResyncComparison = compareOptionalIsoTimestampsAsc(
        left.state?.lastFullResyncAt ?? null,
        right.state?.lastFullResyncAt ?? null,
      );
      if (fullResyncComparison !== 0) {
        return fullResyncComparison;
      }
    }

    const successfulSyncComparison = compareOptionalIsoTimestampsAsc(
      left.state?.lastSuccessfulSyncAt ?? null,
      right.state?.lastSuccessfulSyncAt ?? null,
    );
    if (successfulSyncComparison !== 0) {
      return successfulSyncComparison;
    }

    return left.order - right.order;
  });

  return orderedMailboxes[0]?.mailbox ?? null;
}

function compareOptionalIsoTimestampsAsc(
  left: string | null,
  right: string | null,
): number {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
    return 0;
  }
  if (Number.isNaN(leftTime)) {
    return -1;
  }
  if (Number.isNaN(rightTime)) {
    return 1;
  }

  return leftTime - rightTime;
}

export async function runMessagingCronTick(now = new Date()) {
  return runMessagingCronTickWithRuntime(
    now,
    defaultMessagingJobsRuntime,
    DEFAULT_MESSAGING_CRON_SCOPE,
  );
}

export async function runMessagingLocalSyncCronTick(now = new Date()) {
  return runMessagingCronTickWithRuntime(
    now,
    defaultMessagingJobsRuntime,
    "local-sync",
  );
}

export async function runAllMessagingCronTick(now = new Date()) {
  return runMessagingCronTickWithRuntime(
    now,
    defaultMessagingJobsRuntime,
    "all",
  );
}

export async function scheduleMessagingCronTick(
  now = new Date(),
  scope: MessagingCronScope = DEFAULT_MESSAGING_CRON_SCOPE,
) {
  return scheduleMessagingCronTickWithRuntime(
    now,
    defaultMessagingJobsRuntime,
    scope,
  );
}

export async function processMessagingCronQueue(
  scope: MessagingCronScope = DEFAULT_MESSAGING_CRON_SCOPE,
) {
  return processMessagingCronQueueWithRuntime(
    defaultMessagingJobsRuntime,
    scope,
  );
}

async function runMessagingCronTickWithRuntime(
  now: Date,
  runtime: MessagingJobsRuntime,
  scope: MessagingCronScope = "all",
) {
  const scheduled = await scheduleMessagingCronTickWithRuntime(
    now,
    runtime,
    scope,
  );
  const queueResult = await processMessagingCronQueueWithRuntime(
    runtime,
    scope,
  );
  return {
    ...scheduled,
    queue: queueResult,
  };
}

async function scheduleMessagingCronTickWithRuntime(
  now: Date,
  runtime: MessagingJobsRuntime,
  scope: MessagingCronScope = "all",
): Promise<MessagingCronTickSummary> {
  return {
    scope,
    scheduled: await scheduleMessagingJobsWithRuntime(now, runtime, scope),
    timestamp: now.toISOString(),
  };
}

async function processMessagingCronQueueWithRuntime(
  runtime: MessagingJobsRuntime,
  scope: MessagingCronScope = "all",
) {
  return runtime.processJobQueue({
    handlers: createMessagingJobHandlers(runtime),
    maxJobs: getMaxJobsForScope(scope),
    allowedTypes: getAllowedTypesForScope(scope),
  });
}

async function scheduleMessagingJobsWithRuntime(
  now: Date,
  runtime: MessagingJobsRuntime,
  scope: MessagingCronScope = "all",
): Promise<MessagingCronScheduleSummary> {
  const scheduled: MessagingCronScheduleSummary = {};

  if (shouldHandleEmailAutomation(scope)) {
    scheduled.scheduledEmails = await enqueueDispatchJob(now, runtime);
    scheduled.autoReplies = await enqueueAutoReplyJobs(now, runtime);
    scheduled.autoForwards = await enqueueAutoForwardSweepJobs(now, runtime);
  }

  if (shouldHandleLocalSync(scope)) {
    scheduled.localSync = await enqueueLocalSyncJobs(now, runtime);
  }

  return scheduled;
}

async function enqueueDispatchJob(
  now: Date,
  runtime: MessagingJobsRuntime,
) {
  const slotKey = computeSlotKey(now, SCHEDULED_EMAIL_INTERVAL_MS);
  const dedupeKey = `scheduled:${slotKey}`;
  const result = await runtime.enqueueJob({
    type: DISPATCH_JOB_TYPE,
    dedupeKey,
    priority: 100,
    runAt: now,
    retryBackoffMs: 60_000,
  });
  return {
    deduped: result.deduped,
    jobId: result.job.id,
  };
}

async function enqueueAutoReplyJobs(
  now: Date,
  runtime: MessagingJobsRuntime,
) {
  const slotKey = computeSlotKey(now, AUTO_REPLY_INTERVAL_MS);
  const candidates = await runtime.findAutoReplyCandidates();

  let enqueued = 0;
  let deduped = 0;

  for (const candidate of candidates) {
    if (!shouldScheduleAutoReply(candidate, now)) {
      continue;
    }
    const dedupeKey = `${candidate.userId}:${slotKey}`;
    const payload = { userId: candidate.userId, bootstrapMode: "skip" } as const;
    const result = await runtime.enqueueJob({
      type: AUTO_REPLY_JOB_TYPE,
      payload,
      dedupeKey,
      priority: 50,
      runAt: now,
      retryBackoffMs: AUTO_REPLY_RETRY_BACKOFF_MS,
    });
    if (result.deduped) {
      deduped += 1;
    } else {
      enqueued += 1;
    }
  }

  return {
    requested: candidates.length,
    enqueued,
    deduped,
  };
}

async function enqueueAutoForwardSweepJobs(
  now: Date,
  runtime: MessagingJobsRuntime,
) {
  const slotKey = computeSlotKey(now, AUTO_FORWARD_INTERVAL_MS);
  const candidates =
    typeof runtime.findAutoForwardCandidates === "function"
      ? await runtime.findAutoForwardCandidates()
      : [];

  let enqueued = 0;
  let deduped = 0;

  for (const userId of candidates) {
    const dedupeKey = `${userId}:${slotKey}`;
    const payload = { userId, bootstrapMode: "skip" } as const;
    const result = await runtime.enqueueJob({
      type: AUTO_FORWARD_SWEEP_JOB_TYPE,
      payload,
      dedupeKey,
      priority: 55,
      runAt: now,
      retryBackoffMs: AUTO_FORWARD_RETRY_BACKOFF_MS,
    });
    if (result.deduped) {
      deduped += 1;
    } else {
      enqueued += 1;
    }
  }

  return {
    requested: candidates.length,
    enqueued,
    deduped,
  };
}

async function enqueueLocalSyncJobs(
  now: Date,
  runtime: MessagingJobsRuntime,
): Promise<MessagingLocalSyncScheduleSummary> {
  if (!runtime.isMessagingLocalSyncServerEnabled()) {
    return {
      enabledUsers: 0,
      bootstrap: createScheduleSummary(),
      delta: createScheduleSummary(),
      reconcile: createScheduleSummary(),
      purge: createScheduleSummary(),
    };
  }

  const enabledUserIds = await runtime.findEnabledLocalSyncUsers();
  const states = await runtime.findLocalSyncStatesForUsers(enabledUserIds);
  const statesByUser = new Map<string, MessagingLocalSyncStateSummary[]>();

  for (const state of states) {
    const userStates = statesByUser.get(state.userId);
    if (userStates) {
      userStates.push(state);
    } else {
      statesByUser.set(state.userId, [state]);
    }
  }

  const bootstrap = createScheduleSummary();
  const delta = createScheduleSummary();
  const reconcile = createScheduleSummary();

  for (const userId of enabledUserIds) {
    const userStates = statesByUser.get(userId) ?? [];
    if (shouldScheduleLocalSyncBootstrap(userStates)) {
      bootstrap.requested += 1;
      const result = await enqueueLocalSyncJob(runtime, {
        type: LOCAL_SYNC_BOOTSTRAP_JOB_TYPE,
        payload: { userId, reason: "bootstrap" },
        dedupeKey: `${userId}:${computeSlotKey(
          now,
          LOCAL_SYNC_BOOTSTRAP_INTERVAL_MS,
        )}`,
        priority: LOCAL_SYNC_BOOTSTRAP_PRIORITY,
        runAt: now,
      });
      recordScheduledJob(bootstrap, result);
      continue;
    }

    delta.requested += 1;
    const deltaResult = await enqueueLocalSyncJob(runtime, {
      type: LOCAL_SYNC_DELTA_JOB_TYPE,
      payload: { userId, reason: "delta" },
      dedupeKey: `${userId}:${computeSlotKey(now, LOCAL_SYNC_DELTA_INTERVAL_MS)}`,
      priority: LOCAL_SYNC_DELTA_PRIORITY,
      runAt: now,
    });
    recordScheduledJob(delta, deltaResult);

    reconcile.requested += 1;
    const reconcileResult = await enqueueLocalSyncJob(runtime, {
      type: LOCAL_SYNC_RECONCILE_JOB_TYPE,
      payload: { userId, reason: "reconcile" },
      dedupeKey: `${userId}:${computeSlotKey(
        now,
        LOCAL_SYNC_RECONCILE_INTERVAL_MS,
      )}`,
      priority: LOCAL_SYNC_RECONCILE_PRIORITY,
      runAt: now,
    });
    recordScheduledJob(reconcile, reconcileResult);
  }

  const dataUserIds = await runtime.findUsersWithLocalSyncData();
  const settings = await runtime.findLocalSyncSettings(dataUserIds);
  const purgeCandidateUserIds = selectLocalSyncPurgeCandidates(
    dataUserIds,
    settings,
  );
  const purge = createScheduleSummary();

  for (const userId of purgeCandidateUserIds) {
    purge.requested += 1;
    const result = await enqueueLocalSyncJob(runtime, {
      type: LOCAL_SYNC_PURGE_JOB_TYPE,
      payload: { userId, reason: "disabled-purge" },
      dedupeKey: `${userId}:${computeSlotKey(now, LOCAL_SYNC_PURGE_INTERVAL_MS)}`,
      priority: LOCAL_SYNC_PURGE_PRIORITY,
      runAt: now,
    });
    recordScheduledJob(purge, result);
  }

  return {
    enabledUsers: enabledUserIds.length,
    bootstrap,
    delta,
    reconcile,
    purge,
  };
}

function createScheduleSummary(): MessagingLocalSyncJobScheduleSummary {
  return {
    requested: 0,
    enqueued: 0,
    deduped: 0,
  };
}

function recordScheduledJob(
  summary: MessagingLocalSyncJobScheduleSummary,
  result: EnqueueJobResult,
) {
  if (result.deduped) {
    summary.deduped += 1;
  } else {
    summary.enqueued += 1;
  }
}

async function enqueueLocalSyncJob(
  runtime: MessagingJobsRuntime,
  options: {
    type: string;
    payload: MessagingLocalSyncJobPayload;
    dedupeKey: string;
    priority: number;
    runAt: Date;
  },
) {
  return runtime.enqueueJob({
    type: options.type,
    payload: options.payload,
    dedupeKey: options.dedupeKey,
    priority: options.priority,
    runAt: options.runAt,
    retryBackoffMs: LOCAL_SYNC_RETRY_BACKOFF_MS,
  });
}

export async function runManualMailboxLocalSyncNow(options: {
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  now?: Date;
}): Promise<RunManualMessagingLocalSyncResult> {
  return runManualMailboxLocalSyncNowWithRuntime(options, defaultMessagingJobsRuntime);
}

export async function runMessagingLocalBootstrapNow(options: {
  userId: string;
  now?: Date;
}): Promise<RunManualMessagingLocalSyncResult> {
  return runMessagingLocalJobNowWithRuntime(
    {
      userId: options.userId,
      type: LOCAL_SYNC_BOOTSTRAP_JOB_TYPE,
      reason: "settings-enable",
      priority: LOCAL_SYNC_BOOTSTRAP_PRIORITY,
      dedupeWindowMs: LOCAL_SYNC_MANUAL_DEDUPE_WINDOW_MS,
      now: options.now,
    },
    defaultMessagingJobsRuntime,
  );
}

export async function runMessagingLocalReconcileNow(options: {
  userId: string;
  now?: Date;
}): Promise<RunManualMessagingLocalSyncResult> {
  return runMessagingLocalJobNowWithRuntime(
    {
      userId: options.userId,
      type: LOCAL_SYNC_RECONCILE_JOB_TYPE,
      reason: "settings-manual-sync",
      priority: LOCAL_SYNC_MANUAL_PRIORITY,
      dedupeWindowMs: LOCAL_SYNC_MANUAL_DEDUPE_WINDOW_MS,
      now: options.now,
    },
    defaultMessagingJobsRuntime,
  );
}

export async function queueMessagingLocalPurge(options: {
  userId: string;
  now?: Date;
}): Promise<MessagingJobQueueResult> {
  return queueMessagingLocalJobWithRuntime(
    {
      userId: options.userId,
      type: LOCAL_SYNC_PURGE_JOB_TYPE,
      reason: "settings-disable",
      priority: LOCAL_SYNC_PURGE_PRIORITY,
      dedupeWindowMs: LOCAL_SYNC_MANUAL_DEDUPE_WINDOW_MS,
      now: options.now,
    },
    defaultMessagingJobsRuntime,
  );
}

export async function runMessagingLocalPurgeNow(options: {
  userId: string;
  now?: Date;
}): Promise<RunManualMessagingLocalSyncResult> {
  return runMessagingLocalJobNowWithRuntime(
    {
      userId: options.userId,
      type: LOCAL_SYNC_PURGE_JOB_TYPE,
      reason: "settings-manual-purge",
      priority: LOCAL_SYNC_PURGE_PRIORITY,
      dedupeWindowMs: LOCAL_SYNC_MANUAL_DEDUPE_WINDOW_MS,
      now: options.now,
    },
    defaultMessagingJobsRuntime,
  );
}

async function runManualMailboxLocalSyncNowWithRuntime(
  options: {
    userId: string;
    mailbox: MessagingLocalSyncMailbox;
    now?: Date;
  },
  runtime: MessagingJobsRuntime,
): Promise<RunManualMessagingLocalSyncResult> {
  return runMessagingLocalJobNowWithRuntime(
    {
      userId: options.userId,
      mailbox: options.mailbox,
      type: LOCAL_SYNC_MANUAL_MAILBOX_JOB_TYPE,
      reason: "manual-refresh",
      priority: LOCAL_SYNC_MANUAL_PRIORITY,
      dedupeWindowMs: LOCAL_SYNC_MANUAL_DEDUPE_WINDOW_MS,
      now: options.now,
    },
    runtime,
  );
}

async function queueMessagingLocalJobWithRuntime(
  options: {
    userId: string;
    type: typeof LOCAL_SYNC_JOB_TYPES[number];
    reason: string;
    priority: number;
    dedupeWindowMs: number;
    now?: Date;
    mailbox?: MessagingLocalSyncMailbox;
  },
  runtime: MessagingJobsRuntime,
): Promise<MessagingJobQueueResult> {
  const now = options.now ?? new Date();
  const dedupeParts = [
    options.userId,
    options.mailbox ?? "all",
    computeSlotKey(now, options.dedupeWindowMs),
  ];
  const queued = await enqueueLocalSyncJob(runtime, {
    type: options.type,
    payload: {
      userId: options.userId,
      ...(options.mailbox ? { mailbox: options.mailbox } : {}),
      reason: options.reason,
    },
    dedupeKey: dedupeParts.join(":"),
    priority: options.priority,
    runAt: now,
  });

  return {
    jobId: queued.job.id,
    deduped: queued.deduped,
  };
}

async function runMessagingLocalJobNowWithRuntime(
  options: {
    userId: string;
    type: typeof LOCAL_SYNC_JOB_TYPES[number];
    reason: string;
    priority: number;
    dedupeWindowMs: number;
    now?: Date;
    mailbox?: MessagingLocalSyncMailbox;
  },
  runtime: MessagingJobsRuntime,
): Promise<RunManualMessagingLocalSyncResult> {
  const queued = await queueMessagingLocalJobWithRuntime(options, runtime);
  const queue = await runtime.processJobQueue({
    handlers: createMessagingJobHandlers(runtime),
    maxJobs: 1,
    allowedTypes: [options.type],
  });

  return {
    jobId: queued.jobId,
    deduped: queued.deduped,
    queue,
  };
}

function parseAutoReplyPayload(
  jobType: string,
  payload: unknown,
): {
  userId: string;
  bootstrapMode: "process" | "skip";
} {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Payload manquant pour le job ${jobType}`);
  }
  const userId = (payload as Record<string, unknown>).userId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Identifiant utilisateur invalide pour le balayage Messagerie.");
  }
  const bootstrapMode =
    (payload as Record<string, unknown>).bootstrapMode === "process"
      ? "process"
      : "skip";
  return { userId, bootstrapMode };
}

function parseAutoForwardMessagePayload(
  jobType: string,
  payload: unknown,
): MessagingAutoForwardJobPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Payload manquant pour le job ${jobType}`);
  }
  const record = payload as Record<string, unknown>;
  const userId = record.userId;
  const mailbox = record.mailbox;
  const uidValidity = record.uidValidity;
  const uid = record.uid;
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("Identifiant utilisateur invalide pour le transfert automatique.");
  }
  if (mailbox !== "inbox") {
    throw new Error("Boîte invalide pour le transfert automatique.");
  }
  if (
    typeof uidValidity !== "number" ||
    !Number.isInteger(uidValidity) ||
    uidValidity <= 0
  ) {
    throw new Error("UIDVALIDITY invalide pour le transfert automatique.");
  }
  if (typeof uid !== "number" || !Number.isInteger(uid) || uid <= 0) {
    throw new Error("UID invalide pour le transfert automatique.");
  }
  return {
    userId,
    mailbox,
    uidValidity,
    uid,
  };
}

function parseLocalSyncJobPayload(
  jobType: string,
  payload: unknown,
  options: {
    mailboxRequired: true;
  },
): {
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  reason: string | null;
};
function parseLocalSyncJobPayload(
  jobType: string,
  payload: unknown,
  options?: {
    mailboxRequired?: false;
  },
): {
  userId: string;
  mailbox?: MessagingLocalSyncMailbox;
  reason: string | null;
};
function parseLocalSyncJobPayload(
  jobType: string,
  payload: unknown,
  options?: {
    mailboxRequired?: boolean;
  },
): {
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  reason: string | null;
} | {
  userId: string;
  mailbox?: MessagingLocalSyncMailbox;
  reason: string | null;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Payload manquant pour le job ${jobType}`);
  }

  const record = payload as Record<string, unknown>;
  const userId = record.userId;
  const reason =
    typeof record.reason === "string" && record.reason.trim().length > 0
      ? record.reason.trim()
      : null;
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error(
      `Identifiant utilisateur invalide pour le job ${jobType}.`,
    );
  }

  const mailbox = record.mailbox;
  if (typeof mailbox === "undefined" || mailbox === null || mailbox === "") {
    if (options?.mailboxRequired) {
      throw new Error(`Boîte aux lettres manquante pour le job ${jobType}.`);
    }
    return {
      userId,
      reason,
    };
  }

  if (
    typeof mailbox !== "string" ||
    !MESSAGING_LOCAL_SYNC_MAILBOX_VALUES.includes(
      mailbox as MessagingLocalSyncMailbox,
    )
  ) {
    throw new Error(`Boîte aux lettres invalide pour le job ${jobType}.`);
  }

  return {
    userId,
    mailbox: mailbox as MessagingLocalSyncMailbox,
    reason,
  };
}

function shouldScheduleAutoReply(
  settings: {
    autoReplyEnabled: boolean;
    vacationModeEnabled: boolean;
    vacationStartDate: Date | null;
    vacationEndDate: Date | null;
  },
  referenceDate: Date,
): boolean {
  if (settings.autoReplyEnabled) {
    return true;
  }
  if (!settings.vacationModeEnabled) {
    return false;
  }
  if (!settings.vacationStartDate || !settings.vacationEndDate) {
    return false;
  }
  const start = normalizeDate(settings.vacationStartDate);
  const end = normalizeDate(settings.vacationEndDate);
  if (!start || !end || end < start) {
    return false;
  }
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return referenceDate >= start && referenceDate <= end;
}

function shouldScheduleLocalSyncBootstrap(
  states: Array<{
    mailbox: MessagingLocalSyncMailbox;
    status: string;
    lastSuccessfulSyncAt: Date | string | null;
  }>,
): boolean {
  const statesByMailbox = new Map(
    states.map((state) => [state.mailbox, state]),
  );

  return MESSAGING_LOCAL_SYNC_MAILBOX_VALUES.some((mailbox) => {
    const state = statesByMailbox.get(mailbox);
    if (!state) {
      return true;
    }
    if (!state.lastSuccessfulSyncAt) {
      return true;
    }
    return (
      state.status === "DISABLED" ||
      state.status === "BOOTSTRAPPING" ||
      state.status === "ERROR"
    );
  });
}

function selectLocalSyncPurgeCandidates(
  userIdsWithLocalData: string[],
  settings: Array<{ userId: string; localSyncEnabled: boolean }>,
): string[] {
  const enabledUserIds = new Set(
    settings
      .filter((entry) => entry.localSyncEnabled)
      .map((entry) => entry.userId),
  );

  return userIdsWithLocalData.filter((userId) => !enabledUserIds.has(userId));
}

function normalizeDate(value: Date | null): Date | null {
  if (!value) {
    return null;
  }
  const copy = new Date(value);
  if (Number.isNaN(copy.getTime())) {
    return null;
  }
  return copy;
}

function computeSlotKey(reference: Date, intervalMs: number): number {
  return Math.floor(reference.getTime() / intervalMs);
}

function shouldHandleEmailAutomation(scope: MessagingCronScope): boolean {
  return scope === "all" || scope === "email";
}

function shouldHandleLocalSync(scope: MessagingCronScope): boolean {
  return scope === "all" || scope === "local-sync";
}

function getAllowedTypesForScope(
  scope: MessagingCronScope,
): readonly string[] | undefined {
  if (scope === "email") {
    return EMAIL_CRON_JOB_TYPES;
  }
  if (scope === "local-sync") {
    return LOCAL_SYNC_JOB_TYPES;
  }
  return undefined;
}

function getMaxJobsForScope(scope: MessagingCronScope): number {
  if (scope === "local-sync") {
    return 5;
  }
  return 25;
}

export const __testables = {
  createMessagingJobHandlers,
  scheduleMessagingJobsWithRuntime,
  runMessagingCronTickWithRuntime,
  scheduleMessagingCronTickWithRuntime,
  processMessagingCronQueueWithRuntime,
  queueMessagingLocalJobWithRuntime,
  runMessagingLocalJobNowWithRuntime,
  runManualMailboxLocalSyncNowWithRuntime,
  parseLocalSyncJobPayload,
  parseAutoForwardMessagePayload,
  shouldProcessCronLocalSyncIncrementally,
  selectCronLocalSyncMailbox,
  shouldScheduleAutoReply,
  shouldScheduleLocalSyncBootstrap,
  selectLocalSyncPurgeCandidates,
  computeSlotKey,
  getAllowedTypesForScope,
  shouldHandleEmailAutomation,
  shouldHandleLocalSync,
  LOCAL_SYNC_JOB_TYPES,
  EMAIL_CRON_JOB_TYPES,
  AUTO_FORWARD_SWEEP_JOB_TYPE,
};
