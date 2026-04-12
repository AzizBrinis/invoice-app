import { Prisma } from "@/lib/db/prisma-server";
import type { BackgroundJobHandlers } from "@/server/background-jobs";
import { enqueueJob, processJobQueue } from "@/server/background-jobs";
import {
  sendOrderCreatedEmail,
  sendOrderPaymentReceivedEmail,
  sendOrderTransferProofReceivedEmail,
  sendQuoteRequestEmail,
} from "@/server/order-email";

export const SEND_ORDER_CREATED_EMAIL_JOB_TYPE = "orders.sendCreatedEmail";
export const SEND_ORDER_PAYMENT_EMAIL_JOB_TYPE = "orders.sendPaymentEmail";
export const SEND_ORDER_PROOF_EMAIL_JOB_TYPE = "orders.sendProofEmail";
export const SEND_QUOTE_REQUEST_EMAIL_JOB_TYPE = "orders.sendQuoteRequestEmail";
const ORDER_EMAIL_JOB_TYPES = [
  SEND_ORDER_CREATED_EMAIL_JOB_TYPE,
  SEND_ORDER_PAYMENT_EMAIL_JOB_TYPE,
  SEND_ORDER_PROOF_EMAIL_JOB_TYPE,
  SEND_QUOTE_REQUEST_EMAIL_JOB_TYPE,
] as const;

const DEDUPE_WINDOW_MS = 30_000;

type QueueResult = {
  jobId: string;
  deduped: boolean;
};

function toJobPayload(payload: Record<string, unknown>): Prisma.JsonObject {
  return JSON.parse(JSON.stringify(payload)) as Prisma.JsonObject;
}

type SendOrderCreatedEmailPayload = {
  userId: string;
  orderId: string;
  to: string;
  subject?: string | null;
};

type SendOrderPaymentEmailPayload = {
  userId: string;
  orderId: string;
  to: string;
  subject?: string | null;
};

type SendOrderProofEmailPayload = {
  userId: string;
  orderId: string;
  to: string;
  subject?: string | null;
};

type SendQuoteRequestEmailPayload = {
  userId: string;
  quoteRequestId: string;
  to: string;
  subject?: string | null;
};

export const orderEmailJobHandlers: BackgroundJobHandlers = {
  [SEND_ORDER_CREATED_EMAIL_JOB_TYPE]: async ({ payload }) => {
    const parsed = parseOrderCreatedPayload(payload);
    await sendOrderCreatedEmail({
      userId: parsed.userId,
      orderId: parsed.orderId,
      to: parsed.to,
      subject: parsed.subject ?? undefined,
    });
  },
  [SEND_ORDER_PAYMENT_EMAIL_JOB_TYPE]: async ({ payload }) => {
    const parsed = parseOrderPaymentPayload(payload);
    await sendOrderPaymentReceivedEmail({
      userId: parsed.userId,
      orderId: parsed.orderId,
      to: parsed.to,
      subject: parsed.subject ?? undefined,
    });
  },
  [SEND_ORDER_PROOF_EMAIL_JOB_TYPE]: async ({ payload }) => {
    const parsed = parseOrderProofPayload(payload);
    await sendOrderTransferProofReceivedEmail({
      userId: parsed.userId,
      orderId: parsed.orderId,
      to: parsed.to,
      subject: parsed.subject ?? undefined,
    });
  },
  [SEND_QUOTE_REQUEST_EMAIL_JOB_TYPE]: async ({ payload }) => {
    const parsed = parseQuoteRequestPayload(payload);
    await sendQuoteRequestEmail({
      userId: parsed.userId,
      quoteRequestId: parsed.quoteRequestId,
      to: parsed.to,
      subject: parsed.subject ?? undefined,
    });
  },
};

export async function queueOrderCreatedEmailJob(options: {
  userId: string;
  orderId: string;
  to: string;
  subject?: string | null;
}): Promise<QueueResult> {
  return queueOrderEmailJob({
    jobType: SEND_ORDER_CREATED_EMAIL_JOB_TYPE,
    userId: options.userId,
    entityId: options.orderId,
    to: options.to,
    subject: options.subject ?? null,
    payload: {
      userId: options.userId,
      orderId: options.orderId,
      to: options.to,
      subject: options.subject ?? null,
    },
  });
}

export async function queueOrderPaymentReceivedEmailJob(options: {
  userId: string;
  orderId: string;
  to: string;
  subject?: string | null;
}): Promise<QueueResult> {
  return queueOrderEmailJob({
    jobType: SEND_ORDER_PAYMENT_EMAIL_JOB_TYPE,
    userId: options.userId,
    entityId: options.orderId,
    to: options.to,
    subject: options.subject ?? null,
    payload: {
      userId: options.userId,
      orderId: options.orderId,
      to: options.to,
      subject: options.subject ?? null,
    },
  });
}

export async function queueOrderTransferProofReceivedEmailJob(options: {
  userId: string;
  orderId: string;
  to: string;
  subject?: string | null;
}): Promise<QueueResult> {
  return queueOrderEmailJob({
    jobType: SEND_ORDER_PROOF_EMAIL_JOB_TYPE,
    userId: options.userId,
    entityId: options.orderId,
    to: options.to,
    subject: options.subject ?? null,
    payload: {
      userId: options.userId,
      orderId: options.orderId,
      to: options.to,
      subject: options.subject ?? null,
    },
  });
}

