# Client Payment Account Restructure Plan

Date: 2026-03-18

## Short Summary Of The Problem

The `CLIENT_PAYMENTS` account type currently exposes a reduced shell, but the product structure inside that shell is wrong.

- Navigation and section access only expose `Dashboard` and `Clients`.
- The client detail page (`src/app/(app)/clients/[id]/page.tsx`) has become a catch-all workspace that mixes:
  - client profile
  - period reporting
  - service CRUD
  - payment creation and receipt actions
  - account collaborator invitations and permission management

This conflicts with the intended product structure, where `Clients`, `Services`, `Payments`, `Collaborateurs du compte`, and `Settings` are separate sections with clear responsibilities.

## Target Structure For This Account Type

- `Dashboard`
  - Payment-focused overview, period summary, recent activity.
- `Clients`
  - Client information only.
  - Payment history for the selected client.
  - Reasonable client edits.
  - No service management, payment creation, or collaborator management here.
- `Services`
  - Dedicated section for create/edit/delete/view.
  - Simple service model: at minimum name, description/details, price, client association, active state.
- `Payments`
  - Main operational section.
  - Ordered payment list, search, detail view, new payment creation, receipt actions, period export in PDF and Excel.
- `Collaborateurs du compte`
  - Dedicated account-level section for invitations, memberships, and permissions.
- `Settings`
  - Reuse the main settings pattern where it fits, but keep only receipt-relevant fields.
  - Exclude tax, VAT/TVA, FODEC, timbre fiscal, and invoice/quote-specific configuration.

## Key Findings From The Current Implementation

### 1. The account shell is already account-type aware, but only for `Dashboard` and `Clients`

- `src/app/(app)/layout.tsx` hard-codes the full app nav and filters it through `canAccessAppSection()`.
- `src/lib/authorization.ts` only grants `CLIENT_PAYMENTS` section access for:
  - `dashboard` via `DASHBOARD_VIEW`
  - `clients` via `CLIENTS_VIEW`
- There is no focused-account section model yet for:
  - `Services`
  - `Payments`
  - `Collaborateurs du compte`
  - focused `Settings`

Impact:

- The current structure cannot expose the intended IA without extending app sections and route gating.

### 2. There are no dedicated focused-account routes for services, payments, or collaborators

Current `src/app/(app)` directories include `clients`, `tableau-de-bord`, and the shared full-app sections, but no dedicated route groups for:

- `services`
- `paiements`
- `collaborateurs`

Impact:

- The current IA forces unrelated features into the client page because the route structure does not provide separate homes for them.

### 3. The client page is overloaded and is the main structural mismatch

`src/app/(app)/clients/[id]/page.tsx` currently loads and renders all of the following in one page:

- client profile and edit entry point
- client payment period report
- service listing and service forms
- payment creation form
- payment history with receipt download/email actions
- account collaborator invitation form
- collaborator and pending invitation lists

The page loader fetches:

- `listClientServices(...)`
- `listClientPayments(...)`
- `getClientPaymentPeriodReport(...)`
- `listAccountCollaborators(...)`
- `listPendingAccountInvitations(...)`

Impact:

- The current client page is acting as:
  - a client record page
  - a services page
  - a payments page
  - a collaborators page
  - a report page

This is the primary mismatch with the intended product.

### 4. The service domain already exists and is reusable, but its data model is incomplete for the intended UX

The domain is already additive and separate from invoices/orders:

- `ClientService`
- `ClientPayment`
- `ClientPaymentService`

The current service flow already supports:

- list/create/update/delete
- details
- notes
- private notes
- active/inactive state

But `ClientService` currently has no price field in either schema or UI:

- `prisma/schema.prisma`
- `src/server/client-payments.ts`
- `src/app/(app)/clients/actions.ts`
- `src/app/(app)/clients/[id]/page.tsx`

Impact:

- A dedicated `Services` section can reuse the current tables and actions, but it cannot meet the expected product requirements until price is added as an additive field.

### 5. The payment domain is already separate and stable enough to preserve, but the UX is still client-page-centric

What already exists:

- standalone `ClientPayment` records
- links to zero or more services
- immutable receipt snapshots
- receipt PDF generation
- receipt email jobs
- dashboard summary
- period reporting

Current gaps against the intended `Payments` section:

- `listClientPayments()` only supports `clientId`, `dateFrom`, `dateTo`, and `currency`
  - there is no text search
- there is no dedicated payment detail page/route
- creation and deletion are only exposed from the client page
- there is no focused-account export for client payments in PDF/Excel
- the existing `/api/export/paiements` route exports invoice payments, not `ClientPayment`

