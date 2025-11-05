"use server";

import sanitizeHtml from "sanitize-html";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  fetchMailboxMessages,
  fetchMessageDetail,
  sendEmailMessage,
  testImapConnection,
  testSmtpConnection,
  updateMessagingConnections,
  updateMessagingSenderIdentity,
  getMessagingSettingsSummary,
  moveMailboxMessage,
  type Mailbox,
  type MailboxPageResult,
  type MessageDetail,
  type MailboxListItem,
  type MessagingConnectionsInput,
  type MessagingIdentityInput,
  type EmailAttachment,
  fetchMailboxUpdates,
  type SentMailboxAppendResult,
} from "@/server/messaging";
import { requireUser } from "@/lib/auth";
import { recordManualSpamFeedback } from "@/server/spam-detection";
import {
  createSavedResponse,
  updateSavedResponse,
  deleteSavedResponse,
} from "@/server/messaging-responses";
import type { SavedResponse } from "@/lib/messaging/saved-responses";

export type ActionResult<T = unknown> =
  | { success: true; message?: string; data?: T }
  | { success: false; message: string };

type ParsedIdentityFormInput = {
  senderName: string;
  senderLogoUrl: string | null;
  removeLogo: boolean;
};

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

const MAILBOX_VALUES = ["inbox", "sent", "drafts", "trash", "spam"] as const satisfies ReadonlyArray<Mailbox>;

const LOGO_UPLOAD_PUBLIC_PREFIX = "/uploads/logos";
const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_LOGO_MIME_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

const messagingIdentitySchema = z.object({
  senderName: z.string().optional().transform((value) => value?.trim() ?? ""),
  senderLogoUrl: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  removeLogo: z
    .string()
    .optional()
    .transform((value) => value === "true"),
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

const composeSchema = z
  .object({
    to: z.string().min(1, "Destinataire requis"),
    cc: z.string().optional().transform((value) => value ?? ""),
    bcc: z.string().optional().transform((value) => value ?? ""),
    subject: z.string().min(1, "Sujet requis"),
    body: z
      .string()
      .optional()
      .transform((value) => (value ?? "").replace(/\r\n/g, "\n")),
    bodyHtml: z.string().optional().transform((value) => value ?? ""),
    bodyFormat: z.enum(["plain", "html"]).default("plain"),
    quotedHtml: z.string().optional().transform((value) => value ?? ""),
    quotedText: z.string().optional().transform((value) => value ?? ""),
  })
  .superRefine((data, ctx) => {
    const plain = data.body.trim();
    const html = data.bodyHtml.trim();
    if (data.bodyFormat === "html") {
      if (!html.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contenu HTML requis.",
          path: ["bodyHtml"],
        });
      }
    } else if (!plain.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Message requis.",
        path: ["body"],
      });
    }
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

const mailboxMoveSchema = z.object({
  mailbox: z.enum(MAILBOX_VALUES),
  target: z.enum(MAILBOX_VALUES),
  uid: z.number().int().min(1),
  subject: z.string().optional(),
  sender: z.string().optional(),
});

const savedResponseSchema = z.object({
  title: z.string().min(3, "Titre trop court").max(120, "Titre trop long"),
  description: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  content: z
    .string()
    .min(1, "Contenu requis")
    .max(20000, "Le modèle est trop long."),
  format: z.enum(["PLAINTEXT", "HTML"]),
});

