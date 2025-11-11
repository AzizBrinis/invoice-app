-- Migrate legacy single-tenant data to per-user ownership.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TEMP TABLE "_default_user" AS
SELECT "id" AS "userId"
FROM "User"
ORDER BY "createdAt" ASC
LIMIT 1;

-- Clients --------------------------------------------------------------------
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Client" (
    "id", "userId", "displayName", "companyName", "address", "email",
    "phone", "vatNumber", "notes", "isActive", "createdAt", "updatedAt"
)
SELECT
    "c"."id",
    "du"."userId",
    "c"."displayName",
    "c"."companyName",
    "c"."address",
    "c"."email",
    "c"."phone",
    "c"."vatNumber",
    "c"."notes",
    "c"."isActive",
    "c"."createdAt",
    "c"."updatedAt"
FROM "Client" AS "c"
JOIN "_default_user" AS "du" ON TRUE;
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_userId_displayName_idx" ON "Client"("userId", "displayName");

-- Products -------------------------------------------------------------------
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "priceHTCents" INTEGER NOT NULL,
    "priceTTCCents" INTEGER NOT NULL,
    "vatRate" REAL NOT NULL,
    "defaultDiscountRate" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" (
    "id", "userId", "sku", "name", "description", "category", "unit",
    "priceHTCents", "priceTTCCents", "vatRate", "defaultDiscountRate",
    "isActive", "createdAt", "updatedAt"
)
SELECT
    "p"."id",
    "du"."userId",
    "p"."sku",
    "p"."name",
    "p"."description",
    "p"."category",
    "p"."unit",
    "p"."priceHTCents",
    "p"."priceTTCCents",
    "p"."vatRate",
    "p"."defaultDiscountRate",
    "p"."isActive",
    "p"."createdAt",
    "p"."updatedAt"
FROM "Product" AS "p"
JOIN "_default_user" AS "du" ON TRUE;
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_userId_name_idx" ON "Product"("userId", "name");
CREATE UNIQUE INDEX "Product_userId_sku_key" ON "Product"("userId", "sku");

-- Quotes ---------------------------------------------------------------------
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "reference" TEXT,
    "issueDate" DATETIME NOT NULL,
    "validUntil" DATETIME,
    "clientId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "globalDiscountRate" REAL,
    "globalDiscountAmountCents" INTEGER,
    "vatBreakdown" JSONB,
    "taxSummary" JSONB,
    "taxConfiguration" JSONB,
    "notes" TEXT,
    "terms" TEXT,
    "subtotalHTCents" INTEGER NOT NULL,
    "totalDiscountCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "fodecAmountCents" INTEGER NOT NULL DEFAULT 0,
    "timbreAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" (
    "id", "userId", "number", "status", "reference", "issueDate",
    "validUntil", "clientId", "currency", "globalDiscountRate",
    "globalDiscountAmountCents", "vatBreakdown", "taxSummary",
    "taxConfiguration", "notes", "terms", "subtotalHTCents",
    "totalDiscountCents", "totalTVACents", "totalTTCCents",
    "fodecAmountCents", "timbreAmountCents", "createdAt", "updatedAt"
)
SELECT
    "q"."id",
    "du"."userId",
    "q"."number",
    "q"."status",
    "q"."reference",
    "q"."issueDate",
    "q"."validUntil",
    "q"."clientId",
    "q"."currency",
    "q"."globalDiscountRate",
    "q"."globalDiscountAmountCents",
    "q"."vatBreakdown",
    "q"."taxSummary",
    "q"."taxConfiguration",
    "q"."notes",
    "q"."terms",
    "q"."subtotalHTCents",
    "q"."totalDiscountCents",
    "q"."totalTVACents",
    "q"."totalTTCCents",
    COALESCE("q"."fodecAmountCents", 0),
    COALESCE("q"."timbreAmountCents", 0),
    "q"."createdAt",
    "q"."updatedAt"