Impact:

- The domain can be preserved.
- The operational workspace still needs to be extracted and completed.

### 6. Collaborator management already exists at the account level, but it is incorrectly embedded in a client page

The current collaborator/invitation domain is account-scoped in:

- `src/server/accounts.ts`
- `prisma/schema.prisma`

The invitation and membership logic is not tied to a specific client record.

Current mismatch:

- the collaborator UI lives inside `src/app/(app)/clients/[id]/page.tsx`
- collaborator actions are implemented in `src/app/(app)/clients/actions.ts`

Impact:

- This functionality can be moved into a dedicated section without changing the underlying data model.

### 7. The settings layer is the biggest reuse candidate, but it is not ready for this account type as-is

Current settings storage and UI are full-app oriented:

- `CompanySettings` stores company identity, tax config, invoice/quote numbering, invoice/quote template ids, legal footer, and related fields
- `src/app/(app)/parametres/page.tsx` exposes:
  - company identity
  - logo/stamp/signature
  - currency
  - TVA/FODEC/timbre configuration
  - invoice/quote numbering
  - invoice/quote templates
  - invoice/quote footers and conditions

Receipt generation currently depends on shared settings fields inside `ClientPayment` receipt snapshots:

- company name
- logo
- address
- email
- phone
- matricule fiscal
- tva number
- iban
- stamp/signature
- legal footer

Important gaps:

- focused accounts cannot currently access `settings` through section gating
- the shared settings page/action use `user.id`, not the active account id
- the current settings UI includes many invoice/tax-only fields that the focused account should not expose
- there is no persisted receipt-specific template selection in `CompanySettings`
- receipt numbering uses `RECU`, but there is no dedicated receipt prefix field in `CompanySettings`

Impact:

- A focused settings section should reuse the main settings pattern and storage where safe, but it needs a focused form and account-scoped access/update behavior.

### 8. The current permission model is good enough to preserve, but it does not map cleanly to the target IA yet

Existing focused-account permissions:

- `DASHBOARD_VIEW`
- `CLIENTS_VIEW`
- `CLIENTS_MANAGE`
- `SERVICES_MANAGE`
- `PAYMENTS_MANAGE`
- `RECEIPTS_MANAGE`
- `REPORTS_VIEW`
- `COLLABORATORS_MANAGE`

Current gap:

- there is no explicit `SERVICES_VIEW`
- there is no explicit `PAYMENTS_VIEW`
- there is no focused-account settings permission

Impact:

- The refactor should preserve current collaborator visibility behavior and avoid multiplying permissions unless needed.
- A simple path is:
  - reuse `CLIENTS_VIEW` for read access into client-linked services/payments
  - keep mutation gates on the current manage permissions
  - limit focused `Settings` to account admins/owners initially

## Risks And Things That Must Be Preserved

- Preserve all existing `ClientService`, `ClientPayment`, and `ClientPaymentService` records and ids.
- Preserve current client-to-payment and payment-to-service links.
- Preserve immutable receipt snapshots and existing generated receipt numbers.
- Preserve the current client deletion safeguard that blocks deletion when services/payments already exist.
- Preserve account invitations, memberships, and existing permission semantics.
- Preserve the ability to edit clients and view payment history from the client page.
- Preserve `FULL_APP` behavior completely.
- Do not reuse or mutate invoice payment storage (`Payment`) or order payment storage (`OrderPayment`) for this refactor.
- Do not replace or disconnect current company settings rows; reuse them carefully.
- Make any service-price change additive and backward compatible.
- Ensure every new focused-account page/action resolves data by active account/tenant id, not by the collaborator's personal `user.id`.

## Progressive Plan

### Task 1: Fix the focused-account IA and route/access model [Done]

- Add dedicated focused-account sections/routes for:
  - `Services`
  - `Payments`
  - `Collaborateurs du compte`
  - focused `Settings`
- Extend the focused-account navigation and section gating in:
  - `src/app/(app)/layout.tsx`
  - `src/lib/authorization.ts`
- Keep the client page focused on:
  - client profile
  - payment history for that client
  - client edit entry points
  - links into the dedicated services/payments/collaborators sections

Preservation and backward compatibility:

- Do not remove or rename the existing client/payment/service tables.
- Keep `FULL_APP` navigation unchanged.

Completion note:

- Completed on 2026-03-18 with focused-account navigation and section gating for `Services`, `Paiements`, `Collaborateurs du compte`, and focused `Settings`; a narrowed default client dossier that now centers on client information and payment history; dedicated top-level routes for the new sections; an account-scoped collaborators page; and an account-scoped focused settings overview for `CLIENT_PAYMENTS`. Existing data models, receipt flows, and `FULL_APP` behavior were preserved, while the previous dense service/payment management UI remains available only as a temporary per-client transitional workspace for `Services` and `Paiements`.

