import { Prisma, MessagingScheduledStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveUserId,
  sendEmailMessageForUser,
  getMessagingCredentials,
  type EmailAttachment,
  type ComposeEmailInput,
  type MessagingCredentials,
} from "@/server/messaging";

function assertLegacyWorkerFlagDisabled() {
  if (process.env.SCHEDULED_EMAIL_WORKER_ENABLED === "1") {
    const message =
      "SCHEDULED_EMAIL_WORKER_ENABLED is no longer supported. Use the /api/cron/messaging endpoint (triggered via GitHub Actions or another scheduler) instead of starting a worker inside serverless runtimes.";
    throw new Error(message);
  }
}

assertLegacyWorkerFlagDisabled();

const DISPATCH_BATCH_SIZE = 10;

type JsonArray = Prisma.JsonArray;

type ScheduleEmailInput = {
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  sendAt: Date;
  attachments: EmailAttachment[];
};

export type ScheduledEmailSummary = {
  id: string;
  subject: string;
  to: string[];
  cc: string[];
  bcc: string[];
  sendAt: string;
  status: MessagingScheduledStatus;
  failureReason: string | null;
  createdAt: string;
  previewText: string;
  attachmentsCount: number;
};

export async function scheduleEmailDraft(
  input: ScheduleEmailInput,
): Promise<{ id: string; sendAt: string }> {
  if (input.to.length === 0) {
    throw new Error("Destinataire requis.");
  }
  if (input.sendAt.getTime() <= Date.now()) {
    throw new Error("L'heure d'envoi doit être dans le futur.");
  }

  const previewText = input.text.trim().slice(0, 400);

  const attachmentData = input.attachments.map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType ?? null,
    size: attachment.content.byteLength,
    content: Buffer.from(attachment.content),
  }));

  const record = await prisma.messagingScheduledEmail.create({
    data: {
      userId: input.userId,
      to: input.to as JsonArray,
      cc: input.cc?.length ? (input.cc as JsonArray) : undefined,
      bcc: input.bcc?.length ? (input.bcc as JsonArray) : undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
      previewText: previewText.length ? previewText : input.subject,
      sendAt: input.sendAt,
      attachments: attachmentData.length
        ? {
            create: attachmentData,
          }
        : undefined,
    },
  });

  return {
    id: record.id,
    sendAt: record.sendAt.toISOString(),
  };
}

export async function listScheduledEmails(
  userId?: string,
): Promise<ScheduledEmailSummary[]> {
  const resolvedUserId = await resolveUserId(userId);
  const records = await prisma.messagingScheduledEmail.findMany({
    where: {
      userId: resolvedUserId,
      status: {
        in: [
          MessagingScheduledStatus.PENDING,
          MessagingScheduledStatus.SENDING,
          MessagingScheduledStatus.FAILED,
          MessagingScheduledStatus.CANCELLED,
        ],
      },
    },
    orderBy: [
      { status: "asc" },
      { sendAt: "asc" },
    ],
    include: {
      attachments: {
        select: { id: true },
      },
    },
  });

  return records.map((record) => ({
    id: record.id,
    subject: record.subject,
    to: toStringArray(record.to),
    cc: toStringArray(record.cc),
    bcc: toStringArray(record.bcc),
    sendAt: record.sendAt.toISOString(),
    status: record.status,
    failureReason: record.failureReason,
    createdAt: record.createdAt.toISOString(),
    previewText: record.previewText,
    attachmentsCount: record.attachments.length,
  }));
}

export async function rescheduleScheduledEmail(options: {
  id: string;
  sendAt: Date;
  userId?: string;
}): Promise<void> {
  if (options.sendAt.getTime() <= Date.now()) {
    throw new Error("L'heure d'envoi doit être dans le futur.");
  }
  const resolvedUserId = await resolveUserId(options.userId);
  const updated = await prisma.messagingScheduledEmail.updateMany({
    where: {
      id: options.id,
      userId: resolvedUserId,
      status: {
        in: [MessagingScheduledStatus.PENDING, MessagingScheduledStatus.FAILED],
      },
    },
    data: {
      sendAt: options.sendAt,
      status: MessagingScheduledStatus.PENDING,
      failureReason: null,
    },
  });
  if (updated.count === 0) {
    throw new Error(
      "Impossible de replanifier cet e-mail. Vérifiez son statut.",
    );
  }
}

