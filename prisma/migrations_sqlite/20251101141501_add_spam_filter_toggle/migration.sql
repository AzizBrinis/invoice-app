-- CreateTable
CREATE TABLE "SpamDetectionLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" TEXT,
    "mailbox" TEXT NOT NULL,
    "targetMailbox" TEXT,
    "uid" INTEGER NOT NULL,
    "subject" TEXT,
    "sender" TEXT,
    "score" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reasons" JSONB,
    "autoMoved" BOOLEAN NOT NULL DEFAULT false,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "actor" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpamSenderReputation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "domain" TEXT NOT NULL,
    "spamCount" INTEGER NOT NULL DEFAULT 0,
    "hamCount" INTEGER NOT NULL DEFAULT 0,
    "lastFeedbackAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MessagingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MessagingSettings" ("createdAt", "fromEmail", "id", "imapHost", "imapPassword", "imapPort", "imapSecure", "imapUser", "senderLogoUrl", "senderName", "smtpHost", "smtpPassword", "smtpPort", "smtpSecure", "smtpUser", "updatedAt") SELECT "createdAt", "fromEmail", "id", "imapHost", "imapPassword", "imapPort", "imapSecure", "imapUser", "senderLogoUrl", "senderName", "smtpHost", "smtpPassword", "smtpPort", "smtpSecure", "smtpUser", "updatedAt" FROM "MessagingSettings";
DROP TABLE "MessagingSettings";
ALTER TABLE "new_MessagingSettings" RENAME TO "MessagingSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SpamSenderReputation_domain_key" ON "SpamSenderReputation"("domain");
