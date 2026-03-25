# Client Payment Account Optimization Audit

Date: 2026-03-22

Scope reviewed:
- `src/app/(app)/layout.tsx`
- `src/app/(app)/tableau-de-bord/*`
- `src/app/(app)/clients/*`
- `src/app/(app)/services/*`
- `src/app/(app)/paiements/*`
- `src/app/(app)/collaborateurs/*`
- `src/app/(app)/parametres/*`
- `src/components/layout/*`
- `src/components/ui/*`
- `src/hooks/use-clients-directory.ts`
- `src/lib/client-directory-cache.ts`
- `src/lib/auth.ts`
- `src/lib/authorization.ts`
- `src/lib/client-payment-filters.ts`
- `src/server/clients.ts`
- `src/server/client-payments.ts`
- `src/server/accounts.ts`
- `src/server/settings.ts`
- `src/server/analytics.ts`
- related tests under `tests/`

## Short Summary Of Current Problems

The feature works, but most of the flow still relies on slow-feeling patterns: broad server invalidation, redirect-after-mutation, repeated auth/settings resolution, large server payloads, and missing route-level loading boundaries. The result is that navigation feels heavier than it should, create/update flows do not feel immediate, and freshness is often achieved by full rerenders instead of local UI reconciliation.

## Key Findings From The Current Implementation

### 1. App Shell And Navigation

- The shared app shell in `src/app/(app)/layout.tsx` is `force-dynamic` and blocks every page render on `requireUser()` and `getSettings()`.
- The same request then often repeats auth/account resolution again in section layouts and page components via `requireAppSectionAccess()` or `requireAccountPermission()`.
- High-traffic client payment routes do not have a consistent route-level loading strategy:
  - `tableau-de-bord` and `parametres` have `loading.tsx`.
  - `clients`, `services`, `paiements`, `collaborateurs`, and detail routes do not.
- Navigation prefetching is inconsistent. Manual prefetch exists in a few client edit links, but not across the main dashboard/clients/services/payments flow.
- This makes route changes depend too much on fresh server work before the user sees a meaningful loading state.

### 2. Clients Flow

- `src/app/(app)/clients/page.tsx` wraps `ClientDirectoryPanel` in `Suspense`, but `ClientDirectoryPanel` is a client component that does not suspend, so that fallback is not the route-transition skeleton users expect.
- The actual client list is fetched after hydration through `/api/clients` using `useClientsDirectory` and `src/lib/client-directory-cache.ts`.
- This gives incremental search and infinite scroll, but first load still waits for route render and then a client-side fetch, which hurts perceived speed.
- Client create/update/delete actions in `src/app/(app)/clients/actions.ts` redirect back with query-string feedback and use `_clientsRefresh` to force the list hook to reload. The behavior is reliable, but not instant.
- There is no optimistic insert/update/remove in the directory, so every mutation feels server-bound.
- `src/server/clients.ts` search uses multi-field `contains` filters without `mode: "insensitive"` and without dedicated search indexes for the client directory path.
- `ClientDirectoryPanel` mutates the URL with `window.history.replaceState`, which keeps search state shareable, but the router is not driving that state and the current infinite-scroll page is not deeply represented in the URL.

### 3. Services Flow

- `src/app/(app)/services/page.tsx` is fully server-rendered and every create/update/delete goes through redirect-based server actions.
- `ServiceManagementPanel` renders the whole catalog as a long list of inline edit forms. That is maintainable for a small catalog, but it scales poorly in DOM size, page weight, and submit ergonomics.
- Service mutations call `revalidatePath("/services")` and `revalidatePath("/paiements")`, but the UX still waits for a full round-trip instead of showing optimistic row updates.
- The services list is sorted by `updatedAt desc`, while the form redirects back to the current page. On paginated pages, a newly created or updated service can move to page 1 and disappear from the page the user returns to.
- There is no lazy loading or on-demand expansion for the create/edit surface.

### 4. Payments Flow

- `src/app/(app)/paiements/page.tsx` loads:
  - all client filter options,
  - the selected client,
  - settings,
  - period summary,
  - paginated payments,
  - and the full payment service catalog.
- The create-payment form always renders all services as checkboxes and the page renders the client list twice as full `<select>` option lists. This will get slow and bulky as the account grows.
- The create-payment flow is still redirect-based and has no optimistic prepend to the payment list or dashboard summaries.
- The create-payment form does not send a `redirectTo`, so after creation it falls back to `/paiements` or `/paiements?client=...` and drops the current search/date/page context.
- Read-only users still pay for some data they do not need. For example, the full service catalog is fetched even when the create-payment form is hidden.
- `src/server/client-payments.ts` uses one broad include shape for many contexts. List pages and dashboard cards fetch more client/service data than they render.
- `getClientPaymentDashboardSummary()` fans out into many queries per load: summary queries, paginated recent payments, and one aggregate per month in the chart range.

### 5. Collaborators Flow

