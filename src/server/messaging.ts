import {
  ImapFlow,
  type MessageStructureObject,
  type MessageAddressObject,
  type MessageEnvelopeObject,
  type ListResponse,
  type FetchMessageObject,
} from "imapflow";
import nodemailer, { type Transporter } from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import addressParser from "nodemailer/lib/addressparser";
import { simpleParser, type Attachment, type ParsedMail } from "mailparser";
import { randomUUID } from "node:crypto";
import type { MessagingAutoReplyType, MessagingRecipientType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/server/secure-credentials";
import { analyzeAndHandleSpam } from "@/server/spam-detection";
import { sanitizeEmailHtml } from "@/lib/email-html";
import {
  DEFAULT_AUTO_REPLY_BODY,
  DEFAULT_AUTO_REPLY_SUBJECT,
  DEFAULT_VACATION_BODY,
  DEFAULT_VACATION_SUBJECT,
  renderVacationTemplate,
} from "@/lib/messaging/auto-reply";
import {
  prepareEmailTracking,
  getEmailTrackingSummaries,
  getEmailTrackingDetail,
  type EmailTrackingDetail,
  type RecipientInput,
} from "@/server/email-tracking";

const DEFAULT_PAGE_SIZE = 20;
const RECIPIENT_TYPE_MAP = {
  to: "TO",
  cc: "CC",
  bcc: "BCC",
} as const satisfies Record<"to" | "cc" | "bcc", MessagingRecipientType>;
const AUTO_REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function parseRecipientList(
  entries: string[] | undefined,
  type: keyof typeof RECIPIENT_TYPE_MAP,
): RecipientInput[] {
  if (!entries?.length) {
    return [];
  }
  return entries.flatMap((entry) => {
    try {
      const parsed = addressParser(entry, { flatten: true });
      return parsed
        .filter((item) => item.address.length > 0)
        .map((item) => ({
          address: item.address ?? "",
          name: item.name?.trim() ?? null,
          type: RECIPIENT_TYPE_MAP[type],
        }));
    } catch (error) {
      console.warn("Impossible d'analyser l'adresse e-mail:", entry, error);
      return [];
    }
  });
}

export async function resolveUserId(provided?: string) {
  if (provided) {
    return provided;
  }
  const user = await requireUser();
  return user.id;
}

export type MessagingIdentityInput = {
  senderName: string;
  senderLogoUrl?: string | null;
};

export type MessagingConnectionsInput = {
  fromEmail: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser?: string | null;
  imapPassword?: string | null;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string | null;
  smtpPassword?: string | null;
};

export type MessagingAutoReplySettingsInput = {
  autoReplyEnabled: boolean;
  autoReplySubject: string;
  autoReplyBody: string;
  vacationModeEnabled: boolean;
  vacationSubject: string;
  vacationMessage: string;
  vacationStartDate: Date | null;
  vacationEndDate: Date | null;
  vacationBackupEmail: string | null;
};

export type MessagingSettingsSummary = {
  fromEmail: string;
  senderName: string;
  senderLogoUrl: string | null;
  imapHost: string;
  imapPort: number | null;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapConfigured: boolean;
  smtpConfigured: boolean;
  spamFilterEnabled: boolean;
  trackingEnabled: boolean;
  autoReplyEnabled: boolean;
  autoReplySubject: string;
  autoReplyBody: string;
  vacationModeEnabled: boolean;
  vacationSubject: string;
  vacationMessage: string;
  vacationStartDate: string | null;
  vacationEndDate: string | null;
  vacationBackupEmail: string | null;
};

export type Mailbox = "inbox" | "sent" | "drafts" | "trash" | "spam";

export type MailboxListItem = {
  uid: number;
  messageId: string | null;
  subject: string;
  from: string | null;
  to: string[];
  date: string;
  seen: boolean;
  hasAttachments: boolean;
  tracking?: {
    enabled: boolean;
    totalOpens: number;
    totalClicks: number;
  } | null;
};

type StandardAutoReplyConfig = {
  enabled: boolean;
  subject: string;
  body: string;
};

type VacationAutoReplyConfig = {
  enabled: boolean;
  subject: string;
  message: string;
  startDate: Date | null;
  endDate: Date | null;
  backupEmail: string | null;
};

export type MessageParticipant = {
  name: string | null;
  address: string | null;
};

type ImapAddress = MessageAddressObject & {
  mailbox?: string | null;
  host?: string | null;
};

export type MailboxPageResult = {
  mailbox: Mailbox;
  page: number;
  pageSize: number;
  totalMessages: number;
  hasMore: boolean;
  messages: MailboxListItem[];
  autoMoved?: AutoMovedSummary[];
};

export type AutoMovedSummary = {
  uid: number;
  subject: string;
  from: string | null;
  score: number;
  target: Mailbox;
};

export type SentMailboxAppendResult = {
  message: MailboxListItem | null;
  totalMessages: number | null;
};

function createMailboxListItem(message: {
  uid: number;
  envelope?: {
    subject?: string | null;
    messageId?: string | null;
    from?: ImapAddress[];
    to?: ImapAddress[];
  };
  internalDate?: Date;
  flags?: Set<string>;
  bodyStructure?:
    | MessageStructureObject
    | MessageStructureObject[]
    | null;
}): MailboxListItem {
  const envelope = message.envelope;
  const from =
    formatAddress(envelope?.from?.[0] as ImapAddress | undefined) ??
    "Expéditeur inconnu";
  const to =
    formatAddressList(envelope?.to as ImapAddress[] | undefined) ?? [];
  return {
    uid: message.uid,
    messageId: envelope?.messageId ?? null,
    subject: envelope?.subject ?? "(Sans objet)",
    from,
    to,
    date: (message.internalDate ?? new Date()).toISOString(),
    seen: message.flags?.has("\\Seen") ?? false,
    hasAttachments: hasAttachments(message.bodyStructure),
    tracking: null,
  };
}

export type MessageDetailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

type AttachmentDescriptor = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  raw: Attachment;
};

export type MessageDetail = {
  mailbox: Mailbox;
  uid: number;
  messageId: string | null;
  subject: string;
  from: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  date: string;
  seen: boolean;
  html: string | null;
  text: string | null;
  attachments: MessageDetailAttachment[];
  fromAddress: MessageParticipant | null;
  toAddresses: MessageParticipant[];
  ccAddresses: MessageParticipant[];
  bccAddresses: MessageParticipant[];
  replyToAddresses: MessageParticipant[];
  tracking: EmailTrackingDetail | null;
};

export type ComposeEmailInput = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
};

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type ImapConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

export type SmtpConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail?: string | null;
};

type MessagingCredentials = {
  fromEmail: string | null;
  senderName: string | null;
  senderLogoUrl: string | null;
  imap: ImapConnectionConfig | null;
  smtp: SmtpConnectionConfig | null;
  spamFilterEnabled: boolean;
  trackingEnabled: boolean;
  autoReply: StandardAutoReplyConfig;
  vacation: VacationAutoReplyConfig;
};

type MailboxOpenResult = {
  name: string;
  info: Awaited<ReturnType<ImapFlow["mailboxOpen"]>>;
  release: () => void;
};

const MAILBOX_CANDIDATES: Record<Mailbox, string[]> = {
  inbox: ["INBOX"],
  sent: [
    "Sent",
    "Sent Messages",
    "Sent Items",
    "Sent Mail",
    "Sent Email",
    "Envoyés",
    "Envoyées",
    "Envoyees",
    "Envoyes",
    "Messages envoyés",
    "Messages envoyes",
    "Courrier envoyé",
    "Courrier envoye",
    "[Gmail]/Sent Mail",
    "[Gmail]/Messages envoyés",
    "[Gmail]/Messages envoyes",
    "[Gmail]/Courrier envoyé",
    "[Gmail]/Courrier envoye",
    "INBOX.Sent",
    "INBOX/Sent",
    "INBOX.Sent Mail",
    "INBOX/Sent Mail",
    "INBOX.Sent Items",
    "INBOX/Sent Items",
    "INBOX.Envoyes",
    "INBOX/Envoyes",
  ],
  drafts: [
    "Drafts",
    "Draft",
    "Brouillons",
    "Brouillon",
    "INBOX.Drafts",
    "INBOX/Drafts",
    "[Gmail]/Drafts",
  ],
  trash: [
    "Trash",
    "Deleted Items",
    "Deleted Messages",
    "Corbeille",
    "INBOX.Trash",
    "INBOX/Trash",
    "[Gmail]/Trash",
    "[Gmail]/Corbeille",
  ],
  spam: [
    "Spam",
    "Junk",
    "Junk Mail",
    "Courrier indésirable",
    "Courrier indesirable",
    "Spam Messages",
    "INBOX.Spam",
    "INBOX/Spam",
    "[Gmail]/Spam",
    "[Gmail]/Junk",
  ],
};