FROM "Quote" AS "q"
JOIN "_default_user" AS "du" ON TRUE;
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE INDEX "Quote_userId_status_idx" ON "Quote"("userId", "status");
CREATE INDEX "Quote_userId_clientId_idx" ON "Quote"("userId", "clientId");
CREATE UNIQUE INDEX "Quote_userId_number_key" ON "Quote"("userId", "number");

-- Invoices -------------------------------------------------------------------
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "reference" TEXT,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "clientId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "globalDiscountRate" REAL,
    "globalDiscountAmountCents" INTEGER,
    "vatBreakdown" JSONB,
    "taxSummary" JSONB,
    "taxConfiguration" JSONB,
    "notes" TEXT,
    "terms" TEXT,
    "lateFeeRate" REAL,
    "subtotalHTCents" INTEGER NOT NULL,
    "totalDiscountCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "fodecAmountCents" INTEGER NOT NULL DEFAULT 0,
    "timbreAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "quoteId" TEXT UNIQUE,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" (
    "id", "userId", "number", "status", "reference", "issueDate",
    "dueDate", "clientId", "currency", "globalDiscountRate",
    "globalDiscountAmountCents", "vatBreakdown", "taxSummary",
    "taxConfiguration", "notes", "terms", "lateFeeRate",
    "subtotalHTCents", "totalDiscountCents", "totalTVACents",
    "totalTTCCents", "amountPaidCents", "fodecAmountCents",
    "timbreAmountCents", "createdAt", "updatedAt", "quoteId"
)
SELECT
    "i"."id",
    "du"."userId",
    "i"."number",
    "i"."status",
    "i"."reference",
    "i"."issueDate",
    "i"."dueDate",
    "i"."clientId",
    "i"."currency",
    "i"."globalDiscountRate",
    "i"."globalDiscountAmountCents",
    "i"."vatBreakdown",
    "i"."taxSummary",
    "i"."taxConfiguration",
    "i"."notes",
    "i"."terms",
    "i"."lateFeeRate",
    "i"."subtotalHTCents",
    "i"."totalDiscountCents",
    "i"."totalTVACents",
    "i"."totalTTCCents",
    COALESCE("i"."amountPaidCents", 0),
    COALESCE("i"."fodecAmountCents", 0),
    COALESCE("i"."timbreAmountCents", 0),
    "i"."createdAt",
    "i"."updatedAt",
    "i"."quoteId"
FROM "Invoice" AS "i"
JOIN "_default_user" AS "du" ON TRUE;
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_userId_status_idx" ON "Invoice"("userId", "status");
CREATE INDEX "Invoice_userId_clientId_idx" ON "Invoice"("userId", "clientId");
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");
CREATE UNIQUE INDEX "Invoice_quoteId_key" ON "Invoice"("quoteId");

-- Payments -------------------------------------------------------------------
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "date" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" (
    "id", "invoiceId", "userId", "amountCents",
    "method", "date", "note", "createdAt"
)
SELECT
    "pay"."id",
    "pay"."invoiceId",
    COALESCE("inv"."userId", "du"."userId"),
    "pay"."amountCents",
    "pay"."method",
    "pay"."date",
    "pay"."note",
    "pay"."createdAt"
FROM "Payment" AS "pay"
LEFT JOIN "Invoice" AS "inv" ON "inv"."id" = "pay"."invoiceId"
LEFT JOIN "_default_user" AS "du" ON TRUE
WHERE COALESCE("inv"."userId", "du"."userId") IS NOT NULL;
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- Invoice audit logs ---------------------------------------------------------
CREATE TABLE "new_InvoiceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL CHECK ("action" IN ('CANCELLATION', 'DELETION')),
    "previousStatus" TEXT CHECK ("previousStatus" IN ('BROUILLON', 'ENVOYEE', 'PAYEE', 'PARTIELLE', 'RETARD', 'ANNULEE')),
    "newStatus" TEXT CHECK ("newStatus" IN ('BROUILLON', 'ENVOYEE', 'PAYEE', 'PARTIELLE', 'RETARD', 'ANNULEE')),
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_InvoiceAuditLog" (
    "id", "invoiceId", "userId", "action",
    "previousStatus", "newStatus", "note", "createdAt"
)
SELECT
    "log"."id",
    "log"."invoiceId",
    COALESCE("inv"."userId", "du"."userId"),
    "log"."action",
    "log"."previousStatus",
    "log"."newStatus",
    "log"."note",
    "log"."createdAt"
