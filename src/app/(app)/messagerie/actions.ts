"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Buffer } from "node:buffer";
import {
  fetchMailboxMessages,
  fetchMessageDetail,
  sendEmailMessage,
  testImapConnection,
  testSmtpConnection,
  updateMessagingConnections,
  updateMessagingSenderIdentity,
  type Mailbox,
  type MailboxPageResult,
  type MessageDetail,
  type MailboxListItem,
  type MessagingConnectionsInput,
  type MessagingIdentityInput,
  type EmailAttachment,
  fetchMailboxUpdates,
} from "@/server/messaging";

export type ActionResult<T = unknown> =
  | { success: true; message?: string; data?: T }
  | { success: false; message: string };

const booleanSchema = z
  .union([z.literal("true"), z.literal("false")])
  .transform((value) => value === "true");

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_ATTACHMENT_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/json",
  "text/plain",
]);
const ALLOWED_ATTACHMENT_PREFIXES = ["image/", "audio/"];

function isAllowedAttachmentType(mime: string | undefined | null): boolean {
  if (!mime) return true;
  if (ALLOWED_ATTACHMENT_TYPES.has(mime)) return true;
  return ALLOWED_ATTACHMENT_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

const MAILBOX_VALUES = ["inbox", "sent"] as const satisfies ReadonlyArray<Mailbox>;

const messagingIdentitySchema = z.object({
  senderName: z.string().optional().transform((value) => value?.trim() ?? ""),
  senderLogoUrl: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
});

const messagingConnectionsUpdateSchema = z.object({
  fromEmail: z
    .string()
    .min(1, "Adresse e-mail requise")
    .email("Adresse e-mail invalide"),
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().min(1).max(65535),
  imapSecure: booleanSchema,
  imapUser: z.string().optional().transform((value) => value?.trim() ?? ""),
  imapPassword: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: booleanSchema,
  smtpUser: z.string().optional().transform((value) => value?.trim() ?? ""),
  smtpPassword: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
});

const messagingConnectionsTestSchema = z.object({
  fromEmail: z
    .string()
    .min(1, "Adresse e-mail requise")
    .email("Adresse e-mail invalide"),
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().min(1).max(65535),
  imapSecure: booleanSchema,
  imapUser: z.string().min(1),
  imapPassword: z.string().min(1),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: booleanSchema,
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
});

const composeSchema = z.object({
  to: z.string().min(1, "Destinataire requis"),
  cc: z.string().optional().transform((value) => value ?? ""),
  bcc: z.string().optional().transform((value) => value ?? ""),
  subject: z.string().min(1, "Sujet requis"),
  body: z.string().min(1, "Message requis"),
  quotedHtml: z.string().optional().transform((value) => value ?? ""),
  quotedText: z.string().optional().transform((value) => value ?? ""),
});

const mailboxSchema = z.object({
  mailbox: z.enum(MAILBOX_VALUES),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

const mailboxDetailSchema = z.object({
  mailbox: z.enum(MAILBOX_VALUES),
  uid: z.number().int().min(1),
});

const mailboxUpdatesSchema = z.object({
  mailbox: z.enum(MAILBOX_VALUES),
  sinceUid: z.number().int().min(0),
});

function mapSettingsValidationError(error: z.ZodError): string {
  const fields = new Set(
    error.issues
      .map((issue) => issue.path?.[0])
      .map((value) => (typeof value === "string" ? value : null))
      .filter((value): value is string => Boolean(value)),
  );
  if ([...fields].some((field) => field.startsWith("imap"))) {
    return "Champs IMAP invalides.";
  }
  if ([...fields].some((field) => field.startsWith("smtp"))) {
    return "Champs SMTP invalides.";
  }
  if (fields.has("fromEmail")) {
    return "Adresse e-mail invalide.";
  }
  return "Champs invalides.";
}

function mapImapValidationError(error: z.ZodError): string {
  return error.issues.length
    ? "Champs IMAP invalides."
    : "Champs invalides.";
}

function mapSmtpValidationError(error: z.ZodError): string {
  return error.issues.length
    ? "Champs SMTP invalides."
    : "Champs invalides.";
}

function isAuthError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /auth|login failed|invalid credentials/i.test(message);
}

function mapConnectionError(error: unknown, fallback: string): string {
  if (isAuthError(error)) {
    return "Échec d'authentification.";
  }
  if (error instanceof Error) {
    if (/fetch failed|network/i.test(error.message)) {
      return "Erreur réseau.";
    }
    return error.message;
  }
  return fallback;
}function parseAddressList(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function convertPlainTextToHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function buildHtmlContent(
  body: string,
  quotedHtml: string,
  quotedText: string,
): string {
  const trimmedBody = body.trimEnd();
  const bodyHtml = `<div>${convertPlainTextToHtml(trimmedBody)}</div>`;
  const hasQuotedHtml = quotedHtml.trim().length > 0;
  const quotedSection = hasQuotedHtml
    ? quotedHtml
    : quotedText.trim().length > 0
      ? `<div>${convertPlainTextToHtml(quotedText)}</div>`
      : '';

  if (!quotedSection) {
    return bodyHtml;
  }

  return `${bodyHtml}<div style="margin-top:24px;padding-left:16px;border-left:2px solid #cbd5f5;background-color:#f1f5f9;border-radius:8px;"><p style="margin:0 0 8px;font-weight:600;color:#334155;">Message original</p>${quotedSection}</div>`;
}



function parseIdentityInput(formData: FormData): MessagingIdentityInput {
  const parsed = messagingIdentitySchema.parse(
    Object.fromEntries(formData),
  );

  return {
    senderName: parsed.senderName,
    senderLogoUrl: parsed.senderLogoUrl.length
      ? parsed.senderLogoUrl
      : null,
  };
}

function parseConnectionsUpdateInput(
  formData: FormData,
): MessagingConnectionsInput {
  const parsed = messagingConnectionsUpdateSchema.parse(
    Object.fromEntries(formData),
  );

  return {
    fromEmail: parsed.fromEmail,
    imapHost: parsed.imapHost,
    imapPort: parsed.imapPort,
    imapSecure: parsed.imapSecure,
    imapUser: parsed.imapUser.length ? parsed.imapUser : undefined,
    imapPassword: parsed.imapPassword.length
      ? parsed.imapPassword
      : undefined,
    smtpHost: parsed.smtpHost,
    smtpPort: parsed.smtpPort,
    smtpSecure: parsed.smtpSecure,
    smtpUser: parsed.smtpUser.length ? parsed.smtpUser : undefined,
    smtpPassword: parsed.smtpPassword.length
      ? parsed.smtpPassword
      : undefined,
  };
}

function parseConnectionsTestInput(formData: FormData) {
  return messagingConnectionsTestSchema.parse(
    Object.fromEntries(formData),
  );
}

export async function updateMessagingIdentityAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const input = parseIdentityInput(formData);
    await updateMessagingSenderIdentity(input);
    revalidatePath("/messagerie/recus");
    revalidatePath("/messagerie/envoyes");
    revalidatePath("/messagerie/parametres");
    return {
      success: true,
      message: "Identité mise à jour.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Champs invalides.",
      };
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour l'identité de l'expéditeur.",
    };
  }
}

