-- Rollback for 20261123_digital_order_review.sql. Orders waiting for review can no
-- longer be sent from invoice-app afterwards (send them again from PrestaShop).

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "DigitalOrderFulfilment"
  DROP COLUMN IF EXISTS "reviewPayload",
  DROP COLUMN IF EXISTS "reviewKeyId",
  DROP COLUMN IF EXISTS "reviewRequestedAt",
  DROP COLUMN IF EXISTS "sentById";

COMMIT;