export async function cancelScheduledEmail(options: {
  id: string;
  userId?: string;
}): Promise<void> {
  const resolvedUserId = await resolveUserId(options.userId);
  const updated = await prisma.messagingScheduledEmail.updateMany({
    where: {
      id: options.id,
      userId: resolvedUserId,
      status: {
        in: [
          MessagingScheduledStatus.PENDING,
          MessagingScheduledStatus.SENDING,
          MessagingScheduledStatus.FAILED,
        ],
      },
    },
    data: {
      status: MessagingScheduledStatus.CANCELLED,
      canceledAt: new Date(),
    },
  });
  if (updated.count === 0) {
    throw new Error("Impossible d'annuler cet e-mail planifié.");
  }
}

export async function runScheduledEmailDispatchCycle(): Promise<void> {
  await dispatchDueScheduledEmails();
}

async function dispatchDueScheduledEmails(): Promise<void> {
  const now = new Date();
  const dueEmails = await prisma.messagingScheduledEmail.findMany({
    where: {
      status: MessagingScheduledStatus.PENDING,
      sendAt: { lte: now },
    },
    orderBy: { sendAt: "asc" },
    take: DISPATCH_BATCH_SIZE,
    include: {
      attachments: true,
    },
  });

  const credentialCache = new Map<string, MessagingCredentials>();

  for (const scheduled of dueEmails) {
    const locked = await prisma.messagingScheduledEmail.updateMany({
      where: { id: scheduled.id, status: MessagingScheduledStatus.PENDING },
      data: { status: MessagingScheduledStatus.SENDING },
    });
    if (locked.count === 0) {
      continue;
    }

    try {
      const cachedCredentials = await getCachedMessagingCredentials(
        scheduled.userId,
        credentialCache,
      );
      await sendEmailMessageForUser(scheduled.userId, {
        to: toStringArray(scheduled.to),
        cc: toOptionalArray(scheduled.cc),
        bcc: toOptionalArray(scheduled.bcc),
        subject: scheduled.subject,
        text: scheduled.text,
        html: scheduled.html,
        attachments:
          scheduled.attachments.length > 0
            ? scheduled.attachments.map((attachment) => ({
                filename: attachment.filename ?? "piece-jointe",
                contentType: attachment.contentType ?? undefined,
                content: Buffer.from(attachment.content),
              }))
            : undefined,
      } satisfies ComposeEmailInput, {
        credentials: cachedCredentials,
      });

      await prisma.messagingScheduledEmail.update({
        where: { id: scheduled.id },
        data: {
          status: MessagingScheduledStatus.SENT,
          sentAt: new Date(),
          failureReason: null,
        },
      });
    } catch (error) {
      await prisma.messagingScheduledEmail.update({
        where: { id: scheduled.id },
        data: {
          status: MessagingScheduledStatus.FAILED,
          failureReason:
            error instanceof Error ? truncateMessage(error.message) : "Erreur inconnue.",
        },
      });
      console.warn(
        "Impossible d'envoyer l'e-mail planifié:",
        error,
      );
    }
  }
}

async function getCachedMessagingCredentials(
  userId: string,
  cache: Map<string, MessagingCredentials>,
) {
  const cached = cache.get(userId);
  if (cached) {
    return cached;
  }
  const credentials = await getMessagingCredentials(userId);
  cache.set(userId, credentials);
  return credentials;
}

function truncateMessage(value: string, length = 300): string {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}…`;
}

function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        typeof entry === "string" ? entry : entry != null ? String(entry) : "",
      )
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function toOptionalArray(
  value: Prisma.JsonValue | null | undefined,
): string[] | undefined {
  const array = toStringArray(value);
  return array.length ? array : undefined;
}
