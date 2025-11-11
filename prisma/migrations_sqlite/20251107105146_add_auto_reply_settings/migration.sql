-- CreateTable
CREATE TABLE "MessagingAutoReplyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "replyType" TEXT NOT NULL,
    "originalMessageId" TEXT,
    "originalUid" INTEGER,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessagingAutoReplyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MessagingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fromEmail" TEXT,
    "senderName" TEXT,
    "senderLogoUrl" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "imapUser" TEXT,
    "imapPassword" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "spamFilterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReplySubject" TEXT,
    "autoReplyBody" TEXT,
    "vacationModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vacationSubject" TEXT,
    "vacationMessage" TEXT,
    "vacationStartDate" DATETIME,
    "vacationEndDate" DATETIME,
    "vacationBackupEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessagingSettings" ("createdAt", "fromEmail", "id", "imapHost", "imapPassword", "imapPort", "imapSecure", "imapUser", "senderLogoUrl", "senderName", "smtpHost", "smtpPassword", "smtpPort", "smtpSecure", "smtpUser", "spamFilterEnabled", "trackingEnabled", "updatedAt", "userId") SELECT "createdAt", "fromEmail", "id", "imapHost", "imapPassword", "imapPort", "imapSecure", "imapUser", "senderLogoUrl", "senderName", "smtpHost", "smtpPassword", "smtpPort", "smtpSecure", "smtpUser", "spamFilterEnabled", "trackingEnabled", "updatedAt", "userId" FROM "MessagingSettings";
DROP TABLE "MessagingSettings";
ALTER TABLE "new_MessagingSettings" RENAME TO "MessagingSettings";
CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON "MessagingSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MessagingAutoReplyLog_userId_senderEmail_idx" ON "MessagingAutoReplyLog"("userId", "senderEmail");

-- CreateIndex
CREATE INDEX "MessagingAutoReplyLog_userId_sentAt_idx" ON "MessagingAutoReplyLog"("userId", "sentAt");
