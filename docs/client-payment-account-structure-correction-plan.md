# Client Payment Account Structure Correction Plan

## Problem Summary

The focused client-payment account already exposes separate navigation entries for `Clients`, `Services`, and `Paiements`, and the client detail page already acts mainly as a dossier plus payment-history view. The remaining mismatch is deeper in the domain model and workflow:

- services are still modeled as `ClientService`, with a required `clientId`
- payment creation still depends on choosing a client first, then entering the payments section with that client preselected
- the dedicated `Services` section is still a client-picker plus client-specific CRUD, not a true account-level service catalog

Because of that, the product still behaves like "client-owned services + client-started payments" instead of "global services + global payments, both linked back to clients for history".

## Target Structure

- `Clients`
  - list clients
  - open/edit a client
  - show that client's payment history
  - do not use the client page as the place to manage services
  - do not use the client page as the main place to create/manage payments
- `Services`
  - dedicated global section for the current account/workspace
  - one reusable service catalog, not one service list per client
  - CRUD for service records with at least name, description/details, and price
- `Paiements`
  - dedicated global section for all client payments
  - global search/browse/detail flow
  - create payment directly from `/paiements`
  - choose the client and the service(s) from global lists
  - keep payments linked to clients and services for history, reports, receipts, and exports

## Code Areas Inspected

- `prisma/schema.prisma`
- `prisma/migrations/20260317170000_client_payment_domain/migration.sql`
- `prisma/migrations/20260318111425_add_client_service_price/migration.sql`
- `src/server/client-payments.ts`
- `src/server/clients.ts`
- `src/app/(app)/clients/[id]/page.tsx`
- `src/app/(app)/clients/actions.ts`
- `src/app/(app)/services/page.tsx`
- `src/app/(app)/services/_components/service-management-panel.tsx`
- `src/app/(app)/paiements/page.tsx`
- `src/app/(app)/paiements/[id]/page.tsx`
- `src/app/api/clients/payments/[id]/receipt/route.ts`
- `src/app/api/clients/payments/export/pdf/route.ts`
- `src/app/api/clients/payments/export/excel/route.ts`
- `tests/client-payments.test.ts`

## Key Findings From The Current Implementation

### What is already aligned

- The focused account already has dedicated nav entries for `Clients`, `Services`, and `Paiements`.
- The client page already shows payment history inside the client dossier.
- The payments list/reporting flow is already global when no `client` filter is applied.
- Receipt/report/export generation is already based on payment records plus immutable snapshots, which is a strong base for a safe refactor.

### What is still mismatched

1. Services are hard client-scoped in the schema.
   - `Client.services` points to `ClientService`.
   - `ClientService` has a required `clientId`.
   - deleting a client cascades to its services at the database level.
   - this is the core reason a service currently belongs to one client only.

2. Service CRUD is implemented as client CRUD, just rendered in a separate route.
   - `createClientService`, `updateClientService`, and `listClientServices` all require `clientId`.
   - `src/app/(app)/services/actions.ts` is only a thin wrapper around client actions.
   - `ServiceManagementPanel` requires `clientId`, binds every form action with that client, and labels the whole section "Services du client".

3. The `Services` page is not a global catalog page today.
   - it loads a client list first
   - it only loads services when a `client` query param resolves to a selected client
   - without a selected client it shows a warning asking the user to choose a client
   - this means the page is structurally "pick a client, then manage that client's services"

4. Payment creation is still client-driven even though payment browsing is global.
   - the page can list all payments globally
   - but the creation form only appears when a client filter is selected
   - the form action is bound as `createClientPaymentAction(selectedClient.id, ...)`
   - selected services are loaded only from `listClientServices(selectedClient.id, ...)`
   - without a selected client the page explicitly tells the user to select a client first

5. Server-side payment validation still enforces same-client services.
   - `createClientPayment` accepts a `clientId`
   - `getServicesForPayment(...)` validates linked services by `userId` and `clientId`
   - this prevents attaching the same service record to multiple clients, even if the UI changed