FROM "InvoiceAuditLog" AS "log"
LEFT JOIN "Invoice" AS "inv" ON "inv"."id" = "log"."invoiceId"
LEFT JOIN "_default_user" AS "du" ON TRUE
WHERE COALESCE("inv"."userId", "du"."userId") IS NOT NULL;
DROP TABLE "InvoiceAuditLog";
ALTER TABLE "new_InvoiceAuditLog" RENAME TO "InvoiceAuditLog";
CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON "InvoiceAuditLog"("userId", "invoiceId");

-- Company settings -----------------------------------------------------------
CREATE TABLE "new_CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoData" TEXT,
    "matriculeFiscal" TEXT,
    "tvaNumber" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "iban" TEXT,
    "stampImage" TEXT,
    "signatureImage" TEXT,
    "stampPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "signaturePosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'TND',
    "defaultVatRate" REAL NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "invoiceNumberPrefix" TEXT NOT NULL DEFAULT 'FAC',
    "quoteNumberPrefix" TEXT NOT NULL DEFAULT 'DEV',
    "resetNumberingAnnually" BOOLEAN NOT NULL DEFAULT true,
    "defaultInvoiceFooter" TEXT,
    "defaultQuoteFooter" TEXT,
    "legalFooter" TEXT,
    "defaultConditions" TEXT,
    "invoiceTemplateId" TEXT,
    "quoteTemplateId" TEXT,
    "taxConfiguration" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES "PdfTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES "PdfTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompanySettings" (
    "id", "userId", "companyName", "logoUrl", "logoData", "matriculeFiscal",
    "tvaNumber", "address", "email", "phone", "iban", "stampImage",
    "signatureImage", "stampPosition", "signaturePosition", "defaultCurrency",
    "defaultVatRate", "paymentTerms", "invoiceNumberPrefix", "quoteNumberPrefix",
    "resetNumberingAnnually", "defaultInvoiceFooter", "defaultQuoteFooter",
    "legalFooter", "defaultConditions", "invoiceTemplateId", "quoteTemplateId",
    "taxConfiguration", "createdAt", "updatedAt"
)
SELECT
    printf('%s', "cs"."id"),
    "du"."userId",
    "cs"."companyName",
    "cs"."logoUrl",
    "cs"."logoData",
    "cs"."matriculeFiscal",
    "cs"."tvaNumber",
    "cs"."address",
    "cs"."email",
    "cs"."phone",
    "cs"."iban",
    "cs"."stampImage",
    "cs"."signatureImage",
    "cs"."stampPosition",
    "cs"."signaturePosition",
    "cs"."defaultCurrency",
    "cs"."defaultVatRate",
    "cs"."paymentTerms",
    "cs"."invoiceNumberPrefix",
    "cs"."quoteNumberPrefix",
    "cs"."resetNumberingAnnually",
    "cs"."defaultInvoiceFooter",
    "cs"."defaultQuoteFooter",
    "cs"."legalFooter",
    "cs"."defaultConditions",
    "cs"."invoiceTemplateId",
    "cs"."quoteTemplateId",
    "cs"."taxConfiguration",
    "cs"."createdAt",
    "cs"."updatedAt"
FROM "CompanySettings" AS "cs"
JOIN "_default_user" AS "du" ON TRUE;
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
CREATE UNIQUE INDEX "CompanySettings_userId_key" ON "CompanySettings"("userId");

