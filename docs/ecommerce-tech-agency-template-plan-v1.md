# E-commerce Tech Agency Template Plan

## 1. Project Overview
The goal is to add a new public template, "E-commerce Tech Agency Template," built on the existing "Site Web" system. The admin interface stays on the app domain, while the public site renders on custom domains via the current domain routing. The template targets a French-only tech agency catalog that supports instant-purchase services and quote-based services, reusing existing products, quotes (devis), invoices (factures), email, and PDF systems.

## 2. Existing System Analysis
- **Next.js architecture (App Router):** Routes live under `src/app`, with the public catalog at `src/app/catalogue/[[...segments]]/page.tsx` and preview at `src/app/preview/page.tsx`. No Pages Router is present.
- **Multi-tenant model:** Most tables carry `userId` in `prisma/schema.prisma`, and server modules enforce `requireUser()` in `src/lib/auth.ts`.
- **Domain resolution:** `middleware.ts` rewrites custom domains to `/catalogue` and injects `domain` + `path` query params. Host lists come from `src/lib/env.ts`. Domain verification and Vercel linking are handled in `src/server/website.ts` and `src/lib/vercel-api.ts`.
- **Site Web module:** Admin UI in `src/app/(app)/site-web`, server actions in `src/app/(app)/site-web/actions.ts`, builder UI in `src/app/(app)/site-web/personnalisation-avancee`, core logic in `src/server/website.ts`, and builder schema in `src/lib/website/builder.ts`.
- **Existing templates:** Template keys and labels in `src/lib/website/templates.ts`, components in `src/components/website/templates/dev-agency.tsx` and `src/components/website/templates/ecommerce.tsx`, selected by `src/components/website/catalog-page.tsx`.
- **Product model:** `Product` in `prisma/schema.prisma` includes `sku`, `name`, `description`, `category`, `unit`, `priceHTCents`, `priceTTCCents`, `vatRate`, `isActive`, `isListedInCatalog`. Server logic is in `src/server/products.ts`, UI in `src/app/(app)/produits`.
- **Quotes/Invoices:** Core logic in `src/server/quotes.ts` and `src/server/invoices.ts`; UI in `src/app/(app)/devis` and `src/app/(app)/factures`. Quote->invoice conversion exists in `src/app/(app)/devis/actions.ts`.
- **Email system:** SMTP/IMAP in `src/server/messaging.ts`, document emails in `src/server/email.ts`, queued in `src/server/document-email-jobs.ts`. Lead capture uses `src/components/website/lead-form.tsx` and `src/app/api/catalogue/leads/route.ts`.
- **PDF generation:** `src/server/pdf.ts` uses Puppeteer/Chromium for quote and invoice PDFs.
- **Payment-related code:** `Payment` model exists and is tied to invoices in `prisma/schema.prisma`; `recordPayment` in `src/server/invoices.ts`. No online payment gateway or webhook code exists in the repo.
- **Supabase schema and migrations:** Prisma schema in `prisma/schema.prisma`, migrations in `prisma/migrations` (e.g., builder JSON columns in `20251215104500_website_builder_customization`). RLS policies are not defined in this repo.

## 3. Technical Integration Strategy
- **Domain-based routing:** Keep the middleware rewrite (`middleware.ts`) and `getCatalogPayloadByDomain` in `src/server/website.ts` as the single entry point for custom domains. The new template should be selectable via `WebsiteConfig.templateKey` and rendered by `CatalogPage`.
- **Data fetching:** Public pages should continue to use `CatalogPayload` from `src/server/website.ts` (server component) and pass data into client templates. New order/quote APIs should resolve tenant by domain or slug (pattern used in `src/app/api/catalogue/leads/route.ts`).
- **Server vs client components:** Templates are client components (`use client`), while the catalog route and preview are server components. For carts and checkout, keep UI client-side but submit to server via API routes or server actions.
- **Caching/SSR/ISR:** The catalog route is `force-dynamic` and `force-no-store`, while `unstable_cache` is used in `src/server/website.ts` for catalog payload and product stats. Follow the same pattern to avoid cross-tenant caching leakage.
- **Security:** Reuse existing zod validation patterns (`src/server/website.ts`, `src/server/products.ts`, `src/server/quotes.ts`). Public endpoints must enforce `published` + `domainStatus` like `loadCatalogWebsite`.
- **Supabase RLS impact:** No RLS definitions exist here. Option A: add RLS policies in Supabase outside this repo. Option B: rely on application-level scoping via `userId` as done today.
- **Payments:** No gateway integration exists. Option A: integrate a provider with webhooks under `src/app/api` and store payment state. Option B: support bank transfer only with manual validation.
- **Bank transfer handling:** Existing bank details live in `CompanySettings` (`iban`, `paymentTerms`) in `prisma/schema.prisma` and `src/server/settings.ts`. Proof uploads can follow the filesystem pattern in `src/app/(app)/messagerie/actions.ts` or be stored as data URLs (not ideal for large files).

