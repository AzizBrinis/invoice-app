import { DocumentType, EmailStatus, Prisma } from "@prisma/client";
import type { BackgroundJobHandlers } from "@/server/background-jobs";
import { enqueueJob, processJobQueue } from "@/server/background-jobs";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail, sendQuoteEmail } from "@/server/email";

export const SEND_INVOICE_EMAIL_JOB_TYPE = "billing.sendInvoiceEmail";
export const SEND_QUOTE_EMAIL_JOB_TYPE = "billing.sendQuoteEmail";
const DOCUMENT_EMAIL_JOB_TYPES = [
  SEND_INVOICE_EMAIL_JOB_TYPE,
  SEND_QUOTE_EMAIL_JOB_TYPE,
] as const;

const DEDUPE_WINDOW_MS = 30_000;

type QueueInvoiceEmailOptions = {
  userId: string;
  invoiceId: string;
  to: string;
  subject?: string | null | undefined;
};

type QueueQuoteEmailOptions = {
  userId: string;
  quoteId: string;
  to: string;
  subject?: string | null | undefined;
};

type QueueResult = {
  jobId: string;
  deduped: boolean;
};

type SendInvoiceEmailJobPayload = {
  userId: string;
  invoiceId: string;
  to: string;
  subject?: string | null;
  emailLogId: string | null;
};

type SendQuoteEmailJobPayload = {
  userId: string;
  quoteId: string;
  to: string;
  subject?: string | null;
  emailLogId: string | null;
};

export const documentEmailJobHandlers: BackgroundJobHandlers = {
  [SEND_INVOICE_EMAIL_JOB_TYPE]: async ({ payload }) => {
    const parsed = parseInvoicePayload(payload);
    try {
      await sendInvoiceEmail({
        invoiceId: parsed.invoiceId,
        to: parsed.to,
        subject: parsed.subject ?? undefined,
        userId: parsed.userId,
        emailLogId: parsed.emailLogId,
      });
    } catch (error) {
      await markEmailLogFailure(parsed.emailLogId, error);
      throw error;
    }
  },
  [SEND_QUOTE_EMAIL_JOB_TYPE]: async ({ payload }) => {
    const parsed = parseQuotePayload(payload);
    try {
      await sendQuoteEmail({
        quoteId: parsed.quoteId,
        to: parsed.to,
        subject: parsed.subject ?? undefined,
        userId: parsed.userId,
        emailLogId: parsed.emailLogId,
      });
    } catch (error) {
      await markEmailLogFailure(parsed.emailLogId, error);
      throw error;
    }
  },
};

export async function queueInvoiceEmailJob(
  options: QueueInvoiceEmailOptions,
): Promise<QueueResult> {
  return queueDocumentEmailJob({
    userId: options.userId,
    documentId: options.invoiceId,
    documentType: DocumentType.FACTURE,
    to: options.to,
    subject: options.subject ?? null,
    jobType: SEND_INVOICE_EMAIL_JOB_TYPE,
    payloadBuilder: ({ emailLogId, normalizedEmail, normalizedSubject }) => ({
      userId: options.userId,
      invoiceId: options.invoiceId,
      to: normalizedEmail,
      subject: normalizedSubject,
      emailLogId,
    }),
  });
}

export async function queueQuoteEmailJob(
  options: QueueQuoteEmailOptions,
): Promise<QueueResult> {
  return queueDocumentEmailJob({
    userId: options.userId,
    documentId: options.quoteId,
    documentType: DocumentType.DEVIS,
    to: options.to,
    subject: options.subject ?? null,
    jobType: SEND_QUOTE_EMAIL_JOB_TYPE,
    payloadBuilder: ({ emailLogId, normalizedEmail, normalizedSubject }) => ({
      userId: options.userId,
      quoteId: options.quoteId,
      to: normalizedEmail,
      subject: normalizedSubject,
      emailLogId,
    }),
  });
}