export async function updateMessagingConnectionsAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const input = parseConnectionsUpdateInput(formData);
    await updateMessagingConnections(input);
    revalidatePath("/messagerie/recus");
    revalidatePath("/messagerie/envoyes");
    revalidatePath("/messagerie/parametres");
    return {
      success: true,
      message: "Paramètres mis à jour.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: mapSettingsValidationError(error),
      };
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour les paramètres.",
    };
  }
}

export async function testImapConnectionAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = parseConnectionsTestInput(formData);
    await testImapConnection({
      host: parsed.imapHost,
      port: parsed.imapPort,
      secure: parsed.imapSecure,
      user: parsed.imapUser,
      password: parsed.imapPassword,
    });
    return {
      success: true,
      message: "Connexion IMAP réussie.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: mapImapValidationError(error),
      };
    }
    return {
      success: false,
      message: mapConnectionError(error, "Échec du test IMAP."),
    };
  }
}

export async function testSmtpConnectionAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = parseConnectionsTestInput(formData);
    await testSmtpConnection({
      host: parsed.smtpHost,
      port: parsed.smtpPort,
      secure: parsed.smtpSecure,
      user: parsed.smtpUser,
      password: parsed.smtpPassword,
      fromEmail: parsed.fromEmail,
    });
    return {
      success: true,
      message: "Connexion SMTP réussie.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: mapSmtpValidationError(error),
      };
    }
    return {
      success: false,
      message: mapConnectionError(error, "Échec du test SMTP."),
    };
  }
}

