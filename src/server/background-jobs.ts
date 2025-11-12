import { Prisma, BackgroundJobStatus, BackgroundJobEventType, type BackgroundJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BackgroundJobHandler = (context: {
  job: BackgroundJob;
  payload: Prisma.JsonValue | null;
}) => Promise<void>;

export type BackgroundJobHandlers = Record<string, BackgroundJobHandler>;

export type EnqueueJobOptions = {
  type: string;
  payload?: Prisma.JsonValue;
  dedupeKey?: string | null;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
  retryBackoffMs?: number;
};

export type EnqueueJobResult = {
  job: BackgroundJob;
  deduped: boolean;
};

export type ProcessJobQueueResult = {
  processed: number;
  completed: number;
  failed: number;
  retried: number;
  skipped: number;
  details: Array<{
    jobId: string;
    type: string;
    status: "success" | "failed" | "retry" | "skipped";
    attempts: number;
    message?: string;
  }>;
};

const MAX_LEASE_ATTEMPTS = 5;

export async function enqueueJob(options: EnqueueJobOptions): Promise<EnqueueJobResult> {
  const payload = options.payload ?? null;
  const dedupeKey = options.dedupeKey ?? null;
  try {
    const job = await prisma.backgroundJob.create({
      data: {
        type: options.type,
        payload: normalizeJsonInput(payload),
        dedupeKey,
        priority: options.priority ?? 0,
        runAt: options.runAt ?? new Date(),
        maxAttempts: options.maxAttempts ?? 5,
        retryBackoffMs: options.retryBackoffMs ?? 60_000,
      },
    });

    await recordJobEvent(job.id, BackgroundJobEventType.ENQUEUED, {
      dedupeKey,
      priority: job.priority,
    });

    return { job, deduped: false };
  } catch (error) {
    if (
      dedupeKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.backgroundJob.findFirst({
        where: { type: options.type, dedupeKey },
      });
      if (existing) {
        await recordJobEvent(existing.id, BackgroundJobEventType.DEDUPED, {
          dedupeKey,
        });
        return { job: existing, deduped: true };
      }
    }
    throw error;
  }
}

export async function processJobQueue(options: {
  handlers: BackgroundJobHandlers;
  maxJobs?: number;
}): Promise<ProcessJobQueueResult> {
  const handlers = options.handlers;
  const limit = Math.max(1, options.maxJobs ?? 20);
  const details: ProcessJobQueueResult["details"] = [];
  let completed = 0;
  let failed = 0;
  let retried = 0;
  let skipped = 0;

  for (let i = 0; i < limit; i++) {
    const job = await leaseNextJob();
    if (!job) {
      break;
    }

    const handler = handlers[job.type];
    if (!handler) {
      const message = `Aucun handler enregistré pour ${job.type}`;
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: BackgroundJobStatus.FAILED,
          lastError: message,
          completedAt: new Date(),
        },
      });
      await recordJobEvent(job.id, BackgroundJobEventType.FAILED, { message });
      details.push({
        jobId: job.id,
        type: job.type,
        status: "failed",
        attempts: job.attempts,
        message,
      });
      failed += 1;
      continue;
    }

    try {
      await handler({ job, payload: job.payload });
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          completedAt: new Date(),
          lastError: null,
        },
      });
      await recordJobEvent(job.id, BackgroundJobEventType.SUCCEEDED, {
        attempts: job.attempts,
      });
      details.push({
        jobId: job.id,
        type: job.type,
        status: "success",
        attempts: job.attempts,
      });
      completed += 1;
    } catch (error) {
      const failure = await handleJobFailure(job, error);
      details.push({
        jobId: job.id,
        type: job.type,
        status: failure.status,
        attempts: job.attempts,
        message: failure.message,
      });
      if (failure.status === "failed") {
        failed += 1;
      } else if (failure.status === "retry") {
        retried += 1;
      } else {
        skipped += 1;
      }
    }
  }

  return {
    processed: details.length,
    completed,
    failed,
    retried,
    skipped,
    details,
  };
}

