# Audit Fix Plan - E-commerce Tech Agency Template

## Constats
- Data loading is Prisma-based and scoped by userId; there is no Supabase client or RLS policy layer in this repo, so tenant isolation relies entirely on application logic (see `src/lib/prisma.ts`, `src/server/website.ts`).
- Domain routing uses middleware rewrite + host detection; however, SEO endpoints are global to the app domain, so custom domains receive a sitemap/robots that point to the app host (see `middleware.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`).
- Admin ecommerce settings are partially ignored: featured products are stored under `ecommerceSettings` but catalog uses `website.featuredProductIds`, so selections do not drive the public template (see `src/server/website.ts`, `src/app/(app)/site-web/_components/website-content-form.tsx`).
- The template reads builder sections only; standard Site Web fields (hero/about) do not update this template unless advanced customization is used, creating a config mismatch (see `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/server/website.ts`).
- Copy and UI elements are hardcoded (metrics, deliverables, filters, durations), limiting admin control and causing design inconsistencies across pages.
- Catalogue filters are static chips without data binding; there is no search, category routing, or pagination (see `src/components/website/templates/ecommerce-tech-agency.tsx`).
- Product detail lacks a real gallery/zoom, packages/tiers, FAQ, and upsells; quote CTA from lists routes to `/contact` instead of the product quote flow.
- Cart totals are computed from `priceTTCCents` only, ignoring discounts and VAT; totals can diverge from server order totals (see `src/components/website/cart/cart-context.tsx`, `src/app/api/catalogue/orders/route.ts`).
- When `showPrices` is false, INSTANT products still allow checkout; pricing is hidden but orders are created (currency display uses hardcoded TND in UI, while server uses company settings).
- Checkout form ignores `requirePhone`, `allowNotes`, and `termsUrl` settings; labels are not bound to inputs, and error feedback lacks accessible semantics.
- Confirmation page relies on sessionStorage only; a refresh or device switch loses the order recap (see `src/components/website/templates/ecommerce-tech-agency.tsx`).
- Payment integration is stub-only; no checkout session is triggered, and payment method toggles are not surfaced in the UI (see `src/server/payments.ts`).
- Bank transfer proof upload writes to `public/uploads` and has no review/approval workflow; orders remain pending until manual admin action (see `src/app/api/catalogue/orders/[id]/transfer-proof/route.ts`, `src/app/(app)/site-web/commandes/[id]/page.tsx`).
- SEO metadata is generic for cart/checkout/contact/confirmation and OG image is site-level only; no `noindex` for sensitive pages or structured data for products.
- Responsiveness and accessibility gaps remain: small uppercase copy, missing input-label associations on checkout, and no `aria-live` for cart updates.

## Objectif cible
Deliver a ready-to-publish, luxury-class tech agency storefront fully localized for Tunisia (FR-TN, TND), with a cohesive visual system, strong home positioning, robust product detail pages (gallery, packages, FAQ, upsells), and production-grade cart/checkout/order/payment flows (including bank transfer). The admin configuration should map cleanly to the public template, and the site should be responsive, accessible, SEO-ready, performant, and resilient to errors and edge cases.

## Data Safety
- Always back up the database before applying any migration (snapshot or `pg_dump`).
- Generate migrations with `--create-only`, review SQL for destructive ops, and split changes into add -> backfill -> enforce steps.
- Apply on staging first; use `prisma migrate deploy` for production and avoid `migrate reset` entirely.

## Plan de corrections et ameliorations

### Phase 1 - Data, tenant, and admin alignment

**FIX-1.1**
- ID: FIX-1.1
- Status: ✅ Completed
- Titre: Align ecommerce settings with featured products and template data
- But: Ensure admin ecommerce selections drive the public template consistently.
- Fichiers/chemins impactes: `src/server/website.ts`, `src/app/(app)/site-web/actions.ts`, `src/app/(app)/site-web/_components/website-content-form.tsx`, `src/app/(app)/site-web/page.tsx`, `src/components/website/templates/ecommerce-tech-agency.tsx`
- Details d implementation: Map `ecommerceSettings.featuredProductIds` to catalog featured selection (or mirror into `website.featuredProductIds` on save); expose a product picker in the admin form; render featured products on home and/or catalogue sections.
- Criteres d acceptance (DoD): Admin-selected featured products appear on the public home page; no regressions for other templates.
- Tests: Smoke: update featured selection in `/site-web` and verify home output; E2E: N/A (no harness in repo).
- Risques & mitigations: Risk of breaking legacy featured behavior; mitigate with fallback to current `website.featuredProductIds` and migration logic.
- Effort: M

