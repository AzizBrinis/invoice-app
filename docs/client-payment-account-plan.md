# Client Payment Account Plan

## Feature Summary

Introduce a new focused account experience for client payment management, alongside the current full app. This account type should stay centered on `Dashboard` and `Clients`, while still covering the supporting flows it needs: client-linked services, standalone payment records, receipt generation, payment history on the client page, period reports, and collaborator invitations with account-scoped permissions.

The implementation should be additive, migration-safe, and explicit about backward compatibility: current invoice, quote, website, messaging, and production data flows must keep working unchanged for existing accounts.

## Key Findings From The Current Codebase

- The app is still fundamentally tenant-scoped by `userId`, not by a shared account/workspace id.
  - Almost every business model hangs directly off `userId` in [`prisma/schema.prisma`](../prisma/schema.prisma): `Client`, `Product`, `Quote`, `Invoice`, `Payment`, `Order`, `OrderPayment`, `QuoteRequest`, `CompanySettings`, `MessagingSettings`, `WebsiteConfig`, `NumberingSequence`, `EmailLog`, AI records, and more.
  - Today, the practical “account” boundary is the owner `User`.

- There is no collaborator, membership, or invitation model yet.
  - Search across `src/`, `prisma/`, and `tests/` shows no back-office invitation/member/collaboration implementation.
  - This means the requested “invite by email”, “existing user vs new user”, and “assign permissions” flows need new account-scoped models, not just UI work.

- Some code already anticipates an `active tenant` context, but only partially.
  - `tenantId` fallbacks already exist in [`src/server/clients.ts`](../src/server/clients.ts), [`src/server/invoices.ts`](../src/server/invoices.ts), [`src/server/analytics.ts`](../src/server/analytics.ts), and [`src/app/(app)/factures/actions.ts`](../src/app/%28app%29/factures/actions.ts).
  - [`tests/authorization.test.ts`](../tests/authorization.test.ts) explicitly checks `tenantId` fallback behavior.
  - This is important: the codebase already hints at shared-account scoping without having fully implemented it.

- Permissions are inconsistent and mostly not account-scoped.
  - Global auth is handled by [`src/lib/auth.ts`](../src/lib/auth.ts) and app-level access is mostly “authenticated user only”.
  - Billing permission logic exists in [`src/lib/authorization.ts`](../src/lib/authorization.ts), but only invoice mutations in [`src/app/(app)/factures/actions.ts`](../src/app/%28app%29/factures/actions.ts) actually enforce it.
  - Quotes, clients, products, settings, dashboard, exports, and many server reads do not have equivalent central permission checks.
  - `User.role` is global per login, not per account membership.

- Current role bootstrapping is system-wide, not tenant/account-specific.
  - [`src/app/(auth)/inscription/actions.ts`](../src/app/%28auth%29/inscription/actions.ts) gives the first billing-capable user in the whole system `ADMIN`, otherwise `VIEWER`.
  - [`src/app/(app)/factures/actions.ts`](../src/app/%28app%29/factures/actions.ts) can auto-promote a user to `ADMIN` if no billing manager exists globally.
  - This behavior is not reusable for invited collaborators and should not become the permission model for the new account type.

- The current app shell is static and shows the full product surface.
  - [`src/app/(app)/layout.tsx`](../src/app/%28app%29/layout.tsx) hardcodes navigation to dashboard, quotes, invoices, products, website, clients, messaging, assistant, and settings.
  - A focused account type will need account-aware nav generation and route gating, not just hidden buttons.

- The client experience is currently list + create/edit, not a true client workspace.
  - [`src/app/(app)/clients/page.tsx`](../src/app/%28app%29/clients/page.tsx) renders a directory panel.
  - [`src/app/(app)/clients/[id]/modifier/page.tsx`](../src/app/%28app%29/clients/%5Bid%5D/modifier/page.tsx) is an edit form, not a client detail page.
  - [`src/server/clients.ts`](../src/server/clients.ts) already loads related `quotes` and `invoices` in `getClient()`, but there is no payment history, service history, or reporting view on the client itself.

