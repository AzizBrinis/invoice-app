# Database Migration Performance Plan

## Findings

- The app is not using `@supabase/supabase-js` for database access. It uses a Prisma-shaped compatibility layer exported as `prisma` from `src/lib/db/index.ts`, backed by the `postgres` driver in `src/lib/db/postgres.ts`.
- A wholesale move to `@supabase/supabase-js` is unlikely to improve server-side database performance. This app relies on transactions, raw SQL analytics, batch writes, and server-only authorization. Direct Postgres is the better runtime path; `supabase-js` is only worth standardizing for Supabase Storage/Auth features if those are adopted.
- The main migration regressions are in the compatibility wrapper: `findMany` always emits `SELECT *`, relation projection happens after hydration, nested relation `where` is overwritten, nested `take` is applied globally instead of per parent, and writes often use `RETURNING *` plus an extra read.
- The default DB pool is intentionally conservative (`DB_MAX_CONNECTIONS=1`), which protects Supabase/serverless connections but serializes `Promise.all` DB calls inside a warm process. Tune only with measurement.
- There is no checked-in Prisma schema or SQL migration source of truth beyond a one-off optimization script, so schema/index drift is hard to audit after the migration.

## Tasks

1. **Done: P0: Fix relation loading correctness before tuning performance.**  
   Update `src/lib/db/client.ts` so `loadRelationValues` merges relation filters with nested `args.where` using `AND` instead of replacing it. Fix to-many nested `take/orderBy` semantics so `take: 1` is applied per parent, not across all parents. Add regression tests around order payments in `src/server/orders.ts`, `src/server/order-email.ts`, and `src/app/api/catalogue/orders/[id]/route.ts`.
   - Completed: relation filters are now merged, paginated to-many relations load per parent, and order-payment regression coverage was added in `tests/db-client-relations.test.ts`.

2. **Done: P0: Push scalar `select` down into SQL for hot reads.**  
   Replace the wrapper's `SELECT *` path with explicit column selection for scalar fields, while automatically adding relation key fields needed for grouping. Prioritize `MessagingLocalMessage` summaries/searches, catalog product listings, order lists, dashboard recent documents, and auth/session reads. Add tests that summary queries do not fetch large fields such as `sanitizedHtml`, `normalizedText`, or `searchText`.
   - Completed: selected scalar fields are now pushed into SQL, relation grouping keys are added internally, and messaging summary regression coverage verifies large body/search fields are not fetched.

3. **Done: P1: Reduce write round trips and returned payload size.**  
   Change `create`, `update`, and atomic `upsert` to use `RETURNING` only for requested scalar fields or primary keys when possible, and skip the follow-up `findFirst` when there is no `include`. Bulk insert nested `createMany` payloads instead of looping through child `createRecord` calls. Start with `upsertMessagingLocalMessage`, invoice/quote line replacement, and order/payment writes.
   - Completed: write queries now use narrow `RETURNING` fields, scalar-only create/update/upsert results avoid the final parent reread, nested `createMany` payloads are inserted in bulk, and invoice/quote/order line writes now use that bulk path with regression coverage in `tests/db-client-writes.test.ts`.

4. **Done: P1: Add DB query observability, then benchmark connection settings.**  
   Add non-production query timing around `executeStatement`/`executeSqlFragment` with duration, model/table when known, row count, and a slow-query threshold. Benchmark representative pages and cron jobs with `DB_MAX_CONNECTIONS=1` versus a small value like `2` or `4` on the Supabase transaction pooler before changing defaults.
   - Completed: non-production query timing now wraps raw statement and SQL-fragment execution with operation/model/table, row count, duration, and configurable slow thresholds. Added a read-only `db:benchmark-connections` benchmark for representative dashboard, order, messaging, and cron queries across `DB_MAX_CONNECTIONS=1,2,4` without changing defaults.

5. **Done: P2: Restore a database schema and index source of truth.**  
   Check in a maintained SQL schema/migration baseline or regenerate flow for `src/lib/db/generated-schema.ts`. Include required indexes for messaging local search/listing, catalog product listing, order filters, sessions, and background jobs. Verify the existing `scripts/sql/20260411_db_optimization.sql` changes are applied in production and add missing indexes through reviewed Supabase SQL migrations.
   - Completed: added a reviewed SQL index baseline with idempotent concurrent indexes, confirmed `BackgroundJobEvent_createdAt_idx` exists through a read-only production check, added deployment verification output, documented how to keep `generated-schema.ts` aligned with reviewed SQL, and covered the baseline in `tests/db-schema-index-baseline.test.ts`.
