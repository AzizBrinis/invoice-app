-- PrestaShop invoice API: replay protection, rate limiting and idempotency.
-- Additive and idempotent; safe to re-run. Apply with the direct/session pooler URL:
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/20261109_external_invoice_requests.sql

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- One row per authenticated request nonce. Rows expire after the signature
-- window and are purged opportunistically by the API.
CREATE TABLE IF NOT EXISTS "IntegrationRequestNonce" (
  "keyId" text NOT NULL,
  "nonce" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "expiresAt" timestamptz NOT NULL,
  CONSTRAINT "IntegrationRequestNonce_pkey" PRIMARY KEY ("keyId", "nonce")
);

CREATE INDEX IF NOT EXISTS "IntegrationRequestNonce_keyId_createdAt_idx"
  ON "IntegrationRequestNonce" ("keyId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "IntegrationRequestNonce_expiresAt_idx"
  ON "IntegrationRequestNonce" ("expiresAt");

-- One row per external order: guarantees a single invoice per PrestaShop order.
CREATE TABLE IF NOT EXISTS "ExternalInvoiceRequest" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "shopId" text NOT NULL,
  "externalOrderId" text NOT NULL,
  "externalOrderReference" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "payloadHash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PROCESSING',
  "invoiceId" text REFERENCES "Invoice"("id") ON DELETE SET NULL,
  "lastErrorCode" text,
  "attempts" integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  "completedAt" timestamptz,
  CONSTRAINT "ExternalInvoiceRequest_status_check"
    CHECK ("status" IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  CONSTRAINT "ExternalInvoiceRequest_order_key"
    UNIQUE ("userId", "source", "shopId", "externalOrderId"),
  CONSTRAINT "ExternalInvoiceRequest_idempotency_key"
    UNIQUE ("userId", "source", "idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "ExternalInvoiceRequest_invoiceId_idx"
  ON "ExternalInvoiceRequest" ("invoiceId");

COMMIT;
