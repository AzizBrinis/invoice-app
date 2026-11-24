-- Defence in depth for Produits Digitaux and the shop integrations: Supabase's
-- public Data API (roles anon/authenticated, reachable with the public anon key)
-- gets no access to these tables. invoice-app only uses the direct Postgres
-- connection, whose role owns the tables and is not subject to row level
-- security. Idempotent; aborts without changing anything when run by a role
-- that does not own the tables.
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/20261124_digital_products_rls.sql
-- Check before and after: scripts/security/supabase-exposure-check.sql

BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  table_name text;
  role_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'DigitalLicenceCode', 'DigitalLicenceOrder', 'DigitalLicenceEvent',
    'DigitalOrderFulfilment', 'ExternalInvoiceRequest', 'IntegrationRequestNonce'
  ] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = format('public.%I', table_name)::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'run this as the owner of %: otherwise invoice-app would lose access', table_name;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
