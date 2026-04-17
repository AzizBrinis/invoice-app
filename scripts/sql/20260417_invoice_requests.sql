CREATE TABLE IF NOT EXISTS "InvoiceRequest" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "clientId" text NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "orderId" text NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "invoiceId" text REFERENCES "Invoice"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "deliveryEmail" text NOT NULL,
  "companyName" text NOT NULL,
  "vatNumber" text NOT NULL,
  "billingAddress" text NOT NULL,
  "requestedAt" timestamptz NOT NULL DEFAULT NOW(),
  "processedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "InvoiceRequest_status_check"
    CHECK ("status" IN ('PENDING', 'COMPLETED')),
  CONSTRAINT "InvoiceRequest_userId_orderId_key"
    UNIQUE ("userId", "orderId")
);

CREATE INDEX IF NOT EXISTS "InvoiceRequest_userId_status_requestedAt_idx"
  ON "InvoiceRequest" ("userId", "status", "requestedAt" DESC);

CREATE INDEX IF NOT EXISTS "InvoiceRequest_userId_clientId_requestedAt_idx"
  ON "InvoiceRequest" ("userId", "clientId", "requestedAt" DESC);

CREATE INDEX IF NOT EXISTS "InvoiceRequest_orderId_idx"
  ON "InvoiceRequest" ("orderId");