## 4. Database Changes
### Product fields (existing table: `Product`)
Current fields cover pricing and visibility (`isListedInCatalog`, `isActive`). For ecommerce service types and quote flows, new fields are required.
- Proposed fields in `prisma/schema.prisma`:
  - `saleMode` (enum or string): `INSTANT` vs `QUOTE`.
  - `publicSlug` (unique per user): for detail pages.
  - `shortDescription` or `excerpt` for listings.
  - `primaryImageUrl` (optional) or `media` JSON.
  - `quoteFormSchema` (JSON) for service-specific fields.
  - `showOnWebsite` could reuse `isListedInCatalog` to avoid duplication.

### New tables (if missing)
None of these exist in the current schema.
- **Orders + items**
  - `Order` (userId, websiteId, status, currency, totals, customer data, paymentMode, createdAt).
  - `OrderItem` (orderId, productId, quantity, unitPriceHTCents, vatRate, totals).
  - `OrderPayment` (orderId, provider, status, amountCents, externalRef).
  - Option B: create `Invoice` immediately and use existing `Payment` model, linking `Order` to `Invoice`.
- **Carts**
  - Option A: DB-backed carts (`Cart`, `CartItem`) to allow cross-device recovery.
  - Option B: client-side cart only, with server-side order creation at checkout.
- **Quote requests**
  - `QuoteRequest` (userId, productId?, status, formPayload JSON, contact fields, createdAt).
  - Link to `Quote` via `quoteId` after conversion.

### WebsiteConfig extensions
`WebsiteConfig` already stores theme, SEO, and featured products. Ecommerce-specific settings should be centralized:
- `ecommerceSettings` JSON: payment methods enabled, bank transfer instructions, checkout rules, order email templates, product selection strategy.
- Option A: store in `WebsiteConfig` JSON. Option B: new table for `WebsiteCheckoutConfig` if querying/filtering is needed.

### SQL migration outline
- Add new columns to `Product` and `WebsiteConfig` in a Prisma migration.
- Create `Order`, `OrderItem`, `OrderPayment`, `QuoteRequest` tables with FK to `User` and optional FK to `WebsiteConfig`.
- Add indexes: `(userId, status, createdAt)` for orders/quote requests, `(userId, publicSlug)` for products.

### RLS rules
No RLS policies in repo. If Supabase RLS is used:
- Option A: write policies in Supabase SQL editor (outside repo).
- Option B: keep app-level enforcement via `userId` like existing modules.

### Relationships to Devis/Factures
- `Order` -> optional `invoiceId` to reuse PDF + payment tracking.
- `QuoteRequest` -> optional `quoteId` to reuse quote editor and PDF generation.

## 5. Task-Based Implementation Plan
### Phase 1: Data model foundations
**Task 1: Extend Product + WebsiteConfig for ecommerce**
- **Goal:** Support service type, SEO slugs, and checkout settings.
- **Affected paths:** `prisma/schema.prisma`, `prisma/migrations`, `src/server/products.ts`, `src/app/(app)/produits`, `src/server/website.ts`.
- **Steps:** Add fields in Prisma; update product schema validation (`productSchema`) and UI forms; extend `WebsiteConfig` with `ecommerceSettings` JSON; update `CatalogPayload` typing to include new fields as needed.
- **Acceptance criteria:** Products can be flagged as instant vs quote; `WebsiteConfig` stores checkout settings; existing product list still works.
- **Risks/mitigation:** Migration impacts existing data; mitigate with defaults and backfill in seed or migration SQL.
- **Effort:** M

