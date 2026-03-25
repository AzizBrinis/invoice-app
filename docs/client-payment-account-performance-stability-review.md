# Client Payment Account Performance And Stability Review

## Scope Reviewed

This review was based on the current implementation in these areas:

- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/clients/client-directory-panel.tsx`
- `src/hooks/use-clients-directory.ts`
- `src/lib/client-directory-cache.ts`
- `src/app/api/clients/route.ts`
- `src/server/clients.ts`
- `src/app/(app)/clients/actions.ts`
- `src/app/(app)/clients/[id]/page.tsx`
- `src/app/(app)/clients/[id]/modifier/page.tsx`
- `src/app/(app)/clients/nouveau/page.tsx`
- `src/app/(app)/paiements/page.tsx`
- `src/app/(app)/paiements/[id]/page.tsx`
- `src/app/(app)/paiements/actions.ts`
- `src/server/client-payments.ts`
- `src/app/(app)/services/page.tsx`
- `src/app/(app)/services/_components/service-management-panel.tsx`
- `src/app/(app)/services/actions.ts`
- `src/app/(app)/tableau-de-bord/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/lib/auth.ts`
- `src/lib/authorization.ts`
- `src/server/accounts.ts`
- `src/server/settings.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20251210100000_search_trgm_indexes/migration.sql`

## Short Summary

The current client payment account has two different problems at the same time:

1. The clients directory mixes local client-side fetching/cache state with App Router URL navigation state in a way that creates races, redundant route transitions, stale cache reuse, and likely page jump/back behavior.
2. The payments/dashboard/services pages do too much work per request: full datasets are loaded eagerly, summaries are computed in application code instead of with narrower queries, and several routes repeatedly re-run auth/account-resolution logic.

The biggest user-visible issues are real and trace back to the current code:

- client creation can return to a stale clients list
- clients list navigation can trigger extra route changes and race with page opens
- payments and dashboard screens load more data than they need
- page transitions pay repeated auth/account-context costs

## Key Findings

### 1. The clients list has a routing/state design bug, not just a rendering problem

`src/app/(app)/clients/client-directory-panel.tsx` currently:

- keeps its own client-side paginated state
- fetches pages through `/api/clients`
- also mirrors that state back into the URL with `router.replace(...)`
- also rehydrates pages from the `page` search param by replaying `loadMore()`

That creates a bad feedback loop:

- local state changes `lastLoadedPage`
- `router.replace` updates `?page=...`
- the server page re-renders with a new `initialPage`
- the client component receives new props but keeps existing state
- the hydration effect replays `loadMore()` again from page 1 toward the new target

Because the hydration effect does not compare the target page with the already loaded page, it can load extra pages that were not requested.

Relevant code:

- `src/app/(app)/clients/client-directory-panel.tsx`
  - hydration effect: around lines 134-155
  - URL sync effect: around lines 245-260

### 2. The clients list cache invalidation is unsafe and explains the stale UI after create/update/delete

The stale list after adding a client is consistent with the current cache behavior.

`src/lib/client-directory-cache.ts`:

- stores page data in a module-level in-memory `Map`
- `clearClientCache()` only clears the map
- in-flight requests are not aborted
- when an old request finishes, it still writes its stale result back into the cache

`src/hooks/use-clients-directory.ts` then:

- reads the cache first
- skips re-fetching if the cache entry is still considered fresh

That means this sequence is possible:

1. old `/api/clients` request starts
2. user creates a client
3. `clearClientCache()` runs
4. old request finishes and repopulates the cache with the pre-create list
5. returning to `/clients` reuses that freshly written stale cache entry
6. new client does not appear until hard refresh or TTL expiry

Relevant code:

- `src/lib/client-directory-cache.ts`
  - `loadClientPage`
  - `clearClientCache`
- `src/hooks/use-clients-directory.ts`
  - initial cache read and `needsFetch` decision in the main effect

### 3. The clients list can issue late route replacements that plausibly cause the "page opens then goes back" symptom

The clients list effect calls `router.replace(target)` whenever:

- debounced search changes
- status changes
- `lastLoadedPage` changes

That replace is not guarded by:

- "URL already matches"
- "user is navigating away"
- "this change was caused by hydration only"

So a pending list-state update can still enqueue a list route replacement while the user is opening another page from the list. In App Router this is a real navigation, not a shallow local URL mutation.

This is the strongest code-path match for the reported:

- page briefly opens
- then the app goes back to the previous page unexpectedly

Relevant code:

- `src/app/(app)/clients/client-directory-panel.tsx`
  - URL sync effect around lines 245-260

### 4. The clients directory API path repeats auth/context work unnecessarily

`GET /api/clients` already does:

- `getCurrentUser()`
- `ensureCanAccessAppSection(user, "clients")`

but it then calls `listClients()` without passing the tenant id, and `listClients()` calls `requireUser()` again internally.

So one clients API request performs duplicated session/account resolution work.

Relevant code:

- `src/app/api/clients/route.ts`
- `src/server/clients.ts`

### 5. Auth/account-context resolution is expensive across the whole workspace

The read path for authenticated pages is heavier than it should be.

`src/lib/auth.ts` -> `hydrateSessionUser(...)` does:

- `ensureOwnedAccountContext(session.userId)`
- `resolveUserAccountContext(...)`

and `resolveUserAccountContext(...)` in `src/server/accounts.ts` calls `ensureOwnedAccountContext(...)` again.

`ensureOwnedAccountContext(...)` performs `upsert` operations on every call.

So a normal page load can trigger repeated account and membership upserts before the actual page query work even starts.

This cost is then multiplied because the same route stack often calls auth repeatedly:

- `src/app/(app)/layout.tsx`
- section layout (`clients`, `paiements`, `services`)
- page component
- API route calls from the page

This is a cross-cutting cause of sluggish navigation.

### 6. `getClient(...)` over-fetches and makes client pages slower than needed

`src/server/clients.ts:getClient` includes:

- `quotes: true`
- `invoices: true`

even when the caller only needs:

- client identity fields for filter validation
- form defaults
- profile header fields

This affects:

- `src/app/(app)/clients/[id]/page.tsx`
- `src/app/(app)/clients/[id]/modifier/page.tsx`
- `src/app/(app)/paiements/page.tsx` when a client filter is selected
- `src/app/(app)/services/page.tsx` when showing the legacy client banner

For clients with many quotes/invoices this will materially slow page loads.

### 7. Payments pages are unbounded and fetch more data than interactive screens should fetch

`src/app/(app)/paiements/page.tsx` loads, on first render:

- all client filter options
- selected client details
- full payment period report
- all payment services
- then renders every returned payment row

The problem is that the default payments page has no default date limit. `parseClientPaymentFilters(...)` returns `null` dates unless the URL provides them, so the default page can load the full payment history.

Relevant code:

- `src/lib/client-payment-filters.ts`
- `src/app/(app)/paiements/page.tsx`
- `src/server/client-payments.ts:getClientPaymentPeriodReport`
- `src/server/client-payments.ts:listClientPayments`

### 8. Payment report/dashboard functions do full data loads and aggregate in application code

`src/server/client-payments.ts:getClientPaymentPeriodReport(...)`:

- calls `listClientPayments(...)`
- loads full payment rows with client and service-link includes
- loops in Node to compute totals
- returns the full item list as well

`src/server/client-payments.ts:getClientPaymentDashboardSummary(...)`:

- separately loads all payments in the dashboard range
- also includes client and service-link data for every row
- computes monthly totals in application code

Then `src/app/(app)/tableau-de-bord/page.tsx` calls both of those functions in parallel for the client-payments dashboard, which means two overlapping full scans for the same workspace view.

This is a major architectural source of slowness.

### 9. Client detail pages also load the full payment history eagerly

`src/app/(app)/clients/[id]/page.tsx` calls `listClientPayments({ clientId })` and renders the full history.

There is:

- no pagination
- no limit
- no summary/list split

For active clients this will become slow and memory-heavy.

### 10. Services pages are also unbounded and render heavy editable UI for every item

`src/app/(app)/services/page.tsx` loads the full service catalog.

`src/app/(app)/services/_components/service-management-panel.tsx` then renders:

- a full editable form for every service when the user can manage services
- plus a create form

This is a large DOM tree and will not scale well.

### 11. Search/index coverage is incomplete for payment/service workloads

There are trigram indexes for client text search:

- `prisma/migrations/20251210100000_search_trgm_indexes/migration.sql`

But there is no equivalent search-index strategy for the payment/service fields that are queried with `contains` + `mode: "insensitive"` in `buildPaymentWhere(...)` and `listPaymentServices(...)`.

Fields currently searched without dedicated text-search support include:

- payment `receiptNumber`
- payment `reference`
- payment `method`
- payment `description`
- payment `note`
- payment service-link `titleSnapshot`
- payment service-link `detailsSnapshot`
- payment service `title`
- payment service `details`
- payment service `notes`
- payment service `privateNotes`

This is likely to become a real DB bottleneck as data grows.

## Likely Root Causes Grouped By Area

### A. Clients List Routing And Navigation

- App Router URL changes are being used as a synchronization mechanism for client-side infinite-scroll state.
- The list has two sources of truth for pagination: local loaded pages and `searchParams.page`.
- The hydration logic is not idempotent against already loaded state.
- Route updates are fired from effects, which makes them race-prone during navigation.

### B. Freshness And Mutation Feedback

- `revalidatePath(...)` refreshes server-rendered routes, but the clients list does not actually use route data as its primary data source.
- The real data source for the list is the custom client-side cache, and that cache is not mutation-safe.
- Cache invalidation does not cancel stale in-flight requests.

### C. Query Volume And Over-Fetching

- Interactive pages fetch full datasets where summary plus paginated detail would be enough.
- Helper functions return broader payloads than their callers need.
- The same workspace screen often triggers multiple overlapping queries for the same domain data.

### D. Request Pipeline Overhead

- Session/account context hydration is repeated across layout, section layout, page, and API route layers.
- Auth hydration currently performs write-heavy account upsert work during normal reads.
- Some API routes validate auth once and then call helpers that validate auth again.

### E. Database Search Scalability

- Client search has trigram support.
- Payment and service search paths do not.
- Current search code relies on multiple `OR`/`contains` predicates across text fields and joined relations, which will degrade badly without a dedicated indexing strategy.

## Risks And Things To Preserve

- Preserve all current tenant/account permission boundaries.
- Preserve the current account model and collaborator permission behavior.
- Preserve receipt numbering and receipt snapshot generation behavior.
- Preserve payment-to-service snapshot behavior on create/delete/update.
- Preserve current redirect targets and flash-message semantics where users already rely on them.
- Preserve the current global service-catalog model.
- Preserve existing exported report/receipt behavior even if interactive views become paginated or summarized.
- Do not drop or rewrite existing client/payment data as part of the optimization work.

## Progressive Action Plan

Keep this to a small number of high-value execution tasks.

### Task 1. Stabilize The Clients Directory State Model

Status: Done.
Note: Removed App Router page-sync navigation from the clients directory, kept filter URL updates on the current history entry only, and made initial page hydration advance from the already loaded state instead of replaying pagination from page 1.

Goal:

- stop page jumps
- stop route races
- make client list state deterministic

Recommended direction:

- pick one source of truth for the clients list
- do not keep infinite-scroll pagination state and App Router page state in a feedback loop

Practical changes:

- `src/app/(app)/clients/client-directory-panel.tsx`
  - remove unconditional `router.replace(...)` on `lastLoadedPage`
  - if URL sync is kept, limit it to deliberate filter changes only, with equality guards
  - make hydration idempotent against `lastLoadedPage`, not "replay from 1"
- `src/hooks/use-clients-directory.ts`
  - expose clearer reset/load APIs if needed
- `src/app/(app)/clients/page.tsx`
  - simplify `page` handling so it matches the chosen data model

Success criteria:

- opening a client from the list never bounces back to `/clients`
- loading more pages does not trigger secondary route-driven rehydration loops
- search/status filtering feels immediate and does not cause unstable navigation

### Task 2. Make Client List Freshness Mutation-Safe

Status: Done.
Note: Added generation-based client cache invalidation with abortable requests, prevented invalidated in-flight responses from repopulating the cache, and added a one-shot post-mutation refetch path for the clients list after create, update, and delete redirects.

Goal:

- new or updated clients appear immediately without hard refresh

Practical changes:

- `src/lib/client-directory-cache.ts`
  - add abortable requests or cache-generation/version invalidation
  - prevent old requests from repopulating cache after invalidation
- `src/hooks/use-clients-directory.ts`
  - force a post-mutation refetch path that cannot be bypassed by stale fresh-cache entries
- `src/app/(app)/clients/client-form.tsx`
- `src/app/(app)/clients/client-directory-panel.tsx`
- `src/app/(app)/clients/actions.ts`
  - ensure all create/update/delete return paths trigger the same freshness strategy

Suggested tests:

- create client -> redirect to `/clients` -> new client is visible immediately
- update client -> return to list/detail -> updated fields are visible immediately
- delete client -> list updates without hard refresh
- invalidation during an in-flight `/api/clients` request cannot restore stale data

### Task 3. Bound Interactive Screens And Split Summary Queries From Detail Queries

Status: Done.
Note: Split interactive payment summaries from detail lists, added paginated payment/service queries for interactive pages, limited client detail history to a recent preview, and removed the client-payments dashboard's overlapping full-history scans.

Goal:

- make `/paiements`, `/clients/[id]`, `/services`, and the client-payments dashboard fast under real data volume

Practical changes:

- `src/server/client-payments.ts`
  - split report-summary queries from detail-list queries
  - stop loading full included payment rows just to compute totals/counts
  - add paginated list functions for interactive pages
- `src/app/(app)/paiements/page.tsx`
  - add bounded default filters and/or pagination
  - load only the data needed for the visible list
- `src/app/(app)/clients/[id]/page.tsx`
  - paginate or limit payment history
- `src/app/(app)/services/page.tsx`
- `src/app/(app)/services/_components/service-management-panel.tsx`
  - paginate or otherwise reduce the all-forms-at-once rendering strategy
- `src/app/(app)/tableau-de-bord/page.tsx`
  - avoid running two overlapping full payment scans for the same dashboard load

Success criteria:

- payments page first load is bounded and predictable
- client detail stays fast even for heavy-history clients
- services catalog does not render an unbounded editable DOM
- dashboard load time no longer scales linearly with full payment history

### Task 4. Remove Redundant Auth/Account-Context Work And Fill Search Index Gaps

Status: Done.
Note: Made owned-account bootstrap read-first instead of write-first, removed the extra bootstrap call from session hydration, threaded resolved tenant ids through the clients API and related client-payment pages, and added trigram indexes for payment/service search fields.

Goal:

- reduce per-navigation overhead across the whole workspace

Practical changes:

- `src/lib/auth.ts`
- `src/server/accounts.ts`
  - remove repeated account upserts from normal request hydration path
  - ensure account bootstrap happens once, not on every read
- `src/app/api/clients/route.ts`
- `src/server/clients.ts`
  - stop double-auth resolution in the clients API path by passing resolved tenant/user context into data helpers
- review other authenticated helpers to pass `tenantId` when already known
- `prisma/schema.prisma` and migrations
  - add payment/service search indexes aligned with real query predicates

Success criteria:

- page navigation no longer performs repeated auth/context write work
- `/api/clients` no longer resolves auth twice
- payment/service search remains responsive as data grows

## Next.js-Specific Notes

- In Next.js App Router, changing `searchParams` through `router.replace(...)` is a real route transition that re-runs server components for that route tree. The current clients list uses that mechanism as part of ordinary local pagination/filter state, which is the wrong level of abstraction for this screen.
- `revalidatePath(...)` only helps if the page is actually reading the invalidated server data on the next render. The clients list mostly reads from a custom browser-side cache, so route revalidation alone cannot guarantee fresh UI.
- The current implementation mixes RSC navigation, browser-side cache, client-side infinite scroll, and server-action redirects. That combination is the main instability source. The later implementation should simplify the data ownership model instead of layering more invalidation calls on top.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4

That order matters:

- Task 1 and Task 2 address the broken/stale user experience directly.
- Task 3 addresses the heavy data-loading path after navigation is stable.
- Task 4 reduces cross-cutting overhead and improves long-term scalability.