const MAILBOX_SPECIAL_USE: Partial<Record<Mailbox, string>> = {
  inbox: "\\Inbox",
  sent: "\\Sent",
  drafts: "\\Drafts",
  trash: "\\Trash",
  spam: "\\Junk",
};

const mailboxNameCache = new Map<Mailbox, string>();

function normalizeMailboxName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function mailboxNameVariants(entry: ListResponse): string[] {
  const variants = new Set<string>();
  variants.add(entry.path);
  const delimiter = entry.delimiter || "/";
  const segments = entry.path.split(delimiter).filter(Boolean);
  if (segments.length) {
    variants.add(segments[segments.length - 1] ?? entry.path);
  }
  return Array.from(variants);
}

function computeSentMailboxWeight(normalizedVariants: string[]): number {
  let best = Number.POSITIVE_INFINITY;

  for (const variant of normalizedVariants) {
    if (!variant) continue;
    const tokens = variant.split(" ").filter(Boolean);
    if (!tokens.length) continue;
    const has = (value: string) => tokens.includes(value);
    const hasAll = (...values: string[]) => values.every(has);
    const hasAny = (...values: string[]) => values.some(has);

    if (
      hasAll("gmail", "sent", "mail") ||
      hasAll("gmail", "messages", "envoyes") ||
      hasAll("gmail", "courrier", "envoye")
    ) {
      best = Math.min(best, 0);
      continue;
    }

    if (
      hasAll("sent", "mail") ||
      hasAll("messages", "envoyes") ||
      hasAll("courrier", "envoye")
    ) {
      best = Math.min(best, 1);
      continue;
    }

    if (hasAll("sent", "items") || hasAll("sent", "messages")) {
      best = Math.min(best, 2);
      continue;
    }

    if (hasAny("envoye", "envoyes", "envoyee", "envoyees")) {
      best = Math.min(best, 3);
      continue;
    }

    if (has("sent")) {
      best = Math.min(best, 4);
      continue;
    }
  }

  return Number.isFinite(best) ? best : 12;
}

async function listMailboxes(client: ImapFlow): Promise<ListResponse[]> {
  const seen = new Map<string, ListResponse>();
  try {
    const folders = await client.list();
    for (const mailbox of folders ?? []) {
      if (mailbox && typeof mailbox.path === "string") {
        if (!seen.has(mailbox.path)) {
          seen.set(mailbox.path, mailbox);
        }
      }
    }
  } catch (error) {
    console.warn("Impossible de lister les boîtes aux lettres IMAP:", error);
  }
  return Array.from(seen.values());
}

async function getMailboxPathCandidates(
  client: ImapFlow,
  mailbox: Mailbox,
): Promise<string[]> {
  const candidateWeights = new Map<string, number>();

  const recordCandidate = (
    path: string | null | undefined,
    weight: number,
  ) => {
    if (!path) {
      return;
    }
    const existing = candidateWeights.get(path);
    if (existing === undefined || weight < existing) {
      candidateWeights.set(path, weight);
    }
  };

  const cached = mailboxNameCache.get(mailbox);
  if (cached) {
    recordCandidate(cached, -10);
  }

  if (mailbox === "inbox") {
    recordCandidate("INBOX", 0);
    return [...candidateWeights.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([path]) => path);
  }

  const allMailboxes = await listMailboxes(client);
  const specialUse = MAILBOX_SPECIAL_USE[mailbox]?.toLowerCase() ?? null;

  for (const entry of allMailboxes) {
    const variants = mailboxNameVariants(entry);
    const normalizedVariants = variants.map((variant) =>
      normalizeMailboxName(variant),
    );

    let weight = Number.POSITIVE_INFINITY;

    if (
      specialUse &&
      entry.specialUse?.toLowerCase() === specialUse
    ) {
      weight = -5;
    }

    if (mailbox === "sent") {
      weight = Math.min(weight, computeSentMailboxWeight(normalizedVariants));
    }

    if (!Number.isFinite(weight)) {
      weight = 5;
    }
    recordCandidate(entry.path, weight);
  }

  for (const candidate of MAILBOX_CANDIDATES[mailbox] ?? []) {
    recordCandidate(candidate, 20);
  }

  const sortedCandidates = [...candidateWeights.entries()].sort(
    (a, b) => a[1] - b[1] || a[0].localeCompare(b[0]),
  );

  if (!sortedCandidates.length) {
    throw new Error(
      mailbox === "sent"
        ? "Aucun dossier 'Envoyés' trouvé sur le serveur IMAP."
        : "Boîte aux lettres introuvable.",
    );
  }

  return sortedCandidates.map(([path]) => path);
}

function ensureNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Le champ ${field} est requis.`);
  }
  return trimmed;
}

function ensurePort(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`Le port ${field} est invalide.`);
  }
  return value;
}

function toOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceWithFallback(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatDateInputValue(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapEmailHtml(
  contentHtml: string,
  options: {
    senderName: string | null;
    senderLogoUrl: string | null;
    fromEmail: string | null;
  },
): string {
  const { senderName, senderLogoUrl, fromEmail } = options;
  const displayName = senderName?.trim() ?? "";
  const email = fromEmail ?? "";
  const fontFamily =
    "'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif";
  const outerBackground = "#f4f5f7";
  const innerBackground = "#ffffff";
  const primaryTextColor = "#111827";
  const secondaryTextColor = "#475569";
  const baseFontStyle = `font-family:${fontFamily};`;

  const logoHtml = senderLogoUrl
    ? `<img src="${escapeHtml(senderLogoUrl)}" alt="Logo expéditeur" width="120" style="display:block;width:120px;max-width:100%;height:auto;border-radius:6px;" />`
    : "";

  const headerContentParts: string[] = [];
  if (displayName) {
    headerContentParts.push(
      `<p style="margin:0;font-size:16px;font-weight:600;color:${primaryTextColor};">${escapeHtml(displayName)}</p>`,
    );
  }
  if (email) {
    headerContentParts.push(
      `<p style="margin:${displayName ? "4px 0 0" : "0"};font-size:12px;color:${secondaryTextColor};">${escapeHtml(email)}</p>`,
    );
  }
  const headerContent = headerContentParts.join("");

  let headerHtml = "";
  if (logoHtml || headerContent) {
    headerHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
        <tr>
          ${
            logoHtml
              ? `<td style="padding-right:12px;vertical-align:middle;" width="48">${logoHtml}</td>`
              : ""
          }
          ${
            headerContent
              ? `<td style="vertical-align:middle;">${headerContent}</td>`
              : ""
          }
        </tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>
      :root {
        color-scheme: light;
        supported-color-schemes: light;
      }
      body,
      table.email-wrapper,
      td.email-wrapper {
        background-color: ${outerBackground} !important;
        color: ${primaryTextColor} !important;
      }
      .email-container,
      .email-container td {
        background-color: ${innerBackground} !important;
        color: ${primaryTextColor} !important;
        border-radius: 16px !important;
      }
      .email-container {
        border-radius: 16px !important;
        overflow: hidden !important;
      }
      @media (prefers-color-scheme: dark) {
        body,
        table.email-wrapper,
        td.email-wrapper {
          background-color: ${outerBackground} !important;
          color: ${primaryTextColor} !important;
        }
        .email-container,
        .email-container td {
          background-color: ${innerBackground} !important;
          color: ${primaryTextColor} !important;
        }
      }
      body[data-ogsc],
      [data-ogsc] body {
        background-color: ${outerBackground} !important;
        color: ${primaryTextColor} !important;
      }
      body[data-ogsc] .email-container,
      [data-ogsc] .email-container {
        background-color: ${innerBackground} !important;
        color: ${primaryTextColor} !important;
        border-radius: 16px !important;
        overflow: hidden !important;
      }
    </style>
    <title>Message</title>
  </head>
  <body bgcolor="${outerBackground}" style="margin:0;padding:0;background-color:${outerBackground};${baseFontStyle}color:${primaryTextColor};color-scheme:light;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper" bgcolor="${outerBackground}" style="width:100%;border-collapse:collapse;background-color:${outerBackground};">
      <tr>
        <td class="email-wrapper" align="center" style="padding:32px 12px;background-color:${outerBackground};">
          <!--[if mso]>
          <table role="presentation" width="600" cellpadding="0" cellspacing="0">
            <tr>
              <td>
          <![endif]-->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-container" bgcolor="${innerBackground}" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background-color:${innerBackground};border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 32px;${baseFontStyle}color:${primaryTextColor};background-color:${innerBackground};border-radius:16px;">
                ${headerHtml}
                <div style="font-size:15px;line-height:1.6;color:${primaryTextColor};background-color:${innerBackground};">
                  ${contentHtml}
                </div>
              </td>
            </tr>
          </table>
          <!--[if mso]>
              </td>
            </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function convertPlainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized.length) {
    return `<p style="margin:0;font-size:14px;line-height:1.6;">&nbsp;</p>`;
  }
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;">${escaped}</p>`;
    })
    .join("");
}

