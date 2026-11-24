-- Result of the signed call telling PrestaShop that a reviewed order was sent
-- ("Livré" right after "Envoyer"). Additive and idempotent; safe to re-run.
-- Requires 20261123_digital_order_review.sql.
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/20261124_digital_order_shop_callback.sql

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "DigitalOrderFulfilment"
  ADD COLUMN IF NOT EXISTS "shopNotifiedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "shopNotifyResult" text;

COMMIT;