6. Client pages still push users into client-filtered service/payment flows.
   - the client detail page builds links to `/services?client=<id>` and `/paiements?client=<id>`
   - it also redirects `workspace=services|payments` into those client-filtered URLs
   - this is acceptable for payment history views, but it reinforces a client-first workflow for actions

7. Client deletion rules assume services are owned by clients.
   - `deleteClient(...)` blocks deletion when `clientService` or `clientPayment` rows exist
   - once services become account-global, that specific service ownership rule must change

8. Historical payment data already depends on service snapshots and must be preserved.
   - `ClientPaymentService` stores `titleSnapshot`, `detailsSnapshot`, and optional allocated amounts
   - receipt snapshots also embed service title/details
   - tests already verify that editing a service after payment creation must not alter historical receipts

9. Naming collisions already exist elsewhere in the repo.
   - there is already a separate `Payment` model for invoice payments
   - there is already a separate `Product` domain for the full app/site/catalog
   - because of that, a refactor should not casually rename the focused account domain to plain `Payment` or try to reuse `Product` as-is

10. Tenant/account scoping is implemented through the current "userId" field pattern.
    - the focused account code resolves scope with `getClientTenantId(...)`
    - new global services must stay account/workspace-scoped exactly the same way as current clients and payments

## Risks And What Must Be Preserved

- Preserve all existing `ClientPayment`, `ClientPaymentService`, receipt numbers, receipt timestamps, and receipt snapshots.
- Preserve current PDF, Excel, e-mail, and detail-page behavior for existing payment IDs.
- Preserve the client detail page as a place to view client info and that client's payment history.
- Preserve the global payments list/reporting flow that already works.
- Preserve historical multi-service payment links even if the new create-payment UI is simplified.
- Preserve account/workspace isolation through the existing tenant-resolution pattern.
- Preserve current URLs where practical.
  - `/paiements?client=<id>` should remain meaningful as a filtered history view.
  - old `/services?client=<id>` entry points should not break abruptly during transition.
- Do not auto-deduplicate existing client services during migration.
  - two clients may currently have similarly named services with different notes, prices, or private notes
  - auto-merging them would be a data-loss risk
- Avoid a broad rename to plain `Payment`, because the invoice domain already owns that model name.

## Recommended Refactor Direction

Use a dedicated account-scoped service entity for the focused client-payment domain, and migrate current `ClientService` rows into it 1:1.

Why this is the safer direction:

- it corrects the business model instead of only hiding the client coupling in the UI
- it avoids leaving a misleading required `clientId` in the service table
- it preserves every existing service record without forced deduplication
- it lets payment records stay linked to clients while making services reusable
- it avoids colliding with the existing invoice `Payment` model

For the payments side, keep the current `ClientPayment` domain model name internally for now if that reduces risk, but change the workflow contract so `/paiements` owns creation and selection of both client and service.

## Progressive Tasks

### Task 1: Introduce account-scoped services with a lossless migration [Done]

- Add a new account/workspace-scoped service model for the focused client-payment domain.
- Migrate every existing `ClientService` row into the new global service model 1:1.
- Repoint payment-service links to the new service model without changing payment IDs or receipt data.
- Keep existing service snapshots untouched.
- Do not deduplicate during migration.
- Adjust delete-client rules so global services no longer make a client undeletable just because that client once "owned" them.

Backward compatibility / preservation:

- existing payments, receipts, and reports must still resolve after the migration
- existing service-linked payments must keep their historical service snapshots

Done note:

- Added the new account-scoped `PaymentService` model and a dedicated migration that copies every legacy `ClientService` row 1:1 with the same IDs.
- Repointed `ClientPaymentService.clientServiceId` to `PaymentService` so existing payment/service links stay connected without rewriting payment records or receipt snapshots.
- Kept current server-side client service flows working through a compatibility field (`sourceClientId`) and compatibility mapping in `src/server/client-payments.ts`.
- Updated client deletion rules so services alone no longer block deleting a client, and added focused coverage for preserving a service after deleting its source client.

### Task 2: Refactor the service and payment domain APIs around the target structure [Done]