async function queueDocumentEmailJob(options: {
  userId: string;
  documentId: string;
  documentType: DocumentType;
  to: string;
  subject?: string | null;
  jobType: string;
  payloadBuilder: (context: {
    emailLogId: string;
    normalizedEmail: string;
    normalizedSubject: string | null;
  }) => Prisma.InputJsonObject;
}): Promise<QueueResult> {
  const normalizedEmail = options.to.trim();
  if (!normalizedEmail) {
    throw new Error("Adresse e-mail requise.");
  }
  const normalizedSubjectValue = options.subject?.trim() ?? "";
  const normalizedSubject =
    normalizedSubjectValue.length > 0 ? normalizedSubjectValue : null;
  const pendingSubject: string =
    normalizedSubject ?? defaultSubjectFor(options.documentType);
  const pendingLog = await prisma.emailLog.create({
    data: {
      userId: options.userId,
      documentType: options.documentType,
      documentId: options.documentId,
      to: normalizedEmail,
      subject: pendingSubject,
      status: EmailStatus.EN_ATTENTE,
    },
  });

  const payload = options.payloadBuilder({
    emailLogId: pendingLog.id,
    normalizedEmail,
    normalizedSubject,
  });

  const jobResult = await enqueueJob({
    type: options.jobType,
    payload: payload as Prisma.JsonValue,
    priority: 80,
    dedupeKey: computeDedupeKey(
      options.jobType,
      options.userId,
      options.documentId,
      normalizedEmail,
    ),
  });

  if (jobResult.deduped) {
    await prisma.emailLog
      .delete({ where: { id: pendingLog.id } })
      .catch(() => undefined);
  }

  scheduleDocumentEmailJobProcessing();

  return {
    jobId: jobResult.job.id,
    deduped: jobResult.deduped,
  };
}

function parseInvoicePayload(payload: unknown): SendInvoiceEmailJobPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload invalide pour l'envoi de facture.");
  }
  const candidate = payload as Record<string, unknown>;
  const required = ["userId", "invoiceId", "to"];
  for (const key of required) {
    if (typeof candidate[key] !== "string" || !(candidate[key] as string).length) {
      throw new Error(`Champ manquant dans le job d'envoi de facture: ${key}`);
    }
  }
  return {
    userId: candidate.userId as string,
    invoiceId: candidate.invoiceId as string,
    to: candidate.to as string,
    subject:
      typeof candidate.subject === "string" && candidate.subject.length
        ? candidate.subject
        : null,
    emailLogId:
      typeof candidate.emailLogId === "string" && candidate.emailLogId.length
        ? candidate.emailLogId
        : null,
  };
}

function parseQuotePayload(payload: unknown): SendQuoteEmailJobPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload invalide pour l'envoi de devis.");
  }
  const candidate = payload as Record<string, unknown>;
  const required = ["userId", "quoteId", "to"];
  for (const key of required) {
    if (typeof candidate[key] !== "string" || !(candidate[key] as string).length) {
      throw new Error(`Champ manquant dans le job d'envoi de devis: ${key}`);
    }
  }
  return {
    userId: candidate.userId as string,
    quoteId: candidate.quoteId as string,
    to: candidate.to as string,
    subject:
      typeof candidate.subject === "string" && candidate.subject.length
        ? candidate.subject
        : null,
    emailLogId:
      typeof candidate.emailLogId === "string" && candidate.emailLogId.length
        ? candidate.emailLogId
        : null,
  };
}

async function markEmailLogFailure(logId: string | null, error: unknown) {
  if (!logId) {
    return;
  }
  const message =
    error instanceof Error
      ? error.message
      : "Impossible d'envoyer ce message.";
  await prisma.emailLog
    .update({
      where: { id: logId },
      data: {
        status: EmailStatus.ECHEC,
        error: message.slice(0, 500),
      },
    })
    .catch(() => undefined);
}

function computeDedupeKey(
  jobType: string,
  userId: string,
  documentId: string,
  to: string,
): string {
  const slot = Math.floor(Date.now() / DEDUPE_WINDOW_MS);
  return `${jobType}:${userId}:${documentId}:${to.toLowerCase()}:${slot}`;
}

function defaultSubjectFor(documentType: DocumentType) {
  return documentType === DocumentType.FACTURE
    ? "Envoi de facture"
    : "Envoi de devis";
}

let documentEmailJobFlushInFlight = false;

function scheduleDocumentEmailJobProcessing() {
  if (documentEmailJobFlushInFlight) {
    return;
  }
  documentEmailJobFlushInFlight = true;

  const run = async () => {
    try {
      await processJobQueue({
        handlers: documentEmailJobHandlers,
        maxJobs: 5,
        allowedTypes: DOCUMENT_EMAIL_JOB_TYPES,
      });
    } catch (error) {
      console.error("[document-email-jobs] processing failed", error);
    } finally {
      documentEmailJobFlushInFlight = false;
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