**Task 2: Create Orders + Quote Requests data layer**
- **Goal:** Persist orders, payments, and quote requests.
- **Affected paths:** `prisma/schema.prisma`, `prisma/migrations`, `src/server` (new modules in `src/server`), `src/app/api`.
- **Steps:** Define tables and relationships; add server CRUD modules mirroring `src/server/quotes.ts` and `src/server/invoices.ts`; add API routes for public creation and admin listing.
- **Acceptance criteria:** Orders and quote requests can be created/read per tenant; data is scoped by `userId`.
- **Risks/mitigation:** No existing patterns for ecommerce state; mitigate by reusing quote/invoice patterns for validation and totals.
- **Effort:** L

### Phase 2: Template addition
**Task 3: Add the new template key + component**
- **Goal:** Register and render "E-commerce Tech Agency Template."
- **Affected paths:** `src/lib/website/templates.ts`, `src/components/website/templates`, `src/components/website/catalog-page.tsx`, `src/server/website.ts`, `src/lib/website/builder.ts`.
- **Steps:** Add a new template key and label; create a new template component based on existing `ecommerce.tsx`; update template map; ensure builder defaults inject required sections (similar to `ensureTemplateSections`).
- **Acceptance criteria:** Template shows in admin dropdown and renders in preview/public routes without breaking existing templates.
- **Risks/mitigation:** Builder config missing required sections; mitigate by adding defaults in `ensureTemplateSections`.
- **Effort:** M

### Phase 3: Public commerce flows
**Task 4: Public listing + detail pages for services**
- **Goal:** Use actual products as service cards and detail views.
- **Affected paths:** `src/components/website/templates`, `src/app/catalogue/[[...segments]]/page.tsx`, `src/server/website.ts`, `src/lib/formatters.ts`.
- **Steps:** Map `CatalogPayload.products` into listing and detail pages; add slug resolution from `Product.publicSlug`; format price using existing helpers; build French-only labels and copy.
- **Acceptance criteria:** Service listing and detail pages show real product data; URLs are stable per product.
- **Risks/mitigation:** Product model has no slug or media; mitigate via schema changes and fallback placeholders.
- **Effort:** M

**Task 5: Cart, checkout, and order confirmation**
- **Goal:** Capture purchase intent and create orders.
- **Affected paths:** `src/components/website/templates`, `src/app/api` (new routes), `src/server` (orders module), `src/app/preview/page.tsx`.
- **Steps:** Implement cart state in client; create checkout form; submit to server; return confirmation view; ensure preview mode stays read-only.
- **Acceptance criteria:** Cart/checkout flow creates an order record and returns a confirmation page; preview mode does not persist.
- **Risks/mitigation:** Payment not integrated; mitigate by supporting bank transfer only until gateway is added.
- **Effort:** L

**Task 6: Quote request flow**
- **Goal:** Allow quote-based services to submit structured requests.
- **Affected paths:** `src/components/website/templates`, `src/app/api` (new quote request endpoint), `src/server` (quote request module).
- **Steps:** Render dynamic form from `quoteFormSchema`; submit to server; store request; show success message.
- **Acceptance criteria:** Quote requests are stored and linked to the correct tenant; submissions appear in admin UI.
- **Risks/mitigation:** Dynamic schema validation complexity; mitigate by zod validation on server and a fixed UI fallback when schema is missing.
- **Effort:** M

### Phase 4: Admin UI updates
**Task 7: Site Web configuration for ecommerce settings**
- **Goal:** Expose payment, checkout, and product visibility controls.
- **Affected paths:** `src/app/(app)/site-web/_components/website-content-form.tsx`, `src/app/(app)/site-web/actions.ts`, `src/server/website.ts`.
- **Steps:** Add fields for payment methods, bank transfer info, displayed products, checkout rules; persist to `WebsiteConfig`.
- **Acceptance criteria:** Admin can configure ecommerce settings and see them applied on the public site.
- **Risks/mitigation:** Form bloat; mitigate with a new sub-section or a dedicated settings card.
- **Effort:** M