export async function fetchMailboxPageAction(
  input: unknown,
): Promise<ActionResult<MailboxPageResult>> {
  try {
    const parsed = mailboxSchema.parse(input);
    const data = await fetchMailboxMessages(parsed);
    return {
      success: true,
      data,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Champs invalides.",
      };
    }
    return {
      success: false,
      message: mapConnectionError(
        error,
        "Échec de chargement des messages.",
      ),
    };
  }
}

export async function fetchMailboxUpdatesAction(
  input: unknown,
): Promise<ActionResult<{ messages: MailboxListItem[]; totalMessages: number | null }>> {
  try {
    const parsed = mailboxUpdatesSchema.parse(input);
    const data = await fetchMailboxUpdates(parsed);
    return {
      success: true,
      data,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Champs invalides.",
      };
    }
    return {
      success: false,
      message: mapConnectionError(
        error,
        "Échec de la synchronisation des messages.",
      ),
    };
  }
}

export async function fetchMessageDetailAction(
  input: unknown,
): Promise<ActionResult<MessageDetail>> {
  try {
    const parsed = mailboxDetailSchema.parse(input);
    const data = await fetchMessageDetail(parsed);
    return {
      success: true,
      data,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Champs invalides.",
      };
    }
    return {
      success: false,
      message: mapConnectionError(
        error,
        "Échec de chargement du message.",
      ),
    };
  }
}

export async function sendEmailAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = composeSchema.parse(
      Object.fromEntries(formData),
    );

    const toList = parseAddressList(parsed.to);
    if (toList.length === 0) {
      return {
        success: false,
        message: "Destinataire requis.",
      };
    }

    const ccList = parseAddressList(parsed.cc);
    const bccList = parseAddressList(parsed.bcc);

    const files = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0);

    const attachments: EmailAttachment[] = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        return {
          success: false,
          message: "Pièce jointe trop volumineuse.",
        };
      }
      if (!isAllowedAttachmentType(file.type)) {
        return {
          success: false,
          message: "Type de fichier non supporté.",
        };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
        content: buffer,
        contentType: file.type || undefined,
      });
    }

    const htmlContent = buildHtmlContent(
      parsed.body,
      parsed.quotedHtml,
      parsed.quotedText,
    );

    const textParts = [parsed.body.trimEnd()];
    if (parsed.quotedText.trim().length > 0) {
      textParts.push("", "----- Message d'origine -----", parsed.quotedText.trim());
    }

    await sendEmailMessage({
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      subject: parsed.subject,
      text: textParts.join("\n"),
      html: htmlContent,
      attachments: attachments.length ? attachments : undefined,
    });

    return {
      success: true,
      message: "Message envoyé.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.issues[0]?.message ?? "Champs invalides.",
      };
    }
    return {
      success: false,
      message: mapConnectionError(
        error,
        "Échec d'envoi du message.",
      ),
    };
  }
}
