# SEO Audit Report: techno-smart.net

Audit date: 2026-04-18  
Scope audited: live site, robots.txt, sitemap.xml, homepage, product pages, collections/categories, search/faceted URLs, blog listing/articles, about/contact/legal/account/cart/checkout pages, rendered metadata, JSON-LD, internal links, mobile rendering, and selected implementation files in the local Next.js codebase.

Important implementation note: the local workspace has uncommitted SEO/catalogue changes and does not perfectly match the currently deployed live site. Findings below are based on the live website first; code references are used to explain likely root causes where they match the observed behavior.

## Executive Summary

Techno Smart has a solid SEO foundation for a new ecommerce catalogue: HTTPS works, indexable pages generally have titles, descriptions, canonicals, hreflang tags, one H1, image alt text, product offer schema, FAQ schema on most product pages, XML sitemap, and clean noindex handling for cart/account/checkout/search/faceted pages.

The site is not yet strong enough for competitive commercial software-license queries because several high-impact issues dilute crawl quality and topical authority:

- Invalid URLs return HTTP 200 instead of 404/redirect, creating soft-404 and crawl-waste risks.
- English URLs are exposed as canonical/hreflang alternates while much of the content remains French and `<html lang>` is always `fr`.
- Category and contact/about pages are thin; category pages are especially weak for commercial non-brand queries.
- Live product JSON-LD incorrectly marks branded products as `brand: Techno Smart` instead of Microsoft, Adobe, Autodesk, etc.
- All tested HTML pages are served with `private, no-cache, no-store` and repeated `x-vercel-cache: MISS`, reducing CDN caching benefit and making crawl performance less resilient.
- Blog articles are informationally useful but do not strongly pass internal authority to matching product pages.

Overall SEO score: **67 / 100**

## Category Scores

| Category | Score | Rationale |
|---|---:|---|
| Technical SEO | 64 | Good HTTPS, canonicals, sitemap and noindex basics; hurt by soft 200 invalid URLs and no CDN cache. |
| On-page SEO | 69 | Most pages have titles/H1/descriptions, but many snippets are too long/short/generic and key pages are under-optimized. |
| Content SEO | 61 | Product/blog content is a good start; category/contact/about pages are thin and topical clusters need expansion. |
| Structured Data | 72 | Product, Offer, FAQ, Breadcrumb, Article, Blog, Organization present; live product `brand` is wrong and Article/Product enhancements are incomplete. |
| Crawlability / Indexability | 58 | Sitemap/robots exist, but invalid URLs and empty categories can be indexed as 200 pages. |
| Internal Linking | 60 | Navigation and product grids work; blog-to-product and category hub linking are weak. |
| Mobile SEO | 84 | Responsive viewport and no horizontal overflow in sampled pages; language signal is wrong for `?lang=en`. |
| Performance / Core Web Vitals SEO | 76 | Lab render metrics are fast, but no-store cache headers, dynamic rendering, and hotlinked product images are risks. |
| Product Page SEO | 77 | Strong product intent, offers and FAQ; overlong meta descriptions, wrong schema brand, and external images reduce quality. |
| Blog SEO | 66 | Useful articles with Article schema; long snippets, weak conversion/internal links, partial localization, and limited depth. |

## Page-Type Score Breakdown

