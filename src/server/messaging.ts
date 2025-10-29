import {
  ImapFlow,
  type MessageStructureObject,
  type MessageAddressObject,
} from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/server/secure-credentials";
import { generateInvoicePdf, generateQuotePdf } from "@/server/pdf";
import {
  MessagingEmailDirection,
  MessagingEmailStatus,
  MessagingMailbox,
} from "@prisma/client";

const SETTINGS_ID = 1;
const DEFAULT_PAGE_SIZE = 20;

const MAILBOX_ENUM_MAP: Record<Mailbox, MessagingMailbox> = {
  inbox: MessagingMailbox.INBOX,
  sent: MessagingMailbox.SENT,
};

const QUICK_REPLY_LIMIT = 10;
const RESPONSE_TEMPLATE_LIMIT = 10;

type ClientDirectoryEntry = {
  id: string;
  displayName: string;
  email: string | null;
};

export type MessagingClient = ClientDirectoryEntry;

function normalizeText(value: string): string {
  return value?.toString().trim() ?? "";
}

function sanitizeQuickReply(
  reply: Partial<MessagingQuickReply>,
  fallbackTitle: string,
): MessagingQuickReply {
  return {
    id: reply.id && reply.id.trim().length > 0 ? reply.id : randomUUID(),
    title: normalizeText(reply.title ?? fallbackTitle) || fallbackTitle,
    body: normalizeText(reply.body ?? ""),
  };
}

function sanitizeResponseTemplate(
  template: Partial<MessagingResponseTemplate>,
  fallbackTitle: string,
): MessagingResponseTemplate {
  return {
    id:
      template.id && template.id.trim().length > 0
        ? template.id
        : randomUUID(),
    title: normalizeText(template.title ?? fallbackTitle) || fallbackTitle,
    subject: normalizeText(template.subject ?? ""),
    body: normalizeText(template.body ?? ""),
  };
}

function parseJsonArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (error) {
      console.error("Impossible d'analyser la valeur JSON", error);
      return [];
    }
  }
  return [];
}

export type MessagingQuickReply = {
  id: string;
  title: string;
  body: string;
};

export type MessagingResponseTemplate = {
  id: string;
  title: string;
  subject: string;
  body: string;
};

export type MessagingSettingsInput = {
  fromEmail: string;
  senderName: string;
  senderLogoUrl: string;
  signature: string;
  signatureHtml: string;
  quickReplies: MessagingQuickReply[];
  responseTemplates: MessagingResponseTemplate[];
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
};

export type MessagingSettingsSummary = {
  fromEmail: string;
  senderName: string;
  senderLogoUrl: string | null;
  signature: string;
  signatureHtml: string | null;
  quickReplies: MessagingQuickReply[];
  responseTemplates: MessagingResponseTemplate[];
  imapHost: string;
  imapPort: number | null;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapConfigured: boolean;
  smtpConfigured: boolean;
};

export type Mailbox = "inbox" | "sent";

export type MailboxListItem = {
  uid: number;
  subject: string;
  from: string | null;
  to: string[];
  date: string;
  seen: boolean;
  hasAttachments: boolean;
  messageId: string | null;
  status: MessagingEmailStatus | null;
  logId: string | null;
  client:
    | {
        id: string;
        displayName: string;
        email: string | null;
      }
    | null;
};

export type MailboxPageResult = {
  mailbox: Mailbox;
  page: number;
  pageSize: number;
  totalMessages: number;
  hasMore: boolean;
  messages: MailboxListItem[];
};

export type MessageDetailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type MessageDetail = {
  mailbox: Mailbox;
  uid: number;
  subject: string;
  messageId: string | null;
  from: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  date: string;
  seen: boolean;
  html: string | null;
  text: string | null;
  attachments: MessageDetailAttachment[];
  status: MessagingEmailStatus | null;
  logId: string | null;
  client:
    | {
        id: string;
        displayName: string;
        email: string | null;
      }
    | null;
};

