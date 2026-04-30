import {
  Prisma,
  MessagingLocalBodyState as PrismaMessagingLocalBodyState,
  MessagingLocalSyncStatus as PrismaMessagingLocalSyncStatus,
  MessagingMailboxName as PrismaMessagingMailboxName,
} from "@/lib/db/prisma-server";
import { prisma } from "@/lib/db";
import type { ImapFlow, MessageEnvelopeObject } from "imapflow";
import {
  fetchRawMessages,
  getMailboxCacheKey,
  getMessagingCredentials,
  openMailbox,
  parseFetchedMailboxMessage,
  resolveUserId,
  withImapClient,
  type EmailAttachment,
  type ImapConnectionConfig,
  type MessageDetail,
  type PrefetchedRawMessage,
  type SentMailboxAppendResult,
} from "@/server/messaging";
import {
  isMessagingLocalSyncServerEnabled,
  recordMessagingLocalSyncSyncCompleted,
  recordMessagingLocalSyncSyncFailed,
} from "@/server/messaging-local-sync-ops";
import {
  isMailboxSearchQueryUsable,
  normalizeMailboxSearchQuery,
  tokenizeMailboxSearchQuery,
} from "@/lib/messaging/mailbox-search";

export const MESSAGING_LOCAL_SYNC_MAILBOX_VALUES = [
  "inbox",
  "sent",
  "drafts",
  "trash",
  "spam",
] as const;

export type MessagingLocalSyncMailbox =
  (typeof MESSAGING_LOCAL_SYNC_MAILBOX_VALUES)[number];

export type MessagingLocalSyncStatus =
  `${PrismaMessagingLocalSyncStatus}`;

export type MessagingLocalBodyState =
  `${PrismaMessagingLocalBodyState}`;

export type MessagingLocalParticipant = {
  name?: string | null;
  address?: string | null;
  label?: string | null;
};

export type MessagingLocalAttachmentInput = {
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string | null;
  contentLocation?: string | null;
  inline?: boolean;
  cachedBlobKey?: string | null;
  cachedAt?: Date | string | null;
};

export type UpsertMessagingMailboxLocalSyncStateInput = {
  userId?: string;
  mailbox: MessagingLocalSyncMailbox;
  remotePath?: string | null;
  uidValidity?: number | null;
  lastKnownUidNext?: number | null;
  lastSyncedUid?: number | null;
  lastBackfilledUid?: number | null;
  remoteMessageCount?: number | null;
  localMessageCount?: number | null;
  status?: MessagingLocalSyncStatus;
  lastSuccessfulSyncAt?: Date | string | null;
  lastAttemptedSyncAt?: Date | string | null;
  lastFullResyncAt?: Date | string | null;
  lastError?: string | null;
};

export type UpsertMessagingLocalMessageInput = {
  userId?: string;
  mailbox: MessagingLocalSyncMailbox;
  remotePath?: string | null;
  uidValidity: number;
  uid: number;
  messageId?: string | null;
  subject?: string | null;
  fromLabel?: string | null;
  fromAddress?: string | null;
  toRecipients?: MessagingLocalParticipant[];
  ccRecipients?: MessagingLocalParticipant[];
  bccRecipients?: MessagingLocalParticipant[];
  replyToRecipients?: MessagingLocalParticipant[];
  internalDate?: Date | string | null;
  sentAt?: Date | string | null;
  seen?: boolean;
  answered?: boolean;
  flagged?: boolean;
  draft?: boolean;
  hasAttachments?: boolean;
  previewText?: string | null;
  normalizedText?: string | null;
  sanitizedHtml?: string | null;
  searchText?: string | null;
  bodyState?: MessagingLocalBodyState;
  lastSyncedAt?: Date | string | null;
  hydratedAt?: Date | string | null;
  attachments?: MessagingLocalAttachmentInput[];
};

const mailboxLocalSyncStateSelect =
  Prisma.validator<Prisma.MessagingMailboxLocalSyncStateSelect>()({
    id: true,
    userId: true,
    mailbox: true,
    remotePath: true,
    uidValidity: true,
    lastKnownUidNext: true,
    lastSyncedUid: true,
    lastBackfilledUid: true,
    remoteMessageCount: true,
    localMessageCount: true,
    status: true,
    lastSuccessfulSyncAt: true,
    lastAttemptedSyncAt: true,
    lastFullResyncAt: true,
    lastError: true,
    createdAt: true,
    updatedAt: true,
  });

const localAttachmentSelect =
  Prisma.validator<Prisma.MessagingLocalAttachmentSelect>()({
    id: true,
    attachmentId: true,
    filename: true,
    contentType: true,
    size: true,
    contentId: true,
    contentLocation: true,
    inline: true,
    cachedBlobKey: true,
    cachedAt: true,
    createdAt: true,
    updatedAt: true,
  });

const localMessageSelect =
  Prisma.validator<Prisma.MessagingLocalMessageSelect>()({
    id: true,
    userId: true,
    mailbox: true,
    remotePath: true,
    uidValidity: true,
    uid: true,
    messageId: true,
    subject: true,
    fromLabel: true,
    fromAddress: true,
    toRecipients: true,
    ccRecipients: true,
    bccRecipients: true,
    replyToRecipients: true,
    internalDate: true,
    sentAt: true,
    seen: true,
    answered: true,
    flagged: true,
    draft: true,
    hasAttachments: true,
    previewText: true,
    normalizedText: true,
    sanitizedHtml: true,
    bodyState: true,
    lastSyncedAt: true,
    hydratedAt: true,
    createdAt: true,
    updatedAt: true,
    attachments: {
      select: localAttachmentSelect,
      orderBy: { createdAt: "asc" },
    },
  });

const localMessageSummarySelect =
  Prisma.validator<Prisma.MessagingLocalMessageSelect>()({
    id: true,
    userId: true,
    mailbox: true,
    remotePath: true,
    uidValidity: true,
    uid: true,
    messageId: true,
    subject: true,
    fromLabel: true,
    fromAddress: true,
    toRecipients: true,
    internalDate: true,
    sentAt: true,
    seen: true,
    hasAttachments: true,
    previewText: true,
    bodyState: true,
    updatedAt: true,
  });

type MailboxLocalSyncStateEntity = Prisma.MessagingMailboxLocalSyncStateGetPayload<{
  select: typeof mailboxLocalSyncStateSelect;
}>;

type LocalAttachmentEntity = Prisma.MessagingLocalAttachmentGetPayload<{
  select: typeof localAttachmentSelect;
}>;

type LocalMessageEntity = Prisma.MessagingLocalMessageGetPayload<{
  select: typeof localMessageSelect;
}>;

type LocalMessageSummaryEntity = Prisma.MessagingLocalMessageGetPayload<{
  select: typeof localMessageSummarySelect;
}>;

export type MessagingMailboxLocalSyncStateRecord = {
  id: string;
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  remotePath: string | null;
  uidValidity: number | null;
  lastKnownUidNext: number | null;
  lastSyncedUid: number | null;
  lastBackfilledUid: number | null;
  remoteMessageCount: number | null;
  localMessageCount: number | null;
  status: MessagingLocalSyncStatus;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  lastFullResyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessagingLocalSyncMode =
  | "live-imap"
  | "local-bootstrapping"
  | "local-partial"
  | "local-ready";

export type MessagingLocalSyncMailboxOverview = {
  mailbox: MessagingLocalSyncMailbox;
  status: MessagingLocalSyncStatus;
  readable: boolean;
  bootstrapComplete: boolean;
  backfillComplete: boolean;
  progressPercent: number | null;
  remotePath: string | null;
  uidValidity: number | null;
  localMessageCount: number | null;
  remoteMessageCount: number | null;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  lastFullResyncAt: string | null;
  lastError: string | null;
};

export type MessagingLocalSyncOverview = {
  enabled: boolean;
  serverEnabled: boolean;
  active: boolean;
  mode: MessagingLocalSyncMode;
  anyReadable: boolean;
  allReadable: boolean;
  allBackfilled: boolean;
  lastSuccessfulSyncAt: string | null;
  mailboxes: MessagingLocalSyncMailboxOverview[];
};

export type MessagingLocalAttachmentRecord = {
  id: string;
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  contentLocation: string | null;
  inline: boolean;
  cachedBlobKey: string | null;
  cachedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessagingLocalAttachmentLookupRecord = {
  id: string;
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  uid: number;
  uidValidity: number;
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  contentLocation: string | null;
  inline: boolean;
  cachedBlobKey: string | null;
  cachedAt: string | null;
};

export type MessagingLocalMessageRecord = {
  id: string;
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  remotePath: string | null;
  uidValidity: number;
  uid: number;
  messageId: string | null;
  subject: string | null;
  fromLabel: string | null;
  fromAddress: string | null;
  toRecipients: MessagingLocalParticipant[];
  ccRecipients: MessagingLocalParticipant[];
  bccRecipients: MessagingLocalParticipant[];
  replyToRecipients: MessagingLocalParticipant[];
  internalDate: string | null;
  sentAt: string | null;
  seen: boolean;
  answered: boolean;
  flagged: boolean;
  draft: boolean;
  hasAttachments: boolean;
  previewText: string | null;
  normalizedText: string | null;
  sanitizedHtml: string | null;
  bodyState: MessagingLocalBodyState;
  lastSyncedAt: string | null;
  hydratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: MessagingLocalAttachmentRecord[];
};

export type MessagingLocalMessageSummaryRecord = {
  id: string;
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  remotePath: string | null;
  uidValidity: number;
  uid: number;
  messageId: string | null;
  subject: string | null;
  fromLabel: string | null;
  fromAddress: string | null;
  toRecipients: MessagingLocalParticipant[];
  internalDate: string | null;
  sentAt: string | null;
  seen: boolean;
  hasAttachments: boolean;
  previewText: string | null;
  bodyState: MessagingLocalBodyState;
  updatedAt: string;
};

const prismaMailboxByValue: Record<
  MessagingLocalSyncMailbox,
  PrismaMessagingMailboxName
> = {
  inbox: PrismaMessagingMailboxName.INBOX,
  sent: PrismaMessagingMailboxName.SENT,
  drafts: PrismaMessagingMailboxName.DRAFTS,
  trash: PrismaMessagingMailboxName.TRASH,
  spam: PrismaMessagingMailboxName.SPAM,
};

const valueByPrismaMailbox = Object.fromEntries(
  Object.entries(prismaMailboxByValue).map(([value, prismaValue]) => [
    prismaValue,
    value,
  ]),
) as Record<PrismaMessagingMailboxName, MessagingLocalSyncMailbox>;

function toMailboxEnum(mailbox: MessagingLocalSyncMailbox) {
  return prismaMailboxByValue[mailbox];
}

function fromMailboxEnum(
  mailbox: PrismaMessagingMailboxName,
): MessagingLocalSyncMailbox {
  return valueByPrismaMailbox[mailbox];
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalDate(
  value: Date | string | null | undefined,
): Date | null | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const MESSAGING_LOCAL_MESSAGE_UPSERT_TRANSACTION_TIMEOUT_MS = 20_000;

function normalizeMessagingLocalAttachmentInputs(
  attachments: MessagingLocalAttachmentInput[] | undefined,
): Array<{
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  contentLocation: string | null;
  inline: boolean;
  cachedBlobKey: string | null;
  cachedAt: Date | null;
}> | undefined {
  if (!attachments) {
    return undefined;
  }

  const normalizedAttachments: Array<{
    attachmentId: string;
    filename: string;
    contentType: string;
    size: number;
    contentId: string | null;
    contentLocation: string | null;
    inline: boolean;
    cachedBlobKey: string | null;
    cachedAt: Date | null;
  }> = [];
  const seenAttachmentIds = new Set<string>();

  attachments.forEach((attachment, index) => {
    const normalizedAttachmentId =
      normalizeOptionalString(attachment.attachmentId) ??
      `attachment-${index + 1}`;
    if (seenAttachmentIds.has(normalizedAttachmentId)) {
      return;
    }
    seenAttachmentIds.add(normalizedAttachmentId);

    normalizedAttachments.push({
      attachmentId: normalizedAttachmentId,
      filename: attachment.filename.trim(),
      contentType: attachment.contentType.trim(),
      size: attachment.size,
      contentId: normalizeOptionalString(attachment.contentId),
      contentLocation: normalizeOptionalString(
        attachment.contentLocation,
      ),
      inline: attachment.inline ?? false,
      cachedBlobKey: normalizeOptionalString(attachment.cachedBlobKey),
      cachedAt: normalizeOptionalDate(attachment.cachedAt) ?? null,
    });
  });

  return normalizedAttachments;
}

function normalizeParticipants(
  participants: MessagingLocalParticipant[] | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof participants === "undefined") {
    return undefined;
  }
  return participants.map((participant) => ({
    name: normalizeOptionalString(participant.name),
    address: normalizeOptionalString(participant.address),
    label: normalizeOptionalString(participant.label),
  })) as Prisma.InputJsonValue;
}

function parseParticipants(
  value: Prisma.JsonValue | null,
): MessagingLocalParticipant[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    return [
      {
        name:
          typeof record.name === "string" ? record.name : null,
        address:
          typeof record.address === "string" ? record.address : null,
        label:
          typeof record.label === "string" ? record.label : null,
      } satisfies MessagingLocalParticipant,
    ];
  });
}