| Page type | Live examples | Score | Main notes |
|---|---|---:|---|
| Homepage | `/`, `/?lang=fr` | 74 | Strong title/description; H1 is trust-focused but not keyword-focused; only 280 words. |
| Product pages | 21 sitemap product URLs | 77 | Good H1/schema/offers/FAQ; many meta descriptions over 160 chars; schema brand wrong live. |
| Collections listing | `/collections?lang=fr` | 55 | 195 words, short title/description, no H2, generic copy. |
| Category pages | `/collections/logiciels`, `/collections/software` | 48 | Very thin, duplicate title issue, one category slug appears duplicated/overlapping. |
| Blog listing | `/blog?lang=fr` | 68 | Has Blog schema and 300 words; description short; needs topic hub structure. |
| Blog articles | 4 sitemap article URLs | 70 | 655-1029 words, Article schema; titles/descriptions long and little product-link equity. |
| About | `/about?lang=fr` | 55 | 216 words, short generic metadata, limited trust/E-E-A-T detail. |
| Contact | `/contact?lang=fr` | 45 | Only 56 words; needs full business trust signals and local business details. |
| Legal pages | CGV, privacy, legal notice | 72 | Content exists and indexable; descriptions are long; useful for trust. |
| Search/faceted pages | `/search`, filtered collections | 78 | Correctly noindexed; robots/noindex handling can be cleaner. |
| Auth/account/cart/checkout | `/login`, `/account`, `/cart`, `/checkout` | 82 | Correctly noindex/nofollow; disallowed in robots. |

## Evidence Snapshot