- Replace client-scoped service listing/CRUD helpers with account-scoped service helpers.
- Change payment creation so the server action receives `clientId` from the form, not from route binding.
- Change payment-to-service validation so services are validated by account/workspace ownership, not by matching client ownership.
- Keep client filtering on payment listing/reporting as an optional reporting view, not as a prerequisite for creation.

Backward compatibility / preservation:

- keep compatibility adapters where helpful so existing pages/routes can transition incrementally
- keep current payment detail, receipt, export, and report contracts stable while the internals change

Done note:

- Added account-scoped service helpers in `src/server/client-payments.ts` (`listPaymentServices`, `createPaymentService`, `updatePaymentService`, `deletePaymentService`) while keeping the existing client-scoped helpers as compatibility adapters.
- Changed payment creation so the server action now reads `clientId` from submitted form data instead of relying on a route-bound client argument.
- Updated payment-service validation to resolve services by tenant/account ownership, which now allows linking the same service record to multiple clients without breaking payment history contracts.
- Switched the current `/paiements` creation form to read from the global account service list while preserving the existing page layout for the later Task 3 workflow rebuild.
- Added focused regression coverage for global service listing and cross-client payment linkage.

### Task 3: Rebuild the `Services`, `Paiements`, and client-detail pages around the corrected workflow [Done]

- Rebuild `/services` as a true global catalog page using existing app patterns from other top-level list/CRUD sections.
- Rebuild `/paiements` so a new payment can be created directly there by selecting:
  - one client
  - zero, one, or multiple global services
- Keep `/paiements` as the main searchable global list and detail entry point.
- Keep the client detail page focused on client information plus contextual payment history.
- Remove client-specific service-management framing from the client page and from the services page.
- Update backlinks and redirects so client pages no longer force users into a client-owned services flow.

Backward compatibility / preservation:

- keep `/paiements?client=<id>` as a filtered client-history shortcut
- tolerate old service URLs during rollout, even if they now land on the global services page

Done note:

- Rebuilt `/services` into a global service-catalog page backed by account-scoped service actions, while still tolerating old `?client=` entry points by landing them on the shared catalog with a compatibility notice.
- Rebuilt the `/paiements` creation flow so a payment can now be created directly there by selecting a client and any global service(s), while preserving `/paiements?client=<id>` as a filtered history/reporting shortcut.
- Trimmed the client detail page back to client information plus contextual payment history, removed the client-owned service-management framing, and updated the client-page redirects so `workspace=services` now lands on the global services page instead of forcing a client-specific service flow.
- Added the small supporting domain adjustment needed for the new global service editor so editing a service no longer clears preserved `sourceClientId` metadata unless that field is explicitly changed.

### Task 4: Lock the change down with migration and regression coverage [Done]

- Add migration coverage for existing service/payment data preservation.
- Add tests for reusing the same global service across multiple clients.
- Add tests for creating a payment directly from `/paiements`.
- Keep and extend snapshot/receipt tests so service edits still do not mutate historical receipts.
- Verify PDF, Excel, and e-mail paths against migrated data.

Done note:

- Extended `tests/client-payments.test.ts` to cover export snapshot preservation, explicit reuse of the same global service across multiple clients, and migrated payment-link preservation after deleting a source client.
- Added `tests/client-payment-actions.test.ts` to lock the `/paiements` creation contract around `FormData` submission with `clientId` coming from the page form instead of route binding.
- Added `tests/client-payment-email.test.ts` to verify the receipt e-mail flow against preserved payment snapshots while mocking only the transport/PDF delivery edges.
- Extended `tests/pdf.test.ts` with an env-gated client-payment receipt PDF regression on a global-service link, and adjusted the PDF test file so it now respects the existing skip gate before importing DB-dependent modules.

## Implementation Notes To Carry Into The Refactor

- Reuse the existing page/layout patterns from `Clients` and `Produits`, but do not reuse the current `Product` data model for this first correction.
- Keep the current receipt/reporting snapshot strategy; it is already the main safety net for historical integrity.
- Favor a staged migration with compatibility layers over a big-bang rename across every route and helper.
- Treat the current data as production data: no lossy merge, no silent remapping, no destructive cleanup during the first pass.
