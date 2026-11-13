-- Rollback for 20261113_digital_order_fulfilment.sql.
-- Licences, invoices and e-mails already produced are NOT affected; only the
-- per-order fulfilment tracking (one e-mail per order guarantee) is dropped.

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS "DigitalOrderFulfilment";

COMMIT;