- Sitemap: valid XML, 35 URLs: 1 home, 1 collections, 2 categories, 21 products, 4 blog articles, 3 legal, about/contact/blog listing.
- Robots.txt: allows `/`, disallows `/api/`, preview, auth/account/cart/checkout/search equivalents; sitemap declared.
- Repeated response headers: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`; `x-vercel-cache: MISS`; `age: 0`.
- Homepage: title length 56, meta description 145, H1 count 1, word count ~280, schema `WebSite`, `Organization`.
- Collections page: title length 26, description 92, word count ~195, no H2.
- Contact page: title length 22, description 54, word count ~56.
- Product pages: all sampled products have `Product` + `Offer`; 20/21 have FAQPage; most have 1 H1 and image alts.
- Blog articles: all 4 have `Article` + `BreadcrumbList`, 1 H1, 4 images with alt text, 655-1029 words.
- Search spot check via available search results returned no visible indexed results for `site:techno-smart.net`; confirm in Google Search Console before treating as definitive.

## Top Critical Issues

### 1. Invalid URLs return HTTP 200 and can create soft-404/index-bloat

Severity: **Critical**  
Affected pages:

- `/does-not-exist` returns 200 and serves homepage content with homepage canonical.
- `/foo/bar` returns 200 and serves homepage content.
- `/produit/does-not-exist?lang=fr` returns 200 with H1 `Produit introuvable` and a self canonical.
- `/collections/does-not-exist?lang=fr` returns 200, indexable, with title `Does Not Exist - Techno Smart`.
- Uppercase routes like `/Collections?lang=fr`, `/Produit/...`, `/BLOG/...` return homepage content with 200.

Root cause:

- The route resolver falls back to home for unknown paths. In the local code, `resolvePage()` returns `{ page: "home" }` as the default in `src/components/website/templates/ecommerce-ciseco/utils.ts`.
- SEO route metadata marks product/category targets as indexable before validating that the product/category exists. See `resolveCatalogRouteInfo()` in `src/server/website.ts`.
- `src/app/catalogue/[[...segments]]/page.tsx` only calls `notFound()` when no catalogue payload exists, not when the requested route inside a valid catalogue is invalid.

Recommended fix:

- Add server-side route validation before rendering:
  - Unknown non-root paths: return real 404.
  - Missing product slug: return 404, not a 200 "product not found" page.
  - Missing blog slug: return 404 or `noindex` with a real 404 status.
  - Unknown/empty category slug: either 404 or canonical redirect to a valid category if it is an alias.
- Normalize route casing and aliases with 301 redirects to canonical lowercase paths.
- Keep user-facing not-found UI, but serve it through Next `notFound()` so the HTTP status is 404.

Expected SEO impact:

- High. Reduces soft-404 signals, crawl waste, duplicate URL variants, and low-quality indexed pages. This is one of the most important fixes before pushing more content.

### 2. Multilingual SEO is exposed but not truly implemented

Severity: **Critical**  
Affected pages:

- `/?lang=en`
- `/collections?lang=en`
- `/produit/microsoft-windows-11-professionnel-telechargement-numerique?lang=en`
- `/blog/windows-11-pro-vs-famille-lequel-choisir?lang=en`
- `/contact?lang=en`
- Sitemap hreflang alternates for `fr`, `en`, and `x-default`.

Observed issues:

- `?lang=en` URLs are canonical and included as hreflang alternates, but large parts of content remain French.
- `<html lang>` remains `fr` even on English URLs.
- Homepage English URL still uses French title, description, and H1.
- Product/blog English URLs mix English UI labels with French product/article content.

Root cause:

- Root layout hardcodes `<html lang="fr">` in `src/app/layout.tsx`.
- Live deployment publishes `en` alternates before full English localized content exists. The local code appears to have changes limiting public locales to French, but the live sitemap still exposes English.

Recommended fix:

- Choose one path:
  - Short-term: remove `en` from hreflang, sitemap alternates, language switcher indexability, and canonical generation until full English content is ready.
  - Long-term: create complete English titles, descriptions, H1s, body copy, product descriptions, FAQs, article bodies, image alts, schema `inLanguage`, and `<html lang="en">`.
- Make locale part of route-level layout or metadata so the HTML `lang` attribute matches the rendered language.
- In sitemap hreflang, include only fully equivalent localized URLs.

Expected SEO impact:

- High. Fixes contradictory language signals, prevents wrong-language indexing, and protects French relevance.

### 3. Category pages are thin, duplicated, and weak for commercial discovery

Severity: **High**  
Affected pages:

- `/collections?lang=fr`: ~195 words, generic title/description.
- `/collections/logiciels?lang=fr`: ~187 words, short description.
- `/collections/software?lang=fr`: ~96 words, duplicate live title `Logiciels - Techno Smart`.

Root cause:

- Collection templates rely mostly on product grids and short generated text.
- Category source data appears inconsistent: `logiciels` and `software` both exist live as separate sitemap URLs even though they overlap semantically.

Recommended fix:

- Consolidate category aliases. Redirect `/collections/software` to `/collections/logiciels` for French, or create a separate English category only on true English pages.
- Add 300-600 words of unique intro/buyer-guide copy per category:
  - target queries such as `licence logiciel Tunisie`, `acheter licence Microsoft Tunisie`, `Windows 11 Pro Tunisie`, `Office 2024 Tunisie`.
  - include benefits, delivery, authenticity, activation, support, FAQs, and brand/product subcategory links.
- Add H2 sections on collections/category pages.
- Add ItemList schema already exists; keep it but ensure only canonical categories are exposed.

Expected SEO impact:

- High. Category pages should be the main ranking targets for non-brand commercial searches; today they are too thin to compete.

### 4. Live Product JSON-LD uses the seller as the product brand

Severity: **High**  
Affected pages:

- All 21 sitemap product pages. Live examples:
  - Microsoft products: `brand: Techno Smart`
  - Adobe product: `brand: Techno Smart`
  - Autodesk products: `brand: Techno Smart`
  - Internet Download Manager: `brand: Techno Smart`

Root cause:

- Live structured data maps product brand to the store/seller. The local code appears to include a newer brand resolver, but this is not reflected live.

Recommended fix:

- In Product JSON-LD:
  - Microsoft products -> `brand.name = Microsoft`
  - Adobe -> `Adobe`
  - Autodesk -> `Autodesk`
  - IDM -> `Tonec` or `Internet Download Manager`
- Keep seller as `offers.seller.name = Techno Smart`.
- Add `mpn`, `gtin`, or manufacturer identifiers where legally/operationally available.

Expected SEO impact:

- Medium-high. Improves rich-result accuracy, merchant trust, and entity alignment for branded software searches.

### 5. Pages are not CDN-cacheable despite mostly catalogue/static content

Severity: **High**  
Affected pages:

- Homepage, product pages, collections, blog articles, contact page.

Observed evidence:

- Repeated `curl` tests returned `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`.
- Repeated `x-vercel-cache: MISS`, `age: 0`.

Root cause:

- Likely dynamic rendering from request header usage/custom domain resolution in the catalogue route and metadata path.
- `src/app/catalogue/[[...segments]]/page.tsx` reads `headers()` and resolves payload by host/domain.

Recommended fix:

- Separate host/domain lookup from cacheable page generation where possible.
- Use explicit Vercel/Next caching strategy for public catalogue pages:
  - cache public product/category/blog HTML for short ISR windows.
  - tag-based revalidation after product/blog/site changes.
  - avoid per-request no-store behavior on public pages.
- Keep private/no-store only for authenticated/account/cart/checkout APIs and pages.

Expected SEO impact:

- Medium-high. Lab performance is currently fast, but cacheability improves crawl efficiency, TTFB consistency, and resilience under load.

## Medium Priority Issues

### 6. Metadata length and quality issues are widespread

Severity: **Medium**  
Affected pages:

- Short/generic metadata:
  - `/collections`: title 26, description 92.
  - `/about`: title 24, description 76.
  - `/contact`: title 22, description 54.
  - `/collections/logiciels`: description 48.
  - `/collections/software`: description 47.
- Overlong descriptions:
  - 13+ product pages exceed ~160 chars.
  - All 4 blog article descriptions are 161-167 chars.
  - Legal descriptions are ~189-190 chars.
- Overlong blog titles:
  - 4 blog titles are 70-73 chars.

Root cause:

- Some metadata comes from page defaults or raw product/blog descriptions without SERP-length tuning.

Recommended fix:

- Write custom SERP snippets for every indexable page:
  - titles: 45-60 chars where possible.
  - descriptions: 135-155 chars.
  - put commercial modifiers early: `Tunisie`, `licence officielle`, `telechargement numerique`, `livraison email`, product year/version.
- Prioritize top revenue products first.

Expected SEO impact:

- Medium. Improves click-through rate and query targeting; not as urgent as soft-404/localization fixes.

### 7. Contact and About pages lack trust depth

Severity: **Medium**  
Affected pages:

- `/contact?lang=fr`: ~56 words.
- `/about?lang=fr`: ~216 words.

Root cause:

- Template uses minimal static copy and contact details; not enough E-E-A-T/trust content for an ecommerce software seller.

Recommended fix:

- Contact page:
  - add full NAP block, hours, support response time, delivery method, business registration/legal links, WhatsApp/phone/email CTAs, FAQ about digital delivery.
  - enrich `ContactPage`/`Organization` schema with addressLocality, postalCode, addressCountry, openingHours, contactPoint, sameAs.
- About page:
  - add company story, software-license expertise, official-license policy, support process, Tunisian market relevance, guarantees, and links to CGV/privacy/legal.

Expected SEO impact:

- Medium. Helps trust, conversion, and quality evaluation around software-license ecommerce.

### 8. Blog articles do not pass enough internal authority to product pages

Severity: **Medium**  
Affected pages:

- All 4 blog articles.

Observed evidence:

- Blog article pages link to blog/category/navigation, but sampled articles had no direct `/produit/` links in rendered HTML.
- Articles target high-commercial topics such as Windows 11 and Office comparisons, but do not consistently link to matching product pages.

Root cause:

- Blog content is structured as informational articles with related articles; product matching/link blocks are absent from the live render.

Recommended fix:

- Add contextual product links inside article body and sidebar:
  - Windows 11 Pro article -> Windows 11 Pro product and Windows 10/Server alternatives.
  - Office 365 vs Office 2021 article -> Office 365, Office 2021, Office 2024 product pages.
  - Cracked software/security article -> official Windows/Office licenses and antivirus/security products if sold.
- Use descriptive anchors, not just `Voir le produit`.
- Add article-end commercial FAQ and comparison tables linking to categories/products.

Expected SEO impact:

- Medium. Strengthens topical clusters and pushes blog traffic toward revenue pages.

### 9. Product body images are often hotlinked external assets without dimensions

Severity: **Medium**  
Affected pages:

- `/produit/microsoft-windows-11-professionnel-telechargement-numerique?lang=fr`
- `/produit/internet-download-manager-idm?lang=fr`
- likely other rich product descriptions.

Observed evidence:

- Product body includes external images from `m.media-amazon.com` and `internetdownloadmanager.com`.
- Many lack explicit width/height attributes.

Root cause:

- Rich product descriptions include remote vendor/media images directly.

Recommended fix:

- Import key images into the site's own media pipeline/CDN.
- Serve optimized WebP/AVIF variants with explicit dimensions.
- Keep remote images only when licensing/usage rights are confirmed.
- Avoid large GIFs where possible; replace with static screenshots or compressed videos.

Expected SEO impact:

- Medium. Improves image reliability, CLS risk, crawl/render consistency, and page trust.

### 10. Homepage H1 is trust-focused but not query-focused

Severity: **Medium**  
Affected page:

- Homepage.

Root cause:

- H1 is `Techno Smart, votre partenaire de confiance.` while the title targets `Achetez vos Licences Logiciels en Tunisie`.

Recommended fix:

- Change H1 to a query-aligned phrase such as `Licences logiciels officielles en Tunisie`.
- Keep trust message as supporting H2/body copy.

Expected SEO impact:

- Medium. Improves top-level relevance for the site's core commercial query.

## Low Priority Issues / Refinements

### 11. Search URLs are both disallowed and noindexed

Severity: **Low**  
Affected pages:

- `/search`, `/recherche`.

Root cause:

- robots.txt disallows search paths while page metadata says `noindex, follow`.

Recommended fix:

- If the goal is deindexing already-discovered search URLs, allow crawl and keep `noindex, follow`.
- If the goal is crawl prevention only, robots disallow is acceptable, but crawlers may not see the noindex directive.

Expected SEO impact:

- Low. Search pages are not primary ranking targets.

### 12. Blog imagery is repetitive/generic

Severity: **Low**  
Affected pages:

- Blog listing and related article cards.

Root cause:

- Several blog cards use generic or repeated imagery.

Recommended fix:

- Use unique branded/product-relevant images for each article.
- Ensure Open Graph images are crawlable, stable, and 1200x630 where possible.

Expected SEO impact:

- Low-medium. Helps CTR/social previews and perceived quality.

### 13. Article schema can be enhanced

Severity: **Low**  
Affected pages:

- 4 blog article pages.

Root cause:

- `Article` schema exists but can include more fields.

Recommended fix:

- Add `dateModified`, `image` consistently, `author.url` or organization/person profile, `publisher.logo`, and article section/tags.
- Consider `BlogPosting` instead of generic `Article` for blog posts.

Expected SEO impact:

- Low-medium. Improves eligibility and clarity, especially when content volume grows.

## Quick Wins

1. Return real 404 for missing product/blog/unknown paths and empty invalid categories.
2. Remove `en` hreflang/canonicals from live until English content is complete, or noindex English URLs temporarily.
3. Fix live Product schema brand mapping.
4. Redirect `/collections/software` to `/collections/logiciels` or make it a true English-only URL.
5. Rewrite metadata for `/collections`, `/collections/logiciels`, `/about`, `/contact`, and top 10 product pages.
6. Add direct product links inside all four blog articles.
7. Change homepage H1 to target `licences logiciels officielles en Tunisie`.
8. Add 300+ words of unique category copy to `/collections/logiciels`.
9. Add detailed contact/trust content and Organization `contactPoint`.
10. Configure cacheable public catalogue HTML on Vercel/Next where possible.

## Longer-Term Opportunities

1. Build category/topic hubs:
   - Microsoft Office licences in Tunisia.
   - Windows licences in Tunisia.
   - Autodesk licences for architects/engineers.
   - Adobe Creative Cloud alternatives/subscriptions.
2. Expand blog clusters:
   - `Windows 11 Pro prix Tunisie`
   - `Office 2024 vs Office 2021`
   - `licence Office Mac Tunisie`
   - `Windows Server CAL c'est quoi`
   - `comment verifier une licence Windows authentique`
