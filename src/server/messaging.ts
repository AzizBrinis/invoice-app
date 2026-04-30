import type {
  ImapFlow,
  MessageStructureObject,
  MessageAddressObject,
  MessageEnvelopeObject,
  ListResponse,
  FetchMessageObject,
} from "imapflow";
import { Readable } from "node:stream";
import { cache } from "react";
import { headers } from "next/headers";
import nodemailer, { type Transporter } from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import addressParser from "nodemailer/lib/addressparser";
import { simpleParser, type Attachment, type ParsedMail } from "mailparser";
import { createHash, randomUUID } from "node:crypto";
import type {
  MessagingAutoReplyType,
  MessagingRecipientType,
  MessagingInboxSyncState,
} from "@/lib/db/prisma";
import { Prisma } from "@/lib/db/prisma-server";
import { prisma } from "@/lib/db";
import { getSessionTokenFromCookie, requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/server/secure-credentials";
import { analyzeAndHandleSpam } from "@/server/spam-detection";
import { sanitizeEmailHtml } from "@/lib/email-html";
import { enqueueJob } from "@/server/background-jobs";
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
import {
  buildMailboxSearchFieldQueries,
  isMailboxSearchQueryUsable,
  normalizeMailboxSearchQuery,
  type SearchableMailbox,
  tokenizeMailboxSearchQuery,
} from "@/lib/messaging/mailbox-search";

type ImapFlowConstructor = typeof import("imapflow").ImapFlow;

let imapFlowConstructor: ImapFlowConstructor | null = null;

async function getImapFlowConstructor(): Promise<ImapFlowConstructor> {
  if (!imapFlowConstructor) {
    const mod = await import("imapflow");
    imapFlowConstructor = mod.ImapFlow;
  }
  return imapFlowConstructor;
}

const DEFAULT_PAGE_SIZE = 20;
const RECIPIENT_TYPE_MAP = {
  to: "TO",
  cc: "CC",
  bcc: "BCC",
} as const satisfies Record<"to" | "cc" | "bcc", MessagingRecipientType>;
const AUTO_REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const AUTO_REPLY_BOOTSTRAP_LOOKBACK = 150;
const AUTO_REPLY_FETCH_LIMIT = 200;
const AUTO_FORWARD_BOOTSTRAP_LOOKBACK = 150;
const AUTO_FORWARD_FETCH_LIMIT = 200;
const AUTO_FORWARD_MAX_RECIPIENTS = 25;
const AUTO_FORWARD_MAX_ATTEMPTS = 5;
const AUTO_FORWARD_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const AUTO_FORWARD_STALE_SENDING_MS = 30 * 60 * 1000;
const AUTO_FORWARD_JOB_PRIORITY = 70;
const SPAM_ANALYSIS_CONCURRENCY = 4;
const AUTO_REPLY_METADATA_CONCURRENCY = 4;
const DEFAULT_SMTP_CONNECTION_TIMEOUT_MS = 15_000;
const DEFAULT_SMTP_GREETING_TIMEOUT_MS = 10_000;
const DEFAULT_SMTP_SOCKET_TIMEOUT_MS = 60_000;
const DEFAULT_IMAP_CONNECTION_TIMEOUT_MS = 15_000;
const DEFAULT_IMAP_GREETING_TIMEOUT_MS = 10_000;
const DEFAULT_IMAP_SOCKET_TIMEOUT_MS = 120_000;

type AutoReplyProcessMode = "process" | "skip";

type AutoReplyProcessResult = {
  scanned: number;
  considered: number;
  replied: number;
  lastSeenUid: number;
  bootstrapped: boolean;
};

export const AUTO_FORWARD_INBOX_MESSAGE_JOB_TYPE =
  "messaging.autoForwardInboxMessage";

export type AutoForwardInboxMessageJobPayload = {
  userId: string;
  mailbox: "inbox";
  uidValidity: number;
  uid: number;
};

export type AutoForwardProcessResult = {
  scanned: number;
  considered: number;
  queued: number;
  deduped: number;
  failed: number;
  lastSeenUid: number;
  bootstrapped: boolean;
};

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getSmtpTransportTimeouts() {
  return {
    connectionTimeout: readPositiveIntegerEnv(
      "SMTP_CONNECTION_TIMEOUT_MS",
      DEFAULT_SMTP_CONNECTION_TIMEOUT_MS,
    ),
    greetingTimeout: readPositiveIntegerEnv(
      "SMTP_GREETING_TIMEOUT_MS",
      DEFAULT_SMTP_GREETING_TIMEOUT_MS,
    ),
    socketTimeout: readPositiveIntegerEnv(
      "SMTP_SOCKET_TIMEOUT_MS",
      DEFAULT_SMTP_SOCKET_TIMEOUT_MS,
    ),
  };
}

function getImapClientTimeouts() {
  return {
    connectionTimeout: readPositiveIntegerEnv(
      "IMAP_CONNECTION_TIMEOUT_MS",
      DEFAULT_IMAP_CONNECTION_TIMEOUT_MS,
    ),
    greetingTimeout: readPositiveIntegerEnv(
      "IMAP_GREETING_TIMEOUT_MS",
      DEFAULT_IMAP_GREETING_TIMEOUT_MS,
    ),
    socketTimeout: readPositiveIntegerEnv(
      "IMAP_SOCKET_TIMEOUT_MS",
      DEFAULT_IMAP_SOCKET_TIMEOUT_MS,
    ),
  };
}

function createSmtpTransport(config: SmtpConnectionConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    ...getSmtpTransportTimeouts(),
  });
}

async function runConcurrentBatches<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  if (!items.length) {
    return;
  }
  const chunkSize = Math.max(1, limit);
  for (let index = 0; index < items.length; index += chunkSize) {
    const batch = items.slice(index, index + chunkSize);
    const settled = await Promise.allSettled(
      batch.map((item) => worker(item)),
    );
    settled.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("Tâche de traitement concurrente échouée:", result.reason);
      }
    });
  }
}

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

function normalizeForwardingEmailAddress(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new Error("Adresse de transfert vide.");
  }
  if (trimmed.length > 254) {
    throw new Error(`Adresse de transfert trop longue: ${trimmed}`);
  }
  const parsed = addressParser(trimmed, { flatten: true });
  if (parsed.length !== 1 || !parsed[0]?.address) {
    throw new Error(`Adresse de transfert invalide: ${trimmed}`);
  }
  const address = parsed[0].address.trim().toLowerCase();
  if (
    address !== trimmed.toLowerCase() ||
    !/^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]+$/.test(address)
  ) {
    throw new Error(`Adresse de transfert invalide: ${trimmed}`);
  }
  return address;
}

export function normalizeForwardingEmailAddresses(
  values: readonly string[],
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed.length) {
      continue;
    }
    const address = normalizeForwardingEmailAddress(trimmed);
    if (seen.has(address)) {
      continue;
    }
    seen.add(address);
    normalized.push(address);
  }
  if (normalized.length > AUTO_FORWARD_MAX_RECIPIENTS) {
    throw new Error(
      `Le transfert automatique accepte ${AUTO_FORWARD_MAX_RECIPIENTS} destinataires maximum.`,
    );
  }
  return normalized;
}

function readForwardingEmailAddresses(value: unknown): string[] {
  try {
    if (Array.isArray(value)) {
      return normalizeForwardingEmailAddresses(
        value.filter((entry): entry is string => typeof entry === "string"),
      );
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return readForwardingEmailAddresses(parsed);
        }
      } catch {
        return normalizeForwardingEmailAddresses(
          value.split(/[\n,;]+/).map((entry) => entry.trim()),
        );
      }
    }
  } catch (error) {
    console.warn("Destinataires de transfert automatique ignorés:", error);
  }
  return [];
}