export type MessagingAttachableDocument = {
  id: string;
  type: "invoice" | "quote";
  number: string;
  clientName: string;
  issueDate: string;
  totalCents: number;
  currency: string;
};

export type MessagingDocumentCollections = {
  invoices: MessagingAttachableDocument[];
  quotes: MessagingAttachableDocument[];
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
  signatureText: string | null;
  signatureHtml: string | null;
  imap: ImapConnectionConfig | null;
  smtp: SmtpConnectionConfig | null;
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
    "Envoyés",
    "[Gmail]/Sent Mail",
    "INBOX.Sent",
  ],
};

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
    signatureHtml: string | null;
    signatureText: string | null;
  },
): string {
  const { senderName, senderLogoUrl, fromEmail, signatureHtml, signatureText } =
    options;
  const displayName = senderName?.trim() ?? "";
  const email = fromEmail ?? "";

  const logoHtml = senderLogoUrl
    ? `<img src="${escapeHtml(senderLogoUrl)}" alt="Logo expéditeur" style="height:40px;width:auto;border-radius:6px;" />`
    : "";

  const headerContent =
    displayName || email
      ? `<div style="display:flex;flex-direction:column;">
          ${
            displayName
              ? `<span style="font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(displayName)}</span>`
              : ""
          }
          ${
            email
              ? `<span style="font-size:12px;color:#475569;">${escapeHtml(email)}</span>`
              : ""
          }
        </div>`
      : "";

  const headerHtml =
    logoHtml || headerContent
      ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          ${logoHtml}
          ${headerContent}
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light dark" />
    <title>Message</title>
  </head>
  <body style="margin:0;padding:32px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:white;padding:32px;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
      ${headerHtml}
      <div style="font-size:15px;line-height:1.6;color:#0f172a;">
        ${contentHtml}
      </div>
      ${
        signatureHtml
          ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">${signatureHtml}</div>`
          : signatureText
              ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;white-space:pre-line;color:#475569;">${escapeHtml(signatureText)}</div>`
              : ""
      }
    </div>
  </body>
