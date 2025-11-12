# Performance Root Causes

## P0 - Prisma connections stall every request
- **Placement:** `src/lib/prisma.ts` + every server-rendered route, API handler, and background job that imports Prisma.
- **Symptom (quick repro):** Run `source .env && node - <<'NODE' ...` (same snippet as in this audit) before hitting `/api/clients`; even with 7 rows `connect+listClients` logged **1.698 s** and a follow-up `listInvoices+count` logged **1.085 s**. The simpler `time psql "$DATABASE_URL" -c "select 1;"` also takes **0.687 s real**, while `DIRECT_URL` takes **3.692 s** and a second script attempt intermittently fails with `PrismaClientInitializationError: Can't reach database server`.
- **Evidence (baseline timings/traces):**
  - `time psql "$DATABASE_URL" -c "select 1;" → real 0m0.687s`
  - `time psql "$DIRECT_URL" -c "select 1;" → real 0m3.692s`
  - `connect+listClients: 1.698s` and `listInvoices+count: 1.085s` (node script in this audit)
  - Frequent `PrismaClientInitializationError` logs when running simple scripts/background tasks.
- **Likely Cause:** Each Vercel lambda cold start re-establishes a fresh TLS session against the Supabase transaction pooler (eu-north-1). The current `globalThis.prisma` cache only protects node processes, not serverless invocations, so every request pays the connection tax and sometimes exhausts the limited pool (20 connections), causing transient `P1001` errors.
- **How to Fix:** 
  1. Enable Prisma Accelerate or the Data Proxy: provision via `npx prisma accelerate init`, set `PRISMA_ACCELERATE_URL`, and update `src/lib/prisma.ts` to instantiate `new PrismaClient().$extends(withAccelerate())`. 
  2. Keep `DATABASE_URL` for background workers only; point `PrismaClient` in production at the Accelerate/Data Proxy endpoint so connections stay warm across invocations.
  3. For long-running workers (messaging jobs, exports), call `await prisma.$connect()` once on boot and reuse the handle instead of letting each job open/close its own connection.
  4. Raise Supabase pool sizes only after connection reuse is in place, otherwise the extra headroom just hides the leak.
- **Expected Impact:** Removes 700-1800 ms of pure connection latency from every API call and eliminates the random `Can't reach database server` failures, dropping TTFB for `/tableau-de-bord`, `/clients`, `/produits`, exports, and background jobs well under one second.
- **Risk / Side effects:** Requires rolling out Prisma Accelerate (new billing + secret management). Need to ensure background workers and local dev keep a direct path (keep `DIRECT_URL` for scripts/migrations). Testing must confirm Accelerate respects Supabase RLS/SSL requirements.
- **Owner:** Platform (Brice / infra)
- **Status:** [x] (Prisma now targets `PRISMA_ACCELERATE_URL` when provided, so Vercel lambdas hit the Prisma Data Proxy instead of opening raw TCP connections)

## P1 - `getSettings` is uncached (+1.3 s per route)
- **Placement:** `src/server/settings.ts` (used by `/tableau-de-bord`, `/produits`, `/site-web`, `/messagerie`, `/api/email`, PDF generation, website leads, etc.).
- **Symptom (quick repro):** `source .env && node - <<'NODE' ... prisma.companySettings.findUnique ...` prints `companySettings: 1.386s` before any page logic runs. Visiting `/produits` or `/site-web` hits `getSettings` first, so the page TTFB already exceeds a second before loading actual data.
- **Evidence:** `companySettings: 1.386s` measurement in this audit. You can see the same delay by sprinkling `console.time('getSettings')` inside `ProduitsPageContent` or `SiteWebPage`.
- **Likely Cause:** `getSettings` always hits Supabase (and may even `upsert` when missing) because it is neither wrapped in `unstable_cache` nor memoized per-request. Many routes call it even when the data hasn’t changed, multiplying the connection penalty described in P0.
- **How to Fix:** Wrap the underlying Prisma read in a cache keyed by tenant id, e.g. `const getCachedSettings = cache((userId) => prisma.companySettings.findUnique(...))`, invalidate it when `updateSettings` runs, and have every consumer call the cached variant. For cross-request reuse add a 30-60 s `unstable_cache` with `revalidateTag('settings:${userId}')`.
- **Expected Impact:** Removes ~1.3 s of redundant DB time from every route that currently calls `getSettings`, compounding with the P0 fix to get `/produits`, `/site-web`, `/messagerie`, PDF/email flows under 500 ms.
- **Risk / Side effects:** Need to remember to `revalidateTag` (or clear the cache) after any settings mutation, otherwise users will see stale company info. Also ensure sensitive blobs (logos) stay server-only when caching.
- **Owner:** Backend
- **Status:** [ ]

