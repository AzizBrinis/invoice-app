# Supabase Egress Audit

Date: 2026-04-29

Scope: code audit only. No production Supabase/Vercel metrics were available in this workspace, so impact is ranked by implementation risk and expected traffic amplification. The main finding is that a large share of likely Supabase egress is database egress, not only Supabase Storage egress.

## Top Likely Egress Sources

| Rank | Source | Supabase egress type | Impact | Why it is expensive |
| --- | --- | --- | --- | --- |
| 1 | Public catalogue payloads fetching all products, including inline base64 images | Postgres/database egress | Very high | Every public catalogue render can pull media-sized text fields and rich product data from Supabase before trimming the response. Custom-domain traffic and bot paths multiply this. |
| 2 | Inline product images stored in `Product.coverImageUrl` and `Product.gallery` | Postgres/database egress, app response egress | Very high | Product uploads become `data:image/...` strings up to 1 MB each. Listings and image routes repeatedly read those blobs from the database. |
| 3 | Supabase Storage public product image delivery | Storage egress | Medium to high | Storage URLs are direct public assets. Next Image helps for current templates, but legacy/raw `<img>` usage and many responsive variants can still pull from Supabase Storage. |
| 4 | Public catalogue client APIs using `no-store` or returning full detail payloads | Postgres/database egress and API response egress | Medium | Client-side product/blog/CMS navigation bypasses caching and fetches rich payloads on repeat visits. |
| 5 | Messaging local sync and detail prefetch | Postgres/database egress | Medium to low | Background sync runs every 3 minutes plus focus/visibility events. Lists are compact, but detail prefetch can select full sanitized HTML/text/search fields. |
| 6 | Order transfer proof delivery from Supabase Storage | Storage egress | Low to medium | Proof uploads go to a public-style Supabase object URL. Impact depends on admin/customer proof download frequency. |
| 7 | Auth/session, client directory, Realtime | Postgres or Realtime egress | Low | Auth is custom database auth with request-scoped caching. Client directory payloads are compact. No Supabase Realtime subscriptions were found. |

## Findings

### 1. Public catalogue loads too much data before route filtering

Code paths:
- `src/app/catalogue/[[...segments]]/page.tsx:325` calls `loadResolvedPayload`.
- `src/app/catalogue/[[...segments]]/page.tsx:350` calls the same resolver from `generateMetadata`.
- `src/app/catalogue/[[...segments]]/page.tsx:416` calls it again for the page render.
- `src/app/catalogue/[[...segments]]/page.tsx:420` resolves the full payload before `resolveCatalogRouteAvailability`.
- `src/server/website.ts:4813` `loadCatalogWebsite`.
- `src/server/website.ts:4828` uses `prisma.websiteConfig.findFirst({ where })` without a narrow `select`.
- `src/server/website.ts:4840` `listCatalogProducts`.
- `src/server/website.ts:4841-4877` selects all listed products with `description`, `descriptionHtml`, `shortDescriptionHtml`, `coverImageUrl`, `gallery`, `faqItems`, `quoteFormSchema`, `optionConfig`, and variant data.
- `src/server/website.ts:5001-5013` builds full catalogue payloads by loading products, CMS pages, and blog content.
- `src/lib/catalogue-public.ts:4` trims products only after the database query.

Root cause:
- The public catalogue assembly fetches a full website and all listed products for the site before it knows whether the requested route needs them.
- Heavy fields are trimmed after they have already crossed from Supabase Postgres to the app.
- Unknown custom-domain paths still rewrite to `/catalogue` and can trigger the same payload work before returning 404.

Why expensive:
- The high-cost unit is "catalogue request x all listed products x rich fields".
- Inline image strings in `coverImageUrl` and `gallery` make the database rows much larger.
- Bot/crawler traffic on public custom domains can create many cache-miss or revalidation events.

Quick wins:
- Add a cheap route preflight before full payload assembly for custom-domain/catalogue paths.
- Split listing queries from detail queries. Listings should select only IDs, slugs, names, prices, stock badges, and a small image pointer/hash.
- Increase public catalogue CDN TTLs if content freshness allows it.
- Add request-size logging around public catalogue payload assembly.

Deeper improvements:
- Build a small denormalized public catalogue index per website and cache it by website/product update tags.
- Store product media as asset IDs or object paths, not inline strings in product rows.
- Move rich fields (`descriptionHtml`, galleries, option config, FAQ, quote schema) behind product-detail-only queries.

How to verify:
- In Supabase Database metrics, compare network egress spikes with Vercel requests to `/catalogue/*` and custom-domain hosts.
- In Vercel logs, group catalogue requests by host, path, user agent, status, response size, and cache status. Pay special attention to 404/bot paths.
- Run database size checks:

```sql
select
  count(*) as listed_products,
  pg_size_pretty(sum(octet_length(coalesce("coverImageUrl", '')))::bigint) as cover_text,
  pg_size_pretty(sum(octet_length(coalesce("gallery"::text, '')))::bigint) as gallery_json,
  max(octet_length(coalesce("gallery"::text, ''))) as max_gallery_json
from "Product"
where "isListedInCatalog" = true;
```

### 2. Product uploads are stored as inline database images

Code paths:
- `src/app/(app)/produits/product-form.tsx:302` reads uploaded files with `FileReader.readAsDataURL`.
- `src/app/(app)/produits/product-form.tsx:332` writes optimized images with `canvas.toDataURL("image/webp", 0.82)`.
- `src/app/(app)/produits/product-form.tsx:465` serializes gallery item `src` values into a hidden `gallery` field.
- `src/app/(app)/produits/product-form.tsx:496` writes the primary image into `coverImageUrl`.
- `src/app/(app)/produits/actions.ts:69-102` reads those form fields and sends them to product persistence.
- `src/server/products.ts:18` allows `data:image/` URLs.
- `src/server/products.ts:20` sets `MAX_GALLERY_IMAGE_URL_LENGTH = 1_000_000`.
- `src/server/products.ts:32` permits inline images up to 1 MB.
- `src/server/products.ts:332-333` stores `coverImageUrl` and `gallery`.

Root cause:
- Product media is embedded directly in product rows as base64 text instead of being uploaded to object storage and referenced by key/URL.

Why expensive:
- Base64 adds overhead versus binary media.
- Every query that selects product image fields transfers image content through the database connection.
- Database egress becomes proportional to page traffic, not only to image requests.

Quick wins:
- Stop accepting new `data:image` uploads for product media.
- Upload product images to Supabase Storage or another object store and store only the object path plus metadata.
- Add a one-time migration for existing inline `coverImageUrl` and `gallery` values.

Deeper improvements:
- Add a `MediaAsset` model with object path, hash, byte size, dimensions, blur placeholder, and variants.
- Store responsive/precompressed product variants at upload time.
- Keep listing images separate from full galleries.

How to verify:
- Count inline images:

```sql
select
  count(*) filter (where "coverImageUrl" like 'data:image/%') as inline_covers,
  count(*) filter (where "gallery"::text like '%data:image/%') as inline_galleries
from "Product";
```

- Sample largest rows:

```sql
select
  id,
  name,
  octet_length(coalesce("coverImageUrl", '')) as cover_bytes,
  octet_length(coalesce("gallery"::text, '')) as gallery_bytes
from "Product"
order by (octet_length(coalesce("coverImageUrl", '')) + octet_length(coalesce("gallery"::text, ''))) desc
limit 25;
```

### 3. Inline image routes cache browsers but still read image blobs from Postgres

Code paths:
- `src/server/website.ts:934` detects inline catalogue image sources.
- `src/server/website.ts:950` builds `/api/catalogue/products/[id]/listing-image/[slug]?v=...&slot=...`.
- `src/server/website.ts:1007` externalizes inline product images after fetching product records.
- `src/app/api/catalogue/products/[id]/listing-image/[slug]/route.ts:334` queries the product image fields.
- `src/app/api/catalogue/products/[id]/listing-image/[slug]/route.ts:359` decodes the data URL.
- `src/app/api/catalogue/products/[id]/listing-image/[slug]/route.ts:474` serves with `Cache-Control: public, max-age=31536000, immutable`.
- `src/app/api/catalogue/blog/image/route.ts:78-87` loads a blog post and reads image fields.
- `src/app/api/catalogue/blog/image/route.ts:115-120` serves decoded inline blog images with `max-age=3600`.
- `src/app/api/catalogue/site-favicon/route.ts:50-60` loads website config and resolves favicon.
- `src/app/api/catalogue/site-favicon/route.ts:79-86` serves decoded inline favicon data with immutable cache.

Root cause:
- Inline image routes are compensating for database-stored images. They reduce client payload size but do not remove the database media read.

Why expensive:
- Cold instances, cache misses, deploys, variant changes, and image transformations can repeatedly read the same large text field from Supabase.
- Blog image cache TTL is only 1 hour.

Quick wins:
- Migrate inline product/blog/favicon images to object storage.
- For routes that remain, cache transformed bytes in durable storage, not only in process memory.
- Extend cache TTLs for immutable content-addressed image URLs.

Deeper improvements:
- Make public image URLs content-addressed by asset hash.
- Generate and persist variants during upload/import.

How to verify:
- In Vercel logs, group requests by `/api/catalogue/products/*/listing-image/*`, `/api/catalogue/blog/image`, and `/api/catalogue/site-favicon`.
- Compare those request counts with Supabase database egress and query count around the same time.
- Check cache hit ratio and cold-start/deploy windows.