-- Messaging settings ---------------------------------------------------------
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessagingSettings" (
    "id", "userId", "fromEmail", "senderName", "senderLogoUrl",
    "imapHost", "imapPort", "imapSecure", "imapUser", "imapPassword",
    "smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPassword",
    "spamFilterEnabled", "createdAt", "updatedAt"
)
SELECT
    printf('%s', "ms"."id"),
    "du"."userId",
    "ms"."fromEmail",
    "ms"."senderName",
    "ms"."senderLogoUrl",
    "ms"."imapHost",
    "ms"."imapPort",
    "ms"."imapSecure",
    "ms"."imapUser",
    "ms"."imapPassword",
    "ms"."smtpHost",
    "ms"."smtpPort",
    "ms"."smtpSecure",
    "ms"."smtpUser",
    "ms"."smtpPassword",
    1,
    "ms"."createdAt",
    "ms"."updatedAt"
FROM "MessagingSettings" AS "ms"
JOIN "_default_user" AS "du" ON TRUE;
DROP TABLE "MessagingSettings";
ALTER TABLE "new_MessagingSettings" RENAME TO "MessagingSettings";
CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON "MessagingSettings"("userId");

-- Numbering sequences --------------------------------------------------------
CREATE TABLE "new_NumberingSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NumberingSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NumberingSequence" (
    "id", "userId", "type", "prefix", "year", "counter",
    "createdAt", "updatedAt"
)
SELECT
    "seq"."id",
    "du"."userId",
    "seq"."type",
    "seq"."prefix",
    "seq"."year",
    "seq"."counter",
    "seq"."createdAt",
    "seq"."updatedAt"
FROM "NumberingSequence" AS "seq"
JOIN "_default_user" AS "du" ON TRUE;
DROP TABLE "NumberingSequence";
ALTER TABLE "new_NumberingSequence" RENAME TO "NumberingSequence";
CREATE INDEX "NumberingSequence_userId_idx" ON "NumberingSequence"("userId");
CREATE UNIQUE INDEX "NumberingSequence_userId_type_year_key" ON "NumberingSequence"("userId", "type", "year");

-- Email logs -----------------------------------------------------------------
CREATE TABLE "new_EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "sentAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" (
    "id", "userId", "documentType", "documentId", "to", "subject",
    "body", "sentAt", "status", "error", "createdAt"
)
SELECT
    "el"."id",
    COALESCE("inv"."userId", "qt"."userId", "du"."userId"),
    "el"."documentType",
    "el"."documentId",
    "el"."to",
    "el"."subject",
    "el"."body",
    "el"."sentAt",
    "el"."status",
    "el"."error",
    "el"."createdAt"
FROM "EmailLog" AS "el"
LEFT JOIN "Invoice" AS "inv" ON "el"."documentType" = 'FACTURE' AND "inv"."id" = "el"."documentId"
LEFT JOIN "Quote" AS "qt" ON "el"."documentType" = 'DEVIS' AND "qt"."id" = "el"."documentId"
LEFT JOIN "_default_user" AS "du" ON TRUE
WHERE COALESCE("inv"."userId", "qt"."userId", "du"."userId") IS NOT NULL;
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
CREATE INDEX "EmailLog_userId_documentType_idx" ON "EmailLog"("userId", "documentType");

DROP TABLE IF EXISTS "SpamDetectionLog";
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
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SpamDetectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SpamDetectionLog_userId_mailbox_idx" ON "SpamDetectionLog"("userId", "mailbox");

-- Spam sender reputation -----------------------------------------------------
DROP TABLE IF EXISTS "SpamSenderReputation";
CREATE TABLE "SpamSenderReputation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "spamCount" INTEGER NOT NULL DEFAULT 0,
    "hamCount" INTEGER NOT NULL DEFAULT 0,
    "lastFeedbackAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpamSenderReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SpamSenderReputation_userId_idx" ON "SpamSenderReputation"("userId");
CREATE UNIQUE INDEX "SpamSenderReputation_userId_domain_key" ON "SpamSenderReputation"("userId", "domain");

DROP TABLE "_default_user";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
