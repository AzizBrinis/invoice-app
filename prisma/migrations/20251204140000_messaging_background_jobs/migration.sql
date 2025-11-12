-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BackgroundJobEventType" AS ENUM ('ENQUEUED', 'DEDUPED', 'STARTED', 'SUCCEEDED', 'FAILED', 'RETRY_SCHEDULED');

-- CreateTable
CREATE TABLE "MessagingInboxSyncState" (
    "userId" TEXT NOT NULL,
    "lastInboxAutoReplyUid" INTEGER,
    "lastInboxSyncAt" TIMESTAMP(3),
    "lastAutoReplyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingInboxSyncState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "dedupeKey" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "retryBackoffMs" INTEGER NOT NULL DEFAULT 60000,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "BackgroundJobEventType" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackgroundJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundJob_status_runAt_idx" ON "BackgroundJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_runAt_idx" ON "BackgroundJob"("runAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_type_dedupeKey_key" ON "BackgroundJob"("type", "dedupeKey");

-- CreateIndex
CREATE INDEX "BackgroundJobEvent_jobId_createdAt_idx" ON "BackgroundJobEvent"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "MessagingInboxSyncState" ADD CONSTRAINT "MessagingInboxSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJobEvent" ADD CONSTRAINT "BackgroundJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

