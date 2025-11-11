-- CreateTable
CREATE TABLE "MessagingScheduledEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "to" JSONB NOT NULL,
    "cc" JSONB,
    "bcc" JSONB,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "previewText" TEXT NOT NULL,
    "sendAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "canceledAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagingScheduledAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledEmailId" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "size" INTEGER NOT NULL,
    "content" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessagingScheduledAttachment_scheduledEmailId_fkey" FOREIGN KEY ("scheduledEmailId") REFERENCES "MessagingScheduledEmail" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MessagingScheduledEmail_userId_status_sendAt_idx" ON "MessagingScheduledEmail"("userId", "status", "sendAt");

-- CreateIndex
CREATE INDEX "MessagingScheduledEmail_status_sendAt_idx" ON "MessagingScheduledEmail"("status", "sendAt");

-- CreateIndex
CREATE INDEX "MessagingScheduledAttachment_scheduledEmailId_idx" ON "MessagingScheduledAttachment"("scheduledEmailId");
