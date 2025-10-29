-- AlterTable
ALTER TABLE "MessagingSettings" ADD COLUMN "quickReplies" JSONB;
ALTER TABLE "MessagingSettings" ADD COLUMN "responseTemplates" JSONB;
ALTER TABLE "MessagingSettings" ADD COLUMN "signature" TEXT;
ALTER TABLE "MessagingSettings" ADD COLUMN "signatureHtml" TEXT;

-- CreateTable
CREATE TABLE "MessagingEmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "direction" TEXT NOT NULL,
    "mailbox" TEXT,
    "uid" INTEGER,
    "messageId" TEXT,
    "subject" TEXT NOT NULL,
    "participants" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENREGISTRE',
    "error" TEXT,
    "sentAt" DATETIME,
    "readAt" DATETIME,
    "failedAt" DATETIME,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingEmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