- `src/app/(app)/collaborateurs/page.tsx` has no route loading boundary and no client-side pending state beyond the submit button.
- `createClientPaymentsInvitationAction()` redirects with `message`/`error` query params, but `CollaborateursPage` does not read search params or render feedback. Success and failure feedback is effectively lost.
- This makes the collaborator flow feel inconsistent compared with clients/services/payments.

### 6. Settings And Dashboard

- `src/app/(app)/parametres/page.tsx` and `src/app/(app)/tableau-de-bord/page.tsx` both fetch settings even though the app layout already fetched settings for the same request.
- `updateSettingsAction()` revalidates `/parametres`, but it does not return explicit success/error UI state. The submit button spins, then the page silently refreshes.
- The client-payments dashboard pulls chart data, summary data, and period report data on demand with no request-scope memoization.
- `RevenueHistoryChart` is always loaded on the dashboard instead of being lazy-loaded as a below-the-fold client enhancement.

### 7. Freshness And Invalidation

- The current strategy relies heavily on `revalidatePath()` fan-out.
- `revalidateClientWorkspace()` invalidates `/tableau-de-bord`, `/clients`, `/clients/[id]`, `/services`, and `/paiements` for many different mutations.
- This keeps data fresh, but it is broader than necessary and makes subsequent navigation heavier.
- There is little tag-based invalidation in the client payment account area, and almost no local optimistic reconciliation after mutations.
- The net effect is fresh data through rerender pressure instead of fast, targeted freshness.

## Optimization Opportunities Grouped By Area

### Navigation And Route Changes

- Add route `loading.tsx` boundaries for `clients`, `services`, `paiements`, `collaborateurs`, and high-traffic detail/edit routes so navigation can show immediate loading skeletons.
- Add deliberate prefetching on the main workspace links and on high-intent row actions, not only on a few edit links.
- Narrow the `force-dynamic` blast radius where possible and memoize per-request auth/settings lookups with Next.js request caching.
- Split slow below-the-fold client UI into lazy chunks where appropriate, especially the dashboard chart and heavy optional panels.

### Mutations And Perceived Latency

- Replace redirect-after-mutation for in-place flows with client shells that use `useActionState`, `useOptimistic`, and `startTransition`.
- Keep submit spinners, but also apply optimistic row insertion/update/removal for:
  - new clients,
  - new services,
  - new payments,
  - collaborator invitations,
  - settings updates where local preview is safe.
- Keep toasts/inline feedback local to the current screen instead of bouncing through query-string redirects.
- Reconcile optimistic state with server truth after the action resolves so data stays fresh without a hard refresh.

### Lists, Filters, And Forms

- Server-render the first page of the client directory instead of always waiting for a client-side fetch after hydration.
- Keep the current client-directory cache pattern, but move it to a model where the first payload is seeded from the server and follow-up filtering stays instant.
- Replace full client/service `<select>` and checkbox payloads with searchable async pickers or progressive loading.
- Avoid loading the full payment service catalog when the user cannot manage payments.
- Reduce overfetch in payment list/detail/dashboard queries by using narrower selects for list views and summary cards.

### Data Freshness And Next.js Caching

- Introduce explicit cache keys/tags for clients, services, payments, dashboard summaries, and settings.
- Use targeted revalidation instead of broad `revalidatePath()` fan-out wherever possible.
- Add request-scope memoization for `requireUser()`, account-context resolution, and `getSettings()` so a single navigation does not repeat the same DB work across layout and page layers.
- Use `router.refresh()` only where needed, and pair it with optimistic UI so refresh becomes reconciliation, not the primary UX mechanism.

### Loading States And Polish

- Add route-level loading skeletons for all primary sections.
- Add row-level and panel-level spinners for mutations that stay in place.
- Use skeleton placeholders for first-load list states and for heavy secondary sections on detail pages.
- Lazy-load below-the-fold or secondary panels instead of blocking the initial paint of the route.

## Important Bugs And Errors That Impact Performance Or UX

- Duplicate feedback rendering: many pages render both `FlashMessages` toasts and inline `Alert` components from the same `message`/`warning`/`error` params.
- Missing collaborator feedback: collaborator invite actions redirect with feedback, but the page never reads it.
- Payments create flow drops active filters: the form does not preserve current search/date/page context through `redirectTo`.
- Service pagination inconsistency: create/update can move a service to another page because the list sorts by `updatedAt desc`.
- Mixed-currency summary inconsistency:
  - the client detail page collapses multi-currency totals into one default-currency figure,
  - the client-payments dashboard report reads only the first currency bucket.
- Clients loading fallback is misleading: the page-level `Suspense` boundary does not actually give the route-loading behavior implied by the code.

## Risks And Things That Must Be Preserved

