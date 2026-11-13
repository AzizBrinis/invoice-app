-- Digital-order fulfilment (PrestaShop -> licences + invoice + customer e-mail).
-- One row per shop order: guarantees one invoice and one e-mail per order even
-- when PrestaShop retries. Additive and idempotent; safe to re-run.
-- Requires 20261109_external_invoice_requests.sql and 20261110_digital_licences.sql.
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/20261113_digital_order_fulfilment.sql

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "DigitalOrderFulfilment" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "shopId" text NOT NULL,
  "externalOrderId" text NOT NULL,
  "orderReference" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestHash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PROCESSING',
  "invoiceId" text REFERENCES "Invoice"("id") ON DELETE SET NULL,
  "licenceOrderIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "emailTo" text,
  "emailSubject" text,
  "emailSentAt" timestamptz,
  "lastErrorCode" text,
  "attempts" integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  "completedAt" timestamptz,
  CONSTRAINT "DigitalOrderFulfilment_status_check"
    CHECK ("status" IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  CONSTRAINT "DigitalOrderFulfilment_order_key"
    UNIQUE ("userId", "source", "shopId", "externalOrderId"),
  CONSTRAINT "DigitalOrderFulfilment_idempotency_key"
    UNIQUE ("userId", "source", "idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "DigitalOrderFulfilment_userId_createdAt_idx"
  ON "DigitalOrderFulfilment" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DigitalOrderFulfilment_invoiceId_idx"
  ON "DigitalOrderFulfilment" ("invoiceId");

-- Data fix: early licence events stored "details" as a JSON string instead of
-- an object (driver serialisation). Normalise them; idempotent.
UPDATE "DigitalLicenceEvent"
SET "details" = ("details" #>> '{}')::jsonb
WHERE jsonb_typeof("details") = 'string';

COMMIT;
