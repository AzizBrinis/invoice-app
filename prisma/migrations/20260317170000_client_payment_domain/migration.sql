ALTER TYPE "PdfTemplateType" ADD VALUE IF NOT EXISTS 'RECU';
ALTER TYPE "SequenceType" ADD VALUE IF NOT EXISTS 'RECU';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'RECU';

CREATE TABLE "ClientService" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "notes" TEXT,
    "privateNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "amountCents" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "note" TEXT,
    "privateNote" TEXT,
    "receiptIssuedAt" TIMESTAMP(3),
    "receiptSentAt" TIMESTAMP(3),
    "receiptSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPaymentService" (
    "id" TEXT NOT NULL,
    "clientPaymentId" TEXT NOT NULL,
    "clientServiceId" TEXT,
    "titleSnapshot" TEXT NOT NULL,
    "detailsSnapshot" TEXT,
    "allocatedAmountCents" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPaymentService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientService_userId_clientId_updatedAt_idx" ON "ClientService"("userId", "clientId", "updatedAt");
CREATE UNIQUE INDEX "ClientPayment_userId_receiptNumber_key" ON "ClientPayment"("userId", "receiptNumber");
CREATE INDEX "ClientPayment_userId_clientId_date_idx" ON "ClientPayment"("userId", "clientId", "date");
CREATE INDEX "ClientPayment_userId_receiptIssuedAt_idx" ON "ClientPayment"("userId", "receiptIssuedAt");
CREATE INDEX "ClientPaymentService_clientPaymentId_position_idx" ON "ClientPaymentService"("clientPaymentId", "position");
CREATE INDEX "ClientPaymentService_clientServiceId_idx" ON "ClientPaymentService"("clientServiceId");

ALTER TABLE "ClientService" ADD CONSTRAINT "ClientService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientService" ADD CONSTRAINT "ClientService_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPayment" ADD CONSTRAINT "ClientPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPayment" ADD CONSTRAINT "ClientPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPaymentService" ADD CONSTRAINT "ClientPaymentService_clientPaymentId_fkey" FOREIGN KEY ("clientPaymentId") REFERENCES "ClientPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPaymentService" ADD CONSTRAINT "ClientPaymentService_clientServiceId_fkey" FOREIGN KEY ("clientServiceId") REFERENCES "ClientService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
