ALTER TABLE "MessagingSettings"
ADD COLUMN "localSyncEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "MessagingMailboxName" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM');

CREATE TYPE "MessagingLocalSyncStatus" AS ENUM (
  'DISABLED',
  'BOOTSTRAPPING',
  'READY',
  'DEGRADED',
  'ERROR'
);

CREATE TYPE "MessagingLocalBodyState" AS ENUM (
  'NONE',
  'TEXT_READY',
  'HTML_READY',
  'OVERSIZED_FALLBACK'
);

CREATE TABLE "MessagingMailboxLocalSyncState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mailbox" "MessagingMailboxName" NOT NULL,
  "remotePath" TEXT,
  "uidValidity" INTEGER,
  "lastKnownUidNext" INTEGER,
  "lastSyncedUid" INTEGER,
  "lastBackfilledUid" INTEGER,
  "remoteMessageCount" INTEGER,
  "localMessageCount" INTEGER,
  "status" "MessagingLocalSyncStatus" NOT NULL DEFAULT 'DISABLED',
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastAttemptedSyncAt" TIMESTAMP(3),
  "lastFullResyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessagingMailboxLocalSyncState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingLocalMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mailbox" "MessagingMailboxName" NOT NULL,
  "remotePath" TEXT,
  "uidValidity" INTEGER NOT NULL,
  "uid" INTEGER NOT NULL,
  "messageId" TEXT,
  "subject" TEXT,
  "fromLabel" TEXT,
  "fromAddress" TEXT,
  "toRecipients" JSONB,
  "ccRecipients" JSONB,
  "bccRecipients" JSONB,
  "replyToRecipients" JSONB,
  "internalDate" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "seen" BOOLEAN NOT NULL DEFAULT false,
  "answered" BOOLEAN NOT NULL DEFAULT false,
  "flagged" BOOLEAN NOT NULL DEFAULT false,
  "draft" BOOLEAN NOT NULL DEFAULT false,
  "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
  "previewText" TEXT,
  "normalizedText" TEXT,
  "sanitizedHtml" TEXT,
  "searchText" TEXT,
  "bodyState" "MessagingLocalBodyState" NOT NULL DEFAULT 'NONE',
  "lastSyncedAt" TIMESTAMP(3),
  "hydratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessagingLocalMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingLocalAttachment" (
  "id" TEXT NOT NULL,
  "messageRecordId" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "contentId" TEXT,
  "contentLocation" TEXT,
  "inline" BOOLEAN NOT NULL DEFAULT false,
  "cachedBlobKey" TEXT,
  "cachedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessagingLocalAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessagingMailboxLocalSyncState_userId_mailbox_key"
ON "MessagingMailboxLocalSyncState"("userId", "mailbox");

CREATE INDEX "MessagingMailboxLocalSyncState_userId_status_idx"
ON "MessagingMailboxLocalSyncState"("userId", "status");

CREATE UNIQUE INDEX "MessagingLocalMessage_userId_mailbox_uidValidity_uid_key"
ON "MessagingLocalMessage"("userId", "mailbox", "uidValidity", "uid");

CREATE INDEX "MessagingLocalMessage_userId_mailbox_internalDate_idx"
ON "MessagingLocalMessage"("userId", "mailbox", "internalDate");

CREATE INDEX "MessagingLocalMessage_userId_messageId_idx"
ON "MessagingLocalMessage"("userId", "messageId");

CREATE INDEX "MessagingLocalMessage_userId_mailbox_seen_idx"
ON "MessagingLocalMessage"("userId", "mailbox", "seen");

CREATE UNIQUE INDEX "MessagingLocalAttachment_messageRecordId_attachmentId_key"
ON "MessagingLocalAttachment"("messageRecordId", "attachmentId");

CREATE INDEX "MessagingLocalAttachment_messageRecordId_idx"
ON "MessagingLocalAttachment"("messageRecordId");

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "MessagingLocalMessage_subject_trgm_idx"
  ON "MessagingLocalMessage" USING GIN ("subject" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "MessagingLocalMessage_fromAddress_trgm_idx"
  ON "MessagingLocalMessage" USING GIN ("fromAddress" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "MessagingLocalMessage_searchText_trgm_idx"
  ON "MessagingLocalMessage" USING GIN ("searchText" gin_trgm_ops);

ALTER TABLE "MessagingMailboxLocalSyncState"
ADD CONSTRAINT "MessagingMailboxLocalSyncState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessagingLocalMessage"
ADD CONSTRAINT "MessagingLocalMessage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessagingLocalAttachment"
ADD CONSTRAINT "MessagingLocalAttachment_messageRecordId_fkey"
FOREIGN KEY ("messageRecordId") REFERENCES "MessagingLocalMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
