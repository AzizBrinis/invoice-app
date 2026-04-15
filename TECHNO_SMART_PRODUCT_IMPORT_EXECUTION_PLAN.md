# Techno Smart Product Import Execution Plan

## Target

- Source site: `https://techno-smart.tn/`
- Target account: resolve at runtime by email `brinisaziz@gmail.com`
- Target website: resolve at runtime by custom domain `techno-smart.net` and confirm template `ecommerce-ciseco-home`
- Current instruction: investigate only, do not import yet, do not modify production data yet

## Confirmed Findings

- The source site is PrestaShop.
- The only reliable crawl entrypoint is the product sitemap leaf `https://techno-smart.tn/sitemaps/shop_1/sitemap_shop_1_002.xml`.
- The sitemap currently exposes 29 product URLs. 28 are real product pages. 1 URL is broken and must be skipped:
  - `https://techno-smart.tn/apple-iphone-14-128-go-minuit.html`
- Listing pagination is not trustworthy enough to drive the import. Example: `https://techno-smart.tn/accueil/?page=5` is empty even though page 4 advertises a next page.
- Real product pages expose a complete `data-product` JSON payload. This is sufficient for a fast HTTP fetch + Cheerio parser. Do not default to Puppeteer.
- Source coverage across the 28 valid products:
  - 25 have `description_short`
  - 17 have `description`
  - 15 embed images inside description HTML
  - 16 have multiple gallery images
  - 8 have a discount
  - 7 are out of stock
  - 5 have selectable options/variants
  - 28 have meta title and meta description
  - 28 have quantity and category data
  - 26 expose brand via product meta
- Gallery/product images are hosted on `techno-smart.tn` and are safe to download and re-upload into our own storage.
- Description HTML sometimes hotlinks third-party images. Observed hosts include `m.media-amazon.com`, `tn.jumia.is`, `des.gbtcdn.com`, `apibackend.megapc.tn`, `www.internetdownloadmanager.com`, and `drive.google.com`.
- In our app, product images currently tend to be stored inline as `data:image/...` inside `coverImageUrl` and `gallery`. Do not reuse that pattern for this import.
- The app already contains a durable upload pattern to Supabase Storage for order proof files. Reuse that architecture for product media.
- The target account already has 15 products. Exact or clear duplicate matches already exist for at least:
  - Internet Download Manager
  - Microsoft Windows 11 Professionnel
  - Microsoft Office 365 Personnel
  - Microsoft Office Professional Plus 2021
  - Autodesk Revit
- The source does not provide usable SKUs. `reference` is empty on all 28 valid product pages.
- The app product schema has no first-class `brand` field. Preserve brand in content/SEO text; do not invent schema.
- The current CSV import action in [`src/app/(app)/produits/actions.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/app/(app)/produits/actions.ts:371) is not suitable for this job.
- Product writes and website lookups still rely on `requireUser().id` in key service layers such as [`src/server/products.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/server/products.ts:528) and [`src/server/website.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/server/website.ts:1097). The later import must resolve and pass the target owner explicitly.

## Required Mapping

- `sku`: use `reference` if present, else deterministic fallback `TS-PS-<id_product>`
- `name`: `data-product.name`
- `publicSlug`: `data-product.link_rewrite`
- `description`: stripped text from `description_short`, else stripped text from `description`
- `shortDescriptionHtml`: sanitized `description_short`; if weak or missing, AI may rewrite, but must stay `<= 600` chars
- `descriptionHtml`: sanitized `description`; keep embedded remote description images as URLs
- `coverImageUrl` + `gallery`: download source gallery images from `techno-smart.tn`, upload into app-managed storage, store managed URLs only
- `priceTTCCents`: `price_amount * 100`
- `priceHTCents`: `price_tax_exc * 100`
- `vatRate`: `rate`
- `defaultDiscountAmountCents`: `(price_without_reduction - price_amount) * 100` when the source exposes an amount discount; only use `defaultDiscountRate` when the source clearly exposes a percentage discount
- `category`: `category_name`
- `brand`: no direct DB field; preserve in HTML/meta/FAQ text only
- `stockQuantity`: `max(quantity, 0)`
- `isActive`: false only when the page is invalid or the source explicitly indicates unavailable/discontinued
- `isListedInCatalog`: true
- `metaTitle`: source meta title first, AI enhancement only if weak/too long
- `metaDescription`: source meta description first, AI enhancement only if weak/too long
- `faqItems`: AI-generated, factual, SEO-safe FAQs
- Optional but recommended for template quality:
  - `excerpt`: derive a plain-text summary `<= 280` chars

## Execution Tasks

### Task 1. Build A Read-Only Source Manifest [DONE]

Status note: completed on 2026-04-14 with [`scripts/build-techno-smart-source-manifest.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/scripts/build-techno-smart-source-manifest.ts:1). The script fetches only the product sitemap leaf, validates `body#product` plus `data-product`, captures the required source fields, writes [`tmp/imports/techno-smart/source-manifest.json`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/tmp/imports/techno-smart/source-manifest.json:1), and currently reports 29 sitemap URLs, 28 valid product records, and 1 skipped invalid page.