3. Add comparison tables and buyer FAQs to product/category pages.
4. Add review generation workflow for each product; product rich results benefit from authentic review depth.
5. Add a dedicated local landing page for Tunis/Nabeul/Tunisia software-license intent if business operations support it.
6. Add Search Console + merchant/rich-results monitoring:
   - Coverage: soft 404s, crawled currently not indexed.
   - Enhancements: Product snippets, Merchant listings, Breadcrumbs, FAQ.
   - Performance: queries by page type.

## Prioritized Action Plan

### Week 1: Crawl Quality and Language Signals

1. Implement 404/301 behavior for invalid/uppercase/alias routes.
2. Remove or disable English hreflang/canonical exposure until complete.
3. Validate sitemap after route changes; include only canonical, indexable URLs.
4. Re-test: `/does-not-exist`, `/produit/does-not-exist`, `/collections/does-not-exist`, uppercase paths, and `/collections/software`.

### Week 2: Schema and Metadata

1. Deploy correct Product brand mapping.
2. Add or validate `mpn` where available.
3. Rewrite metadata for homepage, collections, category, contact/about, and top product pages.
4. Add `dateModified` and richer publisher data to blog schema.

### Weeks 3-4: Content and Internal Links

1. Expand `/collections/logiciels` into a strong commercial landing page.
2. Add product-specific internal links to all blog posts.
3. Expand contact/about trust content.
4. Add FAQs and comparison sections to top product pages.

