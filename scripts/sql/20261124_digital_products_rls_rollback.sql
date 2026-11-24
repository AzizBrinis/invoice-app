-- Rollback for 20261124_digital_products_rls.sql: only needed if invoice-app
-- connects with a role that does not own the tables. Grants to anon and
-- authenticated are deliberately not restored.

BEGIN;

SET LOCAL lock_timeout = '2s';

ALTER TABLE "DigitalLicenceCode" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalLicenceOrder" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalLicenceEvent" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalOrderFulfilment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ExternalInvoiceRequest" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationRequestNonce" DISABLE ROW LEVEL SECURITY;

COMMIT;