### 4. Supabase Storage product delivery can still bypass the app cache

Code paths:
- `src/server/product-media-storage.ts:8` uses bucket `product-images`.
- `src/server/product-media-storage.ts:91` builds public Supabase Storage URLs.
- `src/server/product-media-storage.ts:286` imports remote images with `cache: "no-store"`.
- `src/server/product-media-storage.ts:369-417` uploads image bytes and returns a public URL.
- `next.config.ts:99-103` enables Next Image for configured remote hosts with `minimumCacheTTL` of 7 days.
- `src/components/website/templates/ecommerce-ciseco/components/shared/CatalogImage.tsx:99-130` uses Next Image for allowed remote Storage URLs.
- `src/components/website/templates/ecommerce.tsx:486` uses raw `<img src={product.image}>`, bypassing Next Image optimization for that template.

Root cause:
- Imported product images live in public Supabase Storage and can be served directly.
- Current Ciseco product cards are mostly protected by Next Image caching, but older/raw templates still download direct Storage URLs from the browser.

Why expensive:
- Direct browser requests to `storage/v1/object/public/...` always count as Supabase Storage egress.
- Responsive image variants can create multiple origin pulls per source image after cache eviction or deployment.

Quick wins:
- Replace raw product `<img>` usage with the shared `CatalogImage`/Next Image path.
- Audit active website templates and confirm product images do not render direct Supabase URLs.
- Keep Storage object cache headers long and immutable where object paths include a hash/version.

Deeper improvements:
- Use a dedicated CDN in front of Storage or precomputed variants served from a CDN bucket.
- Store width/height and variant metadata with each media asset.

How to verify:
- In Supabase Storage logs, group by bucket/path prefix, especially `product-images`.
- Separate direct browser Storage requests from Next Image optimizer origin pulls by user agent/referrer/path.
- In Vercel logs, group `_next/image` URLs where `url=` points to the Supabase Storage host.

### 5. Product, blog, and CMS APIs fetch public content with weak caching

Code paths:
- `src/app/api/catalogue/products/route.ts:14-43` selects full product detail fields.
- `src/app/api/catalogue/products/route.ts:95-104` may perform a fallback lookup over product IDs/names/SKUs/slugs.
- `src/app/api/catalogue/products/route.ts:140` returns JSON without an explicit public cache header.
- `src/components/website/templates/ecommerce-ciseco/pages/ProductPage.tsx:56-60` fetches product detail with `cache: "no-store"`.
- `src/app/api/catalogue/blog/route.ts:47-56` returns full blog post JSON without an explicit public cache header.
- `src/components/website/templates/ecommerce-ciseco/pages/BlogDetailPage.tsx:169` fetches blog detail with `cache: "no-store"`.
- `src/app/api/catalogue/cms/route.ts:51-72` returns rendered CMS content without an explicit public cache header.

Root cause:
- Client-side navigation relies on public API routes that bypass browser/Next fetch caching and return rich detail payloads.

Why expensive:
- The same product/blog/CMS detail can be refetched by each client session.
- Rich fields include HTML, galleries, options, FAQs, and other metadata.

Quick wins:
- Add public CDN cache headers to immutable or versioned catalogue API responses.
- Remove `cache: "no-store"` for public catalogue content where freshness allows.
- Return compact responses unless the route is definitely a detail view.

Deeper improvements:
- Version API responses by content `updatedAt` or hash.
- Share the same cached data source between SSR payloads and client navigation APIs.

How to verify:
- In Vercel logs, group `/api/catalogue/products`, `/api/catalogue/blog`, and `/api/catalogue/cms` by response size and cache status.
- Correlate API traffic with Supabase database egress.
- Compare repeat requests per browser session before and after caching changes.

### 6. Custom-domain routing amplifies public catalogue work

Code paths:
- `src/proxy.ts:42` rewrites non-static, non-API routes through `handleCatalogHostRouting`.
- `src/lib/catalog-proxy.ts:48-81` rewrites custom-host paths to `/catalogue` and sets `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`.
- `src/lib/catalog-proxy.ts:12-23` excludes only known dynamic path prefixes from public caching.
- `src/lib/catalog-host.ts:83-90` treats non-app hosts as custom catalogue domains.
- `next.config.ts:83-120` sets 30 second `s-maxage` catalogue headers.

Root cause:
- Broad custom-domain rewrites make many arbitrary paths eligible for catalogue rendering.
- The catalogue render then loads full site/product payloads before cheap route rejection.

Why expensive:
- Public domains attract crawlers, scanners, and invalid paths.
- A 30 second CDN TTL still allows recurring origin/database work under steady traffic.