export async function getJobMetrics() {
  const grouped = await prisma.backgroundJob.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const totals: Record<string, number> = {};
  for (const entry of grouped) {
    totals[entry.status] = entry._count.status ?? 0;
  }

  const upcoming = await prisma.backgroundJob.findMany({
    where: { status: BackgroundJobStatus.PENDING },
    orderBy: [{ runAt: "asc" }],
    take: 5,
    select: { id: true, type: true, runAt: true, priority: true },
  });

  const recentEvents = await prisma.backgroundJobEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      jobId: true,
      type: true,
      detail: true,
      createdAt: true,
    },
  });

  return {
    totals,
    upcoming,
    recentEvents,
  };
}

async function leaseNextJob(): Promise<BackgroundJob | null> {
  const now = new Date();
  for (let attempt = 0; attempt < MAX_LEASE_ATTEMPTS; attempt += 1) {
    const candidate = await prisma.backgroundJob.findFirst({
      where: {
        status: BackgroundJobStatus.PENDING,
        runAt: { lte: now },
      },
      orderBy: [
        { priority: "desc" },
        { runAt: "asc" },
        { createdAt: "asc" },
      ],
    });
    if (!candidate) {
      return null;
    }

    const locked = await prisma.backgroundJob.updateMany({
      where: { id: candidate.id, status: BackgroundJobStatus.PENDING },
      data: {
        status: BackgroundJobStatus.RUNNING,
        lockedAt: now,
        lastRunAt: now,
        attempts: candidate.attempts + 1,
        lastError: null,
      },
    });

    if (locked.count === 0) {
      continue;
    }

    await recordJobEvent(candidate.id, BackgroundJobEventType.STARTED, {
      attempts: candidate.attempts + 1,
    });

    const fresh = await prisma.backgroundJob.findUnique({ where: { id: candidate.id } });
    if (fresh) {
      return fresh;
    }
  }

  return null;
}

async function handleJobFailure(job: BackgroundJob, error: unknown): Promise<{
  status: "retry" | "failed";
  message: string;
}> {
  const message = normalizeErrorMessage(error);
  const now = new Date();
  if (job.attempts >= job.maxAttempts) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: BackgroundJobStatus.FAILED,
        lastError: message,
        completedAt: now,
      },
    });
    await recordJobEvent(job.id, BackgroundJobEventType.FAILED, { message });
    await sendJobFailureAlert(job, message);
    return { status: "failed", message };
  }

  const delay = computeBackoffDelay(job.attempts, job.retryBackoffMs);
  const nextRun = new Date(Date.now() + delay);

  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: {
      status: BackgroundJobStatus.PENDING,
      runAt: nextRun,
      lastError: message,
    },
  });
  await recordJobEvent(job.id, BackgroundJobEventType.RETRY_SCHEDULED, {
    delayMs: delay,
    runAt: nextRun.toISOString(),
  });
  return { status: "retry", message };
}

function computeBackoffDelay(attempt: number, baseDelay: number): number {
  const safeBase = Number.isFinite(baseDelay) && baseDelay > 0 ? baseDelay : 60_000;
  const exponent = Math.max(0, attempt - 1);
  return Math.min(safeBase * 2 ** exponent, 60 * 60 * 1000);
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Erreur inconnue";
}

function normalizeJsonInput(
  value: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

async function recordJobEvent(
  jobId: string,
  type: BackgroundJobEventType,
  detail?: Prisma.JsonValue | null,
) {
  try {
    await prisma.backgroundJobEvent.create({
      data: {
        jobId,
        type,
        detail: normalizeJsonInput(detail),
      },
    });
  } catch (error) {
    console.warn("Impossible d'enregistrer l'événement de job", jobId, type, error);
  }
}

async function sendJobFailureAlert(job: BackgroundJob, message: string) {
  const webhook = process.env.JOBS_ALERT_WEBHOOK_URL;
  if (!webhook) {
    return;
  }
  try {
    await fetch(webhook, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jobId: job.id,
        type: job.type,
        message,
        attempts: job.attempts,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn("Impossible d'envoyer l'alerte de job", job.id, error);
  }
}

export const __testables = {
  computeBackoffDelay,
};