### Task 2: Extract `Services` and `Collaborateurs du compte` from the client page [Done]

- Move service CRUD UI out of `src/app/(app)/clients/[id]/page.tsx` into a dedicated `Services` section.
- Reuse the current server actions and domain logic as the base.
- Add service price as an additive field with a migration-safe default/backfill strategy.
- Move collaborator invitation/member management into a dedicated account section.
- Reuse existing account invitation/membership logic without changing account ownership semantics.

Preservation and backward compatibility:

- Existing services remain linked to clients exactly as they are today.
- Existing memberships and pending invitations stay valid.
- Private notes visibility should remain tied to the current manage permissions.

Completion note:

- Completed on 2026-03-18 with a dedicated `Services` section that now hosts the service CRUD UI instead of the client page, additive `ClientService.priceCents` storage plus migration-safe default backfill, dedicated service-section redirects/revalidation, and backward-compatible redirection of old `?workspace=services` client URLs into `/services`. The dedicated `Collaborateurs du compte` section from Task 1 was kept as the only collaborator-management surface, with section-local action wiring and no changes to invitations, memberships, ownership semantics, or existing client/service/payment links.

### Task 3: Make `Payments` the main operational workspace [Done]

- Create a dedicated payments index and payment detail flow on top of `ClientPayment`.
- Reuse current payment creation, deletion, receipt PDF, and receipt email logic.
- Add text search/filtering for the payment list.
- Add period export for client payments:
  - PDF summary/report
  - Excel export
- Keep client-page payment history as a contextual, lighter view rather than the main management surface.

Preservation and backward compatibility:

- Do not touch invoice payment exports or invoice payment tables.
- Preserve receipt snapshot generation so historical documents do not drift.
- Keep existing `ClientPayment` ids and receipt URLs stable where possible.

Completion note:

- Completed on 2026-03-18 with a dedicated `Paiements` workspace that now lists `ClientPayment` records directly, supports text search and period/client filtering, provides a dedicated payment detail route, reuses the existing payment creation/deletion and receipt PDF/email actions, and adds focused client-payment exports in PDF and Excel without touching invoice payment exports or storage. The former client-page `?workspace=payments` flow now redirects into `/paiements`, while the client page keeps only contextual payment history.

### Task 4: Add a limited receipt-focused settings experience [Done]

- Reuse the main settings pattern, but expose only receipt-relevant fields for `CLIENT_PAYMENTS`.
- Base the focused form on the fields already used by receipt generation where still appropriate:
  - company/display name
  - logo
  - address
  - email
  - phone
  - iban if still desired on receipts
  - signature/stamp and placement
  - legal footer or equivalent receipt footer text
  - default currency if still needed for receipt/payment display
- Exclude from the focused settings UI:
  - tax configuration
  - VAT/TVA fields
  - FODEC
  - timbre fiscal
  - invoice/quote templates
  - invoice/quote numbering
  - invoice/quote footers and default conditions
  - other invoice-oriented fields
- Make reads/writes account-scoped using the active tenant/account id.

Preservation and backward compatibility:

- Reuse the existing `CompanySettings` row for the account unless a truly additive receipt-only extension is needed.
- Avoid destructive cleanup of currently stored tax/invoice fields; hide them from the focused account instead of deleting them.

Completion note:

- Completed on 2026-03-18 with an editable `CLIENT_PAYMENTS` settings form in `src/app/(app)/parametres/page.tsx` limited to receipt-relevant fields only: company/display information, default currency, contact details, address, IBAN, receipt footer, and receipt visual assets (logo, stamp, signature, positions). The shared save action in `src/app/(app)/parametres/actions.ts` now detects focused accounts, reads and writes settings by active tenant/account id, and preserves all hidden invoice/tax configuration from the existing `CompanySettings` row instead of overwriting it with defaults. No destructive schema or receipt-history changes were made.

## Notes For The Later Implementation Phase

- The existing `docs/client-payment-account-plan.md` and `docs/client-payment-account-user-guide.md` describe the current client-dossier-centric structure. They will become inaccurate after this refactor and should be updated after the code changes land.
- Receipt rendering currently displays company MF/TVA lines when present. If the product direction is to remove tax-oriented receipt presentation for this account type, the PDF/email rendering will need a focused-account review in addition to the settings UI change.
- Keep the solution intentionally small. The goal is a cleaner IA and better section ownership, not a second large ERP surface inside the app.