const savedResponseUpdateSchema = savedResponseSchema.extend({
  responseId: z.string().min(1, "Identifiant requis"),
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
}

function parseAddressList(value: string): string[] {
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

function buildQuotedSection(
  quotedHtml: string,
  quotedText: string,
): string {
  const hasQuotedHtml = quotedHtml.trim().length > 0;
  const quotedSection = hasQuotedHtml
    ? quotedHtml
    : quotedText.trim().length > 0
      ? `<div>${convertPlainTextToHtml(quotedText)}</div>`
      : '';

  if (!quotedSection) {
    return "";
  }

  return `<div style="margin-top:24px;padding-left:16px;border-left:2px solid #cbd5f5;background-color:#f1f5f9;border-radius:8px;"><p style="margin:0 0 8px;font-weight:600;color:#334155;">Message original</p>${quotedSection}</div>`;
}

function buildEmailHtml(
  bodyPlain: string,
  bodyHtml: string,
  format: "plain" | "html",
  quotedHtml: string,
  quotedText: string,
): string {
  const baseContent =
    format === "html" && bodyHtml.trim().length > 0
      ? bodyHtml.trim()
      : `<div>${convertPlainTextToHtml(bodyPlain.trimEnd())}</div>`;

  const quotedBlock = buildQuotedSection(quotedHtml, quotedText);
  if (!quotedBlock) {
    return baseContent;
  }

  return `${baseContent}${quotedBlock}`;
}

function stripHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getLogoUploadDir(userId: string): string {
  return path.join(process.cwd(), "public", "uploads", "logos", userId);
}

function createLogoFileName(extension: string): string {
  return `${Date.now()}-${randomUUID()}.${extension}`;
}

async function saveSenderLogoFile(file: File, userId: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Fichier de logo invalide.");
  }
  if (file.size > MAX_LOGO_FILE_SIZE) {
    throw new Error("Le logo dépasse la taille maximale de 2 Mo.");
  }
  const inferredExtension = ALLOWED_LOGO_MIME_TYPES.get(file.type);
  if (!inferredExtension) {
    throw new Error("Format de logo non supporté. Utilisez PNG, JPG, GIF ou SVG.");
  }

  const uploadDir = getLogoUploadDir(userId);
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = createLogoFileName(inferredExtension);
  const absolutePath = path.join(uploadDir, fileName);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(absolutePath, Buffer.from(arrayBuffer));

  return `${LOGO_UPLOAD_PUBLIC_PREFIX}/${userId}/${fileName}`.replace(/\\/g, "/");
}

async function deleteManagedLogo(logoUrl: string | null, userId: string): Promise<void> {
  if (!logoUrl) {
    return;
  }
  const normalized = logoUrl.replace(/\\/g, "/");
  const expectedPrefix = `${LOGO_UPLOAD_PUBLIC_PREFIX}/${userId}/`;
  if (!normalized.startsWith(expectedPrefix)) {
    return;
  }
  const relativePath = normalized.replace(/^\//, "");
  if (relativePath.includes("..")) {
    return;
  }
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  try {
    await fs.rm(absolutePath, { force: true });
  } catch (error) {
    console.warn("Suppression du logo expéditeur impossible:", error);
  }
}

function parseIdentityInput(formData: FormData): ParsedIdentityFormInput {
  const rawSenderName = formData.get("senderName");
  const rawLogoUrl = formData.get("senderLogoUrl");
  const rawRemoveLogo = formData.get("removeLogo");

  const parsed = messagingIdentitySchema.parse({
    senderName: typeof rawSenderName === "string" ? rawSenderName : "",
    senderLogoUrl: typeof rawLogoUrl === "string" ? rawLogoUrl : "",
    removeLogo: typeof rawRemoveLogo === "string" ? rawRemoveLogo : undefined,
  });

  return {
    senderName: parsed.senderName,
    senderLogoUrl: parsed.senderLogoUrl.length ? parsed.senderLogoUrl : null,
    removeLogo: parsed.removeLogo,
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
  let userId: string | null = null;
  let uploadedLogoUrl: string | null = null;
  let existingLogoUrl: string | null = null;
  let nextLogoUrl: string | null = null;
  try {
    const { senderName, senderLogoUrl, removeLogo } = parseIdentityInput(formData);
    const potentialFile = formData.get("senderLogoFile");
    const logoFile =
      potentialFile instanceof File && potentialFile.size > 0
        ? potentialFile
        : null;

    const user = await requireUser();
    const currentUserId = user.id;
    userId = currentUserId;
    const summary = await getMessagingSettingsSummary(currentUserId);
    existingLogoUrl = summary.senderLogoUrl;

    nextLogoUrl = removeLogo ? null : senderLogoUrl;

    if (logoFile) {
      const storedLogoUrl = await saveSenderLogoFile(logoFile, currentUserId);
      uploadedLogoUrl = storedLogoUrl;
      nextLogoUrl = storedLogoUrl;
    }

    await updateMessagingSenderIdentity({
      senderName,
      senderLogoUrl: nextLogoUrl,
    });
    if (existingLogoUrl && existingLogoUrl !== nextLogoUrl) {
      await deleteManagedLogo(existingLogoUrl, currentUserId);
    }
    revalidatePath("/messagerie/recus");
    revalidatePath("/messagerie/envoyes");
    revalidatePath("/messagerie/parametres");
    return {
      success: true,
      message: "Identité mise à jour.",
    };
  } catch (error) {
    if (userId && uploadedLogoUrl) {
      await deleteManagedLogo(uploadedLogoUrl, userId);
    }
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
  const parsed = mailboxSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Champs invalides.",
    };
  }

  const { mailbox } = parsed.data;

  try {
    const data = await fetchMailboxMessages(parsed.data);
    return {
      success: true,
      data,
    };
  } catch (error) {
    const fallback =
      mailbox === "sent"
        ? "Erreur lors du chargement des messages envoyés."
        : "Échec de chargement des messages.";
    return {
      success: false,
      message: mapConnectionError(error, fallback),
    };
  }
}

export async function fetchMailboxUpdatesAction(
  input: unknown,
): Promise<ActionResult<{ messages: MailboxListItem[]; totalMessages: number | null }>> {
  const parsed = mailboxUpdatesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Champs invalides.",
    };
  }

  const { mailbox } = parsed.data;

  try {
    const data = await fetchMailboxUpdates(parsed.data);
    return {
      success: true,
      data,
    };
  } catch (error) {
    const fallback =
      mailbox === "sent"
        ? "Erreur lors de la synchronisation des messages envoyés."
        : "Échec de la synchronisation des messages.";
    return {
      success: false,
      message: mapConnectionError(error, fallback),
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

export async function moveMailboxMessageAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = mailboxMoveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Champs invalides.",
    };
  }

  try {
    await moveMailboxMessage(parsed.data);

    const isManualSpam =
      parsed.data.target === "spam" && parsed.data.mailbox !== "spam";
    const isManualHam =
      parsed.data.mailbox === "spam" && parsed.data.target !== "spam";

    if (isManualSpam || isManualHam) {
      await recordManualSpamFeedback({
        mailbox: parsed.data.mailbox,
        target: parsed.data.target,
        uid: parsed.data.uid,
        subject: parsed.data.subject,
        sender: parsed.data.sender,
      });
    }

    return {
      success: true,
      message: "Message déplacé.",
    };
  } catch (error) {
    return {
      success: false,
      message: mapConnectionError(
        error,
        "Échec du déplacement du message.",
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

    const plainBody = parsed.body ?? "";
    const htmlBody = parsed.bodyHtml ?? "";
    const bodyFormat = parsed.bodyFormat;
    const isHtmlBody = bodyFormat === "html" && htmlBody.trim().length > 0;

    const htmlContent = buildEmailHtml(
      plainBody,
      htmlBody,
      isHtmlBody ? "html" : "plain",
      parsed.quotedHtml,
      parsed.quotedText,
    );

    let primaryText = isHtmlBody
      ? stripHtml(htmlBody)
      : plainBody.trimEnd();

    if (!primaryText.length && plainBody.length) {
      primaryText = plainBody.trim();
    }
    if (!primaryText.length && isHtmlBody) {
      primaryText = stripHtml(htmlContent);
    }

    const textParts: string[] = [];
    if (primaryText.length) {
      textParts.push(primaryText);
    }
    const trimmedQuotedText = parsed.quotedText.trim();
    if (trimmedQuotedText.length > 0) {
      if (textParts.length) {
        textParts.push("");
      }
      textParts.push("----- Message d'origine -----", trimmedQuotedText);
    }

    const textPayload = textParts.length ? textParts.join("\n") : " ";

    const sentResult = await sendEmailMessage({
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      subject: parsed.subject,
      text: textPayload,
      html: htmlContent,
      attachments: attachments.length ? attachments : undefined,
    });

    return {
      success: true,
      message: "Message envoyé.",
      data: sentResult satisfies SentMailboxAppendResult,
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

function toNullable(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function createSavedResponseAction(
  formData: FormData,
): Promise<ActionResult<{ response: SavedResponse }>> {
  try {
    const parsed = savedResponseSchema.parse(
      Object.fromEntries(formData),
    );
    const response = await createSavedResponse({
      title: parsed.title,
      description: toNullable(parsed.description),
      content: parsed.content,
      format: parsed.format,
    });
    revalidatePath("/messagerie/parametres");
    revalidatePath("/messagerie/nouveau-message");
    return {
      success: true,
      message: "Réponse enregistrée.",
      data: { response },
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
      message:
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer la réponse.",
    };
  }
}

export async function updateSavedResponseAction(
  formData: FormData,
): Promise<ActionResult<{ response: SavedResponse }>> {
  try {
    const parsed = savedResponseUpdateSchema.parse(
      Object.fromEntries(formData),
    );
    const response = await updateSavedResponse({
      id: parsed.responseId,
      title: parsed.title,
      description: toNullable(parsed.description),
      content: parsed.content,
      format: parsed.format,
    });
    revalidatePath("/messagerie/parametres");
    revalidatePath("/messagerie/nouveau-message");
    return {
      success: true,
      message: "Réponse mise à jour.",
      data: { response },
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
      message:
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour la réponse.",
    };
  }
}

export async function deleteSavedResponseAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const responseId = formData.get("responseId")?.toString() ?? "";
  if (!responseId) {
    return {
      success: false,
      message: "Réponse introuvable.",
    };
  }

  try {
    const result = await deleteSavedResponse(responseId);
    revalidatePath("/messagerie/parametres");
    revalidatePath("/messagerie/nouveau-message");
    return {
      success: true,
      message: "Réponse supprimée.",
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la réponse.",
    };
  }
}
