-- Rollback for 20261124_digital_order_shop_callback.sql (deploy the previous app first).

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "DigitalOrderFulfilment"
  DROP COLUMN IF EXISTS "shopNotifiedAt",
  DROP COLUMN IF EXISTS "shopNotifyResult";

COMMIT;
