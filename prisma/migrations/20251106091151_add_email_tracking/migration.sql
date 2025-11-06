-- CreateTable
CREATE TABLE "MessagingEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "sentAt" DATETIME NOT NULL,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagingEmailRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "openToken" TEXT NOT NULL,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" DATETIME,
    "lastOpenedAt" DATETIME,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingEmailRecipient_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "MessagingEmail" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagingEmailLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingEmailLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "MessagingEmail" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagingEmailLinkRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "firstClickedAt" DATETIME,
    "lastClickedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingEmailLinkRecipient_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MessagingEmailLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessagingEmailLinkRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "MessagingEmailRecipient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagingEmailEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "recipientId" TEXT,
    "linkId" TEXT,
    "linkRecipientId" TEXT,
    "type" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceFamily" TEXT,
    "deviceType" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessagingEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "MessagingEmail" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessagingEmailEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "MessagingEmailRecipient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MessagingEmailEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MessagingEmailLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MessagingEmailEvent_linkRecipientId_fkey" FOREIGN KEY ("linkRecipientId") REFERENCES "MessagingEmailLinkRecipient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceAuditLog" ("action", "createdAt", "id", "invoiceId", "newStatus", "note", "previousStatus", "userId") SELECT "action", "createdAt", "id", "invoiceId", "newStatus", "note", "previousStatus", "userId" FROM "InvoiceAuditLog";
DROP TABLE "InvoiceAuditLog";
ALTER TABLE "new_InvoiceAuditLog" RENAME TO "InvoiceAuditLog";
CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON "InvoiceAuditLog"("userId", "invoiceId");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessagingSettings" ("createdAt", "fromEmail", "id", "imapHost", "imapPassword", "imapPort", "imapSecure", "imapUser", "senderLogoUrl", "senderName", "smtpHost", "smtpPassword", "smtpPort", "smtpSecure", "smtpUser", "spamFilterEnabled", "updatedAt", "userId") SELECT "createdAt", "fromEmail", "id", "imapHost", "imapPassword", "imapPort", "imapSecure", "imapUser", "senderLogoUrl", "senderName", "smtpHost", "smtpPassword", "smtpPort", "smtpSecure", "smtpUser", "spamFilterEnabled", "updatedAt", "userId" FROM "MessagingSettings";
DROP TABLE "MessagingSettings";
ALTER TABLE "new_MessagingSettings" RENAME TO "MessagingSettings";
CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON "MessagingSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MessagingEmail_userId_sentAt_idx" ON "MessagingEmail"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingEmail_userId_messageId_key" ON "MessagingEmail"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingEmailRecipient_openToken_key" ON "MessagingEmailRecipient"("openToken");

-- CreateIndex
CREATE INDEX "MessagingEmailRecipient_emailId_address_idx" ON "MessagingEmailRecipient"("emailId", "address");

-- CreateIndex
CREATE INDEX "MessagingEmailLink_emailId_idx" ON "MessagingEmailLink"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingEmailLinkRecipient_token_key" ON "MessagingEmailLinkRecipient"("token");

-- CreateIndex
CREATE INDEX "MessagingEmailLinkRecipient_linkId_idx" ON "MessagingEmailLinkRecipient"("linkId");

-- CreateIndex
CREATE INDEX "MessagingEmailLinkRecipient_recipientId_idx" ON "MessagingEmailLinkRecipient"("recipientId");

-- CreateIndex
CREATE INDEX "MessagingEmailEvent_emailId_occurredAt_idx" ON "MessagingEmailEvent"("emailId", "occurredAt");

-- CreateIndex
CREATE INDEX "MessagingEmailEvent_recipientId_idx" ON "MessagingEmailEvent"("recipientId");

-- CreateIndex
CREATE INDEX "MessagingEmailEvent_linkRecipientId_idx" ON "MessagingEmailEvent"("linkRecipientId");