export async function resolveUserId(provided?: string) {
  if (provided) {
    return provided;
  }
  const user = await requireUser();
  return user.activeTenantId ?? user.tenantId ?? user.id;
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

export type MessagingAutoForwardSettingsInput = {
  autoForwardEnabled: boolean;
  autoForwardRecipients: string[];
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
  autoForwardEnabled: boolean;
  autoForwardRecipients: string[];
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

export const MAILBOX_DISPLAY_NAMES: Record<Mailbox, string> = {
  inbox: "Boîte de réception",
  sent: "Messages envoyés",
  drafts: "Brouillons",
  trash: "Corbeille",
  spam: "Indésirables",
};

export function getMailboxDisplayName(mailbox: Mailbox): string {
  return MAILBOX_DISPLAY_NAMES[mailbox] ?? mailbox;
}

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

export type MailboxEmailSummary = {
  mailbox: Mailbox;
  uid: number;
  subject: string;
  from: string | null;
  to: string[];
  cc: string[];
  date: string;
  seen: boolean;
  hasAttachments: boolean;
  textPreview: string | null;
};

export type MailboxEmailSummaryResult = {
  mailbox: Mailbox;
  totalMessages: number;
  limit: number;
  emails: MailboxEmailSummary[];
  errors?: Array<{ uid: number; message: string }>;
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

type AutoForwardConfig = {
  enabled: boolean;
  recipients: string[];
};

export type MessageParticipant = {
  name: string | null;
  address: string | null;
};

function formatParticipantLabel(
  participant?: MessageParticipant | null,
): string | null {
  if (!participant) {
    return null;
  }
  const name = participant.name?.trim() ?? "";
  const address = participant.address?.trim() ?? "";
  if (name && address) {
    return `${name} <${address}>`;
  }
  if (address) {
    return address;
  }
  if (name) {
    return name;
  }
  return null;
}

function formatParticipantList(
  participants: MessageParticipant[],
): string[] {
  return participants
    .map((participant) => formatParticipantLabel(participant))
    .filter((value): value is string => Boolean(value));
}

export type PrefetchedRawMessage = {
  uid: number;
  envelope: MessageEnvelopeObject | null;
  source: Buffer | Uint8Array | string;
  internalDate: Date | string | null;
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

export type MailboxSearchResult = {
  mailbox: SearchableMailbox;
  query: string;
  page: number;
  pageSize: number;
  totalMessages: number;
  hasMore: boolean;
  messages: MailboxListItem[];
};

function buildUidSequence(uids: number[]): string {
  if (!uids.length) {
    return "";
  }
  const sorted = Array.from(new Set(uids)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = start;
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}:${prev}`);
    start = current;
    prev = current;
  }
  ranges.push(start === prev ? `${start}` : `${start}:${prev}`);
  return ranges.join(",");
}

export async function fetchRawMessages(
  client: ImapFlow,
  uids: number[],
): Promise<Map<number, PrefetchedRawMessage>> {
  const map = new Map<number, PrefetchedRawMessage>();
  const query = buildUidSequence(uids);
  if (!query.length) {
    return map;
  }
  for await (const message of client.fetch(
    { uid: query },
    {
      source: true,
      envelope: true,
      internalDate: true,
    },
  )) {
    const fetched = message as FetchMessageObject & {
      source?: Buffer | Uint8Array | string;
      envelope?: MessageEnvelopeObject;
    };
    if (
      !fetched ||
      !fetched.source ||
      typeof message.uid !== "number" ||
      Number.isNaN(message.uid)
    ) {
      continue;
    }
    const uid = message.uid;
    map.set(uid, {
      uid,
      envelope: fetched.envelope ?? null,
      source: fetched.source,
      internalDate: fetched.internalDate ?? null,
    });
  }
  return map;
}

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
  remotePath?: string | null;
  uidValidity?: number | null;
};

export type MovedMailboxMessageResult = {
  sourceMailbox: Mailbox;
  targetMailbox: Mailbox;
  sourceUid: number;
  targetUid: number | null;
  sourcePath: string | null;
  targetPath: string | null;
  sourceUidValidity: number | null;
  targetUidValidity: number | null;
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

type SpamFilterResult = {
  remaining: MailboxListItem[];
  autoMoved: AutoMovedSummary[];
  newlyMovedCount: number;
};

async function filterSpamCandidates(options: {
  userId: string;
  mailbox: Mailbox;
  items: MailboxListItem[];
  client: ImapFlow;
  spamFilteringEnabled: boolean;
  prefetchedMessages?: Map<number, PrefetchedRawMessage> | null;
}): Promise<SpamFilterResult> {
  if (
    options.mailbox !== "inbox" ||
    !options.spamFilteringEnabled ||
    options.items.length === 0
  ) {
    return {
      remaining: options.items,
      autoMoved: [],
      newlyMovedCount: 0,
    };
  }

  const uids = Array.from(
    new Set(
      options.items
        .map((item) => item.uid)
        .filter((uid): uid is number => typeof uid === "number" && uid > 0),
    ),
  );
  const alreadyLogged = new Set<number>();
  if (uids.length) {
    const logs = await prisma.spamDetectionLog.findMany({
      where: {
        userId: options.userId,
        mailbox: options.mailbox,
        uid: { in: uids },
        manual: false,
      },
      select: { uid: true },
    });
    logs.forEach((entry) => alreadyLogged.add(entry.uid));
  }

  const candidates = options.items.filter(
    (item) => !alreadyLogged.has(item.uid),
  );

  if (!candidates.length) {
    return {
      remaining: options.items,
      autoMoved: [],
      newlyMovedCount: 0,
    };
  }

  const removedUids = new Set<number>();
  const autoMoved: AutoMovedSummary[] = [];
  let newlyMovedCount = 0;

  await runConcurrentBatches(
    candidates,
    SPAM_ANALYSIS_CONCURRENCY,
    async (entry) => {
      const analysis = await analyzeAndHandleSpam({
        userId: options.userId,
        client: options.client,
        mailbox: options.mailbox,
        uid: entry.uid,
        spamFilteringEnabled: options.spamFilteringEnabled,
        prefetched: options.prefetchedMessages?.get(entry.uid),
      });
      if (analysis.movedToSpam) {
        removedUids.add(entry.uid);
        newlyMovedCount += 1;
        if (!analysis.alreadyLogged) {
          autoMoved.push({
            uid: entry.uid,
            subject: entry.subject,
            from: entry.from,
            score: analysis.score,
            target: "spam",
          });
        }
      }
    },
  );

  const remaining = options.items.filter(
    (item) => !removedUids.has(item.uid),
  );

  return {
    remaining,
    autoMoved,
    newlyMovedCount,
  };
}

export type MessageDetailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type ParsedMailboxAttachmentMetadata = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  contentLocation: string | null;
  inline: boolean;
};

type AttachmentDescriptor = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  raw: Attachment;
};

const DEFAULT_ATTACHMENT_MIME = "application/octet-stream";

function normalizeAttachmentContentType(
  value: string | null | undefined,
): string {
  if (!value) {
    return DEFAULT_ATTACHMENT_MIME;
  }
  const [base] = value.split(";");
  const normalized = base?.trim().toLowerCase();
  return normalized?.length ? normalized : DEFAULT_ATTACHMENT_MIME;
}

function detectAttachmentMimeType(content: Buffer): string | null {
  if (content.length >= 8) {
    const pngSignature = [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ];
    const isPng = pngSignature.every(
      (value, index) => content[index] === value,
    );
    if (isPng) {
      return "image/png";
    }
  }
  if (content.length >= 3) {
    const isJpeg =
      content[0] === 0xff &&
      content[1] === 0xd8 &&
      content[2] === 0xff;
    if (isJpeg) {
      return "image/jpeg";
    }
  }
  if (content.length >= 6) {
    const header = content.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }
  if (content.length >= 12) {
    const riff = content.subarray(0, 4).toString("ascii");
    const webp = content.subarray(8, 12).toString("ascii");
    if (riff === "RIFF" && webp === "WEBP") {
      return "image/webp";
    }
  }
  return null;
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as AsyncIterable<T>)[Symbol.asyncIterator] === "function"
  );
}

function isIterable<T>(value: unknown): value is Iterable<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Iterable<T>)[Symbol.iterator] === "function"
  );
}

function normalizeAttachmentChunk(chunk: unknown): Buffer {
  if (!chunk && chunk !== 0) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }
  if (ArrayBuffer.isView(chunk)) {
    const view = chunk as ArrayBufferView;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }
  if (chunk instanceof ArrayBuffer) {
    return Buffer.from(chunk);
  }
  if (typeof chunk === "string") {
    return Buffer.from(chunk, "utf-8");
  }
  throw new Error("Type de segment de pièce jointe invalide.");
}

function isReadableStream(value: unknown): value is Readable {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof Readable) {
    return true;
  }
  const candidate = value as Readable;
  return (
    typeof candidate.pipe === "function" &&
    typeof candidate.read === "function" &&
    typeof candidate.on === "function"
  );
}

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

export type ParsedMailboxMessageContent = {
  messageId: string | null;
  subject: string;
  from: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  date: string;
  sentAt: string | null;
  seen: boolean;
  answered: boolean;
  flagged: boolean;
  draft: boolean;
  html: string | null;
  text: string | null;
  previewText: string | null;
  attachments: ParsedMailboxAttachmentMetadata[];
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

export type MessagingCredentials = {
  fromEmail: string | null;
  senderName: string | null;
  senderLogoUrl: string | null;
  imap: ImapConnectionConfig | null;
  smtp: SmtpConnectionConfig | null;
  spamFilterEnabled: boolean;
  trackingEnabled: boolean;
  autoForward: AutoForwardConfig;
  autoReply: StandardAutoReplyConfig;
  vacation: VacationAutoReplyConfig;
};

const getMessagingSettingsRecord = cache(async (userId: string) => {
  return prisma.messagingSettings.findUnique({
    where: { userId },
  });
});

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

function isAutoReplyFeatureEnabled(
  credentials: MessagingCredentials,
  referenceDate: Date = new Date(),
): boolean {
  if (!credentials.smtp) {
    return false;
  }
  if (credentials.autoReply.enabled) {
    return true;
  }
  return isVacationModeActive(credentials.vacation, referenceDate);
}

function isAutoForwardFeatureEnabled(
  credentials: MessagingCredentials,
): boolean {
  return Boolean(
    credentials.smtp &&
      credentials.autoForward.enabled &&
      credentials.autoForward.recipients.length > 0,
  );
}

const MAILBOX_SPECIAL_USE: Partial<Record<Mailbox, string>> = {
  inbox: "\\Inbox",
  sent: "\\Sent",
  drafts: "\\Drafts",
  trash: "\\Trash",
  spam: "\\Junk",
};

const mailboxNameCache = new Map<string, string>();

export function getMailboxCacheKey(
  config: Pick<ImapConnectionConfig, "host" | "port" | "secure" | "user">,
  mailbox: Mailbox,
) {
  return [
    "v2",
    config.host.trim().toLowerCase(),
    config.port,
    config.secure ? "secure" : "plain",
    config.user.trim().toLowerCase(),
    mailbox,
  ].join("::");
}

function buildStaticMailboxCandidates(mailbox: Mailbox): string[] {
  if (mailbox === "inbox") {
    return ["INBOX"];
  }
  return MAILBOX_CANDIDATES[mailbox] ?? [];
}

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
  options?: {
    cacheKey?: string;
    discover?: boolean;
  },
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

  const cached = options?.cacheKey
    ? mailboxNameCache.get(options.cacheKey)
    : null;
  if (cached) {
    recordCandidate(cached, -10);
  }

  for (const candidate of buildStaticMailboxCandidates(mailbox)) {
    recordCandidate(candidate, mailbox === "inbox" ? 0 : 20);
  }

  if (options?.discover) {
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

function normalizeImapCounterValue(
  value: number | bigint | null | undefined,
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? Math.trunc(asNumber) : null;
  }
  return null;
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
    const filename = attachment.filename?.trim()?.length
      ? attachment.filename.trim()
      : `pièce-jointe-${index + 1}.bin`;
    const contentType = normalizeAttachmentContentType(
      attachment.contentType,
    );
    const size =
      typeof attachment.size === "number" && Number.isFinite(attachment.size)
        ? attachment.size
        : Buffer.isBuffer(attachment.content)
          ? attachment.content.length
          : attachment.content instanceof Uint8Array
            ? attachment.content.byteLength
            : attachment.content instanceof ArrayBuffer
              ? attachment.content.byteLength
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

  if (content instanceof Uint8Array) {
    return Buffer.from(content);
  }

  if (content instanceof ArrayBuffer) {
    return Buffer.from(content);
  }

  if (typeof content === "string") {
    return Buffer.from(content, "utf-8");
  }

  if (isReadableStream(content)) {
    const chunks: Buffer[] = [];
    for await (const chunk of content) {
      chunks.push(normalizeAttachmentChunk(chunk as Buffer | Uint8Array | string));
    }
    return Buffer.concat(chunks);
  }

  if (isAsyncIterable<Buffer | Uint8Array | string>(content)) {
    const chunks: Buffer[] = [];
    for await (const chunk of content) {
      chunks.push(normalizeAttachmentChunk(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (isIterable<Buffer | Uint8Array | string>(content)) {
    const chunks: Buffer[] = [];
    for (const chunk of content) {
      chunks.push(normalizeAttachmentChunk(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error("Flux de pièce jointe invalide.");
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

function isExpectedMailboxLookupFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const mailboxMissing = (error as { mailboxMissing?: unknown }).mailboxMissing;
  if (mailboxMissing === true) {
    return true;
  }

  const responseStatus = (error as { responseStatus?: unknown }).responseStatus;
  if (typeof responseStatus === "string" && responseStatus.toUpperCase() === "NO") {
    return true;
  }

  const code = (error as { serverResponseCode?: unknown }).serverResponseCode;
  if (typeof code === "string" && code.toUpperCase() === "CANNOT") {
    return true;
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /mailbox doesn't exist|invalid mailbox name/i.test(message);
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

export async function withImapClient<T>(
  config: ImapConnectionConfig,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const ImapFlowCtor = await getImapFlowConstructor();
  const client = new ImapFlowCtor({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    ...getImapClientTimeouts(),
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

export async function openMailbox(
  client: ImapFlow,
  mailbox: Mailbox,
  readOnly: boolean,
  options?: {
    cacheKey?: string;
  },
): Promise<MailboxOpenResult> {
  const attempted = new Set<string>();

  const tryOpenCandidates = async (candidates: string[]) => {
    for (const name of candidates) {
      if (attempted.has(name)) {
        continue;
      }
      attempted.add(name);

      let lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null = null;
      const releaseLock = () => {
        if (lock) {
          lock.release();
          lock = null;
        }
      };
      try {
        lock = await client.getMailboxLock(name, { readOnly });
        const info = client.mailbox;
        if (!info) {
          throw new Error("Boîte aux lettres IMAP non ouverte.");
        }
        const resolvedName = info.path ?? lock.path ?? name;
        if (options?.cacheKey) {
          mailboxNameCache.set(options.cacheKey, resolvedName);
        }
        return {
          name: resolvedName,
          info,
          release: releaseLock,
        } satisfies MailboxOpenResult;
      } catch (error) {
        releaseLock();
        if (
          options?.cacheKey &&
          mailboxNameCache.get(options.cacheKey) === name
        ) {
          mailboxNameCache.delete(options.cacheKey);
        }
        if (isConnectionError(error)) {
          throw formatError("Connexion IMAP indisponible", error);
        }
        if (!isExpectedMailboxLookupFailure(error)) {
          console.warn(
            `Impossible d'ouvrir la boîte "${name}" (${mailbox}):`,
            error,
          );
        }
        if (mailbox === "sent" && isAuthError(error)) {
          throw error;
        }
      }
    }
    return null;
  };

  const hasCachedPath = Boolean(
    options?.cacheKey && mailboxNameCache.has(options.cacheKey),
  );

  if (mailbox === "inbox") {
    const inboxCandidates = await getMailboxPathCandidates(client, mailbox, {
      cacheKey: options?.cacheKey,
      discover: false,
    });
    const inboxMatch = await tryOpenCandidates(inboxCandidates);
    if (inboxMatch) {
      return inboxMatch;
    }
  } else {
    if (hasCachedPath) {
      const cachedCandidates = await getMailboxPathCandidates(client, mailbox, {
        cacheKey: options?.cacheKey,
        discover: false,
      });
      const cachedMatch = await tryOpenCandidates(cachedCandidates);
      if (cachedMatch) {
        return cachedMatch;
      }
    }

    const discoveredCandidates = await getMailboxPathCandidates(client, mailbox, {
      cacheKey: options?.cacheKey,
      discover: true,
    });
    const discoveredMatch = await tryOpenCandidates(discoveredCandidates);
    if (discoveredMatch) {
      return discoveredMatch;
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
      opened = await openMailbox(client, "sent", false, {
        cacheKey: getMailboxCacheKey(params.imap!, "sent"),
      });
    } catch (error) {
      console.warn(
        "Impossible d'enregistrer le message dans le dossier 'Envoyés':",
        error,
      );
      return {
        message: null,
        totalMessages: null,
        remotePath: null,
        uidValidity: null,
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
        remotePath: opened.name,
        uidValidity: normalizeImapCounterValue(opened.info.uidValidity),
      };
    } finally {
      opened.release();
    }
  });
}

