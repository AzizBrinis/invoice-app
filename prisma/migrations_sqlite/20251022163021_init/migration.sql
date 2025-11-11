-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "siren" TEXT,
    "tvaNumber" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "iban" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES "PdfTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES "PdfTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PdfTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "reference" TEXT,
    "issueDate" DATETIME NOT NULL,
    "validUntil" DATETIME,
    "clientId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "globalDiscountRate" REAL,
    "globalDiscountAmountCents" INTEGER,
    "vatBreakdown" JSONB,
    "notes" TEXT,
    "terms" TEXT,
    "subtotalHTCents" INTEGER NOT NULL,
    "totalDiscountCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "unitPriceHTCents" INTEGER NOT NULL,
    "vatRate" REAL NOT NULL,
    "discountRate" REAL,
    "discountAmountCents" INTEGER,
    "totalHTCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "reference" TEXT,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "clientId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "globalDiscountRate" REAL,
    "globalDiscountAmountCents" INTEGER,
    "vatBreakdown" JSONB,
    "notes" TEXT,
    "terms" TEXT,
    "lateFeeRate" REAL,
    "subtotalHTCents" INTEGER NOT NULL,
    "totalDiscountCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "quoteId" TEXT,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "unitPriceHTCents" INTEGER NOT NULL,
    "vatRate" REAL NOT NULL,
    "discountRate" REAL,
    "discountAmountCents" INTEGER,
    "totalHTCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "date" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NumberingSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "sentAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_quoteId_key" ON "Invoice"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "NumberingSequence_type_year_key" ON "NumberingSequence"("type", "year");
