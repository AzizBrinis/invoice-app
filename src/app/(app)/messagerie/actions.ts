"use server";

import sanitizeHtml from "sanitize-html";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { callSelectedModel } from "@/server/assistant/providers";
import {
  fetchMailboxMessages,
  fetchMessageDetail,
  sendEmailMessage,
  testImapConnection,
  testSmtpConnection,
  updateMessagingConnections,
  updateMessagingAutoReplySettings,
  updateMessagingSenderIdentity,
  updateEmailTrackingPreference,
  getMessagingSettingsSummary,
  moveMailboxMessage,
  type Mailbox,
  type MailboxPageResult,
  type MessageDetail,
  type MailboxListItem,
  type MessagingConnectionsInput,
  type EmailAttachment,
  fetchMailboxUpdates,
  type SentMailboxAppendResult,
  type AutoMovedSummary,
} from "@/server/messaging";
import {
  scheduleEmailDraft,
  rescheduleScheduledEmail,
  cancelScheduledEmail,
} from "@/server/messaging-scheduled";
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
    quotedHeaderHtml: z.string().optional().transform((value) => value ?? ""),
    quotedHeaderText: z.string().optional().transform((value) => value ?? ""),
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

const aiReplyRequestSchema = z.object({
  mailbox: z.enum(MAILBOX_VALUES),
  uid: z.number().int().min(1),
  intent: z
    .enum([
      "generate",
      "improve",
      "improve_text_html",
      "improve_text_only",
      "correct_only",
    ] as const)
    .default("generate"),
  currentBody: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  currentHtmlBody: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  senderName: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  senderEmail: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
});

const aiSummaryRequestSchema = z.object({
  mailbox: z.enum(MAILBOX_VALUES),
  uid: z.number().int().min(1),
});

const aiDraftPolishSchema = z.object({
  intent: z
    .enum(["correct_only", "enhance"] as const)
    .default("correct_only"),
  plainBody: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  htmlBody: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
});

const aiSubjectRequestSchema = z.object({
  plainBody: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  htmlBody: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
});

export type AiReplyActionInput = z.infer<typeof aiReplyRequestSchema>;
export type AiSummaryActionInput = z.infer<typeof aiSummaryRequestSchema>;
export type AiDraftPolishActionInput = z.infer<typeof aiDraftPolishSchema>;
export type AiSubjectActionInput = z.infer<typeof aiSubjectRequestSchema>;

const AI_REPLY_CONTEXT_LIMIT = 7000;
const AI_REPLY_DRAFT_LIMIT = 6000;
const AI_REPLY_SYSTEM_PROMPT =
  "Tu es un assistant spécialisé dans la rédaction de réponses d'e-mails professionnelles. Tu fournis uniquement le contenu demandé, sans sujet ni instructions supplémentaires.";
const AI_DRAFT_POLISH_SYSTEM_PROMPT =
  "Tu aides les utilisateurs à corriger leurs brouillons d'e-mails. Tes réponses sont professionnelles, concises et fidèles au contenu fourni.";
const AI_SUMMARY_SYSTEM_PROMPT =
  "Tu es un assistant qui synthétise fidèlement des e-mails. Tu fournis uniquement le résumé demandé, sans instructions supplémentaires.";
const AI_SUBJECT_SYSTEM_PROMPT =
  "Tu proposes des objets d'e-mails concis et professionnels, sans guillemets ni balises.";

const AI_REPLY_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeStyle: "short",
});

export async function summarizeMessageWithAiAction(
  input: AiSummaryActionInput,
): Promise<ActionResult<{ summary: string }>> {
  try {
    const parsed = aiSummaryRequestSchema.parse(input);
    const user = await requireUser();
    const detail = await fetchMessageDetail({
      mailbox: parsed.mailbox,
      uid: parsed.uid,
      userId: user.id,
    });
    const normalized = normalizeDetailText(detail);
    if (!normalized.length) {
      return {
        success: false,
        message: "Contenu du message indisponible pour le résumé.",
      };
    }

    const header = formatDetailHeader(detail);
    const context = truncateContext(normalized);
    const promptSections = [
      "Analyse l'e-mail suivant pour produire un résumé clair et fidèle en deux ou trois phrases maximum.",
      "Détecte automatiquement la langue du message et écris le résumé dans cette même langue sans traduire.",
      "Souligne les points importants, engagements ou actions attendues, sans inventer d'informations.",
      "",
      "Contexte du message :",
      header,
      "",
      "Contenu du message :",
      context || "(Contenu indisponible)",
    ];

    const response = await callSelectedModel({
      messages: [
        { role: "system", content: AI_SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: promptSections.join("\n") },
      ],
      tools: [],
    });

    const summary = response.content?.trim();
    if (!summary) {
      throw new Error("Résumé vide du modèle.");
    }

    return {
      success: true,
      message: "Résumé généré.",
      data: { summary },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message:
          error.issues[0]?.message ?? "Paramètres invalides pour le résumé.",
      };
    }
    console.error("[messagerie][ai-summary]", error);
    return {
      success: false,
      message: "Impossible de générer un résumé pour le moment.",
    };
  }
}

