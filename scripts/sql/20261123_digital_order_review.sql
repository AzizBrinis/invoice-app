-- Manual review of digital orders ("Traiter la commande" in PrestaShop, module >= 1.7.0).
-- The shop sends the order with mode "review": licences and invoice are prepared,
-- the order request is kept here, and an administrator checks the e-mail and the
-- PDFs in invoice-app before clicking "Envoyer". Additive and idempotent; safe to re-run.
-- Requires 20261113_digital_order_fulfilment.sql.
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/20261123_digital_order_review.sql

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "DigitalOrderFulfilment"
  ADD COLUMN IF NOT EXISTS "reviewPayload" jsonb,
  ADD COLUMN IF NOT EXISTS "reviewKeyId" text,
  ADD COLUMN IF NOT EXISTS "reviewRequestedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "sentById" text;

COMMIT;