export async function queueQuoteRequestEmailJob(options: {
  userId: string;
  quoteRequestId: string;
  to: string;
  subject?: string | null;
}): Promise<QueueResult> {
  return queueOrderEmailJob({
    jobType: SEND_QUOTE_REQUEST_EMAIL_JOB_TYPE,
    userId: options.userId,
    entityId: options.quoteRequestId,
    to: options.to,
    subject: options.subject ?? null,
    payload: {
      userId: options.userId,
      quoteRequestId: options.quoteRequestId,
      to: options.to,
      subject: options.subject ?? null,
    },
  });
}

async function queueOrderEmailJob(options: {
  jobType: string;
  userId: string;
  entityId: string;
  to: string;
  subject?: string | null;
  payload: Record<string, unknown>;
}): Promise<QueueResult> {
  const normalizedEmail = options.to.trim();
  if (!normalizedEmail) {
    throw new Error("Adresse e-mail requise.");
  }

  const jobResult = await enqueueJob({
    type: options.jobType,
    payload: toJobPayload(options.payload),
    priority: 70,
    dedupeKey: computeDedupeKey(
      options.jobType,
      options.userId,
      options.entityId,
      normalizedEmail,
    ),
  });

  scheduleOrderEmailJobProcessing();

  return {
    jobId: jobResult.job.id,
    deduped: jobResult.deduped,
  };
}

function parseOrderCreatedPayload(payload: unknown): SendOrderCreatedEmailPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload invalide pour l'email de commande.");
  }
  const candidate = payload as Record<string, unknown>;
  const required = ["userId", "orderId", "to"];
  for (const key of required) {
    if (typeof candidate[key] !== "string" || !(candidate[key] as string).length) {
      throw new Error(`Champ manquant dans le job commande: ${key}`);
    }
  }
  return {
    userId: candidate.userId as string,
    orderId: candidate.orderId as string,
    to: candidate.to as string,
    subject:
      typeof candidate.subject === "string" && candidate.subject.length
        ? candidate.subject
        : null,
  };
}

function parseOrderPaymentPayload(payload: unknown): SendOrderPaymentEmailPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload invalide pour l'email de paiement.");
  }
  const candidate = payload as Record<string, unknown>;
  const required = ["userId", "orderId", "to"];
  for (const key of required) {
    if (typeof candidate[key] !== "string" || !(candidate[key] as string).length) {
      throw new Error(`Champ manquant dans le job paiement: ${key}`);
    }
  }
  return {
    userId: candidate.userId as string,
    orderId: candidate.orderId as string,
    to: candidate.to as string,
    subject:
      typeof candidate.subject === "string" && candidate.subject.length
        ? candidate.subject
        : null,
  };
}

function parseOrderProofPayload(payload: unknown): SendOrderProofEmailPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload invalide pour l'email de preuve.");
  }
  const candidate = payload as Record<string, unknown>;
  const required = ["userId", "orderId", "to"];
  for (const key of required) {
    if (typeof candidate[key] !== "string" || !(candidate[key] as string).length) {
      throw new Error(`Champ manquant dans le job preuve: ${key}`);
    }
  }
  return {
    userId: candidate.userId as string,
    orderId: candidate.orderId as string,
    to: candidate.to as string,
    subject:
      typeof candidate.subject === "string" && candidate.subject.length
        ? candidate.subject
        : null,
  };
}

function parseQuoteRequestPayload(payload: unknown): SendQuoteRequestEmailPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload invalide pour l'email de devis.");
  }
  const candidate = payload as Record<string, unknown>;
  const required = ["userId", "quoteRequestId", "to"];
  for (const key of required) {
    if (typeof candidate[key] !== "string" || !(candidate[key] as string).length) {
      throw new Error(`Champ manquant dans le job devis: ${key}`);
    }
  }
  return {
    userId: candidate.userId as string,
    quoteRequestId: candidate.quoteRequestId as string,
    to: candidate.to as string,
    subject:
      typeof candidate.subject === "string" && candidate.subject.length
        ? candidate.subject
        : null,
  };
}

function computeDedupeKey(
  jobType: string,
  userId: string,
  entityId: string,
  to: string,
): string {
  const slot = Math.floor(Date.now() / DEDUPE_WINDOW_MS);
  return `${jobType}:${userId}:${entityId}:${to.toLowerCase()}:${slot}`;
}

let orderEmailJobFlushInFlight = false;

function scheduleOrderEmailJobProcessing() {
  if (orderEmailJobFlushInFlight) {
    return;
  }
  orderEmailJobFlushInFlight = true;

  const run = async () => {
    try {
      await processJobQueue({
        handlers: orderEmailJobHandlers,
        maxJobs: 5,
        allowedTypes: ORDER_EMAIL_JOB_TYPES,
      });
    } catch (error) {
      console.error("[order-email-jobs] processing failed", error);
    } finally {
      orderEmailJobFlushInFlight = false;
    }
  };

  scheduleAsync(run);
}

type AsyncTask = () => Promise<void>;

const scheduleAsync: (task: AsyncTask) => void =
  typeof setImmediate === "function"
    ? (task) => {
        setImmediate(() => {
          void task();
        });
      }
    : (task) => {
        setTimeout(() => {
          void task();
        }, 0);
      };