**FIX-1.2**
- ID: FIX-1.2
- Status: ✅ Completed
- Titre: Tenant/domain resolution and Supabase RLS posture
- But: Make tenant resolution explicit and safe across slug/domain paths and document the RLS stance.
- Fichiers/chemins impactes: `middleware.ts`, `src/app/catalogue/[[...segments]]/page.tsx`, `src/app/api/catalogue/orders/route.ts`, `src/app/api/catalogue/quote-requests/route.ts`, `src/server/website.ts`, `docs/audit-fix-plan-ecommerce-tech-agency-template.md`
- Details d implementation: Validate `domain`/`path` inputs, add guardrails for slug-domain mismatch; document Option A (Supabase RLS policies managed outside the repo) vs Option B (app-level scoping only) and ensure API routes consistently resolve tenant by host when on custom domains.
- RLS posture:
  - Option A: Supabase RLS active; policies are managed outside this repo and enforce tenant isolation at the DB layer.
  - Option B: No RLS; tenant isolation relies on app-level scoping (`userId`) and host-based resolution in public routes.
- Criteres d acceptance (DoD): Tenant resolution is consistent across public pages and API routes; documentation states the RLS model clearly.
- Tests: Smoke: access custom domain and slug routes; E2E: N/A.
- Risques & mitigations: Risk of breaking existing custom domains; mitigate with staged rollout and logs on mismatch.
- Effort: S

**FIX-1.3**
- ID: FIX-1.3
- Status: ✅ Completed
- Titre: Currency and FR-TN localization consistency
- But: Guarantee TND + fr-TN formatting and aligned currency between UI and server.
- Fichiers/chemins impactes: `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/app/api/catalogue/orders/route.ts`, `src/server/order-email.ts`, `src/lib/formatters.ts`, `src/lib/currency.ts`
- Details d implementation: Use `data.website.currencyCode` consistently in UI; enforce TND in settings for this template or validate mismatch; update copy and placeholders to FR-TN (including diacritics) in a dedicated copy block; ensure emails render TND with 3 decimals.
- Criteres d acceptance (DoD): UI and server totals display the same currency and formatting; FR-TN copy is consistent across pages and emails.
- Tests: Smoke: place a test order and compare totals UI vs order email; E2E: N/A.
- Risques & mitigations: Risk of breaking non-TND tenants; mitigate with template-specific enforcement only.
- Effort: S

### Phase 2 - Home, catalogue, and product experience

**FIX-2.1**
- ID: FIX-2.1
- Status: ✅ Completed
- Titre: Map builder sections to the tech agency home layout
- But: Remove hardcoded content and render a controllable, luxury-grade home page.
- Fichiers/chemins impactes: `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/lib/website/builder.ts`, `src/app/(app)/site-web/personnalisation-avancee/_components/advanced-customization-client.tsx`
- Details d implementation: Render builder sections for logos, about, gallery, pricing, and faq; hide sections when `visible` is false; add layout presets that match the tech agency theme.
- Criteres d acceptance (DoD): Home sections reflect builder config edits; unused sections do not render; design remains consistent and elegant on mobile and desktop.
- Tests: Smoke: edit builder sections and verify preview updates; E2E: N/A.
- Risques & mitigations: Risk of breaking other templates using builder; mitigate with template-specific section mapping.
- Effort: M

**FIX-2.2**
- ID: FIX-2.2
- Status: ✅ Completed
- Titre: Catalogue filtering, category routing, and search
- But: Make the catalogue scalable and navigable without hardcoded filters.
- Fichiers/chemins impactes: `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/server/website.ts`, `src/app/catalogue/[[...segments]]/page.tsx`, `src/server/website.ts`
- Details d implementation: Build filter options from product categories; add query param handling (category, search); update `resolveCatalogMetadata` for category URLs; optionally add pagination if product count exceeds a threshold.
- Criteres d acceptance (DoD): Filters update the list, category pages render correctly, and metadata reflects selected category.
- Tests: Smoke: filter by category and search; E2E: N/A.
- Risques & mitigations: Risk of route conflicts; mitigate with explicit path rules and fallbacks.
- Effort: M