- Client creation is reused across several flows and must be preserved.
  - [`src/server/clients.ts`](../src/server/clients.ts) exposes `resolveClientForContact()`.
  - Website signups, quote requests, and orders all call that helper via [`src/server/website-signup.ts`](../src/server/website-signup.ts), [`src/server/quote-requests.ts`](../src/server/quote-requests.ts), and [`src/server/orders.ts`](../src/server/orders.ts).
  - New payment-management behavior must coexist with manual clients and website-generated clients.

- Payments are currently document-specific, not client-centric.
  - Back-office payments are stored in `Payment`, but `Payment.invoiceId` is required in [`prisma/schema.prisma`](../prisma/schema.prisma) and all logic in [`src/server/invoices.ts`](../src/server/invoices.ts) is invoice-bound.
  - Website/e-commerce payments are stored separately in `OrderPayment` and managed in [`src/server/orders.ts`](../src/server/orders.ts) and [`src/server/payments.ts`](../src/server/payments.ts).
  - There is no standalone “client payment record” model that can exist without an invoice or order.

- Receipt generation cannot be added cleanly by reusing current quote/invoice document types as-is.
  - PDF generation in [`src/server/pdf.ts`](../src/server/pdf.ts) only knows `"invoice"` and `"quote"`.
  - Email sending/logging in [`src/server/email.ts`](../src/server/email.ts) and [`src/server/document-email-jobs.ts`](../src/server/document-email-jobs.ts) only covers `DocumentType.DEVIS` and `DocumentType.FACTURE`.
  - Numbering only supports `SequenceType.DEVIS` and `SequenceType.FACTURE` in [`src/server/sequences.ts`](../src/server/sequences.ts).
  - PDF templates only support `PdfTemplateType.DEVIS` and `PdfTemplateType.FACTURE` in [`prisma/schema.prisma`](../prisma/schema.prisma) and are selected from settings in [`src/app/(app)/parametres/page.tsx`](../src/app/%28app%29/parametres/page.tsx).

- Reporting today is limited and invoice-driven.
  - Dashboard metrics in [`src/server/analytics.ts`](../src/server/analytics.ts) are built from invoices and quotes only, with month boundaries fixed to `Africa/Tunis`.
  - CSV exports in [`src/server/csv.ts`](../src/server/csv.ts) cover clients, products, quotes, invoices, and invoice payments, all by current `userId`.
  - There is no reusable reporting layer for “single client over a selected period” or “all clients over a selected period” for standalone payment records.

- The existing “Produits & services” model is real, but it is heavier than this focused account needs.
  - The product model in [`src/server/products.ts`](../src/server/products.ts) and [`src/app/(app)/produits`](../src/app/%28app%29/produits) includes catalog slugs, e-commerce sale modes, SEO, media, variants, quote forms, and website exposure.
  - It can still be useful as an optional service template source, but it is not a clean direct replacement for lightweight client-linked services in a payment-only experience.

- The current dashboard for full accounts is invoice/quote-oriented.
  - [`src/app/(app)/tableau-de-bord/page.tsx`](../src/app/%28app%29/tableau-de-bord/page.tsx) shows invoice revenue, overdue invoices, outstanding amounts, pending quotes, and recent invoices/quotes.
  - A payment-management account will need a different dashboard data source and likely a different summary layout.

- There is already reusable email infrastructure, but not for system invitations.
  - Transactional document delivery uses account SMTP from `MessagingSettings` in [`src/server/messaging.ts`](../src/server/messaging.ts).
  - Background delivery is already abstracted through `BackgroundJob` in [`src/server/background-jobs.ts`](../src/server/background-jobs.ts).
  - However, there is no generic app-level/system invitation mailer yet. Current outbound email is tenant-configured.

- Client-auth fields are unrelated to collaborator access.
  - `Client.passwordHash`, `ClientSession`, and public account routes in [`src/lib/client-auth.ts`](../src/lib/client-auth.ts), [`src/server/website-login.ts`](../src/server/website-login.ts), and [`src/app/api/catalogue/account`](../src/app/api/catalogue/account) support catalogue customers, not internal collaborators.
  - `Client.authUserId` exists in the schema but is not wired into current flows and should not be confused with back-office user membership.

## Risks And Things To Preserve

- Do not repurpose or loosen existing invoice payment storage.
  - `Payment` is invoice-specific today and should remain so for full-account flows.
  - Making `Payment.invoiceId` nullable or dual-purpose would create regression risk across invoice status reconciliation, exports, detail pages, and payment history.

