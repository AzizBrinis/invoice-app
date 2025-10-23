-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "taxConfiguration" JSONB;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "fodecAmountCents" INTEGER;
ALTER TABLE "InvoiceLine" ADD COLUMN "fodecRate" REAL;

-- AlterTable
ALTER TABLE "QuoteLine" ADD COLUMN "fodecAmountCents" INTEGER;
ALTER TABLE "QuoteLine" ADD COLUMN "fodecRate" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "quoteId" TEXT,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amountPaidCents", "clientId", "createdAt", "currency", "dueDate", "globalDiscountAmountCents", "globalDiscountRate", "id", "issueDate", "lateFeeRate", "notes", "number", "quoteId", "reference", "status", "subtotalHTCents", "terms", "totalDiscountCents", "totalTTCCents", "totalTVACents", "updatedAt", "vatBreakdown") SELECT "amountPaidCents", "clientId", "createdAt", "currency", "dueDate", "globalDiscountAmountCents", "globalDiscountRate", "id", "issueDate", "lateFeeRate", "notes", "number", "quoteId", "reference", "status", "subtotalHTCents", "terms", "totalDiscountCents", "totalTTCCents", "totalTVACents", "updatedAt", "vatBreakdown" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE UNIQUE INDEX "Invoice_quoteId_key" ON "Invoice"("quoteId");
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("clientId", "createdAt", "currency", "globalDiscountAmountCents", "globalDiscountRate", "id", "issueDate", "notes", "number", "reference", "status", "subtotalHTCents", "terms", "totalDiscountCents", "totalTTCCents", "totalTVACents", "updatedAt", "validUntil", "vatBreakdown") SELECT "clientId", "createdAt", "currency", "globalDiscountAmountCents", "globalDiscountRate", "id", "issueDate", "notes", "number", "reference", "status", "subtotalHTCents", "terms", "totalDiscountCents", "totalTTCCents", "totalTVACents", "updatedAt", "validUntil", "vatBreakdown" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