## P1 - Dashboard metrics issue multiple heavy scans
- **Placement:** `/tableau-de-bord` (`src/app/(app)/tableau-de-bord/page.tsx`) and `src/server/analytics.ts`.
- **Symptom (quick repro):** Running the bundled measurement script (`dashboard-metrics: 1.869s`) shows that computing KPIs plus revenue history alone consumes ~1.9 s, even though only six invoices exist. The page then does two more `prisma.findMany` for recent invoices/quotes, so TTFB routinely exceeds 3 s on Vercel.
- **Evidence:** `dashboard-metrics: 1.869s` log from this audit.
- **Likely Cause:** `getDashboardMetrics` fires five independent queries (two `aggregate`, two `count`, one `findMany`) and `buildRevenueHistory` pulls every invoice row for the last six months into Node just to bucket per month. That’s a lot of round-trips and row materialization for a handful of aggregate numbers.
- **How to Fix:** Collapse the computations into a single raw SQL (or Prisma `groupBy`) that uses `date_trunc('month', issueDate)` and `SUM(amountPaidCents)` grouped on the DB, and expose a single cached `getDashboardPayload` that already includes recent invoices/quotes so the page only awaits one promise. Cache the result via `unstable_cache(..., { revalidate: 30, tags: [invoiceStatsTag] })`.
- **Expected Impact:** Cuts dashboard TTFB from ~3 s to sub-1 s while reducing Supabase load by ~4 queries per request.
- **Risk / Side effects:** Need to keep timezone handling (Africa/Tunis) in sync between SQL and JavaScript. Changing the payload shape will require a small UI refactor.
- **Owner:** Analytics / Billing
- **Status:** [ ]

## P1 - CSV exports read entire tables into memory
- **Placement:** `/api/export/{clients,produits,devis,factures,paiements}` via `src/server/csv.ts`.
- **Symptom (quick repro):** `source .env && node - <<'NODE' ... exportInvoicesCsv` logged `exportInvoicesCsv: 1.877s` for **9** invoices, and the first attempt even threw `PrismaClientInitializationError`. Larger tenants hang the lambda or OOM.
- **Evidence:** `exportInvoicesCsv: 1.877s; rows 9` measurement plus the transient Prisma connection failure during the first attempt.
- **Likely Cause:** Each export does `prisma.*.findMany({ include: { client: true } })` without pagination, waits for the entire result set, then builds a giant string synchronously on the Node main thread. There is no streaming, no cursoring, and no storage offload, so the request time and memory footprint scale linearly with row count.
- **How to Fix:** 
  1. Switch to chunked reads (`cursor` + `take`) and stream CSV rows through a `TransformStream` so the response starts immediately.
  2. Alternatively, enqueue a background job (`background-jobs.ts`) that generates the CSV into S3/Object Storage, return a job id immediately, and let the UI poll for a signed download URL.
  3. For fast server-side generation, leverage Postgres `COPY (SELECT ...) TO STDOUT WITH CSV` via `pg-copy-streams` so the DB does the formatting.
- **Expected Impact:** Keeps exports under a few hundred ms regardless of dataset size, eliminates connection spikes, and prevents the API from freezing other requests.
- **Risk / Side effects:** Streaming responses aren’t yet supported by all browsers for `attachment` downloads, so asynchronous exports may require a new UX flow. Also need to scrub PII if files are persisted.
- **Owner:** Billing / Data
- **Status:** [ ]