- Do not reuse `OrderPayment` for this feature.
  - It is tied to public orders, providers/webhooks, payment proofs, and e-commerce statuses.
  - A client-payment account needs a simpler back-office payment domain.

- Do not rely on `User.role` for collaborator permissions.
  - It is global, not per account, and current bootstrapping logic is system-wide.
  - New collaborator permissions must be explicit and account-scoped.

- Preserve the current single-user/full-app behavior by default.
  - Existing users should keep their current app surface and data without any manual migration step.
  - Existing login, dashboard, quotes, invoices, products, site-web, messaging, assistant, exports, and PDFs must behave exactly as before unless the active account is explicitly the new focused type.

- Preserve current data ownership and links.
  - Existing `Client`, `Quote`, `Invoice`, `Order`, `OrderPayment`, `QuoteRequest`, `EmailLog`, and settings data must not be reassigned or disconnected.
  - Additive migrations and backfills are required; destructive data moves are not acceptable.

- Preserve website-created client flows.
  - Public orders, quote requests, and customer signups already create or reuse clients.
  - The new account type must not break those flows for full accounts, and client records from those flows must stay visible/usable.

- Preserve current document and email behavior for quotes/invoices.
  - Receipt support should extend document, numbering, PDF, email, and logging systems without changing quote/invoice semantics or filenames.

- Keep the new focused experience actually focused.
  - Do not add a large parallel mini-ERP inside the app.
  - Reports, services, receipts, and collaborators should live under the dashboard/client workflow rather than reopening the whole current menu.

## Recommended Direction

- Treat the existing tenant boundary (`userId`) as the migration-safe account root for this feature.
  - Because the codebase already stores nearly all business data by `userId`, and because some modules already accept optional `tenantId`, the least disruptive path is to formalize an `activeTenantId`/account context rather than immediately re-keying every production table to a new workspace id.
  - This keeps current data intact while allowing shared access later through memberships.

- Store the new experience type at the account/tenant level, not only on the login user.
  - A user may already own one account and later collaborate on another.
  - The focused type should describe the active account being managed, not the human identity that signed in.

- Add dedicated payment-management models instead of bending invoice/order models.
  - Add a client-centric service layer and a client-centric payment/receipt layer.
  - Keep invoice payments and website order payments untouched.

- Build the focused UX around `Dashboard` and a new client detail workspace.
  - Global period reporting belongs on the focused dashboard.
  - Single-client reporting, service management, payment history, and receipt actions belong on the client page.
  - This satisfies the requested access limits without forcing a separate `Reports` or `Products` section into the focused account.

## Progressive Implementation Plan

### Task 1: Add account context, account type, memberships, and invitations on top of the current tenant boundary [Done]

Create the account-layer foundation without moving existing business data off `userId`.

- Introduce account metadata for the current tenant root so the app can distinguish at least `FULL_APP` and `CLIENT_PAYMENTS`.
- Add additive tables for:
  - memberships/collaborators,
  - invitations,
  - account-scoped permission assignments.
- Extend auth/session resolution so a signed-in person has:
  - `user.id` for their identity,
  - `activeTenantId` for the account they are currently managing.
- Backfill current production users so each existing tenant keeps a default `FULL_APP` account context and an owner-level membership automatically.
- Add invitation acceptance flows for:
  - invited email already belongs to an existing back-office user,
  - invited email does not exist yet and must create/login first.

Why first:

- Nothing else can be implemented cleanly until the app understands “person vs active account”.
- This also reuses the partial `tenantId` groundwork already present in the codebase.

Backward compatibility and preservation:

- Existing rows stay where they are.
- Existing single-user logins continue to operate exactly as before when there is no alternate membership/account selection involved.

Completion note:

- Completed on 2026-03-17 with additive `Account`/membership/invitation schema + migration, tenant-aware auth/session resolution (`activeTenantId` while preserving `tenantId` fallback), lazy/default owner bootstrap for existing tenants, and invitation acceptance wired into the current login/registration flow for both existing and newly created back-office users.

### Task 2: Add payment-management domain models for client-linked services, standalone payments, receipts, and filtered reporting [Done]