function buildAttachmentDescriptors(
  mailbox: Mailbox,
  uid: number,
  attachments: Attachment[] | undefined,
): AttachmentDescriptor[] {
  if (!attachments?.length) {
    return [];
  }

  return attachments.map((attachment, index) => {
    const id = attachment.checksum ?? `${mailbox}-${uid}-${index}`;
    const filename =
      attachment.filename ?? `pièce-jointe-${index + 1}.bin`;
    const contentType =
      attachment.contentType ?? "application/octet-stream";
    const size =
      typeof attachment.size === "number" && Number.isFinite(attachment.size)
        ? attachment.size
        : Buffer.isBuffer(attachment.content)
          ? attachment.content.length
          : 0;

    return {
      id,
      filename,
      contentType,
      size,
      raw: attachment,
    } satisfies AttachmentDescriptor;
  });
}

async function readAttachmentContent(attachment: Attachment): Promise<Buffer> {
  const { content } = attachment;
  if (!content) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(content)) {
    return content;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of content) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function formatError(prefix: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`${prefix}: ${error.message}`);
  }
  return new Error(`${prefix}: erreur inconnue`);
}

function isAuthError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /auth|login failed|invalid credentials/i.test(message);
}

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") {
    if (
      /no.?connection|econn|enotfound|etimedout|socket|ehost/i.test(code)
    ) {
      return true;
    }
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /connection (?:not )?available|econn|timed out|socket|refused/i.test(
    message,
  );
}

function formatAddress(entry?: ImapAddress | null): string | null {
  if (!entry) {
    return null;
  }
  const email =
    entry.mailbox && entry.host
      ? `${entry.mailbox}@${entry.host}`
      : undefined;
  if (entry.name && email) {
    return `${entry.name} <${email}>`;
  }
  if (entry.name) {
    return entry.name;
  }
  return email ?? null;
}

function formatAddressList(list?: ImapAddress[]): string[] {
  if (!list?.length) {
    return [];
  }
  return list
    .map((entry) => formatAddress(entry))
    .filter((value): value is string => Boolean(value));
}

type AddressLike = {
  name?: string | null;
  mailbox?: string | null;
  host?: string | null;
  address?: string | null;
};

function toParticipant(entry?: AddressLike | null): MessageParticipant | null {
  if (!entry) {
    return null;
  }
  const rawName = typeof entry.name === "string" ? entry.name.trim() : "";
  const rawAddress = typeof entry.address === "string"
    ? entry.address.trim()
    : entry.mailbox && entry.host
      ? `${entry.mailbox}@${entry.host}`
      : "";
  const name = rawName.length ? rawName : null;
  const address = rawAddress.length ? rawAddress : null;
  if (!name && !address) {
    return null;
  }
  return { name, address };
}

function mergeParticipants(
  ...sources: Array<readonly AddressLike[] | undefined>
): MessageParticipant[] {
  const results: MessageParticipant[] = [];
  const byAddress = new Map<string, MessageParticipant>();

  const addParticipant = (entry?: AddressLike | null) => {
    const participant = toParticipant(entry);
    if (!participant) {
      return;
    }
    if (participant.address) {
      const key = participant.address.toLowerCase();
      const existing = byAddress.get(key);
      if (existing) {
        if (!existing.name && participant.name) {
          existing.name = participant.name;
        }
        return;
      }
      byAddress.set(key, participant);
      results.push(participant);
      return;
    }
    results.push(participant);
  };

  for (const list of sources) {
    for (const entry of list ?? []) {
      addParticipant(entry);
    }
  }

  return results;
}

function hasAttachments(
  structure:
    | MessageStructureObject
    | MessageStructureObject[]
    | null
    | undefined,
): boolean {
  if (!structure) return false;
  if (Array.isArray(structure)) {
    return structure.some((child) => hasAttachments(child));
  }
  const disposition = structure.disposition
    ? String(structure.disposition).toLowerCase()
    : "";
  if (disposition === "attachment") {
    return true;
  }
  if (structure.childNodes?.length) {
    return structure.childNodes.some((child) => hasAttachments(child));
  }
  return false;
}

async function withImapClient<T>(
  config: ImapConnectionConfig,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  });

  client.on("error", (error: unknown) => {
    console.warn("Erreur du client IMAP:", error);
  });

  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function openMailbox(
  client: ImapFlow,
  mailbox: Mailbox,
  readOnly: boolean,
): Promise<MailboxOpenResult> {
  const candidates = await getMailboxPathCandidates(client, mailbox);
  const attempted = new Set<string>();

  const buildVariants = (path: string): Array<string | string[]> => {
    const variants: Array<string | string[]> = [];

    const slashSegments = path.split("/").map((segment) => segment.trim()).filter(Boolean);
    if (slashSegments.length > 1) {
      variants.push(slashSegments);
    }

    const dotSegments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
    if (dotSegments.length > 1) {
      variants.push(dotSegments);
    }

    variants.push(path);
    return variants;
  };

  for (const name of candidates) {
    for (const variant of buildVariants(name)) {
      const attemptKey = Array.isArray(variant)
        ? variant.join("::")
        : variant;
      if (attempted.has(attemptKey)) {
        continue;
      }
      attempted.add(attemptKey);

      let lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null = null;
      const releaseLock = () => {
        if (lock) {
          lock.release();
          lock = null;
        }
      };
      try {
        lock = await client.getMailboxLock(variant);
        const info = await client.mailboxOpen(variant, { readOnly });
        mailboxNameCache.set(mailbox, info.path ?? name);
        return {
          name: info.path ?? name,
          info,
          release: releaseLock,
        };
      } catch (error) {
        releaseLock();
        if (mailboxNameCache.get(mailbox) === name) {
          mailboxNameCache.delete(mailbox);
        }
        if (isConnectionError(error)) {
          throw formatError("Connexion IMAP indisponible", error);
        }
        console.warn(
          `Impossible d'ouvrir la boîte "${Array.isArray(variant) ? variant.join(" / ") : variant}" (${mailbox}):`,
          error,
        );
        if (mailbox === "sent" && isAuthError(error)) {
          throw error;
        }
      }
    }
  }
  throw new Error(
    mailbox === "sent"
      ? "Dossier 'Envoyés' introuvable sur le serveur IMAP."
      : "Boîte aux lettres introuvable.",
  );
}

