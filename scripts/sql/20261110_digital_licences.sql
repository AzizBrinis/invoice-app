-- Produits Digitaux (Phase 1): encrypted licence-code inventory, licence
-- documents (manual or API) and their audit history.
-- Additive and idempotent; safe to re-run. Apply with the direct/session pooler URL:
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/20261110_digital_licences.sql
-- The programmatic API also relies on "IntegrationRequestNonce" from
-- 20261109_external_invoice_requests.sql (replay protection / rate limiting).

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- One row per licence document: a set of codes allocated together for one
-- product variant (manual generation, API call, later a PrestaShop order line).
CREATE TABLE IF NOT EXISTS "DigitalLicenceOrder" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "number" text NOT NULL,
  "productSku" text NOT NULL,
  "quantity" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "source" text NOT NULL DEFAULT 'MANUAL',
  "idempotencyKey" text,
  "requestHash" text,
  "customerName" text,
  "customerEmail" text,
  "orderReference" text,
  "activationRegion" text,
  "useBefore" date,
  "notes" text,
  -- Forward-compatible links (PrestaShop sync, invoices, e-mail delivery).
  "externalSource" text,
  "externalOrderId" text,
  "externalLineId" text,
  "invoiceId" text REFERENCES "Invoice"("id") ON DELETE SET NULL,
  "createdById" text REFERENCES "User"("id") ON DELETE SET NULL,
  "apiKeyId" text,
  "generationCount" integer NOT NULL DEFAULT 0,
  "lastErrorCode" text,
  "generatedAt" timestamptz,
  "lastDownloadedAt" timestamptz,
  "deliveredAt" timestamptz,
  "cancelledAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "DigitalLicenceOrder_status_check"
    CHECK ("status" IN ('PENDING', 'GENERATED', 'DELIVERED', 'CANCELLED')),
  CONSTRAINT "DigitalLicenceOrder_source_check"
    CHECK ("source" IN ('MANUAL', 'API', 'PRESTASHOP')),
  CONSTRAINT "DigitalLicenceOrder_quantity_check"
    CHECK ("quantity" BETWEEN 1 AND 100),
  CONSTRAINT "DigitalLicenceOrder_number_key" UNIQUE ("userId", "number"),
  CONSTRAINT "DigitalLicenceOrder_idempotency_key" UNIQUE ("userId", "idempotencyKey")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DigitalLicenceOrder_external_line_key"
  ON "DigitalLicenceOrder" ("userId", "externalSource", "externalOrderId", "externalLineId")
  WHERE "externalSource" IS NOT NULL AND "externalOrderId" IS NOT NULL AND "externalLineId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "DigitalLicenceOrder_userId_createdAt_idx"
  ON "DigitalLicenceOrder" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DigitalLicenceOrder_invoiceId_idx"
  ON "DigitalLicenceOrder" ("invoiceId");

-- One row per activation code. The code itself is only stored encrypted
-- (AES-256-GCM, bound to tenant + row id); "codeFingerprint" is a keyed HMAC
-- used for duplicate prevention; "codeHint" holds the last 4 characters for
-- masked display.
CREATE TABLE IF NOT EXISTS "DigitalLicenceCode" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "productSku" text NOT NULL,
  "codeCiphertext" text NOT NULL,
  "codeFingerprint" text NOT NULL,
  "codeHint" text NOT NULL,
  "keyVersion" smallint NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'AVAILABLE',
  -- NO ACTION (checked at end of statement): an order holding codes cannot be
  -- deleted on its own, but a tenant deletion cascades cleanly.
  "orderId" text REFERENCES "DigitalLicenceOrder"("id") ON DELETE NO ACTION,
  "batchLabel" text,
  "importedById" text REFERENCES "User"("id") ON DELETE SET NULL,
  "reservedAt" timestamptz,
  "usedAt" timestamptz,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "DigitalLicenceCode_status_check"
    CHECK ("status" IN ('AVAILABLE', 'RESERVED', 'USED', 'REVOKED')),
  CONSTRAINT "DigitalLicenceCode_allocation_check"
    CHECK (("status" IN ('RESERVED', 'USED')) = ("orderId" IS NOT NULL)),
  CONSTRAINT "DigitalLicenceCode_fingerprint_key" UNIQUE ("userId", "codeFingerprint")
);

-- Allocation scan: oldest available code of a variant first.
CREATE INDEX IF NOT EXISTS "DigitalLicenceCode_alloc_idx"
  ON "DigitalLicenceCode" ("userId", "productSku", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "DigitalLicenceCode_orderId_idx"
  ON "DigitalLicenceCode" ("orderId");

-- Append-only audit trail (never contains activation codes).
CREATE TABLE IF NOT EXISTS "DigitalLicenceEvent" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "orderId" text REFERENCES "DigitalLicenceOrder"("id") ON DELETE CASCADE,
  "codeId" text REFERENCES "DigitalLicenceCode"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "actor" text,
  "details" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "DigitalLicenceEvent_userId_createdAt_idx"
  ON "DigitalLicenceEvent" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DigitalLicenceEvent_orderId_idx"
  ON "DigitalLicenceEvent" ("orderId");

COMMIT;