**FIX-2.3**
- ID: FIX-2.3
- Status: ✅ Completed
- Titre: Product detail - gallery, packages, FAQ, and upsells
- But: Deliver a premium product page with conversion-ready content blocks.
- Fichiers/chemins impactes: `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/lib/website/builder.ts`, `src/server/website.ts`
- Details d implementation: Implement a gallery carousel/zoom from `gallery`; render packages using builder pricing section or introduce a product-level JSON field (Option A/B); add FAQ and upsell sections using existing builder types and `products.featured`.
- Criteres d acceptance (DoD): Product page shows a functional gallery, package options, FAQ, and related services; quote CTA routes to product quote form.
- Tests: Smoke: verify rendering with products that have multiple images and with none; E2E: N/A.
- Risques & mitigations: Risk of schema changes; mitigate with Option A using existing builder sections first.
- Effort: L

### Phase 3 - Cart, checkout, and order creation

**FIX-3.1**
- ID: FIX-3.1
- Status: ✅ Completed
- Titre: Cart totals and pricing rules parity with server
- But: Ensure cart totals match server-calculated amounts and respect pricing visibility.
- Fichiers/chemins impactes: `src/components/website/cart/cart-context.tsx`, `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/app/api/catalogue/orders/route.ts`
- Details d implementation: Compute totals using VAT/discount logic (reuse `calculateLineTotals` or a new public totals endpoint); disable checkout when `showPrices` is false or items have missing prices; expose tax/discount breakdown in the summary.
- Criteres d acceptance (DoD): Cart totals match created order totals; checkout is blocked or redirected when pricing is hidden.
- Tests: Smoke: compare cart total to order total in admin; E2E: N/A.
- Risques & mitigations: Risk of extra API latency; mitigate with client-side calculation using shared logic.
- Effort: M

**FIX-3.2**
- ID: FIX-3.2
- Status: ✅ Completed
- Titre: Checkout validation, terms, and payment method selection
- But: Enforce required fields and allow users to pick payment method per settings.
- Fichiers/chemins impactes: `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/server/website.ts`, `src/app/(app)/site-web/_components/website-content-form.tsx`, `src/server/orders.ts`
- Details d implementation: Add phone requirement and terms checkbox when configured; render payment method selector from `ecommerceSettings`; store selected method on order (add field or metadata); add accessible error feedback.
- Criteres d acceptance (DoD): Validation blocks submission when rules are not met; payment method is saved on the order.
- Tests: Smoke: submit checkout with missing required fields; E2E: N/A.
- Risques & mitigations: Risk of schema change; mitigate with metadata JSON on Order if preferred.
- Effort: M

**FIX-3.3**
- ID: FIX-3.3
- Status: ✅ Completed
- Titre: Confirmation page resiliency and order recap retrieval
- But: Preserve order confirmation details beyond sessionStorage.
- Fichiers/chemins impactes: `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/app/api/catalogue/orders/route.ts`, `src/app/api/catalogue/orders/[id]/route.ts` (new)
- Details d implementation: Return a signed confirmation token or order ID, add a read-only order summary endpoint scoped to tenant, and hydrate confirmation from server when storage is empty.
- Criteres d acceptance (DoD): Confirmation page recovers order summary after refresh; unauthorized access is blocked.
- Tests: Smoke: refresh confirmation page and still see order; E2E: N/A.
- Risques & mitigations: Risk of exposing order data; mitigate with signed tokens and strict tenant scoping.
- Effort: M

### Phase 4 - Payments and bank transfer workflow

**FIX-4.1**
- ID: FIX-4.1
- Status: ✅ Completed
- Titre: Payment provider integration and checkout session
- But: Support a real payment provider in addition to the stub.
- Fichiers/chemins impactes: `src/server/payments.ts`, `src/app/api/catalogue/payments/webhook/route.ts`, `src/app/api/catalogue/payments/checkout/route.ts` (new), `src/components/website/templates/ecommerce-tech-agency.tsx`
- Details d implementation: Implement provider adapter (Option A: Stripe; Option B: local provider like Paymee/Konnect); create checkout session API; redirect users from checkout; handle webhook events to sync payment status.
- Criteres d acceptance (DoD): Payment session is created and status updates via webhook; orders reflect payment status transitions.
- Tests: Smoke: trigger stub provider checkout and webhook; E2E: N/A.
- Risques & mitigations: Risk of provider API changes; mitigate with adapter interface and feature flag.
- Effort: L