## P1 - Scheduled email worker runs via `setInterval` inside lambdas
- **Placement:** `src/server/messaging-scheduled.ts` (global `ensureScheduledEmailWorker()`), indirectly imported by messaging actions and pages.
- **Symptom (quick repro):** Set `SCHEDULED_EMAIL_WORKER_ENABLED=1` locally and `npm run dev`: Next spawns multiple runtimes, each starting the worker. The README already notes this saturates the Supabase pool, which mirrors what we see in production logs (random `PrismaClientInitializationError` spikes) because every lambda import spins a 60 s interval that calls `dispatchDueScheduledEmails()` (which does `findMany` + updates) even when nobody is online.
- **Evidence:** README section “Traitement des e-mails planifiés en local” explaining the worker had to be disabled due to pool exhaustion, plus the `setInterval` implementation at `src/server/messaging-scheduled.ts:300-338`.
- **Likely Cause:** The worker design assumes a long-lived process. On Vercel, each request/route loads the module, so intervals either never fire (function freezes) or, worse, multiple copies fire in parallel, each needing its own DB session.
- **How to Fix:** Remove `ensureScheduledEmailWorker()` from the shared module and run scheduled dispatch via a single background channel:
  1. Wire up the existing queue in `src/server/messaging-jobs.ts` to a Vercel Cron endpoint (e.g., `/api/cron/messaging`) that calls `runMessagingCronTick`.
  2. Gate any emergency in-process fallback behind a feature flag so it never runs on serverless runtimes.
  3. Add monitoring on the cron endpoint to ensure no overlapping runs.
- **Expected Impact:** Stops the constant idle polling, freeing up Supabase connections and reducing noisy retries so user-triggered actions see lower latency.
- **Risk / Side effects:** Missed cron executions would delay scheduled emails; need alerting. Requires DevOps work to provision the cron trigger.
- **Owner:** Messaging / Ops
- **Status:** [ ]

## P2 - Search endpoints rely on unindexed `%term%` scans
- **Placement:** `src/server/clients.ts::listClients`, `src/server/products.ts::listProducts`, `src/server/website.ts::listWebsiteProductSummaries`, `/api/clients`, `/api/produits`, `/site-web` product lists.
- **Symptom (quick repro):** Run `source .env && psql "$DIRECT_URL" -c "EXPLAIN (ANALYZE, BUFFERS) SELECT ... WHERE userId='...' AND (displayName ILIKE '%a%' OR companyName ILIKE '%a%' ...)"` - Postgres reports `Filter: ("displayName" ~~* '%a%' ...)` with `Rows Removed by Filter` and planning time > execution time. With only 7 clients the query finishes in ~2.6 ms, but the plan confirms it scans every row. In tenants with 2 500+ clients/products (per `docs/client-performance-report.md`), `/api/clients` and `/api/produits` will degrade linearly past 1 s per call.
- **Evidence:** `EXPLAIN (ANALYZE, BUFFERS)` output captured in this audit showing `Index Scan using "Client_userId_displayName_idx"` followed by a full filter on all `ILIKE` clauses (no trigram index usage).
- **Likely Cause:** Prisma’s `contains` produces `%term%` `ILIKE` filters across multiple columns. Apart from the primary `userId` index there are no trigram or `tsvector` indexes on `displayName`, `companyName`, `email`, `phone`, `sku`, etc., so Postgres must evaluate every row and apply five string comparisons.
- **How to Fix:** 
  1. Enable the `pg_trgm` extension on Supabase and add supporting indexes (e.g., `CREATE INDEX CONCURRENTLY "Client_displayName_trgm" ON "Client" USING GIN ("displayName" gin_trgm_ops);`) for every searched column.
  2. Consider denormalizing into a `search_vector` column (`tsvector`) and query via `@@ plainto_tsquery`, which can be indexed once.
  3. Cap `pageSize` defaults lower (20) when no search term is provided to reduce payloads until indexes ship.
- **Expected Impact:** Keeps `/api/clients` and `/api/produits` under 100 ms even with 10-20 k rows, so virtualized client/product tables stay responsive.
- **Risk / Side effects:** Requires applying migrations that depend on `pg_trgm`; need to ensure Supabase project enables the extension. `tsvector` approach needs triggers or Prisma middlewares to keep the vector in sync.
- **Owner:** Data / Search
- **Status:** [ ]