function participantToSearchText(
  participants: MessagingLocalParticipant[] | undefined,
): string {
  if (!participants?.length) {
    return "";
  }
  return participants
    .flatMap((participant) => [
      normalizeOptionalString(participant.label),
      normalizeOptionalString(participant.name),
      normalizeOptionalString(participant.address),
    ])
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function buildMessagingLocalMessageSearchText(
  input: Pick<
    UpsertMessagingLocalMessageInput,
    | "searchText"
    | "subject"
    | "fromLabel"
    | "fromAddress"
    | "toRecipients"
    | "ccRecipients"
    | "bccRecipients"
    | "replyToRecipients"
    | "previewText"
    | "normalizedText"
  >,
): string | null {
  const explicit = normalizeOptionalString(input.searchText);
  if (explicit) {
    return explicit;
  }

  const pieces = [
    normalizeOptionalString(input.subject),
    normalizeOptionalString(input.fromLabel),
    normalizeOptionalString(input.fromAddress),
    participantToSearchText(input.toRecipients),
    participantToSearchText(input.ccRecipients),
    participantToSearchText(input.bccRecipients),
    participantToSearchText(input.replyToRecipients),
    normalizeOptionalString(input.previewText),
    normalizeOptionalString(input.normalizedText),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return pieces.length > 0 ? pieces : null;
}

function extractLocalParticipantAddress(
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }
  const bracketMatch = trimmed.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return normalizeOptionalString(bracketMatch[1]);
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function extractLocalParticipantName(
  value: string,
  address: string | null,
): string | null {
  const trimmed = value.trim();
  if (!trimmed.length || !address) {
    return null;
  }
  const bracketMatch = trimmed.match(/^(.*)<[^>]+>\s*$/);
  if (!bracketMatch?.[1]) {
    return null;
  }
  const name = bracketMatch[1].trim().replace(/^"|"$/g, "");
  return name.length > 0 ? name : null;
}

function toLocalParticipantsFromAddressLabels(
  values: string[] | undefined,
): MessagingLocalParticipant[] {
  if (!values?.length) {
    return [];
  }
  return values.flatMap((value) => {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return [];
    }
    const address = extractLocalParticipantAddress(trimmed);
    const name = extractLocalParticipantName(trimmed, address);
    const participant = {
      name,
      address,
      label: trimmed,
    } satisfies MessagingLocalParticipant;
    return [participant];
  });
}

function normalizeMessagingLocalPreviewText(
  value: string,
): string {
  return value
    .replace(/\r?\n|\r/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMessagingLocalHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function buildMessagingLocalPreviewText(params: {
  text?: string | null;
  html?: string | null;
  maxLength?: number;
}): string | null {
  const maxLength = Math.max(1, params.maxLength ?? 1800);
  const normalizedText = normalizeOptionalString(params.text);
  if (normalizedText) {
    const preview = normalizeMessagingLocalPreviewText(normalizedText);
    return preview.length > 0 ? preview.slice(0, maxLength) : null;
  }
  const normalizedHtml = normalizeOptionalString(params.html);
  if (normalizedHtml) {
    const preview = normalizeMessagingLocalPreviewText(
      stripMessagingLocalHtml(normalizedHtml),
    );
    return preview.length > 0 ? preview.slice(0, maxLength) : null;
  }
  return null;
}

function serializeMailboxLocalSyncState(
  entity: MailboxLocalSyncStateEntity,
): MessagingMailboxLocalSyncStateRecord {
  return {
    id: entity.id,
    userId: entity.userId,
    mailbox: fromMailboxEnum(entity.mailbox),
    remotePath: entity.remotePath ?? null,
    uidValidity: entity.uidValidity ?? null,
    lastKnownUidNext: entity.lastKnownUidNext ?? null,
    lastSyncedUid: entity.lastSyncedUid ?? null,
    lastBackfilledUid: entity.lastBackfilledUid ?? null,
    remoteMessageCount: entity.remoteMessageCount ?? null,
    localMessageCount: entity.localMessageCount ?? null,
    status: entity.status,
    lastSuccessfulSyncAt: entity.lastSuccessfulSyncAt?.toISOString() ?? null,
    lastAttemptedSyncAt: entity.lastAttemptedSyncAt?.toISOString() ?? null,
    lastFullResyncAt: entity.lastFullResyncAt?.toISOString() ?? null,
    lastError: entity.lastError ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function serializeLocalAttachment(
  entity: LocalAttachmentEntity,
): MessagingLocalAttachmentRecord {
  return {
    id: entity.id,
    attachmentId: entity.attachmentId,
    filename: entity.filename,
    contentType: entity.contentType,
    size: entity.size,
    contentId: entity.contentId ?? null,
    contentLocation: entity.contentLocation ?? null,
    inline: entity.inline,
    cachedBlobKey: entity.cachedBlobKey ?? null,
    cachedAt: entity.cachedAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function serializeLocalMessage(
  entity: LocalMessageEntity,
): MessagingLocalMessageRecord {
  return {
    id: entity.id,
    userId: entity.userId,
    mailbox: fromMailboxEnum(entity.mailbox),
    remotePath: entity.remotePath ?? null,
    uidValidity: entity.uidValidity,
    uid: entity.uid,
    messageId: entity.messageId ?? null,
    subject: entity.subject ?? null,
    fromLabel: entity.fromLabel ?? null,
    fromAddress: entity.fromAddress ?? null,
    toRecipients: parseParticipants(entity.toRecipients),
    ccRecipients: parseParticipants(entity.ccRecipients),
    bccRecipients: parseParticipants(entity.bccRecipients),
    replyToRecipients: parseParticipants(entity.replyToRecipients),
    internalDate: entity.internalDate?.toISOString() ?? null,
    sentAt: entity.sentAt?.toISOString() ?? null,
    seen: entity.seen,
    answered: entity.answered,
    flagged: entity.flagged,
    draft: entity.draft,
    hasAttachments: entity.hasAttachments,
    previewText: entity.previewText ?? null,
    normalizedText: entity.normalizedText ?? null,
    sanitizedHtml: entity.sanitizedHtml ?? null,
    bodyState: entity.bodyState,
    lastSyncedAt: entity.lastSyncedAt?.toISOString() ?? null,
    hydratedAt: entity.hydratedAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    attachments: entity.attachments.map(serializeLocalAttachment),
  };
}

function serializeLocalMessageSummary(
  entity: LocalMessageSummaryEntity,
): MessagingLocalMessageSummaryRecord {
  return {
    id: entity.id,
    userId: entity.userId,
    mailbox: fromMailboxEnum(entity.mailbox),
    remotePath: entity.remotePath ?? null,
    uidValidity: entity.uidValidity,
    uid: entity.uid,
    messageId: entity.messageId ?? null,
    subject: entity.subject ?? null,
    fromLabel: entity.fromLabel ?? null,
    fromAddress: entity.fromAddress ?? null,
    toRecipients: parseParticipants(entity.toRecipients),
    internalDate: entity.internalDate?.toISOString() ?? null,
    sentAt: entity.sentAt?.toISOString() ?? null,
    seen: entity.seen,
    hasAttachments: entity.hasAttachments,
    previewText: entity.previewText ?? null,
    bodyState: entity.bodyState,
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export async function getMessagingLocalSyncPreference(
  userId?: string,
): Promise<boolean> {
  const resolvedUserId = await resolveUserId(userId);
  const settings = await prisma.messagingSettings.findUnique({
    where: { userId: resolvedUserId },
    select: { localSyncEnabled: true },
  });
  return settings?.localSyncEnabled ?? false;
}

export async function setMessagingLocalSyncPreference(
  enabled: boolean,
  userId?: string,
): Promise<{ userId: string; localSyncEnabled: boolean }> {
  const resolvedUserId = await resolveUserId(userId);
  const settings = await prisma.messagingSettings.upsert({
    where: { userId: resolvedUserId },
    create: {
      userId: resolvedUserId,
      localSyncEnabled: enabled,
    },
    update: {
      localSyncEnabled: enabled,
    },
    select: {
      userId: true,
      localSyncEnabled: true,
    },
  });

  return {
    userId: settings.userId,
    localSyncEnabled: settings.localSyncEnabled,
  };
}

export async function getMessagingLocalSyncOverview(
  userId?: string,
): Promise<MessagingLocalSyncOverview> {
  const resolvedUserId = await resolveUserId(userId);
  const enabled = await getMessagingLocalSyncPreference(resolvedUserId);
  const serverEnabled = isMessagingLocalSyncServerEnabled();
  const active = enabled && serverEnabled;
  const states = await listMessagingMailboxLocalSyncStates(resolvedUserId);
  const statesByMailbox = new Map(
    states.map((state) => [state.mailbox, state]),
  );

  const mailboxes = MESSAGING_LOCAL_SYNC_MAILBOX_VALUES.map((mailbox) => {
    const state = statesByMailbox.get(mailbox);
    if (!state) {
      return {
        mailbox,
        status: PrismaMessagingLocalSyncStatus.DISABLED,
        readable: false,
        bootstrapComplete: false,
        backfillComplete: false,
        progressPercent: null,
        remotePath: null,
        uidValidity: null,
        localMessageCount: null,
        remoteMessageCount: null,
        lastSuccessfulSyncAt: null,
        lastAttemptedSyncAt: null,
        lastFullResyncAt: null,
        lastError: null,
      } satisfies MessagingLocalSyncMailboxOverview;
    }

    const readable = isMessagingMailboxLocalSyncReadable(state);
    const remoteMessageCount = state.remoteMessageCount;
    const localMessageCount = state.localMessageCount;
    const progressPercent =
      typeof remoteMessageCount !== "number"
        ? null
        : remoteMessageCount <= 0
          ? 100
          : Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((typeof localMessageCount === "number"
                    ? localMessageCount
                    : 0) /
                    remoteMessageCount) *
                    100,
                ),
              ),
            );
    const backfillComplete =
      Boolean(state.lastFullResyncAt) ||
      (typeof remoteMessageCount === "number" &&
        typeof localMessageCount === "number" &&
        localMessageCount >= remoteMessageCount);

    return {
      mailbox,
      status: state.status,
      readable,
      bootstrapComplete: readable || Boolean(state.lastSuccessfulSyncAt),
      backfillComplete,
      progressPercent,
      remotePath: state.remotePath,
      uidValidity: state.uidValidity,
      localMessageCount,
      remoteMessageCount,
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
      lastAttemptedSyncAt: state.lastAttemptedSyncAt,
      lastFullResyncAt: state.lastFullResyncAt,
      lastError: state.lastError,
    } satisfies MessagingLocalSyncMailboxOverview;
  });

  const lastSuccessfulSyncAt = mailboxes.reduce<string | null>(
    (currentLatest, mailbox) => {
      if (!mailbox.lastSuccessfulSyncAt) {
        return currentLatest;
      }
      if (!currentLatest) {
        return mailbox.lastSuccessfulSyncAt;
      }
      return new Date(mailbox.lastSuccessfulSyncAt).getTime() >
        new Date(currentLatest).getTime()
        ? mailbox.lastSuccessfulSyncAt
        : currentLatest;
    },
    null,
  );
  const anyReadable = mailboxes.some((mailbox) => mailbox.readable);
  const allReadable = mailboxes.every((mailbox) => mailbox.readable);
  const allBackfilled = mailboxes.every((mailbox) => mailbox.backfillComplete);
  const mode: MessagingLocalSyncMode = !active
    ? "live-imap"
    : allReadable && allBackfilled
      ? "local-ready"
      : anyReadable
        ? "local-partial"
        : "local-bootstrapping";

  return {
    enabled,
    serverEnabled,
    active,
    mode,
    anyReadable,
    allReadable,
    allBackfilled,
    lastSuccessfulSyncAt,
    mailboxes,
  };
}

export async function listMessagingMailboxLocalSyncStates(
  userId?: string,
): Promise<MessagingMailboxLocalSyncStateRecord[]> {
  const resolvedUserId = await resolveUserId(userId);
  const states = await prisma.messagingMailboxLocalSyncState.findMany({
    where: { userId: resolvedUserId },
    select: mailboxLocalSyncStateSelect,
    orderBy: { mailbox: "asc" },
  });
  return states.map(serializeMailboxLocalSyncState);
}

export async function getMessagingMailboxLocalSyncState(params: {
  mailbox: MessagingLocalSyncMailbox;
  userId?: string;
}): Promise<MessagingMailboxLocalSyncStateRecord | null> {
  const resolvedUserId = await resolveUserId(params.userId);
  const state = await prisma.messagingMailboxLocalSyncState.findUnique({
    where: {
      userId_mailbox: {
        userId: resolvedUserId,
        mailbox: toMailboxEnum(params.mailbox),
      },
    },
    select: mailboxLocalSyncStateSelect,
  });
  return state ? serializeMailboxLocalSyncState(state) : null;
}

export async function upsertMessagingMailboxLocalSyncState(
  input: UpsertMessagingMailboxLocalSyncStateInput,
): Promise<MessagingMailboxLocalSyncStateRecord> {
  const resolvedUserId = await resolveUserId(input.userId);
  const state = await prisma.messagingMailboxLocalSyncState.upsert({
    where: {
      userId_mailbox: {
        userId: resolvedUserId,
        mailbox: toMailboxEnum(input.mailbox),
      },
    },
    create: {
      userId: resolvedUserId,
      mailbox: toMailboxEnum(input.mailbox),
      remotePath: normalizeOptionalString(input.remotePath),
      uidValidity: input.uidValidity ?? null,
      lastKnownUidNext: input.lastKnownUidNext ?? null,
      lastSyncedUid: input.lastSyncedUid ?? null,
      lastBackfilledUid: input.lastBackfilledUid ?? null,
      remoteMessageCount: input.remoteMessageCount ?? null,
      localMessageCount: input.localMessageCount ?? null,
      status: input.status ?? PrismaMessagingLocalSyncStatus.DISABLED,
      lastSuccessfulSyncAt:
        normalizeOptionalDate(input.lastSuccessfulSyncAt) ?? null,
      lastAttemptedSyncAt:
        normalizeOptionalDate(input.lastAttemptedSyncAt) ?? null,
      lastFullResyncAt:
        normalizeOptionalDate(input.lastFullResyncAt) ?? null,
      lastError: normalizeOptionalString(input.lastError),
    },
    update: {
      ...(typeof input.remotePath !== "undefined"
        ? { remotePath: normalizeOptionalString(input.remotePath) }
        : {}),
      ...(typeof input.uidValidity !== "undefined"
        ? { uidValidity: input.uidValidity }
        : {}),
      ...(typeof input.lastKnownUidNext !== "undefined"
        ? { lastKnownUidNext: input.lastKnownUidNext }
        : {}),
      ...(typeof input.lastSyncedUid !== "undefined"
        ? { lastSyncedUid: input.lastSyncedUid }
        : {}),
      ...(typeof input.lastBackfilledUid !== "undefined"
        ? { lastBackfilledUid: input.lastBackfilledUid }
        : {}),
      ...(typeof input.remoteMessageCount !== "undefined"
        ? { remoteMessageCount: input.remoteMessageCount }
        : {}),
      ...(typeof input.localMessageCount !== "undefined"
        ? { localMessageCount: input.localMessageCount }
        : {}),
      ...(typeof input.status !== "undefined"
        ? { status: input.status }
        : {}),
      ...(typeof input.lastSuccessfulSyncAt !== "undefined"
        ? {
            lastSuccessfulSyncAt:
              normalizeOptionalDate(input.lastSuccessfulSyncAt) ?? null,
          }
        : {}),
      ...(typeof input.lastAttemptedSyncAt !== "undefined"
        ? {
            lastAttemptedSyncAt:
              normalizeOptionalDate(input.lastAttemptedSyncAt) ?? null,
          }
        : {}),
      ...(typeof input.lastFullResyncAt !== "undefined"
        ? {
            lastFullResyncAt:
              normalizeOptionalDate(input.lastFullResyncAt) ?? null,
          }
        : {}),
      ...(typeof input.lastError !== "undefined"
        ? { lastError: normalizeOptionalString(input.lastError) }
        : {}),
    },
    select: mailboxLocalSyncStateSelect,
  });

  return serializeMailboxLocalSyncState(state);
}

export async function deleteMessagingMailboxLocalSyncState(params: {
  mailbox: MessagingLocalSyncMailbox;
  userId?: string;
}): Promise<{ deleted: boolean }> {
  const resolvedUserId = await resolveUserId(params.userId);
  const deleted = await prisma.messagingMailboxLocalSyncState.deleteMany({
    where: {
      userId: resolvedUserId,
      mailbox: toMailboxEnum(params.mailbox),
    },
  });
  return { deleted: deleted.count > 0 };
}

export async function listMessagingLocalMessages(params: {
  mailbox: MessagingLocalSyncMailbox;
  userId?: string;
  page?: number;
  pageSize?: number;
  uidValidity?: number;
}): Promise<{
  items: MessagingLocalMessageRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const resolvedUserId = await resolveUserId(params.userId);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const where = {
    userId: resolvedUserId,
    mailbox: toMailboxEnum(params.mailbox),
    ...(typeof params.uidValidity === "number"
      ? {
          uidValidity: params.uidValidity,
        }
      : {}),
  } satisfies Prisma.MessagingLocalMessageWhereInput;

  const [items, total] = await Promise.all([
    prisma.messagingLocalMessage.findMany({
      where,
      select: localMessageSelect,
      orderBy: [
        { internalDate: "desc" },
        { uid: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.messagingLocalMessage.count({ where }),
  ]);

  return {
    items: items.map(serializeLocalMessage),
    total,
    page,
    pageSize,
  };
}

export async function listMessagingLocalMessageSummaries(params: {
  mailbox: MessagingLocalSyncMailbox;
  userId?: string;
  page?: number;
  pageSize?: number;
  uidValidity?: number;
}): Promise<{
  items: MessagingLocalMessageSummaryRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const resolvedUserId = await resolveUserId(params.userId);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const where = {
    userId: resolvedUserId,
    mailbox: toMailboxEnum(params.mailbox),
    ...(typeof params.uidValidity === "number"
      ? {
          uidValidity: params.uidValidity,
        }
      : {}),
  } satisfies Prisma.MessagingLocalMessageWhereInput;

  const [items, total] = await Promise.all([
    prisma.messagingLocalMessage.findMany({
      where,
      select: localMessageSummarySelect,
      orderBy: [
        { internalDate: "desc" },
        { uid: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.messagingLocalMessage.count({ where }),
  ]);

  return {
    items: items.map(serializeLocalMessageSummary),
    total,
    page,
    pageSize,
  };
}

export async function getMessagingLocalMessageByUid(params: {
  mailbox: MessagingLocalSyncMailbox;
  uid: number;
  userId?: string;
  uidValidity?: number;
}): Promise<MessagingLocalMessageRecord | null> {
  const resolvedUserId = await resolveUserId(params.userId);
  const resolvedUidValidity =
    typeof params.uidValidity === "number"
      ? params.uidValidity
      : (await getMessagingMailboxLocalSyncState({
          userId: resolvedUserId,
          mailbox: params.mailbox,
        }))?.uidValidity ?? null;

  const message =
    typeof resolvedUidValidity === "number"
      ? await prisma.messagingLocalMessage.findUnique({
          where: {
            userId_mailbox_uidValidity_uid: {
              userId: resolvedUserId,
              mailbox: toMailboxEnum(params.mailbox),
              uidValidity: resolvedUidValidity,
              uid: params.uid,
            },
          },
          select: localMessageSelect,
        })
      : await prisma.messagingLocalMessage.findFirst({
          where: {
            userId: resolvedUserId,
            mailbox: toMailboxEnum(params.mailbox),
            uid: params.uid,
          },
          select: localMessageSelect,
          orderBy: [
            { uidValidity: "desc" },
            { updatedAt: "desc" },
          ],
        });

  return message ? serializeLocalMessage(message) : null;
}

export async function getMessagingLocalAttachmentById(params: {
  mailbox: MessagingLocalSyncMailbox;
  uid: number;
  attachmentId: string;
  userId?: string;
  uidValidity?: number;
}): Promise<MessagingLocalAttachmentLookupRecord | null> {
  const resolvedUserId = await resolveUserId(params.userId);
  const resolvedAttachmentId = normalizeOptionalString(params.attachmentId);
  if (!resolvedAttachmentId) {
    return null;
  }

  const resolvedUidValidity =
    typeof params.uidValidity === "number"
      ? params.uidValidity
      : (await getMessagingMailboxLocalSyncState({
          userId: resolvedUserId,
          mailbox: params.mailbox,
        }))?.uidValidity ?? null;

  const attachment =
    typeof resolvedUidValidity === "number"
      ? await prisma.messagingLocalAttachment.findFirst({
          where: {
            attachmentId: resolvedAttachmentId,
            messageRecord: {
              userId: resolvedUserId,
              mailbox: toMailboxEnum(params.mailbox),
              uid: params.uid,
              uidValidity: resolvedUidValidity,
            },
          },
          select: {
            id: true,
            attachmentId: true,
            filename: true,
            contentType: true,
            size: true,
            contentId: true,
            contentLocation: true,
            inline: true,
            cachedBlobKey: true,
            cachedAt: true,
            messageRecord: {
              select: {
                userId: true,
                mailbox: true,
                uid: true,
                uidValidity: true,
              },
            },
          },
        })
      : await prisma.messagingLocalAttachment.findFirst({
          where: {
            attachmentId: resolvedAttachmentId,
            messageRecord: {
              userId: resolvedUserId,
              mailbox: toMailboxEnum(params.mailbox),
              uid: params.uid,
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            id: true,
            attachmentId: true,
            filename: true,
            contentType: true,
            size: true,
            contentId: true,
            contentLocation: true,
            inline: true,
            cachedBlobKey: true,
            cachedAt: true,
            messageRecord: {
              select: {
                userId: true,
                mailbox: true,
                uid: true,
                uidValidity: true,
              },
            },
          },
        });

  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    userId: attachment.messageRecord.userId,
    mailbox: fromMailboxEnum(attachment.messageRecord.mailbox),
    uid: attachment.messageRecord.uid,
    uidValidity: attachment.messageRecord.uidValidity,
    attachmentId: attachment.attachmentId,
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
    contentId: attachment.contentId ?? null,
    contentLocation: attachment.contentLocation ?? null,
    inline: attachment.inline,
    cachedBlobKey: attachment.cachedBlobKey ?? null,
    cachedAt: attachment.cachedAt?.toISOString() ?? null,
  };
}

export async function updateMessagingLocalAttachmentCache(params: {
  mailbox: MessagingLocalSyncMailbox;
  uid: number;
  attachmentId: string;
  userId?: string;
  uidValidity?: number;
  cachedBlobKey: string | null;
  cachedAt?: Date | string | null;
}): Promise<MessagingLocalAttachmentLookupRecord | null> {
  const attachment = await getMessagingLocalAttachmentById(params);
  if (!attachment) {
    return null;
  }

  const updated = await prisma.messagingLocalAttachment.update({
    where: {
      id: attachment.id,
    },
    data: {
      cachedBlobKey: normalizeOptionalString(params.cachedBlobKey),
      cachedAt: normalizeOptionalDate(params.cachedAt) ?? null,
    },
    select: {
      id: true,
      attachmentId: true,
      filename: true,
      contentType: true,
      size: true,
      contentId: true,
      contentLocation: true,
      inline: true,
      cachedBlobKey: true,
      cachedAt: true,
      messageRecord: {
        select: {
          userId: true,
          mailbox: true,
          uid: true,
          uidValidity: true,
        },
      },
    },
  });

  return {
    id: updated.id,
    userId: updated.messageRecord.userId,
    mailbox: fromMailboxEnum(updated.messageRecord.mailbox),
    uid: updated.messageRecord.uid,
    uidValidity: updated.messageRecord.uidValidity,
    attachmentId: updated.attachmentId,
    filename: updated.filename,
    contentType: updated.contentType,
    size: updated.size,
    contentId: updated.contentId ?? null,
    contentLocation: updated.contentLocation ?? null,
    inline: updated.inline,
    cachedBlobKey: updated.cachedBlobKey ?? null,
    cachedAt: updated.cachedAt?.toISOString() ?? null,
  };
}

type MessagingLocalSearchIdRow = {
  id: string;
  total_count: bigint | number | string;
};

function normalizeSearchResultTotal(
  value: bigint | number | string | undefined,
): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function reorderSearchResultsById<T extends { id: string }>(
  items: T[],
  orderedIds: string[],
): T[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return orderedIds
    .map((id) => itemsById.get(id) ?? null)
    .filter((item): item is T => Boolean(item));
}

async function searchMessagingLocalMessageIds(params: {
  mailbox: MessagingLocalSyncMailbox;
  query: string;
  userId: string;
  page: number;
  pageSize: number;
  uidValidity?: number;
}): Promise<{
  ids: string[];
  total: number;
}> {
  const terms = tokenizeMailboxSearchQuery(params.query);
  const filters = [
    Prisma.sql`"userId" = ${params.userId}`,
    Prisma.sql`"mailbox" = ${toMailboxEnum(params.mailbox)}`,
    ...(typeof params.uidValidity === "number"
      ? [Prisma.sql`"uidValidity" = ${params.uidValidity}`]
      : []),
  ];
  const exactPattern = `%${params.query}%`;
  const fallbackMatch =
    terms.length > 0
      ? Prisma.join(
          terms.map((term) =>
            Prisma.sql`COALESCE("searchText", '') ILIKE ${`%${term}%`}`,
          ),
          " AND ",
        )
      : Prisma.sql`FALSE`;
  const ftsMatch = Prisma.sql`
    to_tsvector('simple', COALESCE("searchText", '')) @@
    plainto_tsquery('simple', ${params.query})
  `;

  const rows = await prisma.$queryRaw<MessagingLocalSearchIdRow[]>(
    Prisma.sql`
      SELECT "id", COUNT(*) OVER() AS total_count
      FROM "MessagingLocalMessage"
      WHERE ${Prisma.join(filters, " AND ")}
        AND (${ftsMatch} OR (${fallbackMatch}))
      ORDER BY
        CASE WHEN ${ftsMatch} THEN 0 ELSE 1 END ASC,
        CASE
          WHEN COALESCE("subject", '') ILIKE ${exactPattern} THEN 0
          WHEN COALESCE("fromLabel", '') ILIKE ${exactPattern} THEN 1
          WHEN COALESCE("fromAddress", '') ILIKE ${exactPattern} THEN 2
          ELSE 3
        END ASC,
        COALESCE("internalDate", "sentAt", "updatedAt") DESC,
        "uid" DESC
      LIMIT ${params.pageSize}
      OFFSET ${(params.page - 1) * params.pageSize}
    `,
  );

  return {
    ids: rows.map((row) => row.id),
    total: normalizeSearchResultTotal(rows[0]?.total_count),
  };
}

export async function searchMessagingLocalMessages(params: {
  mailbox: MessagingLocalSyncMailbox;
  query: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  uidValidity?: number;
}): Promise<{
  items: MessagingLocalMessageRecord[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}> {
  const normalizedQuery = normalizeMailboxSearchQuery(params.query);
  if (!isMailboxSearchQueryUsable(normalizedQuery)) {
    throw new Error(
      "La recherche doit contenir au moins deux caractères.",
    );
  }

  const resolvedUserId = await resolveUserId(params.userId);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const { ids, total } = await searchMessagingLocalMessageIds({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    query: normalizedQuery,
    page,
    pageSize,
    uidValidity: params.uidValidity,
  });
  const items = ids.length
    ? reorderSearchResultsById(
        (
          await prisma.messagingLocalMessage.findMany({
            where: {
              id: {
                in: ids,
              },
            },
            select: localMessageSelect,
          })
        ).map(serializeLocalMessage),
        ids,
      )
    : [];

  return {
    items,
    total,
    page,
    pageSize,
    query: normalizedQuery,
  };
}

export async function searchMessagingLocalMessageSummaries(params: {
  mailbox: MessagingLocalSyncMailbox;
  query: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  uidValidity?: number;
}): Promise<{
  items: MessagingLocalMessageSummaryRecord[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}> {
  const normalizedQuery = normalizeMailboxSearchQuery(params.query);
  if (!isMailboxSearchQueryUsable(normalizedQuery)) {
    throw new Error(
      "La recherche doit contenir au moins deux caractères.",
    );
  }

  const resolvedUserId = await resolveUserId(params.userId);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(Math.max(1, params.pageSize ?? 20), 100);
  const { ids, total } = await searchMessagingLocalMessageIds({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    query: normalizedQuery,
    page,
    pageSize,
    uidValidity: params.uidValidity,
  });
  const items = ids.length
    ? reorderSearchResultsById(
        (
          await prisma.messagingLocalMessage.findMany({
            where: {
              id: {
                in: ids,
              },
            },
            select: localMessageSummarySelect,
          })
        ).map(serializeLocalMessageSummary),
        ids,
      )
    : [];

  return {
    items,
    total,
    page,
    pageSize,
    query: normalizedQuery,
  };
}

async function syncMessagingLocalMailboxMessageCount(
  mailbox: MessagingLocalSyncMailbox,
  userId: string,
): Promise<MessagingMailboxLocalSyncStateRecord | null> {
  const existingState = await getMessagingMailboxLocalSyncState({
    userId,
    mailbox,
  });
  if (!existingState) {
    return null;
  }

  const localMessageCount = await prisma.messagingLocalMessage.count({
    where: {
      userId,
      mailbox: toMailboxEnum(mailbox),
    },
  });

  return upsertMessagingMailboxLocalSyncState({
    userId,
    mailbox,
    localMessageCount,
  });
}

export async function markMessagingMailboxLocalSyncStateDegraded(params: {
  mailbox: MessagingLocalSyncMailbox;
  lastError: string;
  userId?: string;
  attemptedAt?: Date | string | null;
}): Promise<MessagingMailboxLocalSyncStateRecord | null> {
  if (!isMessagingLocalSyncServerEnabled()) {
    return null;
  }
  const resolvedUserId = await resolveUserId(params.userId);
  const existingState = await getMessagingMailboxLocalSyncState({
    userId: resolvedUserId,
    mailbox: params.mailbox,
  });
  if (!existingState) {
    return null;
  }

  return upsertMessagingMailboxLocalSyncState({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    status: PrismaMessagingLocalSyncStatus.DEGRADED,
    lastError: params.lastError,
    lastAttemptedSyncAt:
      normalizeOptionalDate(params.attemptedAt) ?? new Date(),
  });
}

export async function updateMessagingLocalMessageSeenState(params: {
  mailbox: MessagingLocalSyncMailbox;
  uid: number;
  seen: boolean;
  userId?: string;
  uidValidity?: number;
  syncedAt?: Date | string | null;
}): Promise<{
  updated: boolean;
  message: MessagingLocalMessageRecord | null;
}> {
  if (!isMessagingLocalSyncServerEnabled()) {
    return {
      updated: false,
      message: null,
    };
  }
  const resolvedUserId = await resolveUserId(params.userId);
  const existingMessage = await getMessagingLocalMessageByUid({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    uid: params.uid,
    uidValidity: params.uidValidity,
  });
  if (!existingMessage) {
    return {
      updated: false,
      message: null,
    };
  }

  const message = await upsertMessagingLocalMessage({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    uidValidity: existingMessage.uidValidity,
    uid: existingMessage.uid,
    seen: params.seen,
    ...(typeof params.syncedAt !== "undefined"
      ? { lastSyncedAt: params.syncedAt }
      : {}),
  });

  return {
    updated: true,
    message,
  };
}

export async function hydrateMessagingLocalMessageFromDetail(params: {
  mailbox: MessagingLocalSyncMailbox;
  uid: number;
  detail: MessageDetail;
  userId?: string;
  uidValidity?: number | null;
  remotePath?: string | null;
  existingMessage?: MessagingLocalMessageRecord | null;
  hydratedAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
}): Promise<MessagingLocalMessageRecord> {
  const resolvedUserId = await resolveUserId(params.userId);
  const existingMessage =
    params.existingMessage ??
    (await getMessagingLocalMessageByUid({
      userId: resolvedUserId,
      mailbox: params.mailbox,
      uid: params.uid,
      uidValidity: params.uidValidity ?? undefined,
    }));
  const resolvedUidValidity =
    params.uidValidity ??
    existingMessage?.uidValidity ??
    (
      await getMessagingMailboxLocalSyncState({
        userId: resolvedUserId,
        mailbox: params.mailbox,
      })
    )?.uidValidity;

  if (
    typeof resolvedUidValidity !== "number" ||
    !Number.isInteger(resolvedUidValidity) ||
    resolvedUidValidity <= 0
  ) {
    throw new Error(
      "UIDVALIDITY local introuvable pour hydrater ce message.",
    );
  }

  const existingAttachmentsById = new Map(
    (existingMessage?.attachments ?? []).map((attachment) => [
      attachment.attachmentId,
      attachment,
    ]),
  );
  const effectiveHydratedAt =
    normalizeOptionalDate(params.hydratedAt) ?? new Date();
  const effectiveLastSyncedAt =
    normalizeOptionalDate(params.lastSyncedAt) ?? effectiveHydratedAt;

  return upsertMessagingLocalMessage({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    remotePath:
      params.remotePath ??
      existingMessage?.remotePath ??
      null,
    uidValidity: resolvedUidValidity,
    uid: params.uid,
    messageId: params.detail.messageId,
    subject: params.detail.subject,
    fromLabel: params.detail.from,
    fromAddress: params.detail.fromAddress?.address ?? null,
    toRecipients: toLocalParticipants(params.detail.toAddresses),
    ccRecipients: toLocalParticipants(params.detail.ccAddresses),
    bccRecipients: toLocalParticipants(params.detail.bccAddresses),
    replyToRecipients: toLocalParticipants(params.detail.replyToAddresses),
    internalDate: params.detail.date,
    sentAt:
      existingMessage?.sentAt ??
      (params.mailbox === "sent" ? params.detail.date : null),
    seen: params.detail.seen,
    answered: existingMessage?.answered ?? false,
    flagged: existingMessage?.flagged ?? false,
    draft: existingMessage?.draft ?? false,
    hasAttachments: params.detail.attachments.length > 0,
    previewText: buildMessagingLocalPreviewText({
      text: params.detail.text,
      html: params.detail.html,
    }),
    normalizedText: params.detail.text,
    sanitizedHtml: params.detail.html,
    bodyState: deriveMessagingLocalBodyState({
      html: params.detail.html,
      text: params.detail.text,
    }),
    lastSyncedAt: effectiveLastSyncedAt,
    hydratedAt: effectiveHydratedAt,
    attachments: params.detail.attachments.map((attachment) => {
      const existingAttachment = existingAttachmentsById.get(
        attachment.id,
      );
      return {
        attachmentId: attachment.id,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        contentId: existingAttachment?.contentId ?? null,
        contentLocation: existingAttachment?.contentLocation ?? null,
        inline: existingAttachment?.inline ?? false,
        cachedBlobKey: existingAttachment?.cachedBlobKey ?? null,
        cachedAt: existingAttachment?.cachedAt ?? null,
      };
    }),
  });
}

export async function projectSentMailboxAppendToLocal(params: {
  sentAppendResult: SentMailboxAppendResult;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
  senderEmail: string;
  senderName?: string | null;
  sentAt?: Date | string | null;
  userId?: string;
}): Promise<MessagingLocalMessageRecord | null> {
  const resolvedUserId = await resolveUserId(params.userId);
  if (!isMessagingLocalSyncServerEnabled()) {
    return null;
  }
  const localSyncEnabled = await getMessagingLocalSyncPreference(
    resolvedUserId,
  );
  if (!localSyncEnabled) {
    return null;
  }

  const mailboxMessage = params.sentAppendResult.message;
  const uidValidity = params.sentAppendResult.uidValidity ?? null;
  if (
    !mailboxMessage ||
    typeof uidValidity !== "number" ||
    !Number.isInteger(uidValidity) ||
    uidValidity <= 0
  ) {
    return null;
  }

  const senderAddress = params.senderEmail.trim();
  if (!senderAddress.length) {
    return null;
  }
  const senderName = normalizeOptionalString(params.senderName);
  const senderLabel =
    senderName && senderAddress
      ? `${senderName} <${senderAddress}>`
      : senderAddress;
  const sentTimestamp =
    normalizeOptionalDate(params.sentAt) ??
    normalizeOptionalDate(mailboxMessage.date) ??
    new Date();

  const record = await upsertMessagingLocalMessage({
    userId: resolvedUserId,
    mailbox: "sent",
    remotePath: params.sentAppendResult.remotePath ?? null,
    uidValidity,
    uid: mailboxMessage.uid,
    messageId: mailboxMessage.messageId,
    subject: mailboxMessage.subject ?? params.subject,
    fromLabel: senderLabel,
    fromAddress: senderAddress,
    toRecipients: toLocalParticipantsFromAddressLabels(params.to),
    ccRecipients: toLocalParticipantsFromAddressLabels(params.cc),
    bccRecipients: toLocalParticipantsFromAddressLabels(params.bcc),
    replyToRecipients: [],
    internalDate: mailboxMessage.date ?? sentTimestamp,
    sentAt: sentTimestamp,
    seen: true,
    answered: false,
    flagged: false,
    draft: false,
    hasAttachments:
      mailboxMessage.hasAttachments ||
      Boolean(params.attachments?.length),
    previewText: buildMessagingLocalPreviewText({
      text: params.text,
      html: params.html,
    }),
    normalizedText: params.text,
    sanitizedHtml: params.html,
    bodyState: deriveMessagingLocalBodyState({
      html: params.html,
      text: params.text,
    }),
    lastSyncedAt: sentTimestamp,
    hydratedAt: sentTimestamp,
    ...(typeof params.attachments !== "undefined"
      ? {
          attachments: params.attachments.map(
            (attachment, index) => ({
              attachmentId: `sent-${mailboxMessage.uid}-${index}`,
              filename: attachment.filename,
              contentType:
                normalizeOptionalString(attachment.contentType) ??
                "application/octet-stream",
              size: attachment.content.byteLength,
            }),
          ),
        }
      : {}),
  });

  await syncMessagingLocalMailboxMessageCount("sent", resolvedUserId);
  return record;
}

export async function applyMessagingLocalMoveProjection(params: {
  mailbox: MessagingLocalSyncMailbox;
  target: MessagingLocalSyncMailbox;
  uid: number;
  targetUid?: number | null;
  targetUidValidity?: number | null;
  targetPath?: string | null;
  sourceUidValidity?: number | null;
  movedAt?: Date | string | null;
  userId?: string;
}): Promise<{
  moved: boolean;
  targetProjected: boolean;
  sourceMessage: MessagingLocalMessageRecord | null;
  targetMessage: MessagingLocalMessageRecord | null;
}> {
  const resolvedUserId = await resolveUserId(params.userId);
  if (!isMessagingLocalSyncServerEnabled()) {
    return {
      moved: false,
      targetProjected: false,
      sourceMessage: null,
      targetMessage: null,
    };
  }
  const localSyncEnabled = await getMessagingLocalSyncPreference(
    resolvedUserId,
  );
  if (!localSyncEnabled || params.mailbox === params.target) {
    return {
      moved: false,
      targetProjected: false,
      sourceMessage: null,
      targetMessage: null,
    };
  }

  const sourceMessage = await getMessagingLocalMessageByUid({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    uid: params.uid,
    uidValidity: params.sourceUidValidity ?? undefined,
  });
  if (!sourceMessage) {
    return {
      moved: false,
      targetProjected: false,
      sourceMessage: null,
      targetMessage: null,
    };
  }

  let targetMessage: MessagingLocalMessageRecord | null = null;
  const movedAt =
    normalizeOptionalDate(params.movedAt) ?? new Date();

  if (
    typeof params.targetUid === "number" &&
    Number.isInteger(params.targetUid) &&
    params.targetUid > 0 &&
    typeof params.targetUidValidity === "number" &&
    Number.isInteger(params.targetUidValidity) &&
    params.targetUidValidity > 0
  ) {
    targetMessage = await upsertMessagingLocalMessage({
      userId: resolvedUserId,
      mailbox: params.target,
      remotePath: params.targetPath ?? sourceMessage.remotePath,
      uidValidity: params.targetUidValidity,
      uid: params.targetUid,
      messageId: sourceMessage.messageId,
      subject: sourceMessage.subject,
      fromLabel: sourceMessage.fromLabel,
      fromAddress: sourceMessage.fromAddress,
      toRecipients: sourceMessage.toRecipients,
      ccRecipients: sourceMessage.ccRecipients,
      bccRecipients: sourceMessage.bccRecipients,
      replyToRecipients: sourceMessage.replyToRecipients,
      internalDate: sourceMessage.internalDate,
      sentAt: sourceMessage.sentAt,
      seen: sourceMessage.seen,
      answered: sourceMessage.answered,
      flagged: sourceMessage.flagged,
      draft: sourceMessage.draft,
      hasAttachments: sourceMessage.hasAttachments,
      previewText: sourceMessage.previewText,
      normalizedText: sourceMessage.normalizedText,
      sanitizedHtml: sourceMessage.sanitizedHtml,
      bodyState: sourceMessage.bodyState,
      lastSyncedAt: movedAt,
      hydratedAt: sourceMessage.hydratedAt,
      attachments: sourceMessage.attachments.map((attachment) => ({
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        contentId: attachment.contentId,
        contentLocation: attachment.contentLocation,
        inline: attachment.inline,
        cachedBlobKey: attachment.cachedBlobKey,
        cachedAt: attachment.cachedAt,
      })),
    });
  }

  await deleteMessagingLocalMessage({
    userId: resolvedUserId,
    mailbox: params.mailbox,
    uidValidity: sourceMessage.uidValidity,
    uid: sourceMessage.uid,
  });

  await Promise.all([
    syncMessagingLocalMailboxMessageCount(params.mailbox, resolvedUserId),
    targetMessage
      ? syncMessagingLocalMailboxMessageCount(
          params.target,
          resolvedUserId,
        )
      : Promise.resolve(null),
  ]);

  return {
    moved: true,
    targetProjected: Boolean(targetMessage),
    sourceMessage,
    targetMessage,
  };
}

export async function getMessagingLocalMessageByImapIdentity(params: {
  mailbox: MessagingLocalSyncMailbox;
  uidValidity: number;
  uid: number;
  userId?: string;
}): Promise<MessagingLocalMessageRecord | null> {
  const resolvedUserId = await resolveUserId(params.userId);
  const message = await prisma.messagingLocalMessage.findUnique({
    where: {
      userId_mailbox_uidValidity_uid: {
        userId: resolvedUserId,
        mailbox: toMailboxEnum(params.mailbox),
        uidValidity: params.uidValidity,
        uid: params.uid,
      },
    },
    select: localMessageSelect,
  });

  return message ? serializeLocalMessage(message) : null;
}

export async function upsertMessagingLocalMessage(
  input: UpsertMessagingLocalMessageInput,
): Promise<MessagingLocalMessageRecord> {
  const resolvedUserId = await resolveUserId(input.userId);
  const searchText = buildMessagingLocalMessageSearchText(input);
  const attachmentInputs = normalizeMessagingLocalAttachmentInputs(
    input.attachments,
  );
  const createData = {
    userId: resolvedUserId,
    mailbox: toMailboxEnum(input.mailbox),
    remotePath: normalizeOptionalString(input.remotePath),
    uidValidity: input.uidValidity,
    uid: input.uid,
    messageId: normalizeOptionalString(input.messageId),
    subject: normalizeOptionalString(input.subject),
    fromLabel: normalizeOptionalString(input.fromLabel),
    fromAddress: normalizeOptionalString(input.fromAddress),
    toRecipients: normalizeParticipants(input.toRecipients),
    ccRecipients: normalizeParticipants(input.ccRecipients),
    bccRecipients: normalizeParticipants(input.bccRecipients),
    replyToRecipients: normalizeParticipants(input.replyToRecipients),
    internalDate: normalizeOptionalDate(input.internalDate) ?? null,
    sentAt: normalizeOptionalDate(input.sentAt) ?? null,
    seen: input.seen ?? false,
    answered: input.answered ?? false,
    flagged: input.flagged ?? false,
    draft: input.draft ?? false,
    hasAttachments: input.hasAttachments ?? false,
    previewText: normalizeOptionalString(input.previewText),
    normalizedText: normalizeOptionalString(input.normalizedText),
    sanitizedHtml: normalizeOptionalString(input.sanitizedHtml),
    searchText,
    bodyState: input.bodyState ?? PrismaMessagingLocalBodyState.NONE,
    lastSyncedAt: normalizeOptionalDate(input.lastSyncedAt) ?? null,
    hydratedAt: normalizeOptionalDate(input.hydratedAt) ?? null,
  } satisfies Prisma.MessagingLocalMessageUncheckedCreateInput;
  const updateData = {
    ...(typeof input.remotePath !== "undefined"
      ? { remotePath: normalizeOptionalString(input.remotePath) }
      : {}),
    ...(typeof input.messageId !== "undefined"
      ? { messageId: normalizeOptionalString(input.messageId) }
      : {}),
    ...(typeof input.subject !== "undefined"
      ? { subject: normalizeOptionalString(input.subject) }
      : {}),
    ...(typeof input.fromLabel !== "undefined"
      ? { fromLabel: normalizeOptionalString(input.fromLabel) }
      : {}),
    ...(typeof input.fromAddress !== "undefined"
      ? { fromAddress: normalizeOptionalString(input.fromAddress) }
      : {}),
    ...(typeof input.toRecipients !== "undefined"
      ? { toRecipients: normalizeParticipants(input.toRecipients) }
      : {}),
    ...(typeof input.ccRecipients !== "undefined"
      ? { ccRecipients: normalizeParticipants(input.ccRecipients) }
      : {}),
    ...(typeof input.bccRecipients !== "undefined"
      ? { bccRecipients: normalizeParticipants(input.bccRecipients) }
      : {}),
    ...(typeof input.replyToRecipients !== "undefined"
      ? { replyToRecipients: normalizeParticipants(input.replyToRecipients) }
      : {}),
    ...(typeof input.internalDate !== "undefined"
      ? { internalDate: normalizeOptionalDate(input.internalDate) ?? null }
      : {}),
    ...(typeof input.sentAt !== "undefined"
      ? { sentAt: normalizeOptionalDate(input.sentAt) ?? null }
      : {}),
    ...(typeof input.seen !== "undefined" ? { seen: input.seen } : {}),
    ...(typeof input.answered !== "undefined"
      ? { answered: input.answered }
      : {}),
    ...(typeof input.flagged !== "undefined" ? { flagged: input.flagged } : {}),
    ...(typeof input.draft !== "undefined" ? { draft: input.draft } : {}),
    ...(typeof input.hasAttachments !== "undefined"
      ? { hasAttachments: input.hasAttachments }
      : {}),
    ...(typeof input.previewText !== "undefined"
      ? { previewText: normalizeOptionalString(input.previewText) }
      : {}),
    ...(typeof input.normalizedText !== "undefined"
      ? { normalizedText: normalizeOptionalString(input.normalizedText) }
      : {}),
    ...(typeof input.sanitizedHtml !== "undefined"
      ? { sanitizedHtml: normalizeOptionalString(input.sanitizedHtml) }
      : {}),
    ...(typeof input.searchText !== "undefined" ||
    typeof input.subject !== "undefined" ||
    typeof input.fromLabel !== "undefined" ||
    typeof input.fromAddress !== "undefined" ||
    typeof input.toRecipients !== "undefined" ||
    typeof input.ccRecipients !== "undefined" ||
    typeof input.bccRecipients !== "undefined" ||
    typeof input.replyToRecipients !== "undefined" ||
    typeof input.previewText !== "undefined" ||
    typeof input.normalizedText !== "undefined"
      ? { searchText }
      : {}),
    ...(typeof input.bodyState !== "undefined"
      ? { bodyState: input.bodyState }
      : {}),
    ...(typeof input.lastSyncedAt !== "undefined"
      ? { lastSyncedAt: normalizeOptionalDate(input.lastSyncedAt) ?? null }
      : {}),
    ...(typeof input.hydratedAt !== "undefined"
      ? { hydratedAt: normalizeOptionalDate(input.hydratedAt) ?? null }
      : {}),
  } satisfies Prisma.MessagingLocalMessageUncheckedUpdateInput;

  const message = await prisma.$transaction(async (tx) => {
    const message = await tx.messagingLocalMessage.upsert({
      where: {
        userId_mailbox_uidValidity_uid: {
          userId: resolvedUserId,
          mailbox: toMailboxEnum(input.mailbox),
          uidValidity: input.uidValidity,
          uid: input.uid,
        },
      },
      create: createData,
      update: updateData,
      select: { id: true },
    });

    if (attachmentInputs) {
      await tx.messagingLocalAttachment.deleteMany({
        where: { messageRecordId: message.id },
      });

      if (attachmentInputs.length > 0) {
        await tx.messagingLocalAttachment.createMany({
          data: attachmentInputs.map((attachment) => ({
            messageRecordId: message.id,
            attachmentId: attachment.attachmentId,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size,
            contentId: attachment.contentId,
            contentLocation: attachment.contentLocation,
            inline: attachment.inline,
            cachedBlobKey: attachment.cachedBlobKey,
            cachedAt: attachment.cachedAt,
          })),
          skipDuplicates: true,
        });
      }
    }

    return message;
  }, {
    timeout: MESSAGING_LOCAL_MESSAGE_UPSERT_TRANSACTION_TIMEOUT_MS,
  });

  const hydrated = await prisma.messagingLocalMessage.findUniqueOrThrow({
    where: { id: message.id },
    select: localMessageSelect,
  });

  return serializeLocalMessage(hydrated);
}

export async function deleteMessagingLocalMessage(params: {
  mailbox: MessagingLocalSyncMailbox;
  uidValidity: number;
  uid: number;
  userId?: string;
}): Promise<{ deleted: boolean }> {
  const resolvedUserId = await resolveUserId(params.userId);
  const deleted = await prisma.messagingLocalMessage.deleteMany({
    where: {
      userId: resolvedUserId,
      mailbox: toMailboxEnum(params.mailbox),
      uidValidity: params.uidValidity,
      uid: params.uid,
    },
  });

  return { deleted: deleted.count > 0 };
}

export async function clearMessagingLocalMailboxMessages(params: {
  mailbox: MessagingLocalSyncMailbox;
  userId?: string;
}): Promise<{ deletedCount: number }> {
  const resolvedUserId = await resolveUserId(params.userId);
  const deleted = await prisma.messagingLocalMessage.deleteMany({
    where: {
      userId: resolvedUserId,
      mailbox: toMailboxEnum(params.mailbox),
    },
  });

  return { deletedCount: deleted.count };
}

export async function purgeMessagingLocalSyncData(params: {
  userId?: string;
  mailboxes?: MessagingLocalSyncMailbox[];
} = {}): Promise<{
  userId: string;
  mailboxes: MessagingLocalSyncMailbox[];
  deletedMessages: number;
  deletedStates: number;
}> {
  const resolvedUserId = await resolveUserId(params.userId);
  const normalizedMailboxes = params.mailboxes?.length
    ? Array.from(new Set(params.mailboxes))
    : [...MESSAGING_LOCAL_SYNC_MAILBOX_VALUES];
  const mailboxFilter = normalizedMailboxes.length
    ? {
        mailbox: {
          in: normalizedMailboxes.map((mailbox) => toMailboxEnum(mailbox)),
        },
      }
    : undefined;

  const [deletedMessages, deletedStates] = await prisma.$transaction(async (tx) =>
    Promise.all([
      tx.messagingLocalMessage.deleteMany({
        where: {
          userId: resolvedUserId,
          ...mailboxFilter,
        },
      }),
      tx.messagingMailboxLocalSyncState.deleteMany({
        where: {
          userId: resolvedUserId,
          ...mailboxFilter,
        },
      }),
    ]),
  );

  return {
    userId: resolvedUserId,
    mailboxes: normalizedMailboxes,
    deletedMessages: deletedMessages.count,
    deletedStates: deletedStates.count,
  };
}

const MESSAGING_LOCAL_SYNC_RECENT_WINDOW_DEFAULT = 75;
const MESSAGING_LOCAL_SYNC_RECENT_WINDOW_MIN = 1;
const MESSAGING_LOCAL_SYNC_RECENT_WINDOW_MAX = 200;
const MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_DEFAULT = 150;
const MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_MIN = 0;
const MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_MAX = 500;
const MESSAGING_LOCAL_SYNC_PRIORITY_BACKFILL_BATCH_DEFAULT = 500;
const MESSAGING_LOCAL_SYNC_SEARCH_PRIORITY_MAILBOXES = [
  "inbox",
  "sent",
] as const satisfies readonly MessagingLocalSyncMailbox[];
const MESSAGING_LOCAL_SYNC_SEARCH_PRIORITY_MAILBOX_SET =
  new Set<MessagingLocalSyncMailbox>(
    MESSAGING_LOCAL_SYNC_SEARCH_PRIORITY_MAILBOXES,
  );

export const MESSAGING_LOCAL_SYNC_POLICY = {
  recentWindowSizeDefault: MESSAGING_LOCAL_SYNC_RECENT_WINDOW_DEFAULT,
  recentWindowSizeMax: MESSAGING_LOCAL_SYNC_RECENT_WINDOW_MAX,
  backfillBatchSizeDefault: MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_DEFAULT,
  backfillBatchSizeMax: MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_MAX,
  priorityBackfillBatchSizeDefault:
    MESSAGING_LOCAL_SYNC_PRIORITY_BACKFILL_BATCH_DEFAULT,
  searchPriorityMailboxes: MESSAGING_LOCAL_SYNC_SEARCH_PRIORITY_MAILBOXES,
  storesAttachmentBinaries: false,
  storesRawMime: false,
  storesSanitizedHtml: true,
  storesNormalizedText: true,
  fullBackfillStrategy: "oldest-uid-batch",
} as const;

type MessagingLocalSyncRemoteMessage = {
  uid: number;
  envelope: MessageEnvelopeObject | null;
  internalDate: Date | string | null;
  flags: Set<string> | null;
};

type MessagingLocalSyncHydrationMode = "full" | "search-only";

export type MessagingLocalSyncErrorEntry = {
  uid: number | null;
  message: string;
};

type MessagingMailboxLocalSyncRuntime = {
  resolveUserId: (userId?: string) => Promise<string>;
  getMessagingCredentials: typeof getMessagingCredentials;
  withImapClient: <T>(
    config: ImapConnectionConfig,
    fn: (client: ImapFlow) => Promise<T>,
  ) => Promise<T>;
  openMailbox: typeof openMailbox;
  getMailboxCacheKey: typeof getMailboxCacheKey;
  fetchRawMessages: (
    client: ImapFlow,
    uids: number[],
  ) => Promise<Map<number, PrefetchedRawMessage>>;
  parseFetchedMailboxMessage: typeof parseFetchedMailboxMessage;
  now: () => Date;
};

const defaultMessagingMailboxLocalSyncRuntime: MessagingMailboxLocalSyncRuntime =
  {
    resolveUserId,
    getMessagingCredentials,
    withImapClient,
    openMailbox,
    getMailboxCacheKey,
    fetchRawMessages,
    parseFetchedMailboxMessage,
    now: () => new Date(),
  };

export type SyncMessagingMailboxToLocalOptions = {
  userId?: string;
  mailbox: MessagingLocalSyncMailbox;
  recentWindowSize?: number;
  bootstrapWindowSize?: number;
  backfillBatchSize?: number;
  includeBackfill?: boolean;
  continuePriorityBackfill?: boolean;
};

export type MessagingMailboxLocalSyncResult = {
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  remotePath: string;
  uidValidity: number;
  lastKnownUidNext: number | null;
  remoteMessageCount: number;
  localMessageCount: number;
  recentWindowSize: number;
  backfillBatchSize: number;
  fetchedCount: number;
  recentFetchedCount: number;
  recentSyncedCount: number;
  backfillFetchedCount: number;
  backfillSyncedCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncedUid: number | null;
  lastBackfilledUid: number | null;
  bootstrapComplete: boolean;
  backfillComplete: boolean;
  status: MessagingLocalSyncStatus;
  errors: MessagingLocalSyncErrorEntry[];
};

export type SyncMessagingMailboxesToLocalOptions = Omit<
  SyncMessagingMailboxToLocalOptions,
  "mailbox"
> & {
  mailboxes?: MessagingLocalSyncMailbox[];
};

export type MessagingMailboxesLocalSyncResult = {
  userId: string;
  results: MessagingMailboxLocalSyncResult[];
  failures: Array<{
    mailbox: MessagingLocalSyncMailbox;
    message: string;
  }>;
  states: MessagingMailboxLocalSyncStateRecord[];
};

function normalizeRecentWindowSize(
  recentWindowSize?: number,
  bootstrapWindowSize?: number,
): number {
  const value =
    typeof recentWindowSize === "number"
      ? recentWindowSize
      : bootstrapWindowSize;
  if (!Number.isFinite(value)) {
    return MESSAGING_LOCAL_SYNC_RECENT_WINDOW_DEFAULT;
  }
  return Math.min(
    Math.max(
      Math.trunc(value ?? MESSAGING_LOCAL_SYNC_RECENT_WINDOW_DEFAULT),
      MESSAGING_LOCAL_SYNC_RECENT_WINDOW_MIN,
    ),
    MESSAGING_LOCAL_SYNC_RECENT_WINDOW_MAX,
  );
}

function normalizeBackfillBatchSize(value?: number): number {
  if (!Number.isFinite(value)) {
    return MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_DEFAULT;
  }
  return Math.min(
    Math.max(
      Math.trunc(value ?? MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_DEFAULT),
      MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_MIN,
    ),
    MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_MAX,
  );
}

function isSearchPriorityMailbox(mailbox: MessagingLocalSyncMailbox): boolean {
  return MESSAGING_LOCAL_SYNC_SEARCH_PRIORITY_MAILBOX_SET.has(mailbox);
}

function resolveBackfillBatchSize(
  mailbox: MessagingLocalSyncMailbox,
  value?: number,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeBackfillBatchSize(value);
  }
  return isSearchPriorityMailbox(mailbox)
    ? MESSAGING_LOCAL_SYNC_PRIORITY_BACKFILL_BATCH_DEFAULT
    : MESSAGING_LOCAL_SYNC_BACKFILL_BATCH_DEFAULT;
}

export function isMessagingMailboxLocalSyncReadable(
  value:
    | MessagingLocalSyncStatus
    | Pick<MessagingMailboxLocalSyncStateRecord, "status">,
): boolean {
  const status = typeof value === "string" ? value : value.status;
  return (
    status === PrismaMessagingLocalSyncStatus.READY ||
    status === PrismaMessagingLocalSyncStatus.DEGRADED
  );
}

function formatLocalSyncErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? "Erreur inconnue.");
}

function summarizeLocalSyncErrors(
  errors: MessagingLocalSyncErrorEntry[],
): string | null {
  if (!errors.length) {
    return null;
  }
  const preview = errors
    .slice(0, 3)
    .map((entry) =>
      entry.uid === null
        ? entry.message
        : `UID ${entry.uid}: ${entry.message}`,
    )
    .join(" | ");
  if (errors.length <= 3) {
    return preview;
  }
  return `${preview} | ${errors.length - 3} autre(s) erreur(s).`;
}

function formatMessagingLocalParticipantLabel(
  participant: MessagingLocalParticipant,
): string | null {
  const name = normalizeOptionalString(participant.name);
  const address = normalizeOptionalString(participant.address);
  if (name && address) {
    return `${name} <${address}>`;
  }
  return address ?? name;
}

function toLocalParticipants(
  participants: Array<{ name: string | null; address: string | null }>,
): MessagingLocalParticipant[] {
  return participants.map((participant) => {
    const localParticipant = {
      name: participant.name,
      address: participant.address,
    } satisfies MessagingLocalParticipant;
    return {
      ...localParticipant,
      label: formatMessagingLocalParticipantLabel(localParticipant),
    };
  });
}

function deriveMessagingLocalBodyState(params: {
  html: string | null;
  text: string | null;
}): MessagingLocalBodyState {
  if (params.html) {
    return PrismaMessagingLocalBodyState.HTML_READY;
  }
  if (params.text) {
    return PrismaMessagingLocalBodyState.TEXT_READY;
  }
  return PrismaMessagingLocalBodyState.NONE;
}

function normalizeImapCounterValue(
  value: number | bigint | null | undefined,
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }
  return null;
}

function minNumber(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return filtered.length ? Math.min(...filtered) : null;
}

function maxNumber(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return filtered.length ? Math.max(...filtered) : null;
}

async function countMessagingLocalMessagesForUidValidity(params: {
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  uidValidity: number;
}): Promise<number> {
  return prisma.messagingLocalMessage.count({
    where: {
      userId: params.userId,
      mailbox: toMailboxEnum(params.mailbox),
      uidValidity: params.uidValidity,
    },
  });
}

async function fetchMailboxMessagesBySequenceWindow(
  client: ImapFlow,
  recentWindowSize: number,
  remoteMessageCount: number,
): Promise<MessagingLocalSyncRemoteMessage[]> {
  if (remoteMessageCount <= 0) {
    return [];
  }

  const endSeq = Math.max(1, remoteMessageCount);
  const startSeq = Math.max(1, endSeq - recentWindowSize + 1);
  const range = `${startSeq}:${endSeq}`;
  const messages: MessagingLocalSyncRemoteMessage[] = [];

  for await (const message of client.fetch(range, {
    envelope: true,
    internalDate: true,
    flags: true,
  })) {
    const uid = typeof message.uid === "number" ? message.uid : NaN;
    if (!Number.isFinite(uid) || uid <= 0) {
      continue;
    }

    messages.push({
      uid,
      envelope:
        "envelope" in message && message.envelope
          ? (message.envelope as MessageEnvelopeObject)
          : null,
      internalDate:
        "internalDate" in message ? message.internalDate ?? null : null,
      flags:
        "flags" in message && message.flags instanceof Set
          ? message.flags
          : null,
    });
  }

  messages.sort((a, b) => b.uid - a.uid);
  return messages;
}

async function fetchMailboxMessagesByUidRange(
  client: ImapFlow,
  startUid: number,
  endUid: number,
): Promise<MessagingLocalSyncRemoteMessage[]> {
  if (endUid < startUid || endUid <= 0) {
    return [];
  }

  const range = { uid: `${Math.max(1, startUid)}:${endUid}` };
  const messages: MessagingLocalSyncRemoteMessage[] = [];

  for await (const message of client.fetch(range, {
    envelope: true,
    internalDate: true,
    flags: true,
  })) {
    const uid = typeof message.uid === "number" ? message.uid : NaN;
    if (!Number.isFinite(uid) || uid <= 0) {
      continue;
    }

    messages.push({
      uid,
      envelope:
        "envelope" in message && message.envelope
          ? (message.envelope as MessageEnvelopeObject)
          : null,
      internalDate:
        "internalDate" in message ? message.internalDate ?? null : null,
      flags:
        "flags" in message && message.flags instanceof Set
          ? message.flags
          : null,
    });
  }

  messages.sort((a, b) => b.uid - a.uid);
  return messages;
}

async function syncRemoteMailboxMessages(params: {
  userId: string;
  mailbox: MessagingLocalSyncMailbox;
  remotePath: string;
  uidValidity: number;
  remoteMessages: MessagingLocalSyncRemoteMessage[];
  attemptStartedAt: Date;
  runtime: MessagingMailboxLocalSyncRuntime;
  client: ImapFlow;
  hydrationMode: MessagingLocalSyncHydrationMode;
}): Promise<{
  syncedMessages: MessagingLocalMessageRecord[];
  errors: MessagingLocalSyncErrorEntry[];
}> {
  const prefetchedMessages = await params.runtime.fetchRawMessages(
    params.client,
    params.remoteMessages.map((message) => message.uid),
  );
  const syncedMessages: MessagingLocalMessageRecord[] = [];
  const errors: MessagingLocalSyncErrorEntry[] = [];
  const existingHydrationByUid =
    params.hydrationMode === "search-only" && params.remoteMessages.length
      ? new Map(
          (
            await prisma.messagingLocalMessage.findMany({
              where: {
                userId: params.userId,
                mailbox: toMailboxEnum(params.mailbox),
                uidValidity: params.uidValidity,
                uid: {
                  in: params.remoteMessages.map((message) => message.uid),
                },
              },
              select: {
                uid: true,
                sanitizedHtml: true,
                bodyState: true,
                hydratedAt: true,
              },
            })
          ).map((message) => [message.uid, message]),
        )
      : null;

  for (const remoteMessage of params.remoteMessages) {
    const prefetched = prefetchedMessages.get(remoteMessage.uid);
    if (!prefetched?.source) {
      errors.push({
        uid: remoteMessage.uid,
        message: "Source IMAP introuvable pour ce message.",
      });
      continue;
    }

    const envelope = prefetched.envelope ?? remoteMessage.envelope;
    if (!envelope) {
      errors.push({
        uid: remoteMessage.uid,
        message: "Enveloppe IMAP introuvable pour ce message.",
      });
      continue;
    }

    try {
      const parsedMessage = await params.runtime.parseFetchedMailboxMessage({
        mailbox: params.mailbox,
        uid: remoteMessage.uid,
        source: prefetched.source,
        envelope,
        internalDate:
          prefetched.internalDate ?? remoteMessage.internalDate ?? null,
        flags: remoteMessage.flags,
      });
      const existingHydration = existingHydrationByUid?.get(remoteMessage.uid);
      const storedHtml =
        params.hydrationMode === "full"
          ? parsedMessage.html
          : existingHydration?.sanitizedHtml ?? null;
      const storedBodyState =
        params.hydrationMode === "full"
          ? deriveMessagingLocalBodyState({
              html: storedHtml,
              text: parsedMessage.text,
            })
          : existingHydration?.bodyState ===
              PrismaMessagingLocalBodyState.HTML_READY
            ? existingHydration.bodyState
            : deriveMessagingLocalBodyState({
                html: storedHtml,
                text: parsedMessage.text,
              });
      const storedHydratedAt =
        params.hydrationMode === "full"
          ? parsedMessage.html || parsedMessage.text
            ? params.attemptStartedAt
            : null
          : existingHydration?.hydratedAt ??
            (parsedMessage.text ? params.attemptStartedAt : null);
      const storedMessage = await upsertMessagingLocalMessage({
        userId: params.userId,
        mailbox: params.mailbox,
        remotePath: params.remotePath,
        uidValidity: params.uidValidity,
        uid: remoteMessage.uid,
        messageId: parsedMessage.messageId,
        subject: parsedMessage.subject,
        fromLabel: parsedMessage.from,
        fromAddress: parsedMessage.fromAddress?.address ?? null,
        toRecipients: toLocalParticipants(parsedMessage.toAddresses),
        ccRecipients: toLocalParticipants(parsedMessage.ccAddresses),
        bccRecipients: toLocalParticipants(parsedMessage.bccAddresses),
        replyToRecipients: toLocalParticipants(
          parsedMessage.replyToAddresses,
        ),
        internalDate: parsedMessage.date,
        sentAt: parsedMessage.sentAt,
        seen: parsedMessage.seen,
        answered: parsedMessage.answered,
        flagged: parsedMessage.flagged,
        draft: parsedMessage.draft,
        hasAttachments: parsedMessage.attachments.length > 0,
        previewText: parsedMessage.previewText,
        normalizedText: parsedMessage.text,
        sanitizedHtml: storedHtml,
        bodyState: storedBodyState,
        lastSyncedAt: params.attemptStartedAt,
        hydratedAt: storedHydratedAt,
        attachments: parsedMessage.attachments.map((attachment) => ({
          attachmentId: attachment.id,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          contentId: attachment.contentId,
          contentLocation: attachment.contentLocation,
          inline: attachment.inline,
        })),
      });
      syncedMessages.push(storedMessage);
    } catch (error) {
      errors.push({
        uid: remoteMessage.uid,
        message: formatLocalSyncErrorMessage(error),
      });
    }
  }

  return {
    syncedMessages,
    errors,
  };
}

async function syncMessagingMailboxToLocalWithRuntime(
  options: SyncMessagingMailboxToLocalOptions,
  runtime: MessagingMailboxLocalSyncRuntime,
): Promise<MessagingMailboxLocalSyncResult> {
  const mailbox = options.mailbox;
  const userId = await runtime.resolveUserId(options.userId);
  const recentWindowSize = normalizeRecentWindowSize(
    options.recentWindowSize,
    options.bootstrapWindowSize,
  );
  const backfillBatchSize = resolveBackfillBatchSize(
    mailbox,
    options.backfillBatchSize,
  );
  const includeBackfill = options.includeBackfill !== false;
  const continuePriorityBackfill =
    options.continuePriorityBackfill === true &&
    isSearchPriorityMailbox(mailbox);
  const attemptStartedAt = runtime.now();
  let existingState = await getMessagingMailboxLocalSyncState({
    userId,
    mailbox,
  });
  const hadReadableLocalState = existingState
    ? isMessagingMailboxLocalSyncReadable(existingState)
    : false;

  await upsertMessagingMailboxLocalSyncState({
    userId,
    mailbox,
    status: hadReadableLocalState
      ? existingState?.status
      : PrismaMessagingLocalSyncStatus.BOOTSTRAPPING,
    lastAttemptedSyncAt: attemptStartedAt,
    lastError: null,
  });

  try {
    const credentials = await runtime.getMessagingCredentials(userId);
    if (!credentials.imap) {
      throw new Error(
        "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
      );
    }

    return runtime.withImapClient(credentials.imap, async (client) => {
      const opened = await runtime.openMailbox(client, mailbox, true, {
        cacheKey: runtime.getMailboxCacheKey(credentials.imap!, mailbox),
      });

      try {
        const uidValidity = normalizeImapCounterValue(opened.info.uidValidity);
        if (
          uidValidity === null ||
          !Number.isInteger(uidValidity) ||
          uidValidity <= 0
        ) {
          throw new Error("UIDVALIDITY IMAP introuvable pour cette boîte.");
        }

        if (
          existingState?.uidValidity &&
          existingState.uidValidity !== uidValidity
        ) {
          await clearMessagingLocalMailboxMessages({
            userId,
            mailbox,
          });
          await deleteMessagingMailboxLocalSyncState({
            userId,
            mailbox,
          });
          existingState = null;
        }

        const remoteMessageCount = opened.info.exists ?? 0;
        const lastKnownUidNext = normalizeImapCounterValue(opened.info.uidNext);
        const shouldUseIncrementalDelta =
          !includeBackfill &&
          hadReadableLocalState &&
          existingState?.uidValidity === uidValidity &&
          typeof existingState.lastKnownUidNext === "number" &&
          existingState.lastKnownUidNext > 0 &&
          lastKnownUidNext !== null &&
          lastKnownUidNext >= existingState.lastKnownUidNext;
        const recentMessages = shouldUseIncrementalDelta
          ? await fetchMailboxMessagesByUidRange(
              client,
              existingState!.lastKnownUidNext!,
              lastKnownUidNext - 1,
            )
          : await fetchMailboxMessagesBySequenceWindow(
              client,
              recentWindowSize,
              remoteMessageCount,
            );
        const recentSync = await syncRemoteMailboxMessages({
          userId,
          mailbox,
          remotePath: opened.name,
          uidValidity,
          remoteMessages: recentMessages,
          attemptStartedAt,
          runtime,
          client,
          hydrationMode: "full",
        });
        const bootstrapComplete =
          remoteMessageCount === 0 ||
          recentMessages.length === recentSync.syncedMessages.length;

        const oldestRecentFetchedUid = minNumber(
          recentMessages.map((message) => message.uid),
        );
        let backfillMessages: MessagingLocalSyncRemoteMessage[] = [];
        let backfillSync = {
          syncedMessages: [] as MessagingLocalMessageRecord[],
          errors: [] as MessagingLocalSyncErrorEntry[],
        };

        const priorBackfillCursor =
          existingState?.uidValidity === uidValidity
            ? existingState.lastBackfilledUid
            : null;
        const backfillCursorBase =
          priorBackfillCursor === null
            ? oldestRecentFetchedUid
            : minNumber([priorBackfillCursor, oldestRecentFetchedUid]);
        const backfillUpperUid =
          bootstrapComplete &&
          (includeBackfill || continuePriorityBackfill) &&
          backfillBatchSize > 0 &&
          remoteMessageCount > recentWindowSize &&
          backfillCursorBase !== null
            ? backfillCursorBase - 1
            : null;

        if (
          bootstrapComplete &&
          backfillUpperUid !== null &&
          backfillUpperUid > 0
        ) {
          const backfillStartUid = Math.max(
            1,
            backfillUpperUid - backfillBatchSize + 1,
          );
          backfillMessages = await fetchMailboxMessagesByUidRange(
            client,
            backfillStartUid,
            backfillUpperUid,
          );
          backfillSync = await syncRemoteMailboxMessages({
            userId,
            mailbox,
            remotePath: opened.name,
            uidValidity,
            remoteMessages: backfillMessages,
            attemptStartedAt,
            runtime,
            client,
            hydrationMode: "search-only",
          });
        }

        const errors = [
          ...recentSync.errors,
          ...backfillSync.errors,
        ];
        const syncedMessages = [
          ...recentSync.syncedMessages,
          ...backfillSync.syncedMessages,
        ];
        const localMessageCount = await countMessagingLocalMessagesForUidValidity(
          {
            userId,
            mailbox,
            uidValidity,
          },
        );
        const syncedUids = syncedMessages.map((message) => message.uid);
        const lastSyncedUid =
          maxNumber([
            ...syncedUids,
            remoteMessageCount === 0 ? null : existingState?.lastSyncedUid,
          ]);
        const lastBackfilledUid =
          remoteMessageCount === 0
            ? null
            : minNumber([
                ...syncedUids,
                existingState?.uidValidity === uidValidity
                  ? existingState.lastBackfilledUid
                  : null,
              ]);
        const backfillComplete =
          remoteMessageCount === 0 ||
          localMessageCount >= remoteMessageCount ||
          (lastBackfilledUid !== null && lastBackfilledUid <= 1);
        const status = bootstrapComplete
          ? errors.length === 0
            ? PrismaMessagingLocalSyncStatus.READY
            : PrismaMessagingLocalSyncStatus.DEGRADED
          : hadReadableLocalState
            ? PrismaMessagingLocalSyncStatus.DEGRADED
            : errors.length > 0
              ? PrismaMessagingLocalSyncStatus.ERROR
              : PrismaMessagingLocalSyncStatus.BOOTSTRAPPING;

        const result = {
          userId,
          mailbox,
          remotePath: opened.name,
          uidValidity,
          lastKnownUidNext,
          remoteMessageCount,
          localMessageCount,
          recentWindowSize,
          backfillBatchSize,
          fetchedCount: recentMessages.length + backfillMessages.length,
          recentFetchedCount: recentMessages.length,
          recentSyncedCount: recentSync.syncedMessages.length,
          backfillFetchedCount: backfillMessages.length,
          backfillSyncedCount: backfillSync.syncedMessages.length,
          syncedCount: syncedMessages.length,
          failedCount: errors.length,
          lastSyncedUid,
          lastBackfilledUid,
          bootstrapComplete,
          backfillComplete,
          status,
          errors,
        } satisfies MessagingMailboxLocalSyncResult;

        await upsertMessagingMailboxLocalSyncState({
          userId,
          mailbox,
          remotePath: opened.name,
          uidValidity,
          lastKnownUidNext,
          remoteMessageCount,
          localMessageCount,
          status,
          lastSyncedUid,
          lastBackfilledUid,
          lastSuccessfulSyncAt:
            bootstrapComplete && errors.length === 0
              ? attemptStartedAt
              : undefined,
          lastFullResyncAt:
            bootstrapComplete && backfillComplete && errors.length === 0
              ? attemptStartedAt
              : undefined,
          lastError: summarizeLocalSyncErrors(errors),
        });

        recordMessagingLocalSyncSyncCompleted({
          userId,
          mailbox,
          status,
          durationMs: runtime.now().getTime() - attemptStartedAt.getTime(),
          syncedCount: syncedMessages.length,
          failedCount: errors.length,
          localMessageCount,
          remoteMessageCount,
          bootstrapComplete,
          backfillComplete,
        });

        return result;
      } finally {
        opened.release();
      }
    });
  } catch (error) {
    const errorMessage = formatLocalSyncErrorMessage(error);
    const status = hadReadableLocalState
      ? PrismaMessagingLocalSyncStatus.DEGRADED
      : PrismaMessagingLocalSyncStatus.ERROR;
    await upsertMessagingMailboxLocalSyncState({
      userId,
      mailbox,
      status,
      lastAttemptedSyncAt: attemptStartedAt,
      lastError: errorMessage,
    });
    recordMessagingLocalSyncSyncFailed({
      userId,
      mailbox,
      durationMs: runtime.now().getTime() - attemptStartedAt.getTime(),
      error: errorMessage,
    });
    throw error;
  }
}

export async function syncMessagingMailboxToLocal(
  options: SyncMessagingMailboxToLocalOptions,
): Promise<MessagingMailboxLocalSyncResult> {
  return syncMessagingMailboxToLocalWithRuntime(
    options,
    defaultMessagingMailboxLocalSyncRuntime,
  );
}

export async function syncInboxMailboxToLocal(
  options: Omit<SyncMessagingMailboxToLocalOptions, "mailbox"> = {},
): Promise<MessagingMailboxLocalSyncResult> {
  return syncMessagingMailboxToLocal({
    ...options,
    mailbox: "inbox",
  });
}

async function syncMessagingMailboxesToLocalWithRuntime(
  options: SyncMessagingMailboxesToLocalOptions = {},
  runtime: MessagingMailboxLocalSyncRuntime,
): Promise<MessagingMailboxesLocalSyncResult> {
  const userId = await runtime.resolveUserId(options.userId);
  const mailboxes = options.mailboxes?.length
    ? options.mailboxes
    : MESSAGING_LOCAL_SYNC_MAILBOX_VALUES;
  const uniqueMailboxes = Array.from(new Set(mailboxes));
  const results: MessagingMailboxLocalSyncResult[] = [];
  const failures: Array<{
    mailbox: MessagingLocalSyncMailbox;
    message: string;
  }> = [];

  for (const mailbox of uniqueMailboxes) {
    try {
      const result = await syncMessagingMailboxToLocalWithRuntime(
        {
          ...options,
          userId,
          mailbox,
        },
        runtime,
      );
      results.push(result);
    } catch (error) {
      const message = formatLocalSyncErrorMessage(error);
      const currentState = await getMessagingMailboxLocalSyncState({
        userId,
        mailbox,
      });
      if (
        !currentState ||
        currentState.status === PrismaMessagingLocalSyncStatus.BOOTSTRAPPING
      ) {
        await upsertMessagingMailboxLocalSyncState({
          userId,
          mailbox,
          status: currentState && isMessagingMailboxLocalSyncReadable(currentState)
            ? PrismaMessagingLocalSyncStatus.DEGRADED
            : PrismaMessagingLocalSyncStatus.ERROR,
          lastAttemptedSyncAt: runtime.now(),
          lastError: message,
        });
      }
      failures.push({
        mailbox,
        message,
      });
    }
  }

  return {
    userId,
    results,
    failures,
    states: await listMessagingMailboxLocalSyncStates(userId),
  };
}

export async function syncMessagingMailboxesToLocal(
  options: SyncMessagingMailboxesToLocalOptions = {},
): Promise<MessagingMailboxesLocalSyncResult> {
  return syncMessagingMailboxesToLocalWithRuntime(
    options,
    defaultMessagingMailboxLocalSyncRuntime,
  );
}

async function syncInboxMailboxToLocalWithRuntime(
  options: Omit<SyncMessagingMailboxToLocalOptions, "mailbox"> = {},
  runtime: MessagingMailboxLocalSyncRuntime,
): Promise<MessagingMailboxLocalSyncResult> {
  return syncMessagingMailboxToLocalWithRuntime(
    {
      ...options,
      mailbox: "inbox",
    },
    runtime,
  );
}

export const __testables = {
  normalizeRecentWindowSize,
  normalizeBackfillBatchSize,
  fetchMailboxMessagesBySequenceWindow,
  fetchMailboxMessagesByUidRange,
  syncMessagingMailboxToLocalWithRuntime,
  syncMessagingMailboxesToLocalWithRuntime,
  syncInboxMailboxToLocalWithRuntime,
};