**Task 8: Orders + Quote Requests admin sections**
- **Goal:** Add management UIs inside the Site Web module.
- **Affected paths:** `src/app/(app)/site-web` (new routes), `src/server` (orders/quote request modules), `src/app/(app)/devis`, `src/app/(app)/factures`.
- **Steps:** Build list + filters, detail pages, internal notes, status transitions, bank transfer proof upload; add actions to generate invoices or quotes using existing modules.
- **Acceptance criteria:** Admin can view and manage orders/quote requests, and convert them into devis/factures.
- **Risks/mitigation:** File upload storage; mitigate by reusing filesystem upload pattern or introduce a storage provider.
- **Effort:** L

### Phase 5: Transactional emails and PDFs
**Task 9: Order/quote emails + PDF linking**
- **Goal:** Send confirmation and status updates using existing email system.
- **Affected paths:** `src/server/email.ts`, `src/server/messaging.ts`, `src/server/document-email-jobs.ts`, `src/server/pdf.ts`, `src/lib/messaging/default-responses.ts`.
- **Steps:** Add templates for order/quote request emails; queue sending via background jobs; optionally attach invoice or quote PDFs using existing PDF generation.
- **Acceptance criteria:** Transactional emails send with consistent branding and proper tenant data.
- **Risks/mitigation:** SMTP misconfiguration; mitigate by reusing messaging settings validation already in place.
- **Effort:** M

### Phase 6: SEO, performance, and accessibility
**Task 10: SEO routes and performance tuning**
- **Goal:** Ensure new pages are indexed and fast.
- **Affected paths:** `src/app/catalogue/[[...segments]]/page.tsx`, `src/server/website.ts`, `src/app` (new sitemap route).
- **Steps:** Extend metadata for new paths; add `sitemap.xml` and `robots.txt` routes if missing; use `next/image` and lazy loading; keep caching rules consistent.
- **Acceptance criteria:** Metadata is correct per page; sitemap generated; Core Web Vitals stable.
- **Risks/mitigation:** No existing sitemap route; mitigate by adding a new route in `src/app`.
- **Effort:** S/M

## 6. Admin Interface Changes
- **Template selection:** Add the new template in the existing selector in `src/app/(app)/site-web/_components/website-content-form.tsx`.
- **Ecommerce settings:** New configuration section for payment methods, bank transfer info, checkout rules, and product selection, stored in `WebsiteConfig`.
- **Orders management:** New sub-section under `src/app/(app)/site-web` with list, filters, detail views, status actions, proof uploads, and internal notes.
- **Quote requests management:** New sub-section under `src/app/(app)/site-web` with list, detail view, and a "Convert to Devis" action that pre-fills the quote editor using `src/server/quotes.ts`.
- **Integration with Devis/Factures:** Buttons in order/quote request detail pages to generate or link to existing quotes/invoices in `src/app/(app)/devis` and `src/app/(app)/factures`.

## 7. Public Website Pages Breakdown
All public pages are rendered through the `/catalogue` catch-all route and the selected template component.
- **Home:** Hero, trust signals, key services, and CTA; powered by builder sections and `WebsiteConfig`.
- **Services listing:** List products filtered to `isListedInCatalog` and `saleMode`; use categories from `Product.category`.
- **Service detail:** Load by `Product.publicSlug`; show pricing, deliverables, and CTA (buy now vs request quote).
- **Cart:** Client-side cart summary; present payment options from `WebsiteConfig.ecommerceSettings`.
- **Checkout:** Capture customer data; create order or quote request via API; handle preview mode.
- **Confirmation:** Display order/quote confirmation and next steps; link to email confirmation.
- **SEO routes:** Metadata already handled in `src/app/catalogue/[[...segments]]/page.tsx` using `buildMetadata`; add sitemap if not present.

## 8. QA, Testing & Deployment Checklist
- **Tests:** Add Vitest coverage for order creation, quote request validation, and slug routing (under `tests/`).
- **Seed data:** Update `prisma/seed.ts` to include service types, slugs, and demo products for the new template.
- **Preview domains:** Verify `/preview?path=...` and custom domain rewrites via `middleware.ts`.
- **Environment:** Validate `APP_URL`, `CATALOG_EDGE_DOMAIN`, SMTP settings, and any payment provider secrets.
- **Webhooks:** If payment provider is added, configure signature validation and retries in `src/app/api`.
- **Migration safety:** Apply Prisma migrations with `npm run prisma:deploy` and keep rollback scripts for new tables.
- **Rollback plan:** Keep the new template behind `templateKey` selection so existing sites remain unaffected; be able to disable via admin config.