function normalizeDetailText(detail: MessageDetail): string {
  const plain = detail.text?.trim();
  if (plain?.length) {
    return plain;
  }
  const html = detail.html?.trim();
  if (!html?.length) {
    return "";
  }
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateContext(value: string): string {
  if (!value || value.length <= AI_REPLY_CONTEXT_LIMIT) {
    return value;
  }
  return `${value.slice(0, AI_REPLY_CONTEXT_LIMIT)}\n\n[Texte original tronqué pour l'analyse]`;
}

function formatDetailHeader(detail: MessageDetail): string {
  const parts: string[] = [`Sujet : ${detail.subject}`];
  if (detail.from) {
    parts.push(`De : ${detail.from}`);
  }
  if (detail.to.length) {
    parts.push(`À : ${detail.to.join(", ")}`);
  }
  if (detail.cc.length) {
    parts.push(`Cc : ${detail.cc.join(", ")}`);
  }
  try {
    const formattedDate = AI_REPLY_DATE_FORMATTER.format(new Date(detail.date));
    parts.push(`Reçu le : ${formattedDate}`);
  } catch {
    // Ignore invalid date formats
  }
  return parts.join("\n");
}

function normalizeAiIntent(
  intent: AiReplyActionInput["intent"],
): "generate" | "improve_text_html" | "improve_text_only" | "correct_only" {
  if (intent === "improve" || intent === "improve_text_html") {
    return "improve_text_html";
  }
  if (intent === "improve_text_only") {
    return "improve_text_only";
  }
  if (intent === "correct_only") {
    return "correct_only";
  }
  return "generate";
}

function truncateDraftValue(value: string, limit = AI_REPLY_DRAFT_LIMIT): string {
  if (!value || value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n\n[Texte tronqué pour l'analyse]`;
}

function extractJsonPayload(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1]?.trim() ?? raw.trim();
  }
  return raw.trim();
}

function htmlStructureSignature(value: string): string {
  return value
    .replace(/>([^<]*)</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAiReplyPayload(raw: string): {
  plain: string | null;
  html: string | null;
} {
  const source = extractJsonPayload(raw);
  try {
    const parsed = JSON.parse(source);
    const plain =
      typeof parsed.plain_text === "string"
        ? parsed.plain_text
        : typeof parsed.plainText === "string"
          ? parsed.plainText
          : typeof parsed.text === "string"
            ? parsed.text
            : null;
    const html =
      typeof parsed.html_body === "string"
        ? parsed.html_body
        : typeof parsed.htmlBody === "string"
          ? parsed.htmlBody
          : typeof parsed.html === "string"
            ? parsed.html
            : null;
    return { plain, html };
  } catch {
    return { plain: raw.trim() || null, html: null };
  }
}

function convertPlainTextToEmailHtml(value: string): string {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  if (paragraphs.length === 0) {
    return value.trim().length ? `<p>${convertPlainTextToHtml(value)}</p>` : "";
  }
  return paragraphs
    .map((paragraph) => `<p>${convertPlainTextToHtml(paragraph)}</p>`)
    .join("");
}

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

const optionalEmailSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length ? trimmed : null;
  })
  .refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    "Adresse e-mail de secours invalide.",
  );

const dateInputSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length ? trimmed : null;
  });