async function appendMessageToSentMailbox(params: {
  imap: ImapConnectionConfig | null;
  rawMessage: Buffer;
  messageId: string;
  sentAt: Date;
  userId: string;
}): Promise<SentMailboxAppendResult> {
  if (!params.imap) {
    return {
      message: null,
      totalMessages: null,
    };
  }

  return withImapClient(params.imap, async (client) => {
    let opened: MailboxOpenResult;
    try {
      opened = await openMailbox(client, "sent", false);
    } catch (error) {
      console.warn(
        "Impossible d'enregistrer le message dans le dossier 'Envoyés':",
        error,
      );
      return {
        message: null,
        totalMessages: null,
      };
    }

    try {
      const appendResponse = await client.append(
        opened.name,
        params.rawMessage,
        ["\\Seen"],
        params.sentAt,
      );

      const fetchQuery = {
        envelope: true,
        internalDate: true,
        flags: true,
        bodyStructure: true,
      } satisfies Parameters<ImapFlow["fetchOne"]>[1];

      let fetched:
        | Awaited<ReturnType<ImapFlow["fetchOne"]>>
        | false = false;

      if (appendResponse && appendResponse.uid) {
        fetched = await client.fetchOne(
          appendResponse.uid,
          fetchQuery,
          { uid: true },
        );
      }

      if (!fetched && appendResponse && appendResponse.seq) {
        fetched = await client.fetchOne(appendResponse.seq, fetchQuery);
      }

      if (!fetched) {
        try {
          const searchResult = await client.search(
            {
              header: {
                "message-id": params.messageId,
              },
            },
            { uid: true },
          );
          if (Array.isArray(searchResult) && searchResult.length > 0) {
            const targetUid = searchResult[searchResult.length - 1];
            fetched = await client.fetchOne(
              targetUid,
              fetchQuery,
              { uid: true },
            );
          }
        } catch (searchError) {
          console.warn(
            "Recherche du message envoyé échouée:",
            searchError,
          );
        }
      }

      const status = await client
        .status(opened.name, { messages: true })
        .catch(() => null);
      const totalMessages =
        status?.messages ?? opened.info.exists ?? null;

      let mailboxItem =
        fetched && typeof fetched === "object"
          ? createMailboxListItem(
              fetched as unknown as Parameters<
                typeof createMailboxListItem
              >[0],
            )
          : null;

      if (mailboxItem?.messageId) {
        try {
          const trackingSummaries = await getEmailTrackingSummaries({
            userId: params.userId,
            messageIds: [mailboxItem.messageId],
          });
          const summary = trackingSummaries.get(mailboxItem.messageId);
          if (summary) {
            mailboxItem = {
              ...mailboxItem,
              tracking: {
                enabled: summary.trackingEnabled,
                totalOpens: summary.totalOpens,
                totalClicks: summary.totalClicks,
              },
            };
          }
        } catch (error) {
          console.warn(
            "Impossible de récupérer le suivi pour le message envoyé:",
            error,
          );
        }
      }

      return {
        message: mailboxItem,
        totalMessages,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

async function getMessagingCredentials(
  providedUserId?: string,
): Promise<MessagingCredentials> {
  const userId = await resolveUserId(providedUserId);
  const settings = await prisma.messagingSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    return {
      fromEmail: null,
      senderName: null,
      senderLogoUrl: null,
      imap: null,
      smtp: null,
      spamFilterEnabled: true,
      trackingEnabled: true,
      autoReply: {
        enabled: false,
        subject: DEFAULT_AUTO_REPLY_SUBJECT,
        body: DEFAULT_AUTO_REPLY_BODY,
      },
      vacation: {
        enabled: false,
        subject: DEFAULT_VACATION_SUBJECT,
        message: DEFAULT_VACATION_BODY,
        startDate: null,
        endDate: null,
        backupEmail: null,
      },
    };
  }

  const decrypt = (value: string | null | undefined) => {
    try {
      return decryptSecret(value) ?? null;
    } catch (error) {
      throw formatError(
        "Impossible de déchiffrer les identifiants de messagerie",
        error,
      );
    }
  };

  const imapUser = decrypt(settings.imapUser);
  const imapPassword = decrypt(settings.imapPassword);
  const smtpUser = decrypt(settings.smtpUser);
  const smtpPassword = decrypt(settings.smtpPassword);

  return {
    fromEmail: settings.fromEmail,
    senderName: settings.senderName ?? null,
    senderLogoUrl: settings.senderLogoUrl ?? null,
    spamFilterEnabled: settings.spamFilterEnabled ?? true,
    trackingEnabled: settings.trackingEnabled ?? true,
    autoReply: {
      enabled: settings.autoReplyEnabled ?? false,
      subject: coerceWithFallback(
        toOptionalString(settings.autoReplySubject),
        DEFAULT_AUTO_REPLY_SUBJECT,
      ),
      body: coerceWithFallback(
        settings.autoReplyBody ?? null,
        DEFAULT_AUTO_REPLY_BODY,
      ),
    },
    vacation: {
      enabled: settings.vacationModeEnabled ?? false,
      subject: coerceWithFallback(
        toOptionalString(settings.vacationSubject),
        DEFAULT_VACATION_SUBJECT,
      ),
      message: coerceWithFallback(
        settings.vacationMessage ?? null,
        DEFAULT_VACATION_BODY,
      ),
      startDate: settings.vacationStartDate ?? null,
      endDate: settings.vacationEndDate ?? null,
      backupEmail: toOptionalString(settings.vacationBackupEmail),
    },
    imap:
      settings.imapHost &&
      settings.imapPort &&
      imapUser &&
      imapPassword
        ? {
            host: settings.imapHost,
            port: settings.imapPort,
            secure: settings.imapSecure,
            user: imapUser,
            password: imapPassword,
          }
        : null,
    smtp:
      settings.smtpHost &&
      settings.smtpPort &&
      smtpUser &&
      smtpPassword
        ? {
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpSecure,
            user: smtpUser,
            password: smtpPassword,
            fromEmail: settings.fromEmail,
          }
        : null,
  };
}

export async function getMessagingSettingsSummary(
  userId?: string,
): Promise<MessagingSettingsSummary> {
  const resolvedUserId = await resolveUserId(userId);
  const settings = await prisma.messagingSettings.findUnique({
    where: { userId: resolvedUserId },
  });

  if (!settings) {
    return {
      fromEmail: "",
      senderName: "",
      senderLogoUrl: null,
      imapHost: "",
      imapPort: null,
      imapSecure: true,
      smtpHost: "",
      smtpPort: null,
      smtpSecure: true,
      imapConfigured: false,
      smtpConfigured: false,
      spamFilterEnabled: true,
      trackingEnabled: true,
      autoReplyEnabled: false,
      autoReplySubject: DEFAULT_AUTO_REPLY_SUBJECT,
      autoReplyBody: DEFAULT_AUTO_REPLY_BODY,
      vacationModeEnabled: false,
      vacationSubject: DEFAULT_VACATION_SUBJECT,
      vacationMessage: DEFAULT_VACATION_BODY,
      vacationStartDate: null,
      vacationEndDate: null,
      vacationBackupEmail: null,
    };
  }

  return {
    fromEmail: settings.fromEmail ?? "",
    senderName: settings.senderName ?? "",
    senderLogoUrl: settings.senderLogoUrl ?? null,
    imapHost: settings.imapHost ?? "",
    imapPort: settings.imapPort,
    imapSecure: settings.imapSecure,
    smtpHost: settings.smtpHost ?? "",
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    imapConfigured:
      Boolean(settings.imapHost) &&
      Boolean(settings.imapPort) &&
      Boolean(settings.imapUser) &&
      Boolean(settings.imapPassword),
    smtpConfigured:
      Boolean(settings.smtpHost) &&
      Boolean(settings.smtpPort) &&
      Boolean(settings.smtpUser) &&
      Boolean(settings.smtpPassword),
    spamFilterEnabled: settings.spamFilterEnabled ?? true,
    trackingEnabled: settings.trackingEnabled ?? true,
    autoReplyEnabled: settings.autoReplyEnabled ?? false,
    autoReplySubject: coerceWithFallback(
      toOptionalString(settings.autoReplySubject),
      DEFAULT_AUTO_REPLY_SUBJECT,
    ),
    autoReplyBody: coerceWithFallback(
      settings.autoReplyBody ?? null,
      DEFAULT_AUTO_REPLY_BODY,
    ),
    vacationModeEnabled: settings.vacationModeEnabled ?? false,
    vacationSubject: coerceWithFallback(
      toOptionalString(settings.vacationSubject),
      DEFAULT_VACATION_SUBJECT,
    ),
    vacationMessage: coerceWithFallback(
      settings.vacationMessage ?? null,
      DEFAULT_VACATION_BODY,
    ),
    vacationStartDate: formatDateInputValue(settings.vacationStartDate ?? null),
    vacationEndDate: formatDateInputValue(settings.vacationEndDate ?? null),
    vacationBackupEmail: toOptionalString(settings.vacationBackupEmail),
  };
}

export async function updateMessagingSenderIdentity(
  input: MessagingIdentityInput,
): Promise<void> {
  const userId = await resolveUserId();
  const normalizedName = (input.senderName ?? "").trim();
  const normalizedLogo = toOptionalString(input.senderLogoUrl ?? null);

  const existing = await prisma.messagingSettings.findUnique({
    where: { userId },
  });

  const data = {
    senderName: normalizedName,
    senderLogoUrl: normalizedLogo,
  };

  if (existing) {
    await prisma.messagingSettings.update({
      where: { userId },
      data,
    });
  } else {
    await prisma.messagingSettings.create({
      data: {
        userId,
        ...data,
      },
    });
  }
}

export async function updateMessagingAutoReplySettings(
  input: MessagingAutoReplySettingsInput,
): Promise<void> {
  const userId = await resolveUserId();
  const existing = await prisma.messagingSettings.findUnique({
    where: { userId },
  });

  const normalizedSubject = coerceWithFallback(
    input.autoReplySubject,
    DEFAULT_AUTO_REPLY_SUBJECT,
  );
  const normalizedBody = coerceWithFallback(
    input.autoReplyBody,
    DEFAULT_AUTO_REPLY_BODY,
  );
  const normalizedVacationSubject = coerceWithFallback(
    input.vacationSubject,
    DEFAULT_VACATION_SUBJECT,
  );
  const normalizedVacationMessage = coerceWithFallback(
    input.vacationMessage,
    DEFAULT_VACATION_BODY,
  );
  const normalizedBackupEmail = toOptionalString(input.vacationBackupEmail);

  const data = {
    autoReplyEnabled: input.autoReplyEnabled,
    autoReplySubject: normalizedSubject,
    autoReplyBody: normalizedBody,
    vacationModeEnabled: input.vacationModeEnabled,
    vacationSubject: normalizedVacationSubject,
    vacationMessage: normalizedVacationMessage,
    vacationStartDate: input.vacationStartDate,
    vacationEndDate: input.vacationEndDate,
    vacationBackupEmail: normalizedBackupEmail,
  };

  if (existing) {
    await prisma.messagingSettings.update({
      where: { userId },
      data,
    });
  } else {
    await prisma.messagingSettings.create({
      data: {
        userId,
        ...data,
      },
    });
  }
}

export async function updateMessagingConnections(
  input: MessagingConnectionsInput,
): Promise<void> {
  const userId = await resolveUserId();
  const existing = await prisma.messagingSettings.findUnique({
    where: { userId },
  });

  const sanitizedFromEmail = ensureNonEmpty(input.fromEmail, "Adresse e-mail");
  const sanitizedImapHost = ensureNonEmpty(input.imapHost, "Serveur IMAP");
  const sanitizedSmtpHost = ensureNonEmpty(input.smtpHost, "Serveur SMTP");
  const validatedImapPort = ensurePort(input.imapPort, "IMAP");
  const validatedSmtpPort = ensurePort(input.smtpPort, "SMTP");

  const trimmedImapUser = input.imapUser?.trim() ?? "";
  const trimmedImapPassword = input.imapPassword?.trim() ?? "";
  const trimmedSmtpUser = input.smtpUser?.trim() ?? "";
  const trimmedSmtpPassword = input.smtpPassword?.trim() ?? "";

  const encryptedImapUser =
    trimmedImapUser.length > 0
      ? encryptSecret(trimmedImapUser)
      : existing?.imapUser ?? null;
  if (!encryptedImapUser) {
    throw new Error("Identifiant IMAP requis.");
  }

  const encryptedImapPassword =
    trimmedImapPassword.length > 0
      ? encryptSecret(trimmedImapPassword)
      : existing?.imapPassword ?? null;
  if (!encryptedImapPassword) {
    throw new Error("Mot de passe IMAP requis.");
  }

  const encryptedSmtpUser =
    trimmedSmtpUser.length > 0
      ? encryptSecret(trimmedSmtpUser)
      : existing?.smtpUser ?? null;
  if (!encryptedSmtpUser) {
    throw new Error("Identifiant SMTP requis.");
  }

  const encryptedSmtpPassword =
    trimmedSmtpPassword.length > 0
      ? encryptSecret(trimmedSmtpPassword)
      : existing?.smtpPassword ?? null;
  if (!encryptedSmtpPassword) {
    throw new Error("Mot de passe SMTP requis.");
  }

  const connectionData = {
    fromEmail: sanitizedFromEmail,
    imapHost: sanitizedImapHost,
    imapPort: validatedImapPort,
    imapSecure: input.imapSecure,
    imapUser: encryptedImapUser,
    imapPassword: encryptedImapPassword,
    smtpHost: sanitizedSmtpHost,
    smtpPort: validatedSmtpPort,
    smtpSecure: input.smtpSecure,
    smtpUser: encryptedSmtpUser,
    smtpPassword: encryptedSmtpPassword,
  };

  if (existing) {
    await prisma.messagingSettings.update({
      where: { userId },
      data: connectionData,
    });
  } else {
    await prisma.messagingSettings.create({
      data: {
        userId,
        senderName: "",
        senderLogoUrl: null,
        ...connectionData,
      },
    });
  }
}

type IncomingMessageMetadata = {
  uid: number;
  messageId: string | null;
  subject: string;
  fromAddress: string | null;
  replyToAddress: string | null;
  parsed: ParsedMail;
};

const AUTOMATED_ADDRESS_PATTERNS = [
  "no-reply",
  "noreply",
  "do-not-reply",
  "donotreply",
  "mailer-daemon",
  "postmaster",
];

function normalizeEmailAddress(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }
  const match = trimmed.match(/<([^>]+)>/);
  const email = (match ? match[1] : trimmed).trim().toLowerCase();
  if (!email.length || !email.includes("@")) {
    return null;
  }
  return email;
}

function getEnvelopeEmail(entry?: ImapAddress | null): string | null {
  if (!entry) return null;
  if (typeof entry.address === "string" && entry.address.trim().length > 0) {
    return entry.address.trim();
  }
  if (entry.mailbox && entry.host) {
    return `${entry.mailbox}@${entry.host}`.trim();
  }
  return null;
}

function getHeaderValue(parsed: ParsedMail, header: string): string | null {
  const raw = parsed.headers.get(header);
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw[0] ? String(raw[0]).trim() : null;
  }
  return String(raw).trim();
}

function hasAutomatedHeaders(parsed: ParsedMail): boolean {
  const autoSubmitted = getHeaderValue(parsed, "auto-submitted");
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") {
    return true;
  }
  const precedence = getHeaderValue(parsed, "precedence");
  if (
    precedence &&
    ["bulk", "junk", "auto_reply"].includes(precedence.toLowerCase())
  ) {
    return true;
  }
  const suppress = getHeaderValue(parsed, "x-auto-response-suppress");
  if (suppress) {
    return true;
  }
  if (
    parsed.headers.has("x-autoreply") ||
    parsed.headers.has("x-autorespond") ||
    parsed.headers.has("auto-submitted") ||
    parsed.headers.has("x-auto-submitted")
  ) {
    return true;
  }
  return false;
}

function shouldSkipAutoResponse(
  parsed: ParsedMail,
  candidateAddress: string | null,
): boolean {
  if (!candidateAddress) {
    return true;
  }
  if (
    AUTOMATED_ADDRESS_PATTERNS.some((pattern) =>
      candidateAddress.toLowerCase().includes(pattern),
    )
  ) {
    return true;
  }
  if (hasAutomatedHeaders(parsed)) {
    return true;
  }
  return false;
}

function formatVacationReturnDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function isVacationModeActive(
  config: VacationAutoReplyConfig,
  referenceDate: Date,
): boolean {
  if (
    !config.enabled ||
    !config.startDate ||
    !config.endDate
  ) {
    return false;
  }
  const start = new Date(config.startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(config.endDate);
  end.setUTCHours(23, 59, 59, 999);
  if (end < start) {
    return false;
  }
  return referenceDate >= start && referenceDate <= end;
}

async function loadIncomingMessageMetadata(
  client: ImapFlow,
  uid: number,
): Promise<IncomingMessageMetadata | null> {
  const fetched = await client.fetchOne(
    uid,
    {
      envelope: true,
      source: true,
    },
    { uid: true },
  );

  if (
    !fetched ||
    typeof fetched !== "object" ||
    !("source" in fetched) ||
    !fetched.source
  ) {
    return null;
  }

  const source = fetched.source as Buffer | Uint8Array | string;
  const normalizedSource =
    typeof source === "string"
      ? source
      : Buffer.isBuffer(source)
        ? source
        : Buffer.from(source);

  const parsed = await simpleParser(normalizedSource);
  const envelope = fetched.envelope;
  const fromEntry = envelope?.from?.[0] as ImapAddress | undefined;
  const replyToEntry = envelope?.replyTo?.[0] as ImapAddress | undefined;

  const fromAddress =
    getEnvelopeEmail(fromEntry) ??
    parsed.from?.value?.[0]?.address ??
    null;
  const replyToAddress =
    getEnvelopeEmail(replyToEntry) ??
    parsed.replyTo?.value?.[0]?.address ??
    null;

  return {
    uid,
    messageId: envelope?.messageId ?? parsed.messageId ?? null,
    subject: envelope?.subject ?? parsed.subject ?? "(Sans objet)",
    fromAddress,
    replyToAddress,
    parsed,
  };
}

async function processAutoReplies(params: {
  userId: string;
  client: ImapFlow;
  credentials: MessagingCredentials;
  messages: MailboxListItem[];
}): Promise<void> {
  const { userId, client, credentials, messages } = params;
  const smtp = credentials.smtp;
  if (!smtp || !messages.length) {
    return;
  }

  const now = new Date();
  const vacationActive = isVacationModeActive(credentials.vacation, now);
  const standardEnabled =
    credentials.autoReply.enabled && !vacationActive;
  if (!vacationActive && !standardEnabled) {
    return;
  }

  const ownAddress = normalizeEmailAddress(
    smtp.fromEmail ?? smtp.user ?? credentials.fromEmail,
  );

  const metadataEntries: Array<{
    uid: number;
    messageId: string | null;
    subject: string;
    targetAddress: string;
    normalizedAddress: string;
    parsed: ParsedMail;
  }> = [];

  for (const entry of messages) {
    const metadata = await loadIncomingMessageMetadata(client, entry.uid);
    if (!metadata) {
      continue;
    }
    const targetAddress = metadata.replyToAddress ?? metadata.fromAddress;
    if (!targetAddress) {
      continue;
    }
    const normalized = normalizeEmailAddress(targetAddress);
    if (!normalized) {
      continue;
    }
    if (ownAddress && normalized === ownAddress) {
      continue;
    }
    if (shouldSkipAutoResponse(metadata.parsed, targetAddress)) {
      continue;
    }
    metadataEntries.push({
      uid: entry.uid,
      messageId: metadata.messageId,
      subject: metadata.subject,
      targetAddress,
      normalizedAddress: normalized,
      parsed: metadata.parsed,
    });
  }

  if (!metadataEntries.length) {
    return;
  }

  const uniqueSenders = Array.from(
    new Set(metadataEntries.map((item) => item.normalizedAddress)),
  );
  const cutoff = new Date(Date.now() - AUTO_REPLY_COOLDOWN_MS);

  const recentLogs = uniqueSenders.length
    ? await prisma.messagingAutoReplyLog.findMany({
        where: {
          userId,
          senderEmail: { in: uniqueSenders },
          sentAt: { gte: cutoff },
        },
        select: {
          senderEmail: true,
          replyType: true,
          sentAt: true,
        },
      })
    : [];

  const recentLogMap = new Map<
    string,
    { replyType: MessagingAutoReplyType; sentAt: Date }
  >();
  for (const log of recentLogs) {
    const existing = recentLogMap.get(log.senderEmail);
    if (!existing || existing.sentAt < log.sentAt) {
      recentLogMap.set(log.senderEmail, {
        replyType: log.replyType,
        sentAt: log.sentAt,
      });
    }
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
  });

  for (const entry of metadataEntries) {
    const replyType: MessagingAutoReplyType = vacationActive
      ? "VACATION"
      : "STANDARD";

    const lastLog = recentLogMap.get(entry.normalizedAddress);
    if (lastLog) {
      const withinCooldown =
        Date.now() - lastLog.sentAt.getTime() < AUTO_REPLY_COOLDOWN_MS;
      if (withinCooldown && lastLog.replyType === replyType) {
        continue;
      }
      if (!withinCooldown) {
        recentLogMap.delete(entry.normalizedAddress);
      }
    }

    const payload =
      replyType === "VACATION"
        ? {
            subject: credentials.vacation.subject,
            body: renderVacationTemplate(
              credentials.vacation.message,
              {
                returnDate: formatVacationReturnDate(
                  credentials.vacation.endDate,
                ),
                backupEmail:
                  credentials.vacation.backupEmail ??
                  credentials.fromEmail ??
                  smtp.fromEmail ??
                  smtp.user,
                defaultReturnText: "bientôt",
                defaultBackupText: "notre équipe support",
              },
            ),
          }
        : {
            subject: credentials.autoReply.subject,
            body: credentials.autoReply.body,
          };

    if (!payload.body.trim().length) {
      continue;
    }

    try {
      await sendAutomatedReplyEmail({
        transporter,
        smtp,
        imap: credentials.imap,
        senderName: credentials.senderName,
        senderLogoUrl: credentials.senderLogoUrl,
        to: entry.targetAddress,
        subject: payload.subject,
        body: payload.body,
        userId,
      });
      const logEntry = await prisma.messagingAutoReplyLog.create({
        data: {
          userId,
          senderEmail: entry.normalizedAddress,
          replyType,
          originalMessageId: entry.messageId,
          originalUid: entry.uid,
        },
      });
      recentLogMap.set(entry.normalizedAddress, {
        replyType,
        sentAt: logEntry.sentAt,
      });
    } catch (error) {
      console.warn("Impossible d'envoyer une réponse automatique:", error);
    }
  }
}

export async function fetchMailboxMessages(params: {
  mailbox: Mailbox;
  page?: number;
  pageSize?: number;
}): Promise<MailboxPageResult> {
  const userId = await resolveUserId();
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }
  const spamFilteringEnabled = credentials.spamFilterEnabled !== false;

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);

    try {
      const totalMessages = opened.info.exists ?? 0;
      if (totalMessages === 0) {
        return {
          mailbox: params.mailbox,
          page,
          pageSize,
          totalMessages: 0,
          hasMore: false,
          messages: [],
        };
      }

      const endSeq = Math.max(1, totalMessages - (page - 1) * pageSize);
      const startSeq = Math.max(1, endSeq - pageSize + 1);
      if (startSeq > endSeq) {
        return {
          mailbox: params.mailbox,
          page,
          pageSize,
          totalMessages,
          hasMore: false,
          messages: [],
        };
      }

      const range = `${startSeq}:${endSeq}`;
      const items: MailboxListItem[] = [];

      for await (const message of client.fetch(range, {
        envelope: true,
        internalDate: true,
        flags: true,
        bodyStructure: true,
      })) {
        items.push(
          createMailboxListItem(
            message as unknown as Parameters<
              typeof createMailboxListItem
            >[0],
          ),
        );
      }

      items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      let filteredItems = items;
      const autoMoved: AutoMovedSummary[] = [];

      if (params.mailbox === "inbox" && items.length && spamFilteringEnabled) {
        for (const entry of [...items]) {
          try {
            const analysis = await analyzeAndHandleSpam({
              userId,
              client,
              mailbox: params.mailbox,
              uid: entry.uid,
              spamFilteringEnabled,
            });
            if (analysis.movedToSpam && !analysis.alreadyLogged) {
              autoMoved.push({
                uid: entry.uid,
                subject: entry.subject,
                from: entry.from,
                score: analysis.score,
                target: "spam",
              });
              filteredItems = filteredItems.filter((item) => item.uid !== entry.uid);
            }
          } catch (error) {
            console.warn("Analyse de spam impossible:", error);
          }
        }
      }

      const adjustedTotal = Math.max(0, totalMessages - autoMoved.length);

      const messageIds = filteredItems
        .map((item) => item.messageId)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      let enrichedItems = filteredItems;

      if (messageIds.length) {
        const trackingSummaries = await getEmailTrackingSummaries({
          userId,
          messageIds,
        });
        enrichedItems = filteredItems.map((item) => {
          if (!item.messageId) {
            return item;
          }
          const summary = trackingSummaries.get(item.messageId);
          if (!summary) {
            return item;
          }
          return {
            ...item,
            tracking: {
              enabled: summary.trackingEnabled,
              totalOpens: summary.totalOpens,
              totalClicks: summary.totalClicks,
            },
          };
        });
      }

      return {
        mailbox: params.mailbox,
        page,
        pageSize,
        totalMessages: adjustedTotal,
        hasMore: startSeq > 1,
        messages: enrichedItems,
        autoMoved: autoMoved.length ? autoMoved : undefined,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function fetchMailboxUpdates(params: {
  mailbox: Mailbox;
  sinceUid: number;
}): Promise<{
  totalMessages: number | null;
  messages: MailboxListItem[];
  autoMoved?: AutoMovedSummary[];
}> {
  const userId = await resolveUserId();
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  const spamFilteringEnabled = credentials.spamFilterEnabled !== false;

  if (params.sinceUid <= 0) {
    return {
      totalMessages: null,
      messages: [],
    };
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);

    try {
      const totalMessages = opened.info.exists ?? null;
      const nextUid = opened.info.uidNext ?? null;
      if (nextUid !== null && params.sinceUid >= nextUid - 1) {
        return {
          totalMessages,
          messages: [],
        };
      }

      const range = `${params.sinceUid + 1}:*`;
      const items: MailboxListItem[] = [];
      for await (const message of client.fetch(
        { uid: range },
        {
          envelope: true,
          internalDate: true,
          flags: true,
          bodyStructure: true,
        },
      )) {
        items.push(
          createMailboxListItem(
            message as unknown as Parameters<
              typeof createMailboxListItem
            >[0],
          ),
        );
      }

      items.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      let filteredItems = items;
      const autoMoved: AutoMovedSummary[] = [];

      if (params.mailbox === "inbox" && items.length && spamFilteringEnabled) {
        for (const entry of [...items]) {
          try {
            const analysis = await analyzeAndHandleSpam({
              userId,
              client,
              mailbox: params.mailbox,
              uid: entry.uid,
              spamFilteringEnabled,
            });
            if (analysis.movedToSpam && !analysis.alreadyLogged) {
              autoMoved.push({
                uid: entry.uid,
                subject: entry.subject,
                from: entry.from,
                score: analysis.score,
                target: "spam",
              });
              filteredItems = filteredItems.filter((item) => item.uid !== entry.uid);
            }
          } catch (error) {
            console.warn("Analyse de spam impossible:", error);
          }
        }
      }

      const adjustedTotal =
        typeof totalMessages === "number"
          ? Math.max(0, totalMessages - autoMoved.length)
          : totalMessages;

      if (
        params.mailbox === "inbox" &&
        filteredItems.length &&
        spamFilteringEnabled
      ) {
        try {
          await processAutoReplies({
            userId,
            client,
            credentials,
            messages: filteredItems,
          });
        } catch (error) {
          console.warn("Impossible d'envoyer les réponses automatiques:", error);
        }
      }

      const messageIds = filteredItems
        .map((item) => item.messageId)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      let enrichedItems = filteredItems;

      if (messageIds.length) {
        const trackingSummaries = await getEmailTrackingSummaries({
          userId,
          messageIds,
        });
        enrichedItems = filteredItems.map((item) => {
          if (!item.messageId) {
            return item;
          }
          const summary = trackingSummaries.get(item.messageId);
          if (!summary) {
            return item;
          }
          return {
            ...item,
            tracking: {
              enabled: summary.trackingEnabled,
              totalOpens: summary.totalOpens,
              totalClicks: summary.totalClicks,
            },
          };
        });
      }

      return {
        totalMessages: adjustedTotal,
        messages: enrichedItems,
        autoMoved: autoMoved.length ? autoMoved : undefined,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function fetchMessageDetail(params: {
  mailbox: Mailbox;
  uid: number;
}): Promise<MessageDetail> {
  const userId = await resolveUserId();
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);

    try {
      const message = await client.fetchOne(
        params.uid,
        {
          envelope: true,
          internalDate: true,
          flags: true,
          source: true,
        },
        { uid: true },
      );

      if (
        !message ||
        typeof message !== "object" ||
        !("source" in message) ||
        !message.source ||
        !("envelope" in message) ||
        !message.envelope
      ) {
        throw new Error("Message introuvable.");
      }

      const fetched = message as FetchMessageObject & {
        source: Buffer | Uint8Array | string;
        envelope: MessageEnvelopeObject;
      };

      const parsed = await simpleParser(fetched.source);

      const parsedFrom = parsed.from?.value ?? [];
      const parsedTo = parsed.to?.value ?? [];
      const parsedCc = parsed.cc?.value ?? [];
      const parsedBcc = parsed.bcc?.value ?? [];
      const parsedReplyTo = parsed.replyTo?.value ?? [];

      const fromParticipants = mergeParticipants(
        fetched.envelope.from,
        parsedFrom,
      );
      const replyToParticipants = mergeParticipants(
        fetched.envelope.replyTo,
        parsedReplyTo,
      );
      const toParticipants = mergeParticipants(
        fetched.envelope.to,
        parsedTo,
      );
      const ccParticipants = mergeParticipants(
        fetched.envelope.cc,
        parsedCc,
      );
      const bccParticipants = mergeParticipants(
        fetched.envelope.bcc,
        parsedBcc,
      );

      const sanitizedHtml = parsed.html ? sanitizeEmailHtml(parsed.html) : null;

      const envelopeMessageId = fetched.envelope.messageId ?? null;
      const trackingDetail =
        envelopeMessageId && params.mailbox === "sent"
          ? await getEmailTrackingDetail({
              userId,
              messageId: envelopeMessageId,
            })
          : null;

      const attachmentDescriptors = buildAttachmentDescriptors(
        params.mailbox,
        params.uid,
        parsed.attachments,
      );

      const internalDate =
        fetched.internalDate instanceof Date
          ? fetched.internalDate
          : fetched.internalDate
            ? new Date(fetched.internalDate)
            : new Date();

      return {
        mailbox: params.mailbox,
        uid: params.uid,
        messageId: envelopeMessageId,
        subject: fetched.envelope.subject ?? "(Sans objet)",
        from: formatAddress(fetched.envelope.from?.[0] as ImapAddress | undefined),
        to: formatAddressList(fetched.envelope.to as ImapAddress[] | undefined),
        cc: formatAddressList(fetched.envelope.cc as ImapAddress[] | undefined),
        bcc: formatAddressList(fetched.envelope.bcc as ImapAddress[] | undefined),
        replyTo: formatAddressList(fetched.envelope.replyTo as ImapAddress[] | undefined),
        date: internalDate.toISOString(),
        seen: fetched.flags?.has("\\Seen") ?? false,
        html: sanitizedHtml,
        text: parsed.text ?? parsed.textAsHtml ?? null,
        attachments: attachmentDescriptors.map(
          ({ id, filename, contentType, size }) => ({
            id,
            filename,
            contentType,
            size,
          }),
        ),
        fromAddress: fromParticipants[0] ?? null,
        toAddresses: toParticipants,
        ccAddresses: ccParticipants,
        bccAddresses: bccParticipants,
        replyToAddresses: replyToParticipants,
        tracking: trackingDetail,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function fetchMessageAttachment(params: {
  mailbox: Mailbox;
  uid: number;
  attachmentId: string;
}): Promise<{ filename: string; contentType: string; content: Buffer }> {
  const userId = await resolveUserId();
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);

    try {
      const message = await client.fetchOne(
        params.uid,
        {
          envelope: true,
          source: true,
        },
        { uid: true },
      );

      if (!message) {
        throw new Error("Message introuvable.");
      }

      if (!message.source) {
        throw new Error("Message introuvable.");
      }

      const parsed = await simpleParser(message.source);
      const attachmentDescriptors = buildAttachmentDescriptors(
        params.mailbox,
        params.uid,
        parsed.attachments,
      );

      const descriptor = attachmentDescriptors.find(
        (entry) => entry.id === params.attachmentId,
      );

      if (!descriptor) {
        throw new Error("Pièce jointe introuvable.");
      }

      const content = await readAttachmentContent(descriptor.raw);

      return {
        filename: descriptor.filename,
        contentType: descriptor.contentType,
        content,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function moveMailboxMessage(params: {
  mailbox: Mailbox;
  uid: number;
  target: Mailbox;
}): Promise<void> {
  if (params.mailbox === params.target) {
    return;
  }

  const userId = await resolveUserId();
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const destinationCandidates = await getMailboxPathCandidates(
      client,
      params.target,
    );
    if (!destinationCandidates.length) {
      throw new Error("Dossier de destination introuvable.");
    }
    const destinationPath = destinationCandidates[0];
    const opened = await openMailbox(client, params.mailbox, false);

    try {
      const moved = await client.messageMove(
        String(params.uid),
        destinationPath,
        { uid: true },
      );
      if (!moved) {
        throw new Error("Déplacement du message impossible.");
      }
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

async function sendAutomatedReplyEmail(options: {
  transporter: Transporter;
  smtp: SmtpConnectionConfig;
  imap: ImapConnectionConfig | null;
  senderName: string | null;
  senderLogoUrl: string | null;
  to: string;
  subject: string;
  body: string;
  userId: string;
}): Promise<void> {
  const fromAddress = options.smtp.fromEmail ?? options.smtp.user;
  if (!fromAddress) {
    throw new Error("Adresse d'expéditeur invalide pour la réponse automatique.");
  }

  const messageDomain = fromAddress.includes("@")
    ? fromAddress.split("@").pop() ?? "local"
    : "local";
  const messageId = `<${randomUUID()}@${messageDomain}>`;
  const sentAt = new Date();
  const senderName = options.senderName?.trim() ?? "";
  const fromField = senderName
    ? { name: senderName, address: fromAddress }
    : fromAddress;

  const htmlContent = wrapEmailHtml(convertPlainTextToHtml(options.body), {
    senderName: options.senderName,
    senderLogoUrl: options.senderLogoUrl,
    fromEmail: fromAddress,
  });

  const headers = {
    "Auto-Submitted": "auto-replied",
    Precedence: "bulk",
    "X-Auto-Response-Suppress": "All",
  } satisfies Record<string, string>;

  await options.transporter.sendMail({
    from: fromField,
    to: options.to,
    subject: options.subject,
    text: options.body,
    html: htmlContent,
    messageId,
    date: sentAt,
    headers,
    envelope: {
      from: fromAddress,
      to: options.to,
    },
  });

  const composer = new MailComposer({
    from: fromField,
    to: options.to,
    subject: options.subject,
    text: options.body,
    html: htmlContent,
    messageId,
    date: sentAt,
    headers,
  });

  const rawMessage = await composer.compile().build();

  try {
    await appendMessageToSentMailbox({
      imap: options.imap,
      rawMessage: Buffer.isBuffer(rawMessage)
        ? rawMessage
        : Buffer.from(rawMessage),
      messageId,
      sentAt,
      userId: options.userId,
    });
  } catch (error) {
    console.warn(
      "Impossible d'enregistrer la réponse automatique dans 'Envoyés':",
      error,
    );
  }
}

export async function sendEmailMessage(
  params: ComposeEmailInput,
): Promise<SentMailboxAppendResult> {
  const userId = await resolveUserId();
  return sendEmailMessageForUser(userId, params);
}

export async function sendEmailMessageForUser(
  userId: string,
  params: ComposeEmailInput,
): Promise<SentMailboxAppendResult> {
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.smtp) {
    throw new Error(
      "Le serveur SMTP n'est pas configuré. Veuillez compléter les paramètres avant d'envoyer un message.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: credentials.smtp.host,
    port: credentials.smtp.port,
    secure: credentials.smtp.secure,
    auth: {
      user: credentials.smtp.user,
      pass: credentials.smtp.password,
    },
  });

  const fromAddress = credentials.smtp.fromEmail ?? credentials.smtp.user;
  const messageDomain = fromAddress.includes("@")
    ? fromAddress.split("@").pop() ?? "local"
    : "local";
  const messageId = `<${randomUUID()}@${messageDomain}>`;
  const senderName = credentials.senderName?.trim() ?? "";
  const fromField = senderName
    ? { name: senderName, address: fromAddress }
    : fromAddress;

  const baseHtml = wrapEmailHtml(params.html, {
    senderName: credentials.senderName,
    senderLogoUrl: credentials.senderLogoUrl,
    fromEmail: fromAddress,
  });

  const sentAt = new Date();

  const recipientInputs: RecipientInput[] = [
    ...parseRecipientList(params.to, "to"),
    ...parseRecipientList(params.cc, "cc"),
    ...parseRecipientList(params.bcc, "bcc"),
  ];

  if (!recipientInputs.length) {
    throw new Error("Aucun destinataire valide n'a été fourni.");
  }

  const trackingEnabled = credentials.trackingEnabled !== false;

  const preparedTracking = await prepareEmailTracking({
    userId,
    messageId,
    subject: params.subject,
    sentAt,
    html: baseHtml,
    recipients: recipientInputs,
    trackingEnabled,
  });

  const baseMailOptions: nodemailer.SendMailOptions = {
    from: fromField,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: baseHtml,
    messageId,
    date: sentAt,
  };

  if (params.cc?.length) {
    baseMailOptions.cc = params.cc;
  }
  if (params.bcc?.length) {
    baseMailOptions.bcc = params.bcc;
  }
  if (params.attachments?.length) {
    baseMailOptions.attachments = params.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    }));
  }

  const envelopeFrom =
    typeof fromField === "string" ? fromField : fromField.address;
  if (!envelopeFrom) {
    throw new Error("Adresse d'expéditeur invalide.");
  }

  try {
    for (const recipientPayload of preparedTracking.recipients) {
      await transporter.sendMail({
        ...baseMailOptions,
        html: recipientPayload.html,
        envelope: {
          from: envelopeFrom,
          to: recipientPayload.address,
        },
      });
    }
  } catch (error) {
    throw formatError("Échec de l'envoi du message", error);
  }

  const primaryHtml =
    preparedTracking.recipients[0]?.html ?? baseHtml;

  const composer = new MailComposer({
    ...baseMailOptions,
    html: primaryHtml,
    keepBcc: true,
  });

  const rawMessage = await composer.compile().build();

  try {
    return await appendMessageToSentMailbox({
      imap: credentials.imap,
      rawMessage: Buffer.isBuffer(rawMessage)
        ? rawMessage
        : Buffer.from(rawMessage),
      messageId,
      sentAt,
      userId,
    });
  } catch (error) {
    console.warn("Impossible d'enregistrer le message dans 'Envoyés':", error);
    return {
      message: null,
      totalMessages: null,
    };
  }
}

export async function updateSpamFilterPreference(enabled: boolean): Promise<void> {
  const userId = await resolveUserId();
  const existing = await prisma.messagingSettings.findUnique({
    where: { userId },
  });

  if (existing) {
    await prisma.messagingSettings.update({
      where: { userId },
      data: { spamFilterEnabled: enabled },
    });
  } else {
    await prisma.messagingSettings.create({
      data: {
        userId,
        spamFilterEnabled: enabled,
      },
    });
  }
}

export async function updateEmailTrackingPreference(enabled: boolean): Promise<void> {
  const userId = await resolveUserId();
  const existing = await prisma.messagingSettings.findUnique({
    where: { userId },
  });

  if (existing) {
    await prisma.messagingSettings.update({
      where: { userId },
      data: { trackingEnabled: enabled },
    });
  } else {
    await prisma.messagingSettings.create({
      data: {
        userId,
        trackingEnabled: enabled,
      },
    });
  }
}

export async function testImapConnection(
  config: ImapConnectionConfig,
): Promise<void> {
  await withImapClient(
    {
      host: ensureNonEmpty(config.host, "Serveur IMAP"),
      port: ensurePort(config.port, "IMAP"),
      secure: config.secure,
      user: ensureNonEmpty(config.user, "Identifiant IMAP"),
      password: ensureNonEmpty(config.password, "Mot de passe IMAP"),
    },
    async (client) => {
      try {
        const opened = await openMailbox(client, "inbox", true);

        try {
          // L'ouverture suffit pour vérifier la connexion IMAP
        } finally {
          await client.mailboxClose().catch(() => undefined);
          opened.release();
        }
      } catch (error) {
        throw formatError("Échec du test IMAP", error);
      }
    },
  );
}

export async function testSmtpConnection(
  config: SmtpConnectionConfig,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: ensureNonEmpty(config.host, "Serveur SMTP"),
    port: ensurePort(config.port, "SMTP"),
    secure: config.secure,
    auth: {
      user: ensureNonEmpty(config.user, "Identifiant SMTP"),
      pass: ensureNonEmpty(config.password, "Mot de passe SMTP"),
    },
  });

  try {
    await transporter.verify();
  } catch (error) {
    throw formatError("Échec du test SMTP", error);
  }
}