**FIX-4.2**
- ID: FIX-4.2
- Status: ✅ Completed
- Titre: Bank transfer proof storage and review workflow
- But: Make bank transfer a production-grade flow with review and notifications.
- Fichiers/chemins impactes: `src/app/api/catalogue/orders/[id]/transfer-proof/route.ts`, `src/server/orders.ts`, `src/app/(app)/site-web/commandes/[id]/page.tsx`, `src/app/(app)/site-web/commandes/actions.ts`, `src/server/order-email.ts`
- Details d implementation: Store proof files in durable storage (Option A: Supabase Storage; Option B: S3) and save proof status; add admin actions to approve/reject proofs and auto-update order status; notify customer on proof received and approval.
- Criteres d acceptance (DoD): Proof uploads persist in production; admins can approve/reject and order/payment status updates accordingly.
- Tests: Smoke: upload proof and approve via admin; E2E: N/A.
- Risques & mitigations: Risk of storage costs and access control; mitigate with signed URLs and retention policies.
- Effort: L

**FIX-4.3**
- ID: FIX-4.3
- Status: ✅ Completed
- Titre: Admin order view enhancements for payments
- But: Give admins a clear view of payment method, proof status, and actions.
- Fichiers/chemins impactes: `src/app/(app)/site-web/commandes/[id]/page.tsx`, `src/app/(app)/site-web/commandes/actions.ts`, `src/server/orders.ts`
- Details d implementation: Display payment method and proof status; add buttons to mark proof approved/rejected; surface payment method filters in the orders list.
- Criteres d acceptance (DoD): Admin can act on proofs from the order page and see status updates immediately.
- Tests: Smoke: update proof status from admin page; E2E: N/A.
- Risques & mitigations: Risk of unintended status transitions; mitigate with confirmation modals and audit logging.
- Effort: M

### Phase 5 - Transactional emails and notifications

**FIX-5.1**
- ID: FIX-5.1
- Status: ✅ Completed
- Titre: FR-TN transactional templates and bank transfer instructions
- But: Deliver localized, premium emails aligned with the new template.
- Fichiers/chemins impactes: `src/server/order-email.ts`, `src/server/order-email-jobs.ts`, `src/lib/messaging/default-responses.ts`
- Details d implementation: Update copy to FR-TN with proper accents; add bank transfer instructions and proof steps; add brand tone and CTA links to order recap.
- Criteres d acceptance (DoD): Order created and payment emails reflect FR-TN copy and include correct totals and instructions.
- Tests: Smoke: trigger order created email in preview; E2E: N/A.
- Risques & mitigations: Risk of breaking existing messaging templates; mitigate with fallback defaults and template versioning.
- Effort: M

**FIX-5.2**
- ID: FIX-5.2
- Status: ✅ Completed
- Titre: New notifications for proof received and payment confirmed
- But: Keep customers informed throughout the bank transfer workflow.
- Fichiers/chemins impactes: `src/server/orders.ts`, `src/server/order-email.ts`, `src/server/order-email-jobs.ts`
- Details d implementation: Add email triggers when proof is uploaded and when approved; include order reference and next steps; ensure admin notifications are logged.
- Criteres d acceptance (DoD): Proof upload and approval each send a distinct email to the customer.
- Tests: Smoke: upload proof and verify both emails; E2E: N/A.
- Risques & mitigations: Risk of duplicate emails; mitigate with idempotent job keys.
- Effort: S

### Phase 6 - SEO, accessibility, responsiveness, and performance

**FIX-6.1**
- ID: FIX-6.1
- Status: ✅ Completed
- Titre: Metadata, OG, and noindex for sensitive pages
- But: Ensure SEO correctness and avoid indexing cart/checkout/confirmation.
- Fichiers/chemins impactes: `src/app/catalogue/[[...segments]]/page.tsx`, `src/server/website.ts`, `src/components/website/templates/ecommerce-tech-agency.tsx`
- Details d implementation: Extend metadata resolver for cart/checkout/contact/confirmation titles; add `robots` noindex for cart/checkout/confirmation; use product cover image for OG when on product pages.
- Criteres d acceptance (DoD): Each page has accurate title/description and sensitive pages are noindex.
- Tests: Smoke: inspect rendered metadata; E2E: N/A.
- Risques & mitigations: Risk of SEO regressions; mitigate with snapshot checks on metadata.
- Effort: S