const autoReplySettingsSchema = z.object({
  autoReplyEnabled: booleanSchema,
  autoReplySubject: z
    .string()
    .min(3, "Sujet trop court.")
    .max(180, "Sujet trop long.")
    .transform((value) => value.trim()),
  autoReplyBody: z
    .string()
    .min(10, "Message trop court.")
    .max(2000, "Message trop long.")
    .transform((value) => value.replace(/\r\n/g, "\n").trim()),
  vacationModeEnabled: booleanSchema,
  vacationSubject: z
    .string()
    .min(3, "Sujet trop court.")
    .max(180, "Sujet trop long.")
    .transform((value) => value.trim()),
  vacationMessage: z
    .string()
    .min(10, "Message trop court.")
    .max(2000, "Message trop long.")
    .transform((value) => value.replace(/\r\n/g, "\n").trim()),
  vacationStartDate: dateInputSchema,
  vacationEndDate: dateInputSchema,
  vacationBackupEmail: optionalEmailSchema,
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
  quotedHeaderHtml: string,
  quotedHeaderText: string,
): string {
  const trimmedHeaderHtml = quotedHeaderHtml.trim();
  const trimmedHeaderText = quotedHeaderText.trim();
  const headerBlock = trimmedHeaderHtml.length
    ? trimmedHeaderHtml
    : trimmedHeaderText.length
      ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#475569;font-weight:600;">${escapeHtml(
          trimmedHeaderText,
        )}</p>`
      : `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#475569;font-weight:600;">Message original</p>`;

  const trimmedHtml = quotedHtml.trim();
  const trimmedText = quotedText.trim();
  const quotedSection = trimmedHtml.length
    ? trimmedHtml
    : trimmedText.length > 0
      ? `<div>${convertPlainTextToHtml(quotedText)}</div>`
      : "";

  if (!quotedSection) {
    return "";
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:24px;">
    <tr>
      <td style="padding:0;">
        <div style="padding:16px;border-left:2px solid #cbd5f5;background-color:#f8fafc;border-radius:10px;">
          ${headerBlock}
          <blockquote style="margin:0;padding-left:12px;border-left:2px solid #cbd5f5;">
            ${quotedSection}
          </blockquote>
        </div>
      </td>
    </tr>
  </table>`;
}

function buildEmailHtml(
  bodyPlain: string,
  bodyHtml: string,
  format: "plain" | "html",
  quotedHtml: string,
  quotedText: string,
  quotedHeaderHtml: string,
  quotedHeaderText: string,
): string {
  const baseContent =
    format === "html" && bodyHtml.trim().length > 0
      ? bodyHtml.trim()
      : `<div>${convertPlainTextToHtml(bodyPlain.trimEnd())}</div>`;

  const quotedBlock = buildQuotedSection(
    quotedHtml,
    quotedText,
    quotedHeaderHtml,
    quotedHeaderText,
  );
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

export async function updateAutoReplySettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = autoReplySettingsSchema.parse(
      Object.fromEntries(formData),
    );
    if (
      parsed.vacationModeEnabled &&
      (!parsed.vacationStartDate || !parsed.vacationEndDate)
    ) {
      return {
        success: false,
        message: "Renseignez une date de début et de fin pour le mode vacances.",
      };
    }

    let vacationStart: Date | null = null;
    let vacationEnd: Date | null = null;

    try {
      vacationStart = parseDateOnly(parsed.vacationStartDate);
      vacationEnd = parseDateOnly(parsed.vacationEndDate);
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Dates invalides fournies.",
      };
    }

    if (vacationStart && vacationEnd && vacationEnd < vacationStart) {
      return {
        success: false,
        message: "La date de fin doit être postérieure à la date de début.",
      };
    }

    await updateMessagingAutoReplySettings({
      autoReplyEnabled: parsed.autoReplyEnabled,
      autoReplySubject: parsed.autoReplySubject,
      autoReplyBody: parsed.autoReplyBody,
      vacationModeEnabled: parsed.vacationModeEnabled,
      vacationSubject: parsed.vacationSubject,
      vacationMessage: parsed.vacationMessage,
      vacationStartDate: vacationStart,
      vacationEndDate: vacationEnd,
      vacationBackupEmail: parsed.vacationBackupEmail,
    });

    revalidatePath("/messagerie/parametres");

    return {
      success: true,
      message: parsed.vacationModeEnabled
        ? "Mode vacances mis à jour."
        : "Réponses automatiques mises à jour.",
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
          : "Impossible de mettre à jour les réponses automatiques.",
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

export async function updateEmailTrackingPreferenceAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const rawEnabled = formData.get("enabled");
    const parsed = booleanSchema.safeParse(
      typeof rawEnabled === "string" ? rawEnabled : "",
    );
    if (!parsed.success) {
      return {
        success: false,
        message: "Valeur de suivi invalide.",
      };
    }

    await updateEmailTrackingPreference(parsed.data);
    revalidatePath("/messagerie/envoyes");
    revalidatePath("/messagerie/parametres");
    return {
      success: true,
      message: parsed.data
        ? "Suivi des ouvertures activé."
        : "Suivi des ouvertures désactivé.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour les préférences de suivi.",
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
): Promise<ActionResult<{
  messages: MailboxListItem[];
  totalMessages: number | null;
  autoMoved?: AutoMovedSummary[];
}>> {
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

type PreparedComposePayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
};

async function buildPreparedComposePayload(
  formData: FormData,
): Promise<PreparedComposePayload> {
  const parsed = composeSchema.parse(Object.fromEntries(formData));

  const toList = parseAddressList(parsed.to);
  if (!toList.length) {
    throw new Error("Destinataire requis.");
  }

  const ccList = parseAddressList(parsed.cc);
  const bccList = parseAddressList(parsed.bcc);

  const files = formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const attachments: EmailAttachment[] = [];
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error("Pièce jointe trop volumineuse.");
    }
    if (!isAllowedAttachmentType(file.type)) {
      throw new Error("Type de fichier non supporté.");
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
  const isHtmlBody = parsed.bodyFormat === "html" && htmlBody.trim().length > 0;

  const htmlContent = buildEmailHtml(
    plainBody,
    htmlBody,
    isHtmlBody ? "html" : "plain",
    parsed.quotedHtml,
    parsed.quotedText,
    parsed.quotedHeaderHtml,
    parsed.quotedHeaderText,
  );

  let primaryText = isHtmlBody ? stripHtml(htmlBody) : plainBody.trimEnd();
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
  const trimmedHeaderText = parsed.quotedHeaderText.trim();
  if (trimmedQuotedText.length > 0) {
    if (textParts.length) {
      textParts.push("");
    }
    if (trimmedHeaderText.length > 0) {
      textParts.push(trimmedHeaderText);
    } else {
      textParts.push("----- Message d'origine -----");
    }
    textParts.push(trimmedQuotedText);
  }

  const textPayload = textParts.length ? textParts.join("\n") : " ";

  return {
    to: toList,
    cc: ccList.length ? ccList : undefined,
    bcc: bccList.length ? bccList : undefined,
    subject: parsed.subject,
    text: textPayload,
    html: htmlContent,
    attachments: attachments.length ? attachments : undefined,
  };
}

export async function sendEmailAction(
  formData: FormData,
): Promise<ActionResult<SentMailboxAppendResult>> {
  try {
    const payload = await buildPreparedComposePayload(formData);
    const sentResult = await sendEmailMessage(payload);

    return {
      success: true,
      message: "Message envoyé.",
      data: sentResult,
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

export async function scheduleEmailAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const scheduledAtRaw = formData.get("scheduledAt");
    if (typeof scheduledAtRaw !== "string" || scheduledAtRaw.trim().length === 0) {
      return {
        success: false,
        message: "Choisissez une date et une heure d'envoi.",
      };
    }
    const scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) {
      return {
        success: false,
        message: "Date d'envoi invalide.",
      };
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return {
        success: false,
        message: "La date d'envoi doit être dans le futur.",
      };
    }

    const payload = await buildPreparedComposePayload(formData);
    const user = await requireUser();
    const summary = await getMessagingSettingsSummary(user.id);
    if (!summary.smtpConfigured) {
      return {
        success: false,
        message: "Configurez le SMTP avant de planifier un envoi.",
      };
    }

    const record = await scheduleEmailDraft({
      userId: user.id,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      sendAt: scheduledAt,
      attachments: payload.attachments ?? [],
    });

    revalidatePath("/messagerie/planifies");

    return {
      success: true,
      message: "E-mail planifié.",
      data: { id: record.id },
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
        error instanceof Error ? error.message : "Impossible de planifier l'e-mail.",
    };
  }
}

export async function runAiDraftPolishAction(
  input: AiDraftPolishActionInput,
): Promise<ActionResult<{ plainBody: string; htmlBody?: string }>> {
  try {
    const parsed = aiDraftPolishSchema.parse(input);
    const plainDraft = parsed.plainBody;
    const htmlDraft = parsed.htmlBody;
    const hasPlain = plainDraft.length > 0;
    const hasHtml = htmlDraft.length > 0;
    const effectivePlain = hasPlain
      ? plainDraft
      : hasHtml
        ? stripHtml(htmlDraft)
        : "";
    if (!effectivePlain.trim().length) {
      return {
        success: false,
        message: "Ajoutez du texte avant d'utiliser l'assistant.",
      };
    }

    const actionInstruction =
      parsed.intent === "enhance"
        ? "Corrige orthographe, grammaire et ponctuation, puis améliore la clarté"
          + " et le ton sans ajouter ni supprimer d'informations."
        : "Corrige uniquement l'orthographe, la grammaire et la ponctuation"
          + " sans modifier la formulation ou le style.";
    const htmlInstruction = hasHtml
      ? "Une version HTML est fournie. Conserve strictement la même structure,"
        + " les mêmes balises, attributs, classes, styles et liens. Modifie"
        + " uniquement le texte. Si tu n'as rien à changer, renvoie le HTML"
        + " original tel quel."
      : "Aucune version HTML n'est fournie. Renvoie une chaîne vide pour"
        + " html_body.";

    const promptSections = [
      actionInstruction,
      "Respecte la langue détectée et n'invente aucune information.",
      "Ne modifie jamais les données factuelles (noms, montants, dates, numéros).",
      htmlInstruction,
      'Réponds uniquement avec un JSON {"plain_text":"...","html_body":"..."}.',
      "",
      "Texte à retravailler :",
      effectivePlain,
    ];
    if (hasHtml) {
      promptSections.push("", "HTML original :", htmlDraft);
    }

    const response = await callSelectedModel({
      messages: [
        { role: "system", content: AI_DRAFT_POLISH_SYSTEM_PROMPT },
        { role: "user", content: promptSections.join("\n") },
      ],
      tools: [],
    });

    const generated = response.content?.trim();
    if (!generated) {
      throw new Error("Réponse vide du modèle.");
    }

    const structured = parseAiReplyPayload(generated);
    const plainSuggestion = structured.plain?.trim();
    if (!plainSuggestion?.length) {
      throw new Error("Texte généré vide.");
    }

    let htmlSuggestion = hasHtml ? structured.html?.trim() ?? "" : "";
    if (hasHtml) {
      if (!htmlSuggestion.length) {
        htmlSuggestion = htmlDraft;
      } else {
        const originalSignature = htmlStructureSignature(htmlDraft);
        const candidateSignature = htmlStructureSignature(htmlSuggestion);
        if (!candidateSignature || candidateSignature !== originalSignature) {
          htmlSuggestion = htmlDraft;
        }
      }
    }

    return {
      success: true,
      message:
        parsed.intent === "enhance"
          ? "Brouillon clarifié."
          : "Brouillon corrigé.",
      data: {
        plainBody: plainSuggestion,
        htmlBody: hasHtml ? htmlSuggestion : undefined,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.issues[0]?.message ?? "Champs invalides.",
      };
    }
    console.error("[messagerie][ai-draft-polish]", error);
    return {
      success: false,
      message: "Impossible d'utiliser l'assistant pour le moment.",
    };
  }
}

export async function runAiSubjectAction(
  input: AiSubjectActionInput,
): Promise<ActionResult<{ subject: string }>> {
  try {
    const parsed = aiSubjectRequestSchema.parse(input);
    const sourcePlain = parsed.plainBody;
    const sourceHtml = parsed.htmlBody;
    const effectivePlain = sourcePlain.trim().length
      ? sourcePlain
      : sourceHtml.trim().length
        ? stripHtml(sourceHtml)
        : "";
    if (!effectivePlain.trim().length) {
      return {
        success: false,
        message: "Ajoutez du contenu avant de générer un objet.",
      };
    }

    const promptSections = [
      "Propose un objet d'e-mail clair, précis et professionnel.",
      "Reste dans la même langue que le contenu fourni (ne traduis pas).",
      "Maximum 12 mots, pas de guillemets, pas d'emojis, pas de balises HTML.",
      "Conserve les informations factuelles sans en ajouter ni en supprimer.",
      "Réponds uniquement par l'objet final.",
      "",
      "Contenu de l'e-mail :",
      effectivePlain,
    ];

    const response = await callSelectedModel({
      messages: [
        { role: "system", content: AI_SUBJECT_SYSTEM_PROMPT },
        { role: "user", content: promptSections.join("\n") },
      ],
      tools: [],
    });

    const generated = response.content?.trim() ?? "";
    if (!generated.length) {
      throw new Error("Réponse vide du modèle.");
    }
    const cleaned = generated
      .replace(/^"|"$/g, "")
      .replace(/^'|'$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned.length) {
      throw new Error("Sujet généré vide.");
    }

    return {
      success: true,
      message: "Objet proposé.",
      data: { subject: cleaned },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.issues[0]?.message ?? "Champs invalides.",
      };
    }
    console.error("[messagerie][ai-subject]", error);
    return {
      success: false,
      message: "Impossible de générer l'objet pour le moment.",
    };
  }
}

export async function runAiReplyAction(
  input: AiReplyActionInput,
): Promise<ActionResult<{ plainBody: string; htmlBody?: string }>> {
  try {
    const parsed = aiReplyRequestSchema.parse(input);
    const normalizedIntent = normalizeAiIntent(parsed.intent);
    const originalHtml = parsed.currentHtmlBody ?? "";
    const plainDraft = truncateDraftValue(parsed.currentBody);
    const htmlDraft = truncateDraftValue(originalHtml, AI_REPLY_CONTEXT_LIMIT);
    const fallbackPlain = !plainDraft && htmlDraft ? stripHtml(htmlDraft) : "";
    const effectivePlainDraft = plainDraft || fallbackPlain;
    const hasDraftContent = Boolean(effectivePlainDraft.length || htmlDraft.length);

    if (normalizedIntent !== "generate" && !hasDraftContent) {
      return {
        success: false,
        message: "Aucun contenu à améliorer.",
      };
    }
    if (normalizedIntent === "improve_text_only" && effectivePlainDraft.length === 0) {
      return {
        success: false,
        message: "Ajoutez un texte brut avant de lancer cette option.",
      };
    }

    const user = await requireUser();
    const detail = await fetchMessageDetail({
      mailbox: parsed.mailbox,
      uid: parsed.uid,
      userId: user.id,
    });
    const header = formatDetailHeader(detail);
    const threadText = truncateContext(normalizeDetailText(detail));
    const personaName =
      parsed.senderName ||
      (parsed.senderEmail ? parsed.senderEmail.split("@")[0] : "votre équipe");
    const closingInstruction = parsed.senderName
      ? `Termine par une formule professionnelle suivie de « ${parsed.senderName} ».`
      : "Termine par une formule professionnelle adaptée.";
    const languageInstruction = hasDraftContent
      ? "Respecte strictement la langue utilisée dans le brouillon."
      : "Rédige dans la même langue que le message reçu (ne traduis jamais).";

    let actionInstruction: string;
    switch (normalizedIntent) {
      case "generate":
        actionInstruction =
          "Rédige une nouvelle réponse complète en t'appuyant sur le message reçu."
          + " Utilise un ton professionnel, cordial et orienté action.";
        break;
      case "improve_text_only":
        actionInstruction =
          "Améliore uniquement la version texte suivante : fluidifie le style, clarifie"
          + " les phrases et garde exactement les mêmes informations. Ne touche pas à la version HTML."
          + " Fournis uniquement la nouvelle version texte.";
        break;
      case "correct_only":
        actionInstruction =
          "Corrige uniquement l'orthographe et la grammaire des versions texte et HTML."
          + " Ne reformule pas les phrases, ne change pas le ton et n'ajoute aucune information.";
        break;
      default:
        actionInstruction =
          "Améliore la version texte ET la version HTML ci-dessous : clarifie, améliore le ton"
          + " professionnel et la structure, tout en gardant la signification exacte.";
        break;
    }

    const factualGuardrails =
      "Ne modifie jamais les données factuelles (noms, dates, montants, numéros, codes)."
      + " Ne traduis pas et n'invente pas d'informations.";
    const htmlGuideline =
      normalizedIntent === "improve_text_only"
        ? "Ne modifie pas la version HTML fournie (garde structure, classes, styles, signatures, logos)."
        : normalizedIntent === "correct_only"
          ? "Corrige uniquement l'orthographe/ponctuation dans le HTML fourni sans changer balises, attributs, classes, styles ni hiérarchie (copie exacte de la structure)."
          : "La version HTML finale doit être un HTML simple compatible e-mail (balises <p>, <br />, <strong>, <em>).";

    const promptSections = [
      actionInstruction,
      factualGuardrails,
      languageInstruction,
      `Tu écris au nom de ${personaName}. ${closingInstruction}`,
      htmlGuideline,
      "Réponds uniquement avec un objet JSON de la forme {\"plain_text\":\"...\",\"html_body\":\"...\"}.",
      "plain_text = version texte brut finale. html_body = version HTML finale.",
      "",
      "Contexte du message reçu :",
      header,
      "",
      "Contenu du message reçu :",
      threadText || "(Contenu indisponible)",
    ];

    if (normalizedIntent !== "generate") {
      promptSections.push(
        "",
        "Texte brut actuel :",
        effectivePlainDraft || "(Aucun texte brut fourni)",
      );
      promptSections.push(
        "",
        "HTML actuel :",
        htmlDraft || "(Aucune version HTML fournie)",
      );
    }

    const response = await callSelectedModel({
      messages: [
        { role: "system", content: AI_REPLY_SYSTEM_PROMPT },
        { role: "user", content: promptSections.join("\n") },
      ],
      tools: [],
    });

    const generated = response.content?.trim();
    if (!generated) {
      throw new Error("Réponse vide du modèle.");
    }

    const structured = parseAiReplyPayload(generated);
    const plainSuggestion = structured.plain?.trim();
    if (!plainSuggestion) {
      throw new Error("Texte généré vide.");
    }

    let htmlSuggestion: string | null = structured.html?.trim() ?? null;
    if (normalizedIntent === "generate") {
      htmlSuggestion = htmlSuggestion || convertPlainTextToEmailHtml(plainSuggestion);
    } else if (normalizedIntent === "improve_text_only") {
      htmlSuggestion = originalHtml;
    } else if (!htmlSuggestion) {
      htmlSuggestion = htmlDraft || convertPlainTextToEmailHtml(plainSuggestion);
    }

    if (normalizedIntent === "correct_only") {
      const signatureOriginal = htmlStructureSignature(originalHtml);
      const signatureCandidate = htmlSuggestion ? htmlStructureSignature(htmlSuggestion) : "";
      if (!signatureCandidate.length || signatureCandidate !== signatureOriginal) {
        htmlSuggestion = originalHtml;
      }
    }

    const successMessageMap: Record<
      ReturnType<typeof normalizeAiIntent>,
      string
    > = {
      generate: "Brouillon généré.",
      improve_text_html: "Texte amélioré.",
      improve_text_only: "Texte amélioré (version texte).",
      correct_only: "Texte corrigé.",
    };

    const payload: { plainBody: string; htmlBody?: string } = {
      plainBody: plainSuggestion,
    };
    if (normalizedIntent === "improve_text_only") {
      payload.htmlBody = originalHtml;
    } else if (htmlSuggestion != null) {
      payload.htmlBody = htmlSuggestion;
    }

    return {
      success: true,
      message: successMessageMap[normalizedIntent],
      data: payload,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message:
          error.issues[0]?.message ?? "Paramètres invalides pour l'assistant.",
      };
    }
    console.error("[messagerie][ai-reply]", error);
    return {
      success: false,
      message: "Impossible d'utiliser l'assistant pour le moment.",
    };
  }
}

export async function rescheduleScheduledEmailAction(
  formData: FormData,
): Promise<ActionResult<{ sendAt: string }>> {
  try {
    const id = formData.get("id")?.toString() ?? "";
    const scheduledAtRaw = formData.get("scheduledAt")?.toString() ?? "";
    if (!id) {
      return {
        success: false,
        message: "E-mail planifié introuvable.",
      };
    }
    if (!scheduledAtRaw) {
      return {
        success: false,
        message: "Nouvelle date d'envoi requise.",
      };
    }
    const sendAt = new Date(scheduledAtRaw);
    if (Number.isNaN(sendAt.getTime())) {
      return {
        success: false,
        message: "Date d'envoi invalide.",
      };
    }
    await rescheduleScheduledEmail({
      id,
      sendAt,
    });
    revalidatePath("/messagerie/planifies");
    return {
      success: true,
      message: "Planification mise à jour.",
      data: { sendAt: sendAt.toISOString() },
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible de replanifier cet e-mail.",
    };
  }
}

export async function cancelScheduledEmailAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const id = formData.get("id")?.toString() ?? "";
    if (!id) {
      return {
        success: false,
        message: "E-mail planifié introuvable.",
      };
    }
    await cancelScheduledEmail({ id });
    revalidatePath("/messagerie/planifies");
    return {
      success: true,
      message: "Planification annulée.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Impossible d'annuler cet e-mail.",
    };
  }
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date invalide.");
  }
  return date;
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