- Create a single crawl script under `scripts/` that fetches only `https://techno-smart.tn/sitemaps/shop_1/sitemap_shop_1_002.xml`.
- For each sitemap URL:
  - fetch HTML with a low concurrency limit (`2-4`)
  - require `body#product`
  - require a parseable `data-product` JSON blob
  - capture `name`, `id_product`, `link_rewrite`, category, brand meta, price fields, quantity, descriptions, image URLs, option selectors, canonical URL, and raw source URL
- Skip and report any URL that fails those checks. Do not try to repair or guess broken products.
- Save the output to `tmp/imports/techno-smart/source-manifest.json`.
- Add a stable `sourceFingerprint` hash per record so later dry-runs can prove idempotence.

### Task 2. Build A Tenant-Safe Dry-Run Planner [DONE]

Status note: completed on 2026-04-14 with [`scripts/plan-techno-smart-import-dry-run.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/scripts/plan-techno-smart-import-dry-run.ts:1). The script resolves the target user by `brinisaziz@gmail.com`, resolves the target website by `techno-smart.net`, loads existing products explicitly from the DB, applies the dry-run skip/manual-review rules without writing any product data, and writes [`tmp/imports/techno-smart/dry-run-report.json`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/tmp/imports/techno-smart/dry-run-report.json:1) plus [`tmp/imports/techno-smart/dry-run-report.md`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/tmp/imports/techno-smart/dry-run-report.md:1). Current result: 28 source products, 15 `create`, 5 `skip_existing`, 8 `manual_review`, and 1 `invalid_source`.

- Create a dry-run importer script, separate from the crawler, that consumes `source-manifest.json`.
- Resolve the target owner and website at runtime by:
  - user email `brinisaziz@gmail.com`
  - website domain `techno-smart.net`
- Fail immediately if the target user/site cannot be resolved uniquely.
- Load all existing target products for that user before planning writes.
- Apply skip rules in this exact order:
  1. exact `sku` match
  2. exact `publicSlug` match
  3. exact normalized product name match
  4. normalized name + same category/brand signal
  5. same `sourceFingerprint` from a previous run artifact
- If a match is ambiguous, do not import and do not auto-rename the product. Put it in `manual-review`.
- Also put a product in `manual-review` if source options/variants cannot be mapped safely without collapsing real price choices.
- Emit `tmp/imports/techno-smart/dry-run-report.json` and `tmp/imports/techno-smart/dry-run-report.md` with:
  - `create`
  - `skip_existing`
  - `manual_review`
  - `invalid_source`
- Do not use the existing CSV import action and do not rely on ambient `requireUser()`.

### Task 3. Implement Managed Product Image Ingestion [DONE]

Status note: completed on 2026-04-14 with [`src/server/product-media-storage.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/server/product-media-storage.ts:1). The helper reuses the Supabase Storage upload pattern, restricts downloads to `techno-smart.tn`, sniffs image bytes before upload, stores managed assets at `products/<userId>/<publicSlug>/<sha256>.<ext>`, deduplicates by content hash, and returns normalized `coverImageUrl` plus gallery entries for the later importer.

