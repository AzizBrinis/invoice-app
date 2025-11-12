import type { BackgroundJobHandlers } from "@/server/background-jobs";
import { enqueueJob, processJobQueue } from "@/server/background-jobs";
import { prisma } from "@/lib/prisma";
import { runScheduledEmailDispatchCycle } from "@/server/messaging-scheduled";
import { runAutomatedReplySweepForUser } from "@/server/messaging";

const DISPATCH_JOB_TYPE = "messaging.dispatchScheduledEmails";
const AUTO_REPLY_JOB_TYPE = "messaging.syncInboxAutoReplies";
const SCHEDULED_EMAIL_INTERVAL_MS = 60 * 1000;
const AUTO_REPLY_INTERVAL_MS = 60 * 1000;
const AUTO_REPLY_RETRY_BACKOFF_MS = 2 * 60 * 1000;

const messagingJobHandlers: BackgroundJobHandlers = {
  [DISPATCH_JOB_TYPE]: async () => {
    await runScheduledEmailDispatchCycle();
  },
  [AUTO_REPLY_JOB_TYPE]: async ({ job, payload }) => {
    if (!payload || typeof payload !== "object") {
      throw new Error(`Payload manquant pour le job ${job.type}`);
    }
    const userId = (payload as Record<string, unknown>).userId;
    if (typeof userId !== "string" || userId.length === 0) {
      throw new Error("Identifiant utilisateur invalide pour le balayage Messagerie.");
    }
    const bootstrapMode = (payload as Record<string, unknown>).bootstrapMode === "process" ? "process" : "skip";
    await runAutomatedReplySweepForUser(userId, { bootstrapMode });
  },
};

export async function runMessagingCronTick(now = new Date()) {
  const scheduled = await scheduleMessagingJobs(now);
  const queueResult = await processJobQueue({ handlers: messagingJobHandlers, maxJobs: 25 });
  return {
    scheduled,
    queue: queueResult,
    timestamp: now.toISOString(),
  };
}

async function scheduleMessagingJobs(now: Date) {
  const scheduledEmails = await enqueueDispatchJob(now);
  const autoReplies = await enqueueAutoReplyJobs(now);
  return { scheduledEmails, autoReplies };
}

async function enqueueDispatchJob(now: Date) {
  const slotKey = computeSlotKey(now, SCHEDULED_EMAIL_INTERVAL_MS);
  const dedupeKey = `scheduled:${slotKey}`;
  const result = await enqueueJob({
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

async function enqueueAutoReplyJobs(now: Date) {
  const slotKey = computeSlotKey(now, AUTO_REPLY_INTERVAL_MS);
  const candidates = await prisma.messagingSettings.findMany({
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

  let enqueued = 0;
  let deduped = 0;

  for (const candidate of candidates) {
    if (!shouldScheduleAutoReply(candidate, now)) {
      continue;
    }
    const dedupeKey = `${candidate.userId}:${slotKey}`;
    const payload = { userId: candidate.userId, bootstrapMode: "skip" } as const;
    const result = await enqueueJob({
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

export const __testables = {
  shouldScheduleAutoReply,
  computeSlotKey,
};