### Month 2: Performance and Authority

1. Make public catalogue pages cacheable with ISR/tag revalidation.
2. Replace hotlinked external product body images with optimized local/CDN assets.
3. Publish 6-10 supporting articles for Windows/Office/Autodesk clusters.
4. Use Search Console data to prioritize pages with impressions but low CTR or low average position.

## Recommended Target Scores After Fixes

| Area | Current | 60-day realistic target |
|---|---:|---:|
| Overall SEO | 67 | 82 |
| Technical SEO | 64 | 85 |
| Crawlability / Indexability | 58 | 88 |
| Product Page SEO | 77 | 86 |
| Content SEO | 61 | 78 |
| Structured Data | 72 | 88 |
| Internal Linking | 60 | 80 |
| Performance / CWV SEO | 76 | 84 |

## URLs Audited

- `https://techno-smart.net/`
- `https://techno-smart.net/?lang=fr`
- `https://techno-smart.net/?lang=en`
- `https://techno-smart.net/robots.txt`
- `https://techno-smart.net/sitemap.xml`
- `https://techno-smart.net/collections?lang=fr`
- `https://techno-smart.net/collections?lang=en`
- `https://techno-smart.net/collections/logiciels?lang=fr`
- `https://techno-smart.net/collections/software?lang=fr`
- `https://techno-smart.net/search?lang=fr`
- `https://techno-smart.net/recherche?lang=fr`
- `https://techno-smart.net/blog?lang=fr`
- `https://techno-smart.net/blog?lang=en`
- `https://techno-smart.net/blog/microsoft-office-365-vs-office-2021-choix-tunisie?lang=fr`
- `https://techno-smart.net/blog/dangers-logiciels-crackes-antivirus-tunisie?lang=fr`
- `https://techno-smart.net/blog/pourquoi-comment-passer-windows-11-tunisie?lang=fr`
- `https://techno-smart.net/blog/windows-11-pro-vs-famille-lequel-choisir?lang=fr`
- All 21 product URLs listed in the sitemap.
- `/about`, `/contact`, CGV, privacy, legal notice, login, signup, account, cart, checkout, order success.
- Invalid route probes: `/does-not-exist`, `/foo/bar`, `/produit/does-not-exist`, `/collections/does-not-exist`, uppercase route variants.