- Add reusable product media helpers modeled after the Supabase Storage flow in [`src/app/api/catalogue/orders/[id]/transfer-proof/route.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/app/api/catalogue/orders/%5Bid%5D/transfer-proof/route.ts:1).
- Store images in a dedicated bucket/path such as `products/<userId>/<publicSlug>/<sha256>.<ext>`.
- Download only gallery/cover images hosted on `techno-smart.tn`.
- Validate MIME type by sniffing file bytes, not only headers.
- Deduplicate uploads by content hash.
- If any required gallery image fails download or upload, fail that product and report it. Do not create a partial image-less catalog record.
- Do not store imported product images as inline base64.
- Do not mirror third-party images embedded inside description HTML unless a later decision explicitly authorizes that.

### Task 4. Implement The Importer With Safe Field Mapping [DONE]

Status note: completed on 2026-04-14 with [`scripts/import-techno-smart-products.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/scripts/import-techno-smart-products.ts:1). The script consumes the dry-run artifact plus source manifest, re-checks duplicate/manual-review safety against the live target account, maps source fields into validated product writes with deterministic SKU/slug behavior, uses managed gallery ingestion for apply mode, writes per-product transactions with explicit `userId`, and emits [`tmp/imports/techno-smart/import-report.json`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/tmp/imports/techno-smart/import-report.json:1) plus [`tmp/imports/techno-smart/import-report.md`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/tmp/imports/techno-smart/import-report.md:1). The script defaults to preview mode and only writes products when run with `--apply` or `TECHNO_SMART_IMPORT_APPLY=1`.

- Build the real importer as a second mode of the dry-run script or as a dedicated script that consumes the dry-run artifact.
- Use deterministic `sku = TS-PS-<id_product>` when the source SKU/reference is empty.
- Use `data-product.link_rewrite` for `publicSlug`, but if that slug already belongs to an existing target product, skip or send to `manual-review`. Do not silently suffix it.
- Sanitize `descriptionHtml` with the existing product HTML rules in [`src/lib/product-html.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/lib/product-html.ts:42).
- Preserve source pricing from `price_tax_exc`, `price_amount`, `rate`, and the discount fields.
- For source option pages:
  - map simple option groups into `optionConfig.options` only when the value labels and price adjustments are recoverable safely
  - if price adjustments cannot be recovered safely, stop and send that product to `manual-review`
- Upsert inside a transaction using explicit target `userId`.
- Re-run behavior must be idempotent:
  - existing skipped products remain skipped
  - already imported products are matched by deterministic SKU or slug
  - failed products can be retried independently

### Task 5. Add AI Enrichment As A Post-Parse, Pre-Write Step [DONE]

Status note: completed on 2026-04-14 with [`src/server/product-import-ai.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/server/product-import-ai.ts:1) plus the importer integration in [`scripts/import-techno-smart-products.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/scripts/import-techno-smart-products.ts:1). The importer now runs provider-selected AI enrichment after normalization and before final product validation/writes, enriches `metaTitle`, `metaDescription`, `shortDescriptionHtml`, `descriptionHtml`, and `faqItems`, and falls back field-safely to sanitized source content when model output is unusable. Current preview result in [`tmp/imports/techno-smart/import-report.json`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/tmp/imports/techno-smart/import-report.json:1): 15 ready products, 13 AI-enriched, 2 fallback, 0 failed, with no product data or images written.

- Run AI only after the source record is normalized and before DB writes.
- Use the source title, category, brand signal, short description, full description, price/discount, and stock signal as inputs.
- Generate only these fields:
  - improved `metaTitle`
  - improved `metaDescription`
  - `shortDescriptionHtml` `<= 600` chars
  - cleaned/enhanced `descriptionHtml`
  - `faqItems`
- Keep the generation factual and in French unless the source product is clearly not French.
- Never invent technical specs, warranty terms, license duration, compatibility, stock, or pricing.
- If AI output fails validation, fall back to sanitized source content and keep the import moving.
- FAQ output must stay within current app limits in [`src/lib/product-faq.ts`](/Users/brinis/Documents/Learning/ai/codex/invoices-app/src/lib/product-faq.ts:77).

## Stop Conditions

- Abort the run if the target user or website cannot be resolved uniquely.
- Skip any source URL that is not a real product page.
- Skip any product that already exists in the target account.
- Send any ambiguous duplicate or unsafe variant mapping to `manual-review`.
- Fail a product if required gallery image ingestion fails.
- Do not write partial products missing mandatory fields.

## Risks To Flag Before Running

- Legal/content rights: importing all products, copy, and images from a third-party commerce site requires business authorization. This is especially important for third-party images embedded inside descriptions.
- Content quality: some source descriptions are thin, image-heavy, or mixed with external embeds. AI cleanup must stay factual.
- Anti-bot: the source does not show strong blocking in current inspection, but the crawl should remain sitemap-driven, low-concurrency, and retry with backoff.
- Tenant isolation: the current app still has user/account scoping shortcuts. The importer must pass the target owner explicitly on every DB/storage path.
- Duplicate risk: several source products are already present in the target account under different slugs. Name-based dedupe is required, but fuzzy matches must not auto-merge.