- Preserve all current data models and current stored data.
- Preserve account isolation, tenant resolution, and permission-based access.
- Preserve current receipt-numbering behavior and receipt snapshot immutability after linked service edits.
- Preserve the migrated global `PaymentService` catalog and `sourceClientId` provenance.
- Preserve the ability to create payments with or without linked services.
- Preserve current route structure, exports, PDF receipt generation, and email sending flows.
- Preserve the existing server-side validation and error semantics unless a change is explicitly intentional.

## Progressive Action Plan

### Task 1. Stabilize The App Shell And Route Navigation [Done]

Status note:
- Completed on 2026-03-22: added route loading boundaries and new skeletons for clients, services, payments, collaborators, and key client/payment detail-edit routes; memoized request-scope auth and settings lookups; added focused prefetching to main navigation, pagination, and high-frequency client/payment links; lazy-loaded the dashboard chart and receipt email form panel.

- Add missing `loading.tsx` files and real skeletons for `clients`, `services`, `paiements`, `collaborateurs`, and key detail routes.
- Memoize auth/account/settings lookups per request and remove duplicate work across app layout, section layouts, and pages.
- Add focused Next.js prefetching for the main navigation and high-frequency detail/edit links.
- Lazy-load below-the-fold client-only pieces such as the dashboard chart and optional detail panels.

### Task 2. Convert Redirect-Based CRUD To In-Place Optimistic UX [Done]

Status note:
- Completed on 2026-03-22: replaced the main client-payment redirect-bound CRUD flows with inline mutation results and client shells for clients, services, payments, collaborators, and client-payment settings; added optimistic list/summary updates, local toast feedback, row or panel pending states, and post-mutation refresh reconciliation without changing the stored data model or validation rules.

- Build small client shells for clients, services, payments, collaborators, and settings using existing repo patterns (`useActionState`, `useTransition`) plus `useOptimistic`.
- Show optimistic UI immediately on create/update/delete, with local toast feedback and row/panel spinners.
- Keep the current server actions and validation rules, but stop depending on full redirect cycles for the main in-place flows.
- Ensure every successful mutation updates visible lists and summaries immediately and then reconciles with fresh server data.

### Task 3. Rework Heavy Lists And Selectors For Scale [Done]

Status note:
- Completed on 2026-03-22: seeded the clients directory from server-rendered page data and primed the client cache for fast first paint; replaced heavy payment client and service selectors with async searchable pickers; collapsed the services catalog into lighter summary cards with on-demand edit panels; and split payment list/search query shapes from the heavier detail include to reduce overfetch and serialization cost.

- Seed the clients directory with server data, then keep search/pagination fast on the client.
- Replace full client/service selects in payments with async searchable pickers.
- Stop rendering the entire service catalog as always-open edit forms; move to lighter row cards plus on-demand edit panels or dialogs.
- Introduce slimmer query shapes for list views and detail previews to reduce overfetch and serialization cost.

### Task 4. Tighten Freshness With Targeted Cache Invalidation [Done]

Status note:
- Completed on 2026-03-22: added explicit cache tags and cached read boundaries for client lists/details, payment services, payment collections, payment summaries, dashboard payment data, and settings; replaced the broad client-payment `revalidatePath()` fan-out with targeted tag invalidation in client, service, payment, and settings mutations; and kept freshness reconciliation on the current route through the existing optimistic UI plus local `router.refresh()` patterns.

- Define explicit cache/tag boundaries for clients, services, payments, dashboard summaries, and settings.
- Replace broad `revalidatePath()` fan-out with smaller invalidation scopes.
- Refresh only the affected surfaces after mutations.
- Make freshness visible through optimistic state + background reconciliation instead of requiring manual hard refreshes.

### Task 5. Fix Consistency Bugs And Lock In Behavior With Tests [Done]

Status note:
- Completed on 2026-03-22: removed duplicated flash-plus-inline feedback from the client and payment pages, restored collaborator redirect feedback rendering, preserved filtered payment-list context through payment creation fallback and detail-delete flows, fixed mixed-currency totals on the client detail page and dashboard period report, and added regression coverage for optimistic payment reconciliation, tag-based payment invalidation plus redirect context retention, and mixed-currency summary separation while keeping the existing receipt snapshot test coverage in place.

- Remove duplicate alert/toast feedback.
- Add collaborator feedback handling.
- Preserve filter/search context during payment creation and deletion flows.
- Fix mixed-currency summary handling on dashboard and client detail pages.
- Add regression tests for optimistic mutation reconciliation, cache invalidation boundaries, preserved receipt snapshots, and filter-context retention.

## Priority Outcome

If only a few changes are made, the highest-value sequence is:

1. real route loading skeletons + request-scope memoization,
2. optimistic in-place CRUD for clients/services/payments/settings,
3. async client/service pickers and slimmer payment queries,
4. targeted cache invalidation instead of broad path revalidation,
5. cleanup of the current UX bugs and consistency gaps.

That sequence should make the full client payment account flow feel materially faster, fresher, and more production-ready without changing the underlying data model or breaking the current business flow.