Quick wins:
- Resolve route availability cheaply before loading product/CMS/blog payloads.
- Cache 404s for invalid public catalogue routes.
- Consider bot filtering/rate limiting on custom domains.

Deeper improvements:
- Maintain a route manifest per website and serve unknown paths from a cheap edge/cache lookup.
- Increase TTLs for public pages whose content changes infrequently.

How to verify:
- Group Vercel logs by custom host and requested path.
- Rank paths by request count and origin/cache miss count.
- Compare invalid path traffic against Supabase database egress spikes.

### 7. Messaging sync is probably secondary, but it does poll and prefetch

Code paths:
- `src/app/(app)/messagerie/_components/mailbox-sync-provider.tsx:29-32` sets a 3 minute background sync and quick initial sync.
- `src/app/(app)/messagerie/_components/mailbox-sync-provider.tsx:327-341` repeats sync on interval, visibility, and focus.
- `src/app/(app)/messagerie/_components/mailbox-client.tsx:456` sets detail prefetch batch size to 3.
- `src/app/(app)/messagerie/_components/mailbox-client.tsx:1327-1364` prefetches visible message details.
- `src/server/messaging-local-sync.ts:154-190` `localMessageSelect` includes body/search fields.
- `src/server/messaging-local-sync.ts:1103-1129` list summaries avoid bodies, which limits list impact.

Root cause:
- Local messaging sync intentionally keeps the UI warm. Detail prefetch may select full message body fields from Supabase-backed tables.

Why expensive:
- The interval and focus triggers can create repeated database reads for active admin users.
- If message bodies or `searchText` are large, detail prefetch multiplies payload size.

Quick wins:
- Confirm whether local sync is enabled in production.
- Reduce detail prefetch or remove large body/search fields from prefetch paths.
- Log mailbox sync query counts and byte estimates.

Deeper improvements:
- Split message detail body fields from searchable/index fields.
- Cache detail payloads by mailbox UID/version.

How to verify:
- Compare Supabase database egress during active admin mailbox sessions versus idle periods.
- Inspect query counts for messaging tables and response sizes from server actions.
- Estimate message body storage:

```sql
select
  pg_size_pretty(
    sum(
      octet_length(coalesce("sanitizedHtml", '')) +
      octet_length(coalesce("normalizedText", '')) +
      octet_length(coalesce("searchText", ''))
    )::bigint
  ) as message_body_text
from "MessagingLocalMessage";
```

### 8. Low-impact or not found

Auth/session:
- `src/lib/auth.ts:90-100` uses request-scoped `cache`.
- `src/lib/auth.ts:147-167` reads custom session/user records from the database.
- No Supabase Auth client was found, so Supabase Auth request egress is not the driver.

Client directory:
- `src/lib/client-directory-cache.ts:44` uses a 45 second client cache.
- `src/lib/client-directory-cache.ts:118` fetches `/api/clients` with `cache: "no-store"`.
- `src/server/clients.ts:224-248` selects compact fields and server-caches for 45 seconds.
- This is worth watching but is unlikely to dominate unless admin traffic is high.

Realtime:
- No `@supabase/supabase-js`, `channel(...)`, or Supabase Realtime subscription usage was found.
- Supabase Realtime egress should be near zero unless configured outside this codebase.

Order proofs:
- `src/app/api/catalogue/orders/[id]/transfer-proof/route.ts:17-22` uses bucket `order-proofs`.
- `src/app/api/catalogue/orders/[id]/transfer-proof/route.ts:73` uploads to Supabase.
- `src/app/api/catalogue/orders/[id]/transfer-proof/route.ts:223-240` returns a public proof URL.
- Impact depends on proof viewing/download volume.

## Recommended Fix Order

1. Measure inline product image size and catalogue route traffic first. This should confirm whether database egress is the main bill driver.
2. Stop writing new product images as `data:image` strings.
3. Migrate existing inline product/blog/favicon media to object storage and store references only.
4. Split catalogue listing/detail queries and preflight unknown custom-domain routes before full payload assembly.
5. Add CDN cache headers to public product/blog/CMS API responses and remove `no-store` from public immutable content.
6. Replace raw product `<img>` paths with the shared optimized image component.
7. Add route-level response-size and cache-status dashboards for Supabase/Vercel correlation.

## Verification Checklist

- Supabase Database: graph network egress against public catalogue origin requests.
- Supabase Storage: group egress by bucket, especially `product-images` and `order-proofs`.
- Vercel/Application logs: group by route, host, status, user agent, response bytes, and cache hit/miss.
- Database SQL: measure `Product.coverImageUrl`, `Product.gallery`, blog image fields, and message body fields.
- Browser/network: inspect product listing pages and confirm images are loaded through `_next/image` or immutable app image routes, not direct Storage URLs.
- Realtime: confirm Supabase Realtime connection and message metrics are zero or negligible.
