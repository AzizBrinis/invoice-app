-- Rollback for 20261109_external_invoice_requests.sql.
-- Disable the endpoint first (unset PRESTASHOP_INVOICE_API_KEYS), then run.
-- Invoices created through the API are NOT deleted; only the tracking tables are.

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS "ExternalInvoiceRequest";
DROP TABLE IF EXISTS "IntegrationRequestNonce";

COMMIT;