**FIX-6.2**
- ID: FIX-6.2
- Status: ✅ Completed
- Titre: Tenant-aware sitemap and robots expansion
- But: Include product/category URLs and respect custom domains.
- Fichiers/chemins impactes: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/server/website.ts`
- Details d implementation: Add product/category URLs to sitemap per tenant; emit sitemap/robots that reflect custom domains when active; optionally add per-tenant sitemap routes.
- Criteres d acceptance (DoD): Sitemap includes product URLs; custom domains receive canonical URLs pointing to themselves.
- Tests: Smoke: validate sitemap output for slug and custom domain; E2E: N/A.
- Risques & mitigations: Risk of large sitemap sizes; mitigate with pagination or multi-sitemap index.
- Effort: M

**FIX-6.3**
- ID: FIX-6.3
- Status: ✅ Completed
- Titre: Accessibility and responsive refinements
- But: Make the storefront keyboard-friendly, readable, and mobile-safe.
- Fichiers/chemins impactes: `src/components/website/templates/ecommerce-tech-agency.tsx`, `src/components/website/cart/cart-context.tsx`, `src/components/website/quote-request-form.tsx`
- Details d implementation: Bind labels to inputs in checkout, add `aria-live` for cart count and errors, improve focus states, and adjust typography to avoid overflow on small screens.
- Criteres d acceptance (DoD): Forms pass basic accessibility checks and the layout is stable on small screens.
- Tests: Smoke: keyboard navigation across cart/checkout; E2E: N/A.
- Risques & mitigations: Risk of design drift; mitigate with visual regression snapshots.
- Effort: M

**FIX-6.4**
- ID: FIX-6.4
- Status: ✅ Completed
- Titre: Performance and caching strategy for public pages
- But: Reduce TTFB and improve caching without breaking multi-tenant correctness.
- Fichiers/chemins impactes: `src/app/catalogue/[[...segments]]/page.tsx`, `src/server/website.ts`, `next.config.ts`
- Details d implementation: Re-evaluate `force-dynamic` and `force-no-store`; enable ISR with `revalidate` when safe; cache catalog payloads per tenant; audit image loading and avoid rendering unused sections.
- Criteres d acceptance (DoD): Public pages show improved caching headers and reduced server work; no stale data beyond intended revalidate window.
- Tests: Smoke: verify revalidate behavior and page load metrics locally; E2E: N/A.
- Risques & mitigations: Risk of stale content for admins; mitigate with revalidatePath on updates.
- Effort: M

### Phase 7 - QA and testing coverage

**FIX-7.1**
- ID: FIX-7.1
- Status: ✅ Completed
- Titre: Extend automated coverage for catalog, cart, checkout, and orders
- But: Prevent regressions across the ecommerce flow.
- Fichiers/chemins impactes: `tests/orders.test.ts`, `tests/quote-requests.test.ts`, `tests/formatters.test.ts`, `tests/authorization.test.ts`
- Details d implementation: Add unit tests for cart totals (discount/VAT), API order creation edge cases, quote request validation, and tenant scoping.
- Criteres d acceptance (DoD): New tests cover pricing parity and tenant scoping; `npm test` passes.
- Tests: Smoke: `npm test`; E2E: N/A.
- Risques & mitigations: Risk of test flakiness; mitigate with deterministic fixtures.
- Effort: M

## Checklist QA avant publication
- Domain preview: verify custom domain points to correct tenant, HTTPS active, and canonical URLs match the domain.
- Env vars: `APP_URL`, `APP_HOSTNAMES`, SMTP/IMAP, storage credentials, payment provider keys, webhook secrets.
- Webhooks: payment webhook endpoint responds and updates order/payment status in admin.
- Emails: order created, payment received, proof received, and quote request emails render in FR-TN with TND totals.
- Migrations: Prisma migrations applied; new fields for payments/proof/metadata present; rollback plan documented.
- Rollback: ability to disable the template or revert to `dev-agency` with a single admin change.
- Smoke tests: add-to-cart, update qty, checkout validation, order creation, confirmation refresh, bank transfer proof upload.
- Accessibility: keyboard-only navigation for cart/checkout, focus visible, form labels and error messages.
- SEO: sitemap/robots output, metadata for product pages, and noindex on cart/checkout/confirmation.
