/*
  Warnings:

  - You are about to drop the column `siren` on the `CompanySettings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
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
    CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES "PdfTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES "PdfTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompanySettings" ("address", "companyName", "createdAt", "defaultConditions", "defaultCurrency", "defaultInvoiceFooter", "defaultQuoteFooter", "defaultVatRate", "email", "iban", "id", "invoiceNumberPrefix", "invoiceTemplateId", "legalFooter", "logoUrl", "paymentTerms", "phone", "quoteNumberPrefix", "quoteTemplateId", "resetNumberingAnnually", "taxConfiguration", "tvaNumber", "updatedAt") SELECT "address", "companyName", "createdAt", "defaultConditions", "defaultCurrency", "defaultInvoiceFooter", "defaultQuoteFooter", "defaultVatRate", "email", "iban", "id", "invoiceNumberPrefix", "invoiceTemplateId", "legalFooter", "logoUrl", "paymentTerms", "phone", "quoteNumberPrefix", "quoteTemplateId", "resetNumberingAnnually", "taxConfiguration", "tvaNumber", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