Create the new business layer as additive models and queries rather than mutating invoice/order semantics.

- Add client-centric service records linked to `Client`, with support for:
  - service details,
  - internal notes/private notes,
  - optional linkage to a reusable service template if that later proves useful.
- Add client-centric payment records linked to `Client` and optionally linked service entries.
- Add receipt support as first-class payment-management documents:
  - receipt numbering,
  - receipt PDF generation,
  - receipt email delivery/logging,
  - immutable historical snapshots where needed so old receipts do not drift when client/service data changes.
- Add reporting queries for:
  - one client over a selected period,
  - all clients over a selected period,
  - dashboard summaries based on the new payment dataset.
- Reuse current patterns where they fit:
  - streaming CSV exports in [`src/server/csv.ts`](../src/server/csv.ts),
  - background jobs in [`src/server/background-jobs.ts`](../src/server/background-jobs.ts),
  - document email job patterns in [`src/server/document-email-jobs.ts`](../src/server/document-email-jobs.ts),
  - PDF generation structure in [`src/server/pdf.ts`](../src/server/pdf.ts).

Why second:

- The focused account type needs its own source of truth for services, payments, receipts, and reports before the UI can be simplified around them.

Backward compatibility and preservation:

- Existing invoices, invoice payments, order payments, orders, quotes, and related exports stay unchanged.
- New models are additive and client-linked; current client ids remain the anchor.

Completion note:

- Completed on 2026-03-17 with additive `ClientService` / `ClientPayment` / `ClientPaymentService` models + migration, receipt numbering/PDF/email job support (`RECU` document and sequence types), immutable receipt snapshots linked to client payments, tenant-aware reporting queries for client/all-client periods and dashboard summaries, a client deletion safeguard that preserves linked payment-management history, and a default receipt email template. No Task 3 UX/navigation work was started.

### Task 3: Add the focused account UX and central permission enforcement [Done]

Build the simplified experience only after the account context and payment domain exist.

- Make app navigation and route access account-type aware so `CLIENT_PAYMENTS` accounts primarily see:
  - dashboard,
  - clients.
- Add a true client detail workspace that becomes the center of this experience:
  - client profile,
  - linked services,
  - payment history,
  - receipt actions,
  - per-client period reporting,
  - collaborator/invitation management for this account.
- Add a payment-focused dashboard using the new reporting layer instead of the invoice/quote analytics in [`src/server/analytics.ts`](../src/server/analytics.ts).
- Enforce permissions centrally in loaders, server actions, and document/report routes.
  - Do not rely on UI hiding alone.
  - Do not copy the current one-off invoice-only permission pattern.

Why third:

- The UX can stay intentionally small because the supporting data models and account context will already exist.

Backward compatibility and preservation:

- `FULL_APP` accounts must keep the current surface and behavior.
- Focused accounts should not accidentally gain access to quotes, invoices, website, messaging, assistant, or settings pages unless explicitly intended later.

Completion note:

- Completed on 2026-03-17 with account-type-aware navigation in the main app shell, focused `CLIENT_PAYMENTS` dashboard + client workspace pages, collaborator/invitation management embedded in the client workspace, and central section/permission enforcement across layouts, server actions, receipt/document/report routes, assistant APIs, and supporting JSON endpoints. Existing `FULL_APP` pages/flows were preserved, and restricted sections now fail closed for focused accounts instead of relying on hidden UI alone.

## Implementation Notes For The Later Coding Phase

- Invitation emails need an explicit delivery decision early.
  - Current email sending is tenant SMTP-based.
  - Collaborator invitations are system/account emails, so introducing a small app-level transactional mailer may be cleaner than depending on account SMTP.

- Do not silently reinterpret `Client.notes`.
  - The current client form labels it as internal notes.
  - If the new experience needs both “notes” and “private notes”, add fields/models with clear semantics instead of changing the meaning of existing data.

- Do not rely on `Client.authUserId` for collaborator access.
  - It exists in the schema but is not wired into current public/back-office flows.
  - Treat it as unrelated until deliberately designed otherwise.

- Keep reports embedded in the focused workflow.
  - “All clients over a period” belongs on the focused dashboard.
  - “One client over a period” belongs on the client detail page.
  - This keeps the new account type aligned with the requested simple experience.
