import {
  ImapFlow,
  type MessageStructureObject,
  type MessageAddressObject,
  type MailboxObject,
} from "imapflow";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { simpleParser, type Attachment } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/server/secure-credentials";
import { analyzeAndHandleSpam } from "@/server/spam-detection";

const SETTINGS_ID = 1;
const DEFAULT_PAGE_SIZE = 20;

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
};

export type Mailbox = "inbox" | "sent" | "drafts" | "trash" | "spam";

export type MailboxListItem = {
  uid: number;
  subject: string;
  from: string | null;
  to: string[];
  date: string;
  seen: boolean;
  hasAttachments: boolean;
};

export type MessageParticipant = {
  name: string | null;
  address: string | null;
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
    from?: Array<Pick<MessageAddressObject, "name" | "mailbox" | "host">>;
    to?: Array<Pick<MessageAddressObject, "name" | "mailbox" | "host">>;
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
    formatAddress(envelope?.from?.[0]) ?? "Expéditeur inconnu";
  const to = formatAddressList(envelope?.to) ?? [];
  return {
    uid: message.uid,
    subject: envelope?.subject ?? "(Sans objet)",
    from,
    to,
    date: (message.internalDate ?? new Date()).toISOString(),
    seen: message.flags?.has("\\Seen") ?? false,
    hasAttachments: hasAttachments(message.bodyStructure),
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

function mailboxNameVariants(entry: MailboxObject): string[] {
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

async function listMailboxes(client: ImapFlow): Promise<MailboxObject[]> {
  const seen = new Map<string, MailboxObject>();
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
    </div>
  </body>
</html>`;
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
      try {
        lock = await client.getMailboxLock(variant);
        const info = await client.mailboxOpen(variant, { readOnly });
        mailboxNameCache.set(mailbox, info.path ?? name);
        return {
          name: info.path ?? name,
          info,
          release: () => lock.release(),
        };
      } catch (error) {
        if (lock) {
          lock.release();
          lock = null;
        }
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

      const mailboxItem =
        fetched && typeof fetched === "object"
          ? createMailboxListItem(
              fetched as unknown as Parameters<
                typeof createMailboxListItem
              >[0],
            )
          : null;

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

async function getMessagingCredentials(): Promise<MessagingCredentials> {
  const settings = await prisma.messagingSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    return {
      fromEmail: null,
      imap: null,
      smtp: null,
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
  };
}

export async function updateMessagingSenderIdentity(
  input: MessagingIdentityInput,
): Promise<void> {
  const normalizedName = (input.senderName ?? "").trim();
  const normalizedLogo = toOptionalString(input.senderLogoUrl ?? null);

  const existing = await prisma.messagingSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const data = {
    senderName: normalizedName,
    senderLogoUrl: normalizedLogo,
  };

  if (existing) {
    await prisma.messagingSettings.update({
      where: { id: SETTINGS_ID },
      data,
    });
  } else {
    await prisma.messagingSettings.create({
      data: {
        id: SETTINGS_ID,
        ...data,
      },
    });
  }
}

export async function updateMessagingConnections(
  input: MessagingConnectionsInput,
): Promise<void> {
  const existing = await prisma.messagingSettings.findUnique({
    where: { id: SETTINGS_ID },
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
      where: { id: SETTINGS_ID },
      data: connectionData,
    });
  } else {
    await prisma.messagingSettings.create({
      data: {
        id: SETTINGS_ID,
        senderName: "",
        senderLogoUrl: null,
        ...connectionData,
      },
    });
  }
}

export async function fetchMailboxMessages(params: {
  mailbox: Mailbox;
  page?: number;
  pageSize?: number;
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

      if (params.mailbox === "inbox" && items.length) {
        for (const entry of [...items]) {
          try {
            const analysis = await analyzeAndHandleSpam({
              client,
              mailbox: params.mailbox,
              uid: entry.uid,
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

      return {
        mailbox: params.mailbox,
        page,
        pageSize,
        totalMessages: adjustedTotal,
        hasMore: startSeq > 1,
        messages: filteredItems,
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
  const credentials = await getMessagingCredentials();
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

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

      if (params.mailbox === "inbox" && items.length) {
        for (const entry of [...items]) {
          try {
            const analysis = await analyzeAndHandleSpam({
              client,
              mailbox: params.mailbox,
              uid: entry.uid,
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

      return {
        totalMessages: adjustedTotal,
        messages: filteredItems,
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
  const credentials = await getMessagingCredentials();
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

      if (!message?.source || !message.envelope) {
        throw new Error("Message introuvable.");
      }

      const parsed = await simpleParser(message.source);

      const parsedFrom = parsed.from?.value ?? [];
      const parsedTo = parsed.to?.value ?? [];
      const parsedCc = parsed.cc?.value ?? [];
      const parsedBcc = parsed.bcc?.value ?? [];
      const parsedReplyTo = parsed.replyTo?.value ?? [];

      const fromParticipants = mergeParticipants(
        message.envelope.from,
        parsedFrom,
      );
      const replyToParticipants = mergeParticipants(
        message.envelope.replyTo,
        parsedReplyTo,
      );
      const toParticipants = mergeParticipants(
        message.envelope.to,
        parsedTo,
      );
      const ccParticipants = mergeParticipants(
        message.envelope.cc,
        parsedCc,
      );
      const bccParticipants = mergeParticipants(
        message.envelope.bcc,
        parsedBcc,
      );

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

      const attachmentDescriptors = buildAttachmentDescriptors(
        params.mailbox,
        params.uid,
        parsed.attachments,
      );

      return {
        mailbox: params.mailbox,
        uid: params.uid,
        subject: message.envelope.subject ?? "(Sans objet)",
        from: formatAddress(message.envelope.from?.[0]),
        to: formatAddressList(message.envelope.to),
        cc: formatAddressList(message.envelope.cc),
        bcc: formatAddressList(message.envelope.bcc),
        replyTo: formatAddressList(message.envelope.replyTo),
        date: (message.internalDate ?? new Date()).toISOString(),
        seen: message.flags?.has("\\Seen") ?? false,
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
  const credentials = await getMessagingCredentials();
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

      if (!message?.source) {
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

  const credentials = await getMessagingCredentials();
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

export async function sendEmailMessage(
  params: ComposeEmailInput,
): Promise<SentMailboxAppendResult> {
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
  const messageDomain = fromAddress.includes("@")
    ? fromAddress.split("@").pop() ?? "local"
    : "local";
  const messageId = `<${randomUUID()}@${messageDomain}>`;
  const senderName = credentials.senderName?.trim() ?? "";
  const fromField = senderName
    ? { name: senderName, address: fromAddress }
    : fromAddress;

  const html = wrapEmailHtml(params.html, {
    senderName: credentials.senderName,
    senderLogoUrl: credentials.senderLogoUrl,
    fromEmail: fromAddress,
  });

  const sentAt = new Date();

  const mailOptions: nodemailer.SendMailOptions = {
    from: fromField,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html,
    messageId,
    date: sentAt,
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

  const composer = new MailComposer({
    ...mailOptions,
    keepBcc: true,
  });

  const rawMessage = await composer.compile().build();

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw formatError("Échec de l'envoi du message", error);
  }

  try {
    return await appendMessageToSentMailbox({
      imap: credentials.imap,
      rawMessage: Buffer.isBuffer(rawMessage)
        ? rawMessage
        : Buffer.from(rawMessage),
      messageId,
      sentAt,
    });
  } catch (error) {
    console.warn("Impossible d'enregistrer le message dans 'Envoyés':", error);
    return {
      message: null,
      totalMessages: null,
    };
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