export async function getMessagingCredentials(
  providedUserId?: string,
): Promise<MessagingCredentials> {
  const userId = await resolveUserId(providedUserId);
  const settings = await getMessagingSettingsRecord(userId);

  if (!settings) {
    return {
      fromEmail: null,
      senderName: null,
      senderLogoUrl: null,
      imap: null,
      smtp: null,
      spamFilterEnabled: true,
      trackingEnabled: true,
      autoForward: {
        enabled: false,
        recipients: [],
      },
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
  const forwardingSettings = settings as typeof settings & {
    autoForwardEnabled?: boolean | null;
    autoForwardRecipients?: unknown;
  };
  const autoForwardRecipients = readForwardingEmailAddresses(
    forwardingSettings.autoForwardRecipients,
  );

  return {
    fromEmail: settings.fromEmail,
    senderName: settings.senderName ?? null,
    senderLogoUrl: settings.senderLogoUrl ?? null,
    spamFilterEnabled: settings.spamFilterEnabled ?? true,
    trackingEnabled: settings.trackingEnabled ?? true,
    autoForward: {
      enabled:
        (forwardingSettings.autoForwardEnabled ?? false) &&
        autoForwardRecipients.length > 0,
      recipients: autoForwardRecipients,
    },
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
  const settings = await getMessagingSettingsRecord(resolvedUserId);

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
      autoForwardEnabled: false,
      autoForwardRecipients: [],
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

  const forwardingSettings = settings as typeof settings & {
    autoForwardEnabled?: boolean | null;
    autoForwardRecipients?: unknown;
  };
  const autoForwardRecipients = readForwardingEmailAddresses(
    forwardingSettings.autoForwardRecipients,
  );

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
    autoForwardEnabled: forwardingSettings.autoForwardEnabled ?? false,
    autoForwardRecipients,
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

export async function updateMessagingAutoForwardSettings(
  input: MessagingAutoForwardSettingsInput,
): Promise<void> {
  const userId = await resolveUserId();
  const recipients = normalizeForwardingEmailAddresses(
    input.autoForwardRecipients,
  );
  if (input.autoForwardEnabled && recipients.length === 0) {
    throw new Error(
      "Ajoutez au moins une adresse e-mail pour activer le transfert automatique.",
    );
  }
  let activationCursor: number | null = null;
  if (input.autoForwardEnabled) {
    const credentials = await getMessagingCredentials(userId);
    if (!credentials.imap) {
      throw new Error(
        "Configurez IMAP avant d'activer le transfert automatique.",
      );
    }
    if (!credentials.smtp) {
      throw new Error(
        "Configurez SMTP avant d'activer le transfert automatique.",
      );
    }
    activationCursor = await readCurrentInboxHighestUid(credentials);
  }

  const existing = await prisma.messagingSettings.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!existing) {
    await prisma.messagingSettings.create({
      data: { userId },
    });
  }

  if (activationCursor !== null) {
    await persistInboxAutoForwardState({
      userId,
      highestUid: activationCursor,
    });
  }

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public."MessagingSettings"
      SET
        "autoForwardEnabled" = ${input.autoForwardEnabled},
        "autoForwardRecipients" = to_jsonb(${recipients}::text[]),
        "updatedAt" = NOW()
      WHERE "userId" = ${userId}
    `,
  );
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
  prefetched?: PrefetchedRawMessage | null,
): Promise<IncomingMessageMetadata | null> {
  const fetched =
    prefetched && prefetched.source
      ? {
          envelope: prefetched.envelope,
          source: prefetched.source,
        }
      : await client.fetchOne(
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
  prefetchedMessages?: Map<number, PrefetchedRawMessage> | null;
  options?: {
    bootstrapMode?: AutoReplyProcessMode;
    existingState?: MessagingInboxSyncState | null;
  };
}): Promise<AutoReplyProcessResult> {
  const { userId, client, credentials, messages, prefetchedMessages } = params;
  const bootstrapMode = params.options?.bootstrapMode ?? "process";
  const providedState = params.options?.existingState ?? null;
  const syncState =
    providedState ??
    (await prisma.messagingInboxSyncState.findUnique({
      where: { userId },
    }));
  const lastSeenUid = syncState?.lastInboxAutoReplyUid ?? 0;
  const selection = selectAutoReplyCandidates(messages, lastSeenUid, bootstrapMode);
  const summary: AutoReplyProcessResult = {
    scanned: messages.length,
    considered: selection.candidates.length,
    replied: 0,
    lastSeenUid: selection.highestUid,
    bootstrapped: selection.bootstrapped,
  };

  const smtp = credentials.smtp;
  if (!smtp) {
    await persistInboxSyncState({
      userId,
      highestUid: selection.highestUid,
      hadReply: false,
      previousState: syncState ?? null,
    });
    if (selection.candidates.length) {
      console.warn(
        "Réponses automatiques ignorées car SMTP est incomplet pour l'utilisateur",
        userId,
      );
    }
    return summary;
  }

  if (!selection.candidates.length) {
    await persistInboxSyncState({
      userId,
      highestUid: selection.highestUid,
      hadReply: false,
      previousState: syncState ?? null,
    });
    return summary;
  }

  const now = new Date();
  const vacationActive = isVacationModeActive(credentials.vacation, now);
  const standardEnabled = credentials.autoReply.enabled && !vacationActive;
  if (!vacationActive && !standardEnabled) {
    await persistInboxSyncState({
      userId,
      highestUid: selection.highestUid,
      hadReply: false,
      previousState: syncState ?? null,
    });
    return summary;
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

  await runConcurrentBatches(
    selection.candidates,
    AUTO_REPLY_METADATA_CONCURRENCY,
    async (entry) => {
      const metadata = await loadIncomingMessageMetadata(
        client,
        entry.uid,
        prefetchedMessages?.get(entry.uid),
      );
      if (!metadata) {
        return;
      }
      const targetAddress = metadata.replyToAddress ?? metadata.fromAddress;
      if (!targetAddress) {
        return;
      }
      const normalized = normalizeEmailAddress(targetAddress);
      if (!normalized) {
        return;
      }
      if (ownAddress && normalized === ownAddress) {
        return;
      }
      if (shouldSkipAutoResponse(metadata.parsed, targetAddress)) {
        return;
      }
      metadataEntries.push({
        uid: entry.uid,
        messageId: metadata.messageId,
        subject: metadata.subject,
        targetAddress,
        normalizedAddress: normalized,
        parsed: metadata.parsed,
      });
    },
  );

  if (!metadataEntries.length) {
    await persistInboxSyncState({
      userId,
      highestUid: selection.highestUid,
      hadReply: false,
      previousState: syncState ?? null,
    });
    return summary;
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

  const transporter = createSmtpTransport(smtp);

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
      summary.replied += 1;
    } catch (error) {
      console.warn("Impossible d'envoyer une réponse automatique:", error);
    }
  }

  await persistInboxSyncState({
    userId,
    highestUid: selection.highestUid,
    hadReply: summary.replied > 0,
    previousState: syncState ?? null,
  });

  return summary;
}

function selectAutoReplyCandidates(
  messages: MailboxListItem[],
  lastSeenUid: number,
  mode: AutoReplyProcessMode,
) {
  const highestUid = messages.reduce(
    (max, entry) => Math.max(max, entry.uid, 0),
    lastSeenUid,
  );
  const bootstrapping = lastSeenUid === 0;
  if (bootstrapping && mode === "skip") {
    return {
      candidates: [] as MailboxListItem[],
      highestUid,
      bootstrapped: true,
    };
  }
  const candidates =
    lastSeenUid > 0
      ? messages.filter((entry) => entry.uid > lastSeenUid)
      : messages;
  return {
    candidates,
    highestUid,
    bootstrapped: false,
  };
}

async function persistInboxSyncState(options: {
  userId: string;
  highestUid: number;
  hadReply: boolean;
  previousState: MessagingInboxSyncState | null;
}) {
  const now = new Date();
  const highest = options.highestUid > 0 ? options.highestUid : null;
  const lastAutoReplyAt = options.hadReply
    ? now
    : options.previousState?.lastAutoReplyAt ?? null;
  await prisma.messagingInboxSyncState.upsert({
    where: { userId: options.userId },
    create: {
      userId: options.userId,
      lastInboxAutoReplyUid: highest,
      lastInboxSyncAt: now,
      lastAutoReplyAt,
    },
    update: {
      lastInboxAutoReplyUid: highest,
      lastInboxSyncAt: now,
      lastAutoReplyAt,
    },
  });
}

export async function runAutomatedReplySweepForUser(
  userId: string,
  options?: {
    bootstrapMode?: AutoReplyProcessMode;
    maxBootstrapWindow?: number;
  },
): Promise<AutoReplyProcessResult> {
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    return {
      scanned: 0,
      considered: 0,
      replied: 0,
      lastSeenUid: 0,
      bootstrapped: false,
    } satisfies AutoReplyProcessResult;
  }

  const mailbox: Mailbox = "inbox";
  const spamFilteringEnabled = credentials.spamFilterEnabled !== false;
  const autoReplyFeatureEnabled = isAutoReplyFeatureEnabled(credentials);
  if (!autoReplyFeatureEnabled) {
    return {
      scanned: 0,
      considered: 0,
      replied: 0,
      lastSeenUid: 0,
      bootstrapped: false,
    } satisfies AutoReplyProcessResult;
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, mailbox, true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, mailbox),
    });

    try {
      const syncState = await prisma.messagingInboxSyncState.findUnique({
        where: { userId },
      });
      const lastSeenUid = syncState?.lastInboxAutoReplyUid ?? 0;
      const nextUid = opened.info.uidNext ?? null;
      const startUid = computeAutoReplyStartUid({
        lastSeenUid,
        nextUid,
        maxBootstrapWindow: options?.maxBootstrapWindow ?? AUTO_REPLY_BOOTSTRAP_LOOKBACK,
      });

      let fetchedMessages: MailboxListItem[] = [];
      let prefetchedMessages: Map<number, PrefetchedRawMessage> | null = null;
      const shouldFetch =
        nextUid === null ||
        startUid < (typeof nextUid === "number" ? Math.max(1, nextUid) : 1);

      if (shouldFetch) {
        const range = { uid: `${startUid}:*` };
        for await (const message of client.fetch(range, {
          envelope: true,
          internalDate: true,
          flags: true,
          bodyStructure: true,
        })) {
          fetchedMessages.push(
            createMailboxListItem(
              message as unknown as Parameters<
                typeof createMailboxListItem
              >[0],
            ),
          );
          if (
            lastSeenUid === 0 &&
            AUTO_REPLY_FETCH_LIMIT > 0 &&
            fetchedMessages.length >= AUTO_REPLY_FETCH_LIMIT
          ) {
            break;
          }
        }

        fetchedMessages.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        if (mailbox === "inbox" && fetchedMessages.length) {
          try {
            prefetchedMessages = await fetchRawMessages(
              client,
              fetchedMessages.map((item) => item.uid),
            );
          } catch (error) {
            console.warn("Impossible de précharger les messages IMAP:", error);
          }
        }

        if (mailbox === "inbox" && spamFilteringEnabled && fetchedMessages.length) {
          const filteredMessages: MailboxListItem[] = [];
          for (const entry of fetchedMessages) {
            try {
              const analysis = await analyzeAndHandleSpam({
                userId,
                client,
                mailbox,
                uid: entry.uid,
                spamFilteringEnabled,
                prefetched: prefetchedMessages?.get(entry.uid),
              });
              if (!analysis.movedToSpam) {
                filteredMessages.push(entry);
              }
            } catch (error) {
              console.warn("Analyse de spam impossible:", error);
              filteredMessages.push(entry);
            }
          }
          fetchedMessages = filteredMessages;
        }
      }

      return await processAutoReplies({
        userId,
        client,
        credentials,
        messages: fetchedMessages,
        prefetchedMessages,
        options: {
          bootstrapMode: options?.bootstrapMode ?? "skip",
          existingState: syncState ?? null,
        },
      });
    } finally {
      opened.release();
    }
  });
}

function computeAutoReplyStartUid(options: {
  lastSeenUid: number;
  nextUid: number | null;
  maxBootstrapWindow: number;
}): number {
  if (options.lastSeenUid > 0) {
    return options.lastSeenUid + 1;
  }
  const reference = Math.max(1, (options.nextUid ?? 1) - 1);
  const window = Math.max(1, options.maxBootstrapWindow);
  return Math.max(1, reference - window);
}

type AutoForwardLogClaim = {
  id: string;
  attempts: number;
  sentRecipients: string[];
  targetRecipients: string[];
};

type AutoForwardLogClaimRow = {
  id: string;
  attempts: number | bigint | string;
  sentRecipients: unknown;
  targetRecipients: unknown;
};

type InboxAutoForwardStateRow = {
  lastInboxAutoForwardUid: number | null;
};

function normalizeAutoForwardLogRecipients(value: unknown): string[] {
  return readForwardingEmailAddresses(value);
}

function normalizeRawMessageSource(
  source: Buffer | Uint8Array | string,
): Buffer {
  if (typeof source === "string") {
    return Buffer.from(source);
  }
  return Buffer.isBuffer(source) ? source : Buffer.from(source);
}

function normalizeAttemptCount(value: number | bigint | string): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number.isFinite(value) ? value : 0;
}

function truncateLogError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "Erreur inconnue");
  return message.slice(0, 2000);
}

function computeAutoForwardRetryAt(attempts: number): Date | null {
  if (attempts >= AUTO_FORWARD_MAX_ATTEMPTS) {
    return null;
  }
  const exponent = Math.max(0, attempts - 1);
  const delay = Math.min(
    AUTO_FORWARD_RETRY_BACKOFF_MS * 2 ** exponent,
    60 * 60 * 1000,
  );
  return new Date(Date.now() + delay);
}

function buildAutoForwardDedupeKey(params: {
  userId: string;
  uidValidity: number;
  uid: number;
}) {
  return `${params.userId}:inbox:${params.uidValidity}:${params.uid}`;
}

function stableMessageToken(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function buildAutoForwardMessageId(params: {
  userId: string;
  uidValidity: number;
  uid: number;
  recipient: string;
  fromAddress: string;
}) {
  const domain = params.fromAddress.includes("@")
    ? params.fromAddress.split("@").pop() ?? "local"
    : "local";
  const token = stableMessageToken(
    [
      params.userId,
      params.uidValidity,
      params.uid,
      params.recipient.toLowerCase(),
    ].join(":"),
  );
  return `<autofwd-${token}@${domain}>`;
}

function buildAutoForwardSubject(subject: string): string {
  const normalized = subject.trim() || "(Sans objet)";
  return normalized.toLowerCase().startsWith("fwd:")
    ? normalized
    : `Fwd: ${normalized}`;
}

function formatParsedAddressText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const entries: string[] = value
      .map((entry) => formatParsedAddressText(entry))
      .filter((entry): entry is string => Boolean(entry));
    return entries.length ? entries.join(", ") : null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const text = (value as { text?: string | null }).text?.trim();
  return text && text.length ? text : null;
}

function formatParsedMessageDate(parsed: ParsedMail): string {
  const rawDate = (parsed as ParsedMail & { date?: Date | string | null }).date;
  if (rawDate instanceof Date) {
    return rawDate.toISOString();
  }
  return rawDate ? String(rawDate) : "";
}

function buildForwardedMessageText(metadata: IncomingMessageMetadata): string {
  const parsed = metadata.parsed;
  const originalText =
    parsed.text?.trim() ||
    (parsed.html ? htmlToPlainText(parsed.html).trim() : "") ||
    "(Contenu indisponible)";
  const headerLines = [
    "---------- Message transféré ----------",
    `De: ${formatParsedAddressText(parsed.from) ?? metadata.fromAddress ?? "Inconnu"}`,
    `Date: ${formatParsedMessageDate(parsed)}`,
    `Sujet: ${metadata.subject}`,
    `À: ${formatParsedAddressText(parsed.to) ?? ""}`,
  ];
  const cc = formatParsedAddressText(parsed.cc);
  if (cc) {
    headerLines.push(`Cc: ${cc}`);
  }
  return `${headerLines.join("\n")}\n\n${originalText}`;
}

function buildForwardedMessageHtml(metadata: IncomingMessageMetadata): string {
  const parsed = metadata.parsed;
  const headerRows = [
    ["De", formatParsedAddressText(parsed.from) ?? metadata.fromAddress ?? "Inconnu"],
    ["Date", formatParsedMessageDate(parsed)],
    ["Sujet", metadata.subject],
    ["À", formatParsedAddressText(parsed.to) ?? ""],
    ["Cc", formatParsedAddressText(parsed.cc) ?? ""],
  ].filter(([, value]) => value.trim().length > 0);

  const headerHtml = headerRows
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 4px 0;font-size:13px;line-height:1.5;"><strong>${escapeHtml(
          label,
        )}:</strong> ${escapeHtml(value)}</p>`,
    )
    .join("");

  const bodyHtml = parsed.html
    ? sanitizeEmailHtml(parsed.html)
    : `<pre style="white-space:pre-wrap;margin:0;">${escapeHtml(
        parsed.text ?? "(Contenu indisponible)",
      )}</pre>`;

  return `<div>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;">Message transféré automatiquement depuis Messagerie.</p>
    <div style="margin:0 0 16px 0;padding:12px;border-left:3px solid #cbd5e1;background:#f8fafc;">
      ${headerHtml}
    </div>
    <blockquote style="margin:0;padding:0 0 0 12px;border-left:2px solid #cbd5e1;">
      ${bodyHtml}
    </blockquote>
  </div>`;
}

function hasAutoForwardLoopHeader(parsed: ParsedMail): boolean {
  return parsed.headers.has("x-messagerie-auto-forward");
}

async function readInboxAutoForwardLastUid(
  userId: string,
): Promise<number> {
  const rows = await prisma.$queryRaw<InboxAutoForwardStateRow[]>(
    Prisma.sql`
      SELECT "lastInboxAutoForwardUid"
      FROM public."MessagingInboxSyncState"
      WHERE "userId" = ${userId}
      LIMIT 1
    `,
  );
  const value = rows[0]?.lastInboxAutoForwardUid;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function readCurrentInboxHighestUid(
  credentials: MessagingCredentials,
): Promise<number> {
  const imap = credentials.imap;
  if (!imap) {
    throw new Error("IMAP non configuré pour le transfert automatique.");
  }

  return withImapClient(imap, async (client) => {
    const opened = await openMailbox(client, "inbox", true, {
      cacheKey: getMailboxCacheKey(imap, "inbox"),
    });

    try {
      const uidNext = normalizeImapCounterValue(opened.info.uidNext);
      if (typeof uidNext === "number" && uidNext > 1) {
        return uidNext - 1;
      }

      const exists =
        typeof opened.info.exists === "number" && opened.info.exists > 0
          ? opened.info.exists
          : 0;
      if (exists <= 0) {
        return 0;
      }

      let highestUid = 0;
      for await (const message of client.fetch(`${exists}:${exists}`, {
        uid: true,
      })) {
        if (typeof message.uid === "number" && message.uid > highestUid) {
          highestUid = message.uid;
        }
      }
      return highestUid;
    } finally {
      opened.release();
    }
  });
}

async function persistInboxAutoForwardState(options: {
  userId: string;
  highestUid: number;
}) {
  const highest = options.highestUid > 0 ? options.highestUid : null;
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public."MessagingInboxSyncState" (
        "userId",
        "lastInboxAutoForwardUid",
        "lastInboxSyncAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (${options.userId}, ${highest}, NOW(), NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE
      SET
        "lastInboxAutoForwardUid" = EXCLUDED."lastInboxAutoForwardUid",
        "lastInboxSyncAt" = NOW(),
        "updatedAt" = NOW()
    `,
  );
}

async function claimAutoForwardLog(params: {
  userId: string;
  uidValidity: number;
  uid: number;
  messageId: string | null;
  subject: string | null;
  targetRecipients: string[];
}): Promise<AutoForwardLogClaim | null> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - AUTO_FORWARD_STALE_SENDING_MS);
  const inserted = await prisma.$queryRaw<AutoForwardLogClaimRow[]>(
    Prisma.sql`
      INSERT INTO public."MessagingAutoForwardLog" (
        "id",
        "userId",
        "mailbox",
        "uidValidity",
        "uid",
        "messageId",
        "subject",
        "targetRecipients",
        "status",
        "attempts",
        "lastAttemptAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${params.userId},
        'inbox',
        ${params.uidValidity},
        ${params.uid},
        ${params.messageId},
        ${params.subject},
        to_jsonb(${params.targetRecipients}::text[]),
        'SENDING',
        1,
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT ("userId", "mailbox", "uidValidity", "uid") DO NOTHING
      RETURNING
        "id",
        "attempts",
        "sentRecipients",
        "targetRecipients"
    `,
  );

  const insertedRow = inserted[0];
  if (insertedRow) {
    return {
      id: insertedRow.id,
      attempts: normalizeAttemptCount(insertedRow.attempts),
      sentRecipients: normalizeAutoForwardLogRecipients(insertedRow.sentRecipients),
      targetRecipients: normalizeAutoForwardLogRecipients(insertedRow.targetRecipients),
    };
  }

  const updated = await prisma.$queryRaw<AutoForwardLogClaimRow[]>(
    Prisma.sql`
      UPDATE public."MessagingAutoForwardLog"
      SET
        "status" = 'SENDING',
        "attempts" = "attempts" + 1,
        "lastAttemptAt" = ${now},
        "nextAttemptAt" = NULL,
        "lastError" = NULL,
        "updatedAt" = ${now}
      WHERE
        "userId" = ${params.userId}
        AND "mailbox" = 'inbox'
        AND "uidValidity" = ${params.uidValidity}
        AND "uid" = ${params.uid}
        AND "attempts" < ${AUTO_FORWARD_MAX_ATTEMPTS}
        AND (
          "status" = 'FAILED'
          OR (
            "status" = 'SENDING'
            AND "lastAttemptAt" <= ${staleCutoff}
          )
        )
      RETURNING
        "id",
        "attempts",
        "sentRecipients",
        "targetRecipients"
    `,
  );

  const updatedRow = updated[0];
  if (!updatedRow) {
    return null;
  }
  const targetRecipients = normalizeAutoForwardLogRecipients(
    updatedRow.targetRecipients,
  );
  return {
    id: updatedRow.id,
    attempts: normalizeAttemptCount(updatedRow.attempts),
    sentRecipients: normalizeAutoForwardLogRecipients(updatedRow.sentRecipients),
    targetRecipients: targetRecipients.length
      ? targetRecipients
      : params.targetRecipients,
  };
}

async function updateAutoForwardSentRecipients(
  logId: string,
  recipients: string[],
) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public."MessagingAutoForwardLog"
      SET
        "sentRecipients" = to_jsonb(${recipients}::text[]),
        "updatedAt" = NOW()
      WHERE "id" = ${logId}
    `,
  );
}

async function markAutoForwardLogSent(logId: string, recipients: string[]) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public."MessagingAutoForwardLog"
      SET
        "status" = 'SENT',
        "sentRecipients" = to_jsonb(${recipients}::text[]),
        "sentAt" = NOW(),
        "nextAttemptAt" = NULL,
        "lastError" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${logId}
    `,
  );
}

async function markAutoForwardLogSkipped(logId: string, reason: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public."MessagingAutoForwardLog"
      SET
        "status" = 'SKIPPED',
        "lastError" = ${reason},
        "nextAttemptAt" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${logId}
    `,
  );
}

async function markAutoForwardLogFailed(
  logId: string,
  attempts: number,
  error: unknown,
) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public."MessagingAutoForwardLog"
      SET
        "status" = 'FAILED',
        "lastError" = ${truncateLogError(error)},
        "nextAttemptAt" = ${computeAutoForwardRetryAt(attempts)},
        "updatedAt" = NOW()
      WHERE "id" = ${logId}
    `,
  );
}

async function queueAutoForwardJobsForMessages(params: {
  userId: string;
  credentials: MessagingCredentials;
  uidValidity: number | null;
  messages: MailboxListItem[];
}): Promise<Pick<AutoForwardProcessResult, "queued" | "deduped" | "failed">> {
  const result = {
    queued: 0,
    deduped: 0,
    failed: 0,
  };
  if (!isAutoForwardFeatureEnabled(params.credentials)) {
    return result;
  }
  if (
    typeof params.uidValidity !== "number" ||
    !Number.isInteger(params.uidValidity) ||
    params.uidValidity <= 0
  ) {
    console.warn("[messaging-auto-forward] UIDVALIDITY manquant; transfert ignoré", {
      userId: params.userId,
    });
    result.failed = params.messages.length;
    return result;
  }

  for (const message of params.messages) {
    try {
      const payload = {
        userId: params.userId,
        mailbox: "inbox",
        uidValidity: params.uidValidity,
        uid: message.uid,
      } satisfies AutoForwardInboxMessageJobPayload;
      const queued = await enqueueJob({
        type: AUTO_FORWARD_INBOX_MESSAGE_JOB_TYPE,
        payload,
        dedupeKey: buildAutoForwardDedupeKey(payload),
        priority: AUTO_FORWARD_JOB_PRIORITY,
        maxAttempts: AUTO_FORWARD_MAX_ATTEMPTS,
        retryBackoffMs: AUTO_FORWARD_RETRY_BACKOFF_MS,
      });
      if (queued.deduped) {
        result.deduped += 1;
      } else {
        result.queued += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.warn("[messaging-auto-forward] mise en file impossible", {
        userId: params.userId,
        uid: message.uid,
        error,
      });
    }
  }

  return result;
}

async function processAutoForwardQueueing(params: {
  userId: string;
  credentials: MessagingCredentials;
  messages: MailboxListItem[];
  uidValidity: number | null;
  bootstrapMode?: AutoReplyProcessMode;
}): Promise<AutoForwardProcessResult> {
  const lastSeenUid = await readInboxAutoForwardLastUid(params.userId);
  const selection = selectAutoReplyCandidates(
    params.messages,
    lastSeenUid,
    params.bootstrapMode ?? "process",
  );
  const summary: AutoForwardProcessResult = {
    scanned: params.messages.length,
    considered: selection.candidates.length,
    queued: 0,
    deduped: 0,
    failed: 0,
    lastSeenUid: selection.highestUid,
    bootstrapped: selection.bootstrapped,
  };

  if (!isAutoForwardFeatureEnabled(params.credentials)) {
    return summary;
  }

  if (selection.candidates.length) {
    const queueResult = await queueAutoForwardJobsForMessages({
      userId: params.userId,
      credentials: params.credentials,
      uidValidity: params.uidValidity,
      messages: selection.candidates,
    });
    summary.queued = queueResult.queued;
    summary.deduped = queueResult.deduped;
    summary.failed = queueResult.failed;
  }

  if (summary.failed === 0 || selection.bootstrapped) {
    await persistInboxAutoForwardState({
      userId: params.userId,
      highestUid: selection.highestUid,
    });
  }

  return summary;
}

export async function runAutoForwardSweepForUser(
  userId: string,
  options?: {
    bootstrapMode?: AutoReplyProcessMode;
    maxBootstrapWindow?: number;
  },
): Promise<AutoForwardProcessResult> {
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap || !isAutoForwardFeatureEnabled(credentials)) {
    return {
      scanned: 0,
      considered: 0,
      queued: 0,
      deduped: 0,
      failed: 0,
      lastSeenUid: 0,
      bootstrapped: false,
    };
  }

  const mailbox: Mailbox = "inbox";
  const spamFilteringEnabled = credentials.spamFilterEnabled !== false;
  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, mailbox, true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, mailbox),
    });

    try {
      const lastSeenUid = await readInboxAutoForwardLastUid(userId);
      const nextUid = opened.info.uidNext ?? null;
      const startUid = computeAutoReplyStartUid({
        lastSeenUid,
        nextUid,
        maxBootstrapWindow:
          options?.maxBootstrapWindow ?? AUTO_FORWARD_BOOTSTRAP_LOOKBACK,
      });
      const shouldFetch =
        nextUid === null ||
        startUid < (typeof nextUid === "number" ? Math.max(1, nextUid) : 1);
      let fetchedMessages: MailboxListItem[] = [];
      let prefetchedMessages: Map<number, PrefetchedRawMessage> | null = null;

      if (shouldFetch) {
        for await (const message of client.fetch(
          { uid: `${startUid}:*` },
          {
            envelope: true,
            internalDate: true,
            flags: true,
            bodyStructure: true,
          },
        )) {
          fetchedMessages.push(
            createMailboxListItem(
              message as unknown as Parameters<
                typeof createMailboxListItem
              >[0],
            ),
          );
          if (
            lastSeenUid === 0 &&
            AUTO_FORWARD_FETCH_LIMIT > 0 &&
            fetchedMessages.length >= AUTO_FORWARD_FETCH_LIMIT
          ) {
            break;
          }
        }

        fetchedMessages.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        if (spamFilteringEnabled && fetchedMessages.length) {
          try {
            prefetchedMessages = await fetchRawMessages(
              client,
              fetchedMessages.map((item) => item.uid),
            );
          } catch (error) {
            console.warn("[messaging-auto-forward] préchargement IMAP impossible", {
              userId,
              error,
            });
          }
          const filteredMessages: MailboxListItem[] = [];
          for (const entry of fetchedMessages) {
            try {
              const analysis = await analyzeAndHandleSpam({
                userId,
                client,
                mailbox,
                uid: entry.uid,
                spamFilteringEnabled,
                prefetched: prefetchedMessages?.get(entry.uid),
              });
              if (!analysis.movedToSpam) {
                filteredMessages.push(entry);
              }
            } catch (error) {
              console.warn("[messaging-auto-forward] analyse spam impossible", {
                userId,
                uid: entry.uid,
                error,
              });
              filteredMessages.push(entry);
            }
          }
          fetchedMessages = filteredMessages;
        }
      }

      return processAutoForwardQueueing({
        userId,
        credentials,
        messages: fetchedMessages,
        uidValidity: normalizeImapCounterValue(opened.info.uidValidity),
        bootstrapMode: options?.bootstrapMode ?? "skip",
      });
    } finally {
      opened.release();
    }
  });
}

export async function forwardInboxMessageForUser(
  payload: AutoForwardInboxMessageJobPayload,
): Promise<void> {
  if (payload.mailbox !== "inbox") {
    throw new Error("Le transfert automatique ne traite que la boîte de réception.");
  }
  if (
    !Number.isInteger(payload.uid) ||
    payload.uid <= 0 ||
    !Number.isInteger(payload.uidValidity) ||
    payload.uidValidity <= 0
  ) {
    throw new Error("Identité IMAP invalide pour le transfert automatique.");
  }

  const credentials = await getMessagingCredentials(payload.userId);
  if (!credentials.autoForward.enabled) {
    return;
  }
  if (!credentials.autoForward.recipients.length) {
    return;
  }
  if (!credentials.smtp) {
    throw new Error("SMTP non configuré pour le transfert automatique.");
  }
  if (!credentials.imap) {
    throw new Error("IMAP non configuré pour le transfert automatique.");
  }

  await withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, "inbox", true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, "inbox"),
    });

    try {
      const currentUidValidity = normalizeImapCounterValue(
        opened.info.uidValidity,
      );
      if (currentUidValidity !== payload.uidValidity) {
        console.warn("[messaging-auto-forward] UIDVALIDITY obsolète; job ignoré", {
          userId: payload.userId,
          uid: payload.uid,
          expected: payload.uidValidity,
          current: currentUidValidity,
        });
        return;
      }

      const fetched = await client.fetchOne(
        payload.uid,
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
        const claim = await claimAutoForwardLog({
          userId: payload.userId,
          uidValidity: payload.uidValidity,
          uid: payload.uid,
          messageId: null,
          subject: null,
          targetRecipients: credentials.autoForward.recipients,
        });
        if (claim) {
          await markAutoForwardLogSkipped(
            claim.id,
            "Message IMAP introuvable pour ce transfert automatique.",
          );
        }
        console.warn("[messaging-auto-forward] message introuvable", {
          userId: payload.userId,
          uid: payload.uid,
        });
        return;
      }

      const metadata = await loadIncomingMessageMetadata(client, payload.uid, {
        uid: payload.uid,
        envelope:
          "envelope" in fetched
            ? (fetched.envelope as MessageEnvelopeObject | null)
            : null,
        source: fetched.source as Buffer | Uint8Array | string,
        internalDate: null,
      });
      const claim = await claimAutoForwardLog({
        userId: payload.userId,
        uidValidity: payload.uidValidity,
        uid: payload.uid,
        messageId: metadata?.messageId ?? null,
        subject: metadata?.subject ?? null,
        targetRecipients: credentials.autoForward.recipients,
      });
      if (!claim) {
        return;
      }

      if (!metadata) {
        await markAutoForwardLogSkipped(
          claim.id,
          "Source IMAP introuvable pour ce message.",
        );
        return;
      }
      if (hasAutoForwardLoopHeader(metadata.parsed)) {
        await markAutoForwardLogSkipped(
          claim.id,
          "Message déjà marqué comme transfert automatique.",
        );
        return;
      }

      const rawSource = normalizeRawMessageSource(
        fetched.source as Buffer | Uint8Array | string,
      );
      const targetRecipients = claim.targetRecipients.length
        ? claim.targetRecipients
        : credentials.autoForward.recipients;
      const sentRecipients = new Set(claim.sentRecipients);

      try {
        await sendAutoForwardedMessage({
          userId: payload.userId,
          uid: payload.uid,
          uidValidity: payload.uidValidity,
          credentials,
          metadata,
          rawSource,
          targetRecipients,
          sentRecipients,
          logId: claim.id,
        });
        await markAutoForwardLogSent(claim.id, Array.from(sentRecipients));
      } catch (error) {
        await markAutoForwardLogFailed(claim.id, claim.attempts, error);
        console.warn("[messaging-auto-forward] envoi échoué", {
          userId: payload.userId,
          uid: payload.uid,
          error,
        });
        throw error;
      }
    } finally {
      opened.release();
    }
  });
}

async function sendAutoForwardedMessage(options: {
  userId: string;
  uidValidity: number;
  uid: number;
  credentials: MessagingCredentials;
  metadata: IncomingMessageMetadata;
  rawSource: Buffer;
  targetRecipients: string[];
  sentRecipients: Set<string>;
  logId: string;
}) {
  const smtp = options.credentials.smtp;
  if (!smtp) {
    throw new Error("SMTP non configuré pour le transfert automatique.");
  }
  const fromAddress = smtp.fromEmail ?? smtp.user;
  if (!fromAddress) {
    throw new Error("Adresse d'expéditeur invalide pour le transfert automatique.");
  }
  const transporter = createSmtpTransport(smtp);
  const senderName = options.credentials.senderName?.trim() ?? "";
  const fromField = senderName
    ? { name: senderName, address: fromAddress }
    : fromAddress;
  const subject = buildAutoForwardSubject(options.metadata.subject);
  const text = buildForwardedMessageText(options.metadata);
  const html = wrapEmailHtml(buildForwardedMessageHtml(options.metadata), {
    senderName: options.credentials.senderName,
    senderLogoUrl: options.credentials.senderLogoUrl,
    fromEmail: fromAddress,
  });
  const originalMessageId = options.metadata.messageId;
  const headers: Record<string, string> = {
    "Auto-Submitted": "auto-forwarded",
    "X-Auto-Response-Suppress": "All",
    "X-Messagerie-Auto-Forward": "1",
  };
  if (originalMessageId) {
    headers["X-Messagerie-Original-Message-Id"] = originalMessageId;
  }
  const filename = `message-${options.uid}.eml`;

  for (const recipient of options.targetRecipients) {
    if (options.sentRecipients.has(recipient)) {
      continue;
    }
    const messageId = buildAutoForwardMessageId({
      userId: options.userId,
      uidValidity: options.uidValidity,
      uid: options.uid,
      recipient,
      fromAddress,
    });
    const info = await transporter.sendMail({
      from: fromField,
      to: recipient,
      subject,
      text,
      html,
      messageId,
      date: new Date(),
      headers,
      attachments: [
        {
          filename,
          content: options.rawSource,
          contentType: "message/rfc822",
        },
      ],
      envelope: {
        from: fromAddress,
        to: recipient,
      },
    });
    const rejected = Array.isArray(info.rejected)
      ? info.rejected.map((entry: unknown) => String(entry).toLowerCase())
      : [];
    if (rejected.includes(recipient.toLowerCase())) {
      throw new Error(`Transfert refusé par le SMTP pour ${recipient}.`);
    }
    options.sentRecipients.add(recipient);
    await updateAutoForwardSentRecipients(
      options.logId,
      Array.from(options.sentRecipients),
    );
  }
}

async function enrichMailboxListItemsWithTracking(
  userId: string,
  items: MailboxListItem[],
): Promise<MailboxListItem[]> {
  const messageIds = items
    .map((item) => item.messageId)
    .filter(
      (value): value is string =>
        typeof value === "string" && value.length > 0,
    );

  if (!messageIds.length) {
    return items;
  }

  const trackingSummaries = await getEmailTrackingSummaries({
    userId,
    messageIds,
  });

  return items.map((item) => {
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

async function searchMailboxTermUids(
  client: ImapFlow,
  term: string,
): Promise<number[]> {
  const queries = buildMailboxSearchFieldQueries(term);
  if (!queries.length) {
    return [];
  }

  const matches = new Set<number>();
  let hadSuccessfulQuery = false;

  for (const query of queries) {
    try {
      const result = await client.search(query, { uid: true });
      hadSuccessfulQuery = true;
      if (!Array.isArray(result)) {
        continue;
      }
      result.forEach((uid) => {
        if (typeof uid === "number" && Number.isInteger(uid) && uid > 0) {
          matches.add(uid);
        }
      });
    } catch (error) {
      console.warn("Recherche IMAP partielle impossible:", {
        term,
        query,
        error,
      });
    }
  }

  if (!hadSuccessfulQuery) {
    throw new Error("La recherche IMAP a échoué.");
  }

  return Array.from(matches);
}

async function searchMailboxUids(
  client: ImapFlow,
  query: string,
): Promise<number[]> {
  const terms = tokenizeMailboxSearchQuery(query);
  let matches: number[] | null = null;

  for (const term of terms) {
    const termMatches = await searchMailboxTermUids(client, term);
    if (!termMatches.length) {
      return [];
    }

    if (matches === null) {
      matches = termMatches;
      continue;
    }

    const termSet = new Set(termMatches);
    matches = matches.filter((uid) => termSet.has(uid));
    if (!matches.length) {
      return [];
    }
  }

  return matches ?? [];
}

async function fetchMailboxListItemsByUids(
  client: ImapFlow,
  uids: number[],
): Promise<MailboxListItem[]> {
  if (!uids.length) {
    return [];
  }

  const fetchedItems: MailboxListItem[] = [];
  const uidSequence = buildUidSequence(uids);
  const order = new Map(
    uids.map((uid, index) => [uid, index] as const),
  );

  for await (const message of client.fetch(
    { uid: uidSequence },
    {
      envelope: true,
      internalDate: true,
      flags: true,
      bodyStructure: true,
    },
  )) {
    fetchedItems.push(
      createMailboxListItem(
        message as unknown as Parameters<
          typeof createMailboxListItem
        >[0],
      ),
    );
  }

  fetchedItems.sort(
    (left, right) =>
      (order.get(left.uid) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.uid) ?? Number.MAX_SAFE_INTEGER),
  );

  return fetchedItems;
}

export async function fetchMailboxMessages(params: {
  mailbox: Mailbox;
  page?: number;
  pageSize?: number;
  userId?: string;
}): Promise<MailboxPageResult> {
  const userId = await resolveUserId(params.userId);
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
    const opened = await openMailbox(client, params.mailbox, true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, params.mailbox),
    });

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
      let newlyMovedCount = 0;

      let prefetchedMessages: Map<number, PrefetchedRawMessage> | null = null;
      const shouldPrefetchRawMessages =
        params.mailbox === "inbox" &&
        items.length > 0 &&
        spamFilteringEnabled;
      if (shouldPrefetchRawMessages) {
        try {
          prefetchedMessages = await fetchRawMessages(
            client,
            items.map((item) => item.uid),
          );
        } catch (error) {
          console.warn("Impossible de précharger les messages IMAP:", error);
        }
      }

      if (params.mailbox === "inbox" && items.length && spamFilteringEnabled) {
        const result = await filterSpamCandidates({
          userId,
          mailbox: params.mailbox,
          items: filteredItems,
          client,
          spamFilteringEnabled,
          prefetchedMessages,
        });
        filteredItems = result.remaining;
        if (result.autoMoved.length) {
          autoMoved.push(...result.autoMoved);
        }
        newlyMovedCount = result.newlyMovedCount;
      }

      const adjustedTotal = Math.max(0, totalMessages - newlyMovedCount);

      const enrichedItems = await enrichMailboxListItemsWithTracking(
        userId,
        filteredItems,
      );

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
      opened.release();
    }
  });
}

export async function searchMailboxMessages(params: {
  mailbox: SearchableMailbox;
  query: string;
  page?: number;
  pageSize?: number;
  userId?: string;
}): Promise<MailboxSearchResult> {
  const normalizedQuery = normalizeMailboxSearchQuery(params.query);
  if (!isMailboxSearchQueryUsable(normalizedQuery)) {
    throw new Error(
      "La recherche doit contenir au moins deux caractères.",
    );
  }

  const userId = await resolveUserId(params.userId);
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, params.mailbox),
    });

    try {
      const matchedUids = await searchMailboxUids(
        client,
        normalizedQuery,
      );
      const sortedUids = Array.from(new Set(matchedUids)).sort(
        (left, right) => right - left,
      );
      const totalMessages = sortedUids.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageUids = sortedUids.slice(startIndex, endIndex);

      if (!pageUids.length) {
        return {
          mailbox: params.mailbox,
          query: normalizedQuery,
          page,
          pageSize,
          totalMessages,
          hasMore: endIndex < totalMessages,
          messages: [],
        };
      }

      const items = await fetchMailboxListItemsByUids(client, pageUids);
      const enrichedItems = await enrichMailboxListItemsWithTracking(
        userId,
        items,
      );

      return {
        mailbox: params.mailbox,
        query: normalizedQuery,
        page,
        pageSize,
        totalMessages,
        hasMore: endIndex < totalMessages,
        messages: enrichedItems,
      };
    } finally {
      opened.release();
    }
  });
}

const EMAIL_PREVIEW_MAX_LENGTH = 1800;
const MAILBOX_SUMMARY_DEFAULT_LIMIT = 6;
const MAILBOX_SUMMARY_MIN_LIMIT = 5;
const MAILBOX_SUMMARY_MAX_LIMIT = 10;

function normalizeMessageBodyText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePreviewText(value: string): string {
  return value
    .replace(/\r?\n|\r/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToPlainText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function buildMessageContentPreview(
  text: string | null,
  html: string | null,
): string | null {
  if (typeof text === "string" && text.trim().length) {
    const normalized = normalizePreviewText(text);
    if (normalized.length) {
      return normalized.slice(0, EMAIL_PREVIEW_MAX_LENGTH);
    }
  }
  if (typeof html === "string" && html.trim().length) {
    const normalized = normalizePreviewText(htmlToPlainText(html));
    if (normalized.length) {
      return normalized.slice(0, EMAIL_PREVIEW_MAX_LENGTH);
    }
  }
  return null;
}

function buildMessageDetailPreview(detail: MessageDetail): string | null {
  return buildMessageContentPreview(detail.text, detail.html);
}

export async function parseFetchedMailboxMessage(params: {
  mailbox: Mailbox;
  uid: number;
  source: Buffer | Uint8Array | string;
  envelope: MessageEnvelopeObject;
  internalDate?: Date | string | null;
  flags?: Set<string> | null;
}): Promise<ParsedMailboxMessageContent> {
  const normalizedSource =
    typeof params.source === "string" || Buffer.isBuffer(params.source)
      ? params.source
      : Buffer.from(params.source);
  const parsed = await simpleParser(normalizedSource);
  const parsedDate =
    (parsed as ParsedMail & { date?: Date | string | null }).date ?? null;

  const parsedFrom = parsed.from?.value ?? [];
  const parsedTo = parsed.to?.value ?? [];
  const parsedCc = parsed.cc?.value ?? [];
  const parsedBcc = parsed.bcc?.value ?? [];
  const parsedReplyTo = parsed.replyTo?.value ?? [];

  const fromParticipants = mergeParticipants(
    params.envelope.from,
    parsedFrom,
  );
  const replyToParticipants = mergeParticipants(
    params.envelope.replyTo,
    parsedReplyTo,
  );
  const toParticipants = mergeParticipants(
    params.envelope.to,
    parsedTo,
  );
  const ccParticipants = mergeParticipants(
    params.envelope.cc,
    parsedCc,
  );
  const bccParticipants = mergeParticipants(
    params.envelope.bcc,
    parsedBcc,
  );

  const sanitizedHtml = parsed.html ? sanitizeEmailHtml(parsed.html) : null;
  const normalizedText = normalizeMessageBodyText(parsed.text);

  const formattedFrom =
    formatParticipantLabel(fromParticipants[0]) ??
    formatAddress(params.envelope.from?.[0] as ImapAddress | undefined);
  const formattedTo = formatParticipantList(toParticipants);
  const formattedCc = formatParticipantList(ccParticipants);
  const formattedBcc = formatParticipantList(bccParticipants);
  const formattedReplyTo = formatParticipantList(replyToParticipants);

  const attachmentDescriptors = buildAttachmentDescriptors(
    params.mailbox,
    params.uid,
    parsed.attachments,
  );
  const attachments = attachmentDescriptors.map((descriptor) => {
    const rawAttachment = descriptor.raw as Attachment & {
      contentId?: string | null;
      contentDisposition?: string | null;
      related?: boolean;
      contentLocation?: string | null;
    };
    const disposition =
      typeof rawAttachment.contentDisposition === "string"
        ? rawAttachment.contentDisposition.trim().toLowerCase()
        : "";
    const contentId =
      typeof rawAttachment.contentId === "string" &&
      rawAttachment.contentId.trim().length > 0
        ? rawAttachment.contentId.trim()
        : null;
    const contentLocation =
      typeof rawAttachment.contentLocation === "string" &&
      rawAttachment.contentLocation.trim().length > 0
        ? rawAttachment.contentLocation.trim()
        : null;

    return {
      id: descriptor.id,
      filename: descriptor.filename,
      contentType: descriptor.contentType,
      size: descriptor.size,
      contentId,
      contentLocation,
      inline: disposition === "inline" || rawAttachment.related === true,
    } satisfies ParsedMailboxAttachmentMetadata;
  });

  const internalDate =
    params.internalDate instanceof Date
      ? params.internalDate
      : params.internalDate
        ? new Date(params.internalDate)
        : new Date();
  const sentAtSource =
    parsedDate instanceof Date
      ? parsedDate
      : parsedDate
        ? new Date(parsedDate)
      : params.envelope.date instanceof Date
        ? params.envelope.date
        : null;

  return {
    messageId: params.envelope.messageId ?? null,
    subject: params.envelope.subject ?? "(Sans objet)",
    from: formattedFrom ?? null,
    to: formattedTo,
    cc: formattedCc,
    bcc: formattedBcc,
    replyTo: formattedReplyTo,
    date: internalDate.toISOString(),
    sentAt: sentAtSource?.toISOString() ?? null,
    seen: params.flags?.has("\\Seen") ?? false,
    answered: params.flags?.has("\\Answered") ?? false,
    flagged: params.flags?.has("\\Flagged") ?? false,
    draft: params.flags?.has("\\Draft") ?? false,
    html: sanitizedHtml,
    text: normalizedText,
    previewText: buildMessageContentPreview(normalizedText, sanitizedHtml),
    attachments,
    fromAddress: fromParticipants[0] ?? null,
    toAddresses: toParticipants,
    ccAddresses: ccParticipants,
    bccAddresses: bccParticipants,
    replyToAddresses: replyToParticipants,
  };
}

export async function fetchRecentMailboxEmails(params: {
  mailbox: Mailbox;
  limit?: number;
  userId?: string;
}): Promise<MailboxEmailSummaryResult> {
  const mailbox = params.mailbox;
  const userId = await resolveUserId(params.userId);
  const requestedLimit = params.limit ?? MAILBOX_SUMMARY_DEFAULT_LIMIT;
  const limit = Math.min(
    Math.max(requestedLimit, MAILBOX_SUMMARY_MIN_LIMIT),
    MAILBOX_SUMMARY_MAX_LIMIT,
  );

  try {
    const page = await fetchMailboxMessages({
      mailbox,
      page: 1,
      pageSize: limit,
      userId,
    });

    const selected = page.messages.slice(0, limit);
    if (!selected.length) {
      return {
        mailbox,
        totalMessages: page.totalMessages,
        limit,
        emails: [],
      };
    }

    const emails: MailboxEmailSummary[] = [];
    const errors: Array<{ uid: number; message: string }> = [];

    for (const item of selected) {
      try {
        const detail = await fetchMessageDetail({
          mailbox,
          uid: item.uid,
          userId,
        });
        emails.push({
          mailbox,
          uid: detail.uid,
          subject: detail.subject,
          from: detail.from,
          to: detail.to,
          cc: detail.cc,
          date: detail.date,
          seen: detail.seen,
          hasAttachments: item.hasAttachments,
          textPreview: buildMessageDetailPreview(detail),
        });
      } catch (error) {
        console.warn("[assistant-email-summary] detail fetch failed", {
          userId,
          mailbox,
          uid: item.uid,
          error,
        });
        errors.push({
          uid: item.uid,
          message:
            error instanceof Error
              ? error.message
              : "Impossible de récupérer le message.",
        });
        emails.push({
          mailbox,
          uid: item.uid,
          subject: item.subject,
          from: item.from,
          to: item.to,
          cc: [],
          date: item.date,
          seen: item.seen,
          hasAttachments: item.hasAttachments,
          textPreview: null,
        });
      }
    }

    return {
      mailbox,
      totalMessages: page.totalMessages,
      limit,
      emails,
      errors: errors.length ? errors : undefined,
    };
  } catch (error) {
    console.error("[assistant-email-summary] inbox fetch failed", {
      userId,
      mailbox,
      limit,
      error,
    });
    throw error;
  }
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
  const autoReplyFeatureEnabled = isAutoReplyFeatureEnabled(credentials);
  const autoForwardFeatureEnabled = isAutoForwardFeatureEnabled(credentials);

  if (params.sinceUid <= 0) {
    return {
      totalMessages: null,
      messages: [],
    };
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, params.mailbox),
    });

    try {
      const totalMessages = opened.info.exists ?? null;
      const nextUid = opened.info.uidNext ?? null;
      const uidValidity = normalizeImapCounterValue(opened.info.uidValidity);
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
      let newlyMovedCount = 0;

      let prefetchedMessages: Map<number, PrefetchedRawMessage> | null = null;
      const shouldPrefetchRawMessages =
        params.mailbox === "inbox" &&
        items.length > 0 &&
        (spamFilteringEnabled || autoReplyFeatureEnabled);
      if (shouldPrefetchRawMessages) {
        try {
          prefetchedMessages = await fetchRawMessages(
            client,
            items.map((item) => item.uid),
          );
        } catch (error) {
          console.warn("Impossible de précharger les messages IMAP:", error);
        }
      }

      if (params.mailbox === "inbox" && items.length && spamFilteringEnabled) {
        const result = await filterSpamCandidates({
          userId,
          mailbox: params.mailbox,
          items: filteredItems,
          client,
          spamFilteringEnabled,
          prefetchedMessages,
        });
        filteredItems = result.remaining;
        if (result.autoMoved.length) {
          autoMoved.push(...result.autoMoved);
        }
        newlyMovedCount = result.newlyMovedCount;
      }

      const adjustedTotal =
        typeof totalMessages === "number"
          ? Math.max(0, totalMessages - newlyMovedCount)
          : totalMessages;

      if (
        params.mailbox === "inbox" &&
        filteredItems.length &&
        autoForwardFeatureEnabled
      ) {
        try {
          await processAutoForwardQueueing({
            userId,
            credentials,
            messages: filteredItems,
            uidValidity,
          });
        } catch (error) {
          console.warn("[messaging-auto-forward] mise en file impossible:", error);
        }
      }

      if (
        params.mailbox === "inbox" &&
        filteredItems.length &&
        autoReplyFeatureEnabled
      ) {
        try {
          await processAutoReplies({
            userId,
            client,
            credentials,
            messages: filteredItems,
            prefetchedMessages,
          });
        } catch (error) {
          console.warn("Impossible d'envoyer les réponses automatiques:", error);
        }
      }

      const enrichedItems = await enrichMailboxListItemsWithTracking(
        userId,
        filteredItems,
      );

      return {
        totalMessages: adjustedTotal,
        messages: enrichedItems,
        autoMoved: autoMoved.length ? autoMoved : undefined,
      };
    } finally {
      opened.release();
    }
  });
}

export async function fetchMessageDetail(params: {
  mailbox: Mailbox;
  uid: number;
  userId?: string;
}): Promise<MessageDetail> {
  const userId = await resolveUserId(params.userId);
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, params.mailbox),
    });

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

      const parsedMessage = await parseFetchedMailboxMessage({
        mailbox: params.mailbox,
        uid: params.uid,
        source: fetched.source,
        envelope: fetched.envelope,
        internalDate: fetched.internalDate ?? null,
        flags: fetched.flags ?? null,
      });

      const envelopeMessageId = parsedMessage.messageId;
      const trackingDetail =
        envelopeMessageId && params.mailbox === "sent"
          ? await getEmailTrackingDetail({
              userId,
              messageId: envelopeMessageId,
            })
          : null;

      return {
        mailbox: params.mailbox,
        uid: params.uid,
        messageId: parsedMessage.messageId,
        subject: parsedMessage.subject,
        from: parsedMessage.from,
        to: parsedMessage.to,
        cc: parsedMessage.cc,
        bcc: parsedMessage.bcc,
        replyTo: parsedMessage.replyTo,
        date: parsedMessage.date,
        seen: parsedMessage.seen,
        html: parsedMessage.html,
        text: parsedMessage.text,
        attachments: parsedMessage.attachments.map(
          ({ id, filename, contentType, size }) => ({
            id,
            filename,
            contentType,
            size,
          }),
        ),
        fromAddress: parsedMessage.fromAddress,
        toAddresses: parsedMessage.toAddresses,
        ccAddresses: parsedMessage.ccAddresses,
        bccAddresses: parsedMessage.bccAddresses,
        replyToAddresses: parsedMessage.replyToAddresses,
        tracking: trackingDetail,
      };
    } finally {
      opened.release();
    }
  });
}

export async function fetchMessageAttachment(params: {
  mailbox: Mailbox;
  uid: number;
  attachmentId: string;
  userId?: string;
}): Promise<{ filename: string; contentType: string; content: Buffer }> {
  const userId = await resolveUserId(params.userId);
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true, {
      cacheKey: getMailboxCacheKey(credentials.imap!, params.mailbox),
    });

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
      const resolvedContentType =
        detectAttachmentMimeType(content) ?? descriptor.contentType;

      return {
        filename: descriptor.filename,
        contentType: resolvedContentType,
        content,
      };
    } finally {
      opened.release();
    }
  });
}

export async function moveMailboxMessage(params: {
  mailbox: Mailbox;
  uid: number;
  target: Mailbox;
  userId?: string;
}): Promise<MovedMailboxMessageResult> {
  if (params.mailbox === params.target) {
    return {
      sourceMailbox: params.mailbox,
      targetMailbox: params.target,
      sourceUid: params.uid,
      targetUid: params.uid,
      sourcePath: null,
      targetPath: null,
      sourceUidValidity: null,
      targetUidValidity: null,
    };
  }

  const userId = await resolveUserId(params.userId);
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
      {
        cacheKey: getMailboxCacheKey(credentials.imap!, params.target),
        discover: true,
      },
    );
    if (!destinationCandidates.length) {
      throw new Error("Dossier de destination introuvable.");
    }
    const destinationPath = destinationCandidates[0];
    const opened = await openMailbox(client, params.mailbox, false, {
      cacheKey: getMailboxCacheKey(credentials.imap!, params.mailbox),
    });

    try {
      const sourcePath = opened.name;
      const sourceUidValidity = normalizeImapCounterValue(
        opened.info.uidValidity,
      );
      const moved = await client.messageMove(
        String(params.uid),
        destinationPath,
        { uid: true },
      );
      if (!moved) {
        throw new Error("Déplacement du message impossible.");
      }
      const targetUid =
        moved.uidMap instanceof Map
          ? moved.uidMap.get(params.uid) ?? null
          : null;
      return {
        sourceMailbox: params.mailbox,
        targetMailbox: params.target,
        sourceUid: params.uid,
        targetUid,
        sourcePath,
        targetPath: moved.destination ?? destinationPath,
        sourceUidValidity,
        targetUidValidity: normalizeImapCounterValue(
          moved.uidValidity,
        ),
      };
    } finally {
      opened.release();
    }
  });
}

export async function updateMailboxMessageSeenState(params: {
  mailbox: Mailbox;
  uid: number;
  seen: boolean;
  userId?: string;
}): Promise<void> {
  const userId = await resolveUserId(params.userId);
  const credentials = await getMessagingCredentials(userId);
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, false, {
      cacheKey: getMailboxCacheKey(credentials.imap!, params.mailbox),
    });

    try {
      const updated = params.seen
        ? await client.messageFlagsAdd(
            String(params.uid),
            ["\\Seen"],
            { uid: true },
          )
        : await client.messageFlagsRemove(
            String(params.uid),
            ["\\Seen"],
            { uid: true },
          );
      if (!updated) {
        throw new Error("Mise à jour de l'état lu/non lu impossible.");
      }
    } finally {
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
  let senderSessionToken: string | null = null;
  try {
    senderSessionToken = await getSessionTokenFromCookie();
  } catch {
    senderSessionToken = null;
  }

  let senderIpAddress: string | null = null;
  try {
    const headersList = await headers();
    senderIpAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip")?.trim() ??
      null;
  } catch {
    senderIpAddress = null;
  }

  return sendEmailMessageForUser(userId, params, {
    senderSessionToken,
    senderIpAddress,
  });
}

export async function sendEmailMessageForUser(
  userId: string,
  params: ComposeEmailInput,
  options?: {
    senderSessionToken?: string | null;
    senderIpAddress?: string | null;
    credentials?: MessagingCredentials;
  },
): Promise<SentMailboxAppendResult> {
  const credentials = options?.credentials ?? (await getMessagingCredentials(userId));
  if (!credentials.smtp) {
    throw new Error(
      "Le serveur SMTP n'est pas configuré. Veuillez compléter les paramètres avant d'envoyer un message.",
    );
  }

  const transporter = createSmtpTransport(credentials.smtp);

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
    senderSessionToken: options?.senderSessionToken ?? null,
    senderIpAddress: options?.senderIpAddress ?? null,
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
    const appendResult = await appendMessageToSentMailbox({
      imap: credentials.imap,
      rawMessage: Buffer.isBuffer(rawMessage)
        ? rawMessage
        : Buffer.from(rawMessage),
      messageId,
      sentAt,
      userId,
    });
    try {
      const {
        projectSentMailboxAppendToLocal,
      } = await import("@/server/messaging-local-sync");
      await projectSentMailboxAppendToLocal({
        userId,
        sentAppendResult: appendResult,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        text: params.text,
        html: baseHtml,
        attachments: params.attachments,
        senderEmail: fromAddress,
        senderName: credentials.senderName,
        sentAt,
      });
    } catch (error) {
      console.warn(
        "Impossible de projeter localement le message envoyé:",
        error,
      );
    }
    return appendResult;
  } catch (error) {
    console.warn("Impossible d'enregistrer le message dans 'Envoyés':", error);
    return {
      message: null,
      totalMessages: null,
      remotePath: null,
      uidValidity: null,
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
        const opened = await openMailbox(client, "inbox", true, {
          cacheKey: getMailboxCacheKey(config, "inbox"),
        });

        try {
          // L'ouverture suffit pour vérifier la connexion IMAP
        } finally {
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
  const transporter = createSmtpTransport({
    host: ensureNonEmpty(config.host, "Serveur SMTP"),
    port: ensurePort(config.port, "SMTP"),
    secure: config.secure,
    user: ensureNonEmpty(config.user, "Identifiant SMTP"),
    password: ensureNonEmpty(config.password, "Mot de passe SMTP"),
  });

  try {
    await transporter.verify();
  } catch (error) {
    throw formatError("Échec du test SMTP", error);
  }
}

export const __testables = {
  selectAutoReplyCandidates,
  computeAutoReplyStartUid,
  normalizeAttachmentContentType,
  detectAttachmentMimeType,
  readAttachmentContent,
};
