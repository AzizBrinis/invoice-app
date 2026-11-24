-- Read-only: which tables can Supabase's public Data API read or write with the
-- public anon key? Reads the system catalogs only, never a row of data.
--   PGOPTIONS='-c default_transaction_read_only=on' psql "$DIRECT_URL" -X -f scripts/security/supabase-exposure-check.sql
-- "EXPOSED" = row level security off and anon/authenticated granted.
-- "POLICY"  = row level security on with policies: read them.

\echo '== current role owns the tables (must be t: the app then bypasses RLS) =='
SELECT current_user, bool_and(pg_has_role(current_user, c.relowner, 'USAGE')) AS owns_all
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

\echo '== tables =='
SELECT c.relname AS table,
  CASE
    WHEN NOT g.granted THEN 'closed'
    WHEN NOT c.relrowsecurity THEN 'EXPOSED'
    WHEN EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) THEN 'POLICY'
    ELSE 'closed by RLS'
  END AS state
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL (
  SELECT EXISTS (
    SELECT 1 FROM pg_roles r, unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS privilege
    WHERE r.rolname IN ('anon', 'authenticated') AND has_table_privilege(r.oid, c.oid, privilege)
  ) AS granted
) g
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY (g.granted AND NOT c.relrowsecurity) DESC, c.relname;