</html>`;
}

function extractEmailAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/<([^>]+)>/);
  const address = match ? match[1] : trimmed;
  const normalized = address.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

async function buildClientDirectory(): Promise<{
  entries: ClientDirectoryEntry[];
  map: Map<string, ClientDirectoryEntry>;
}> {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });

  const map = new Map<string, ClientDirectoryEntry>();
  for (const client of clients) {
    const email = client.email?.trim().toLowerCase();
    if (!email) continue;
    map.set(email, client);
  }

  return { entries: clients, map };
}

async function fetchEmailLogsForMessages(
  mailbox: Mailbox,
  uids: number[],
): Promise<Map<number, { status: MessagingEmailStatus; logId: string }>> {
  if (!uids.length) {
    return new Map();
  }

  const entries = await prisma.messagingEmailLog.findMany({
    where: {
      mailbox: MAILBOX_ENUM_MAP[mailbox],
      uid: { in: uids },
    },
    select: {
      uid: true,
      status: true,
      id: true,
    },
  });

  const map = new Map<number, { status: MessagingEmailStatus; logId: string }>();
  for (const entry of entries) {
    if (typeof entry.uid === "number") {
      map.set(entry.uid, { status: entry.status, logId: entry.id });
    }
  }
  return map;
}

async function upsertLogForMessage(
  mailbox: Mailbox,
  params: {
    uid?: number | null;
    messageId?: string | null;
    subject: string;
    direction: MessagingEmailDirection;
    participants: Record<string, unknown>;
    status: MessagingEmailStatus;
    error?: string | null;
    clientId?: string | null;
    sentAt?: Date | null;
    readAt?: Date | null;
  },
): Promise<{ id: string; status: MessagingEmailStatus }> {
  const mailboxEnum = MAILBOX_ENUM_MAP[mailbox];

  const lookupConditions = [] as {
    messageId?: string | null;
    mailbox?: MessagingMailbox;
    uid?: number | null;
  }[];

  if (params.messageId) {
    lookupConditions.push({ messageId: params.messageId });
  }
  if (typeof params.uid === "number") {
    lookupConditions.push({ mailbox: mailboxEnum, uid: params.uid });
  }

  let existing: Awaited<
    ReturnType<typeof prisma.messagingEmailLog.findFirst>
  > | null = null;

  for (const condition of lookupConditions) {
    if (!condition.messageId && typeof condition.uid !== "number") {
      continue;
    }
    existing = await prisma.messagingEmailLog.findFirst({
      where: condition,
    });
    if (existing) break;
  }

  const resolvedStatus = existing
    ? existing.status === MessagingEmailStatus.ECHEC
      ? existing.status
      : params.status
    : params.status;

  const data = {
    mailbox: mailboxEnum,
    uid: params.uid ?? existing?.uid ?? null,
    messageId: params.messageId ?? existing?.messageId ?? null,
    subject: params.subject,
    direction: params.direction,
    participants: params.participants,
    status: resolvedStatus,
    error: params.error ?? existing?.error ?? null,
    sentAt: params.sentAt ?? existing?.sentAt ?? null,
    readAt: params.readAt ?? existing?.readAt ?? null,
    clientId: params.clientId ?? existing?.clientId ?? null,
  };

  if (existing) {
    const updated = await prisma.messagingEmailLog.update({
      where: { id: existing.id },
      data,
    });
    return { id: updated.id, status: updated.status };
  }

  const created = await prisma.messagingEmailLog.create({
    data,
  });
  return { id: created.id, status: created.status };
}

function findClientForParticipants(
  directory: Map<string, ClientDirectoryEntry>,
  participants: string[],
): ClientDirectoryEntry | null {
  for (const participant of participants) {
    const email = extractEmailAddress(participant);
    if (!email) continue;
    const client = directory.get(email);
    if (client) return client;
  }
  return null;
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

function formatAddress(
  entry?: Pick<MessageAddressObject, "name" | "mailbox" | "host"> | null,
): string | null {
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

function formatAddressList(
  list?: Array<Pick<MessageAddressObject, "name" | "mailbox" | "host">>,
): string[] {
  if (!list?.length) {
    return [];
  }
  return list
    .map((entry) => formatAddress(entry))
    .filter((value): value is string => Boolean(value));
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
): Promise<MailboxOpenResult | null> {
  const candidates = MAILBOX_CANDIDATES[mailbox];
  for (const name of candidates) {
    const lock = await client.getMailboxLock(name);
    try {
      const info = await client.mailboxOpen(name, { readOnly });
      return {
        name,
        info,
        release: () => lock.release(),
      };
    } catch (error) {
      lock.release();
      if (mailbox === "sent" && isAuthError(error)) {
        throw error;
      }
    }
  }
  return null;
}

async function getMessagingCredentials(): Promise<MessagingCredentials> {
  const settings = await prisma.messagingSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    return {
      fromEmail: null,
      imap: null,
      smtp: null,
      senderName: null,
      senderLogoUrl: null,
      signatureText: null,
      signatureHtml: null,
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
    signatureText: settings.signature ?? null,
    signatureHtml: settings.signatureHtml ?? null,
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

export async function getMessagingSettingsSummary(): Promise<MessagingSettingsSummary> {
  const settings = await prisma.messagingSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    return {
      fromEmail: "",
      senderName: "",
      senderLogoUrl: null,
      signature: "",
      signatureHtml: null,
      quickReplies: [],
      responseTemplates: [],
      imapHost: "",
      imapPort: null,
      imapSecure: true,
      smtpHost: "",
      smtpPort: null,
      smtpSecure: true,
      imapConfigured: false,
      smtpConfigured: false,
    };
  }

  const quickReplies = parseJsonArray<MessagingQuickReply>(
    settings.quickReplies,
  )
    .slice(0, QUICK_REPLY_LIMIT)
    .map((reply, index) => sanitizeQuickReply(reply, `Réponse ${index + 1}`));

  const responseTemplates = parseJsonArray<MessagingResponseTemplate>(
    settings.responseTemplates,
  )
    .slice(0, RESPONSE_TEMPLATE_LIMIT)
    .map((template, index) =>
      sanitizeResponseTemplate(template, `Modèle ${index + 1}`),
    );

  return {
    fromEmail: settings.fromEmail ?? "",
    senderName: settings.senderName ?? "",
    senderLogoUrl: settings.senderLogoUrl ?? null,
    signature: settings.signature ?? "",
    signatureHtml: settings.signatureHtml ?? null,
    quickReplies,
    responseTemplates,
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
  };
}

export async function saveMessagingSettings(
  input: MessagingSettingsInput,
): Promise<void> {
  const {
    fromEmail,
    senderName,
    senderLogoUrl,
    signature,
    signatureHtml,
    quickReplies,
    responseTemplates,
    imapHost,
    imapPort,
    imapSecure,
    imapUser,
    imapPassword,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPassword,
  } = input;

  const sanitizedFromEmail = ensureNonEmpty(fromEmail, "Adresse e-mail");
  const sanitizedImapHost = ensureNonEmpty(imapHost, "Serveur IMAP");
  const sanitizedImapUser = ensureNonEmpty(imapUser, "Identifiant IMAP");
  const sanitizedImapPassword = ensureNonEmpty(
    imapPassword,
    "Mot de passe IMAP",
  );
  const sanitizedSmtpHost = ensureNonEmpty(smtpHost, "Serveur SMTP");
  const sanitizedSmtpUser = ensureNonEmpty(smtpUser, "Identifiant SMTP");
  const sanitizedSmtpPassword = ensureNonEmpty(
    smtpPassword,
    "Mot de passe SMTP",
  );
  const validatedImapPort = ensurePort(imapPort, "IMAP");
  const validatedSmtpPort = ensurePort(smtpPort, "SMTP");
  const normalizedSenderName = senderName.trim();
  const normalizedSenderLogoUrl = toOptionalString(senderLogoUrl);
  const normalizedSignature = signature.trim();
  const normalizedSignatureHtml = signatureHtml.trim();

  const normalizedQuickReplies = quickReplies
    .slice(0, QUICK_REPLY_LIMIT)
    .map((reply, index) => sanitizeQuickReply(reply, `Réponse ${index + 1}`));

  const normalizedResponseTemplates = responseTemplates
    .slice(0, RESPONSE_TEMPLATE_LIMIT)
    .map((template, index) =>
      sanitizeResponseTemplate(template, `Modèle ${index + 1}`),
    );

  await prisma.messagingSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      fromEmail: sanitizedFromEmail,
      senderName: normalizedSenderName,
      senderLogoUrl: normalizedSenderLogoUrl,
      signature: normalizedSignature,
      signatureHtml:
        normalizedSignatureHtml.length > 0
          ? normalizedSignatureHtml
          : null,
      quickReplies: normalizedQuickReplies,
      responseTemplates: normalizedResponseTemplates,
      imapHost: sanitizedImapHost,
      imapPort: validatedImapPort,
      imapSecure,
      imapUser: encryptSecret(sanitizedImapUser),
      imapPassword: encryptSecret(sanitizedImapPassword),
      smtpHost: sanitizedSmtpHost,
      smtpPort: validatedSmtpPort,
      smtpSecure,
      smtpUser: encryptSecret(sanitizedSmtpUser),
      smtpPassword: encryptSecret(sanitizedSmtpPassword),
    },
    create: {
      id: SETTINGS_ID,
      fromEmail: sanitizedFromEmail,
      senderName: normalizedSenderName,
      senderLogoUrl: normalizedSenderLogoUrl,
      signature: normalizedSignature,
      signatureHtml:
        normalizedSignatureHtml.length > 0
          ? normalizedSignatureHtml
          : null,
      quickReplies: normalizedQuickReplies,
      responseTemplates: normalizedResponseTemplates,
      imapHost: sanitizedImapHost,
      imapPort: validatedImapPort,
      imapSecure,
      imapUser: encryptSecret(sanitizedImapUser),
      imapPassword: encryptSecret(sanitizedImapPassword),
      smtpHost: sanitizedSmtpHost,
      smtpPort: validatedSmtpPort,
      smtpSecure,
      smtpUser: encryptSecret(sanitizedSmtpUser),
      smtpPassword: encryptSecret(sanitizedSmtpPassword),
    },
  });
}

export async function fetchMailboxMessages(params: {
  mailbox: Mailbox;
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: {
    unreadOnly?: boolean;
    hasAttachments?: boolean;
    clientId?: string;
  };
}): Promise<MailboxPageResult> {
  const credentials = await getMessagingCredentials();
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);
    if (!opened) {
      return {
        mailbox: params.mailbox,
        page,
        pageSize,
        totalMessages: 0,
        hasMore: false,
        messages: [],
      };
    }

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
        const envelope = message.envelope;
        const from =
          formatAddress(envelope?.from?.[0]) ?? "Expéditeur inconnu";
        const to = formatAddressList(envelope?.to) ?? [];
        items.push({
          uid: message.uid,
          subject: envelope?.subject ?? "(Sans objet)",
          from,
          to,
          date: (message.internalDate ?? new Date()).toISOString(),
          seen: message.flags?.has("\\Seen") ?? false,
          hasAttachments: hasAttachments(message.bodyStructure),
          messageId: envelope?.messageId ?? null,
          status: null,
          logId: null,
          client: null,
        });
      }

      items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      const logMap = await fetchEmailLogsForMessages(
        params.mailbox,
        items.map((item) => item.uid),
      );
      const { map: clientDirectory } = await buildClientDirectory();

      for (const item of items) {
        const logEntry = logMap.get(item.uid);
        if (logEntry) {
          item.status = logEntry.status;
          item.logId = logEntry.logId;
        }
        const participants = [
          ...(item.from ? [item.from] : []),
          ...item.to,
        ];
        const clientMatch = findClientForParticipants(
          clientDirectory,
          participants,
        );
        item.client = clientMatch
          ? {
              id: clientMatch.id,
              displayName: clientMatch.displayName,
              email: clientMatch.email,
            }
          : null;
      }

      let filtered = items;

      const searchTerm = params.search?.trim().toLowerCase() ?? "";
      if (searchTerm.length > 0) {
        filtered = filtered.filter((item) => {
          const text = [
            item.subject,
            item.from ?? "",
            item.to.join(" "),
            item.client?.displayName ?? "",
            item.client?.email ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return text.includes(searchTerm);
        });
      }

      if (params.filters?.unreadOnly) {
        filtered = filtered.filter((item) => !item.seen);
      }

      if (params.filters?.hasAttachments) {
        filtered = filtered.filter((item) => item.hasAttachments);
      }

      if (params.filters?.clientId) {
        filtered = filtered.filter(
          (item) => item.client?.id === params.filters?.clientId,
        );
      }

      return {
        mailbox: params.mailbox,
        page,
        pageSize,
        totalMessages,
        hasMore: startSeq > 1 || filtered.length < items.length,
        messages: filtered,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function listAttachableDocuments(): Promise<MessagingDocumentCollections> {
  const [invoices, quotes] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      take: 15,
      select: {
        id: true,
        number: true,
        issueDate: true,
        totalTTCCents: true,
        currency: true,
        client: {
          select: { displayName: true },
        },
      },
    }),
    prisma.quote.findMany({
      orderBy: { issueDate: "desc" },
      take: 15,
      select: {
        id: true,
        number: true,
        issueDate: true,
        totalTTCCents: true,
        currency: true,
        client: {
          select: { displayName: true },
        },
      },
    }),
  ]);

  return {
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      type: "invoice",
      number: invoice.number ?? invoice.id,
      clientName: invoice.client?.displayName ?? "Client inconnu",
      issueDate: invoice.issueDate.toISOString(),
      totalCents: invoice.totalTTCCents,
      currency: invoice.currency,
    })),
    quotes: quotes.map((quote) => ({
      id: quote.id,
      type: "quote",
      number: quote.number ?? quote.id,
      clientName: quote.client?.displayName ?? "Client inconnu",
      issueDate: quote.issueDate.toISOString(),
      totalCents: quote.totalTTCCents,
      currency: quote.currency,
    })),
  };
}

export async function buildDocumentAttachments(params: {
  invoiceIds?: string[];
  quoteIds?: string[];
}): Promise<EmailAttachment[]> {
  const attachments: EmailAttachment[] = [];
  const invoiceIds = Array.from(new Set(params.invoiceIds ?? []));
  const quoteIds = Array.from(new Set(params.quoteIds ?? []));

  if (invoiceIds.length) {
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true, number: true },
    });
    for (const invoice of invoices) {
      const buffer = await generateInvoicePdf(invoice.id);
      attachments.push({
        filename: `facture-${invoice.number ?? invoice.id}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      });
    }
  }

  if (quoteIds.length) {
    const quotes = await prisma.quote.findMany({
      where: { id: { in: quoteIds } },
      select: { id: true, number: true },
    });
    for (const quote of quotes) {
      const buffer = await generateQuotePdf(quote.id);
      attachments.push({
        filename: `devis-${quote.number ?? quote.id}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      });
    }
  }

  return attachments;
}

export async function listMessagingClients(): Promise<MessagingClient[]> {
  const { entries } = await buildClientDirectory();
  return entries.filter((entry) => Boolean(entry.email));
}

export async function fetchMessageDetail(params: {
  mailbox: Mailbox;
  uid: number;
}): Promise<MessageDetail> {
  const credentials = await getMessagingCredentials();
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);
    if (!opened) {
      throw new Error("Boîte aux lettres introuvable.");
    }

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

      if (!message?.source || !message.envelope) {
        throw new Error("Message introuvable.");
      }

      const parsed = await simpleParser(message.source);
      const messageDate = message.internalDate ?? new Date();
      const from = formatAddress(message.envelope.from?.[0]);
      const to = formatAddressList(message.envelope.to);
      const cc = formatAddressList(message.envelope.cc);
      const bcc = formatAddressList(message.envelope.bcc);
      const messageId = parsed.messageId ?? message.envelope.messageId ?? null;

      const sanitizedHtml = parsed.html
        ? sanitizeHtml(parsed.html, {
            allowedTags: [
              ...sanitizeHtml.defaults.allowedTags,
              "img",
              "table",
              "thead",
              "tbody",
              "tr",
              "td",
              "th",
              "span",
            ],
            allowedAttributes: {
              ...sanitizeHtml.defaults.allowedAttributes,
              a: ["href", "name", "target", "rel"],
              img: ["src", "alt", "title", "width", "height"],
              td: ["colspan", "rowspan"],
              th: ["colspan", "rowspan"],
            },
            allowedSchemes: ["http", "https", "mailto", "data"],
            transformTags: {
              a: sanitizeHtml.simpleTransform(
                "a",
                { target: "_blank", rel: "noopener noreferrer" },
                true,
              ),
            },
          })
        : null;

      if (!message.flags?.has("\\Seen")) {
        await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
      }

      const { map: clientDirectory } = await buildClientDirectory();
      const participants = [
        ...(from ? [from] : []),
        ...to,
        ...cc,
        ...bcc,
      ];
      const clientMatch = findClientForParticipants(
        clientDirectory,
        participants,
      );

      const direction =
        params.mailbox === "sent"
          ? MessagingEmailDirection.SORTANT
          : MessagingEmailDirection.ENTRANT;

      const logResult = await upsertLogForMessage(params.mailbox, {
        uid: params.uid,
        messageId,
        subject: message.envelope.subject ?? "(Sans objet)",
        direction,
        participants: {
          from,
          to,
          cc,
          bcc,
        },
        status:
          direction === MessagingEmailDirection.SORTANT
            ? MessagingEmailStatus.ENVOYE
            : MessagingEmailStatus.LECTURE,
        clientId: clientMatch?.id ?? null,
        sentAt:
          direction === MessagingEmailDirection.SORTANT
            ? messageDate
            : undefined,
        readAt:
          direction === MessagingEmailDirection.ENTRANT
            ? new Date()
            : undefined,
      });

      return {
        mailbox: params.mailbox,
        uid: params.uid,
        subject: message.envelope.subject ?? "(Sans objet)",
        messageId,
        from,
        to,
        cc,
        bcc,
        date: messageDate.toISOString(),
        seen: true,
        html: sanitizedHtml,
        text: parsed.text ?? parsed.textAsHtml ?? null,
        attachments: parsed.attachments.map((attachment, index) => ({
          id:
            attachment.checksum ??
            `${params.mailbox}-${params.uid}-${index}`,
          filename:
            attachment.filename ?? `pièce-jointe-${index + 1}.bin`,
          contentType:
            attachment.contentType ?? "application/octet-stream",
          size: attachment.size ?? 0,
        })),
        status: logResult.status,
        logId: logResult.id,
        client: clientMatch
          ? {
              id: clientMatch.id,
              displayName: clientMatch.displayName,
              email: clientMatch.email,
            }
          : null,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function sendEmailMessage(
  params: ComposeEmailInput,
): Promise<void> {
  const credentials = await getMessagingCredentials();
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
  const senderName = credentials.senderName?.trim() ?? "";
  const fromField = senderName
    ? { name: senderName, address: fromAddress }
    : fromAddress;

  const fromDisplay =
    typeof fromField === "string"
      ? fromField
      : fromField.name
        ? `${fromField.name} <${fromField.address}>`
        : fromField.address;

  const html = wrapEmailHtml(params.html, {
    senderName: credentials.senderName,
    senderLogoUrl: credentials.senderLogoUrl,
    fromEmail: fromAddress,
    signatureHtml: credentials.signatureHtml,
    signatureText: credentials.signatureText,
  });

  const signaturePlainText = credentials.signatureText?.trim();
  const textContent =
    signaturePlainText && signaturePlainText.length > 0
      ? `${params.text}\n\n${signaturePlainText}`
      : params.text;

  const mailOptions: nodemailer.SendMailOptions = {
    from: fromField,
    to: params.to,
    subject: params.subject,
    text: textContent,
    html,
  };

  if (params.cc?.length) {
    mailOptions.cc = params.cc;
  }
  if (params.bcc?.length) {
    mailOptions.bcc = params.bcc;
  }
  if (params.attachments?.length) {
    mailOptions.attachments = params.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    }));
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    const { map: clientDirectory } = await buildClientDirectory();
    const participants = [
      fromDisplay,
      ...params.to,
      ...(params.cc ?? []),
      ...(params.bcc ?? []),
    ].filter((value): value is string => Boolean(value));
    const clientMatch = findClientForParticipants(clientDirectory, participants);
    await upsertLogForMessage("sent", {
      uid: undefined,
      messageId: info.messageId ?? undefined,
      subject: params.subject,
      direction: MessagingEmailDirection.SORTANT,
      participants: {
        from: fromDisplay,
        to: params.to,
        cc: params.cc ?? [],
        bcc: params.bcc ?? [],
      },
      status: MessagingEmailStatus.ENVOYE,
      clientId: clientMatch?.id ?? null,
      sentAt: new Date(),
    });
  } catch (error) {
    await upsertLogForMessage("sent", {
      subject: params.subject,
      direction: MessagingEmailDirection.SORTANT,
      participants: {
        from: fromDisplay,
        to: params.to,
        cc: params.cc ?? [],
        bcc: params.bcc ?? [],
      },
      status: MessagingEmailStatus.ECHEC,
      error: error instanceof Error ? error.message : String(error ?? ""),
    });
    throw formatError("Échec de l'envoi du message", error);
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
        if (!opened) {
          throw new Error("Boîte de réception introuvable.");
        }

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
