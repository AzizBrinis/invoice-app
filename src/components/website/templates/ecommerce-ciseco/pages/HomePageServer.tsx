import clsx from "clsx";
import type { CSSProperties } from "react";
import type {
  WebsiteBuilderButton,
  WebsiteBuilderMediaAsset,
  WebsiteBuilderPageConfig,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { CatalogViewerState } from "@/lib/catalog-viewer";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { CatalogPayload } from "@/server/website";
import {
  resolveBuilderMedia,
  resolveVisibleSections,
} from "../builder-helpers";
import {
  BLOG_POSTS,
  FEATURE_ITEMS,
  PRODUCT_CARDS,
  TESTIMONIALS,
} from "../data/home";
import { FOOTER_LINKS, NAV_ITEMS } from "../data/navigation";
import {
  appendCisecoLocaleToHref,
  translateCisecoText,
  type CisecoLocale,
} from "../locale";
import type { HomeProduct, HomeProductStatus, ThemeTokens } from "../types";
import {
  buildHomeProducts,
  buildCisecoHref,
  resolveCisecoNavigationHref,
} from "../utils";
import { HomeCartButton } from "../components/home/HomeCartButton";
import { HomeProductActions } from "../components/home/HomeProductActions";
import { Section } from "../components/layout/Section";
import { CatalogImage } from "../components/shared/CatalogImage";
import { FeatureIcon } from "../components/shared/Icons";

type HomePageServerProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  catalogSlug: string;
  locale: CisecoLocale;
  mode: "public" | "preview";
  rawBaseLink: (target: string) => string;
  baseLink: (target: string) => string;
  products: CatalogPayload["products"];
  showPrices: boolean;
  builder: WebsiteBuilderPageConfig;
  viewerAuthStatus: CatalogViewerState["authStatus"];
  cmsPages: CatalogPayload["website"]["cmsPages"];
};

function localizeHref(locale: CisecoLocale, href: string) {
  return appendCisecoLocaleToHref(href, locale);
}

function translate(locale: CisecoLocale, text: string | null | undefined) {
  return translateCisecoText(locale, text ?? "");
}

function compactText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeHeroButtons(
  buttons: readonly WebsiteBuilderButton[] | null | undefined,
) {
  return (buttons ?? [])
    .map((button, index) => {
      const label = compactText(button.label);
      const href = compactText(button.href);
      if (!label || !href) {
        return null;
      }
      return {
        ...button,
        id: compactText(button.id) ?? `home-hero-btn-${index + 1}`,
        label,
        href,
      };
    })
    .filter(
      (
        button,
      ): button is WebsiteBuilderButton & { id: string; label: string; href: string } =>
        Boolean(button),
    )
    .slice(0, 2);
}

function normalizeProductCount(source: HomeProduct[], fallbackProducts: HomeProduct[], minimum: number) {
  if (source.length >= minimum) return source;
  if (!source.length) return fallbackProducts.slice(0, minimum);
  const padded = [...source];
  let index = 0;
  while (padded.length < minimum) {
    padded.push(source[index % source.length]);
    index += 1;
  }
  return padded;
}

function buildFallbackProducts() {
  return PRODUCT_CARDS.map((product, index) => ({
    ...product,
    slug: `fallback-${index + 1}`,
    saleMode: "INSTANT" as const,
    unitAmountCents: null,
    unitPriceHTCents: null,
    vatRate: null,
    discountRate: null,
    currencyCode: "TND",
  }));
}

function resolveProductStatus(products: CatalogPayload["products"]): HomeProductStatus {
  if (!products) return "loading";
  if (Array.isArray(products.all)) {
    return products.all.length > 0 ? "ready" : "empty";
  }
  return "error";
}

function resolveHomeProducts(
  products: CatalogPayload["products"],
  showPrices: boolean,
) {
  const productSource = Array.isArray(products?.all) ? products.all : [];
  const featuredSource = Array.isArray(products?.featured) ? products.featured : [];
  const fallbackProducts = buildFallbackProducts();
  const homeProducts = normalizeProductCount(
    buildHomeProducts({ products: productSource, showPrices }),
    fallbackProducts,
    12,
  );
  const featuredProducts = normalizeProductCount(
    buildHomeProducts({ products: featuredSource, showPrices }),
    fallbackProducts,
    8,
  );
  return {
    status: resolveProductStatus(products),
    homeProducts,
    featuredProducts,
  };
}

export function HomePageServer({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  catalogSlug,
  locale,
  mode,
  rawBaseLink,
  baseLink,
  products,
  showPrices,
  builder,
  viewerAuthStatus,
  cmsPages,
}: HomePageServerProps) {
  const { status, homeProducts, featuredProducts } = resolveHomeProducts(
    products,
    showPrices,
  );
  const visibleSections = resolveVisibleSections(builder.sections ?? []);
  const heroSection =
    visibleSections.find(
      (section) =>
        section.layout === "home-hero" || section.layout === "page-hero",
    ) ?? null;
  const productSection =
    visibleSections.find((section) => section.layout === "best-sellers") ??
    visibleSections.find((section) =>
      ["featured", "new-arrivals", "favorites"].includes(section.layout),
    ) ??
    null;
  const accountHref =
    viewerAuthStatus === "authenticated" ? baseLink("/account") : baseLink("/login");
  const homeFrHref = appendCisecoLocaleToHref(rawBaseLink("/"), "fr");
  const homeEnHref = appendCisecoLocaleToHref(rawBaseLink("/"), "en");

  return (
    <div
      data-ciseco-page-shell
      className="relative flex min-h-screen flex-col bg-[var(--ciseco-bg)] text-[var(--ciseco-ink)] supports-[min-height:100dvh]:min-h-[100dvh] [&>main]:flex-1"
      style={inlineStyles}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at top, rgba(15, 23, 42, 0.06), transparent 55%)",
          }}
        />
      </div>
      <header className="relative z-[60] border-b border-black/5 bg-white">
        <div
          className={clsx(
            "mx-auto flex min-h-[68px] items-center justify-between gap-3 px-4 py-3 sm:min-h-[72px] sm:px-6 lg:px-8",
            theme.containerClass,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <a
              href={homeHref}
              className="inline-flex min-w-0 max-w-full items-baseline whitespace-nowrap text-[clamp(1rem,4vw,1.18rem)] font-bold leading-none tracking-tight text-slate-900 sm:text-[25px] lg:text-[30px]"
            >
              <span className="truncate">{companyName}</span>
              <span className="shrink-0 text-[var(--site-accent)]">.</span>
            </a>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={localizeHref(
                  locale,
                  resolveCisecoNavigationHref({
                    href: item.href,
                    homeHref,
                  }),
                )}
                className="transition hover:text-slate-900"
              >
                {translate(locale, item.label)}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={baseLink("/search")}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-black/10 text-slate-700 transition hover:border-black/20 hover:text-slate-900 sm:inline-flex"
              aria-label={translate(locale, "Search")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M16 16l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </a>
            <div className="hidden items-center rounded-full border border-black/10 bg-white p-1 text-[11px] font-semibold text-slate-600 sm:flex">
              <a
                href={homeFrHref}
                className={clsx(
                  "rounded-full px-2.5 py-1 transition",
                  locale === "fr" ? "bg-slate-950 text-white" : "hover:text-slate-900",
                )}
              >
                FR
              </a>
              <a
                href={homeEnHref}
                className={clsx(
                  "rounded-full px-2.5 py-1 transition",
                  locale === "en" ? "bg-slate-950 text-white" : "hover:text-slate-900",
                )}
              >
                EN
              </a>
            </div>
            <a
              href={accountHref}
              className="hidden rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-900 sm:inline-flex"
            >
              {translate(
                locale,
                viewerAuthStatus === "authenticated" ? "My Account" : "Sign In",
              )}
            </a>
            <HomeCartButton homeHref={homeHref} />
          </div>
        </div>
        <nav className="border-t border-black/5 px-4 py-3 sm:px-6 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={localizeHref(
                  locale,
                  resolveCisecoNavigationHref({
                    href: item.href,
                    homeHref,
                  }),
                )}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                {translate(locale, item.label)}
              </a>
            ))}
            <a
              href={baseLink("/search")}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {translate(locale, "Search")}
            </a>
            <a
              href={accountHref}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {translate(
                locale,
                viewerAuthStatus === "authenticated" ? "My Account" : "Sign In",
              )}
            </a>
          </div>
        </nav>
      </header>
      <main>
        <ServerHomeHeroSection
          theme={theme}
          section={heroSection}
          mediaLibrary={builder.mediaLibrary ?? []}
          homeHref={homeHref}
          locale={locale}
        />
        <ServerBestSellersSection
          theme={theme}
          section={productSection}
          locale={locale}
          products={featuredProducts.length ? featuredProducts : homeProducts}
          status={status}
          baseLink={baseLink}
          catalogSlug={catalogSlug}
          wishlistLoginHref={baseLink("/login")}
          loadWishlistOnMount={viewerAuthStatus === "authenticated"}
        />
      </main>
      <ServerFooter
        theme={theme}
        companyName={companyName}
        homeHref={homeHref}
        locale={locale}
        cmsPages={cmsPages}
      />
    </div>
  );
}

function ServerHomeHeroSection({
  theme,
  section,
  mediaLibrary,
  homeHref,
  locale,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  homeHref: string;
  locale: CisecoLocale;
}) {
  const title =
    compactText(section?.title) ?? "Discover the Techno Smart catalogue";
  const eyebrow =
    compactText(section?.eyebrow) ?? "Techno Smart catalogue";
  const subtitle =
    compactText(section?.subtitle) ??
    "Browse the most important products first with a lighter, faster storefront opening.";
  const note =
    compactText(section?.description) ??
    "Focused for mobile so the first screen loads faster without sacrificing navigation or product discovery.";
  const buttons = normalizeHeroButtons(section?.buttons);
  const image = resolveBuilderMedia(section?.mediaId, mediaLibrary);
  const hasImage = Boolean(image?.src && !image.src.startsWith("data:"));

  return (
    <Section
      theme={theme}
      id="hero"
      className="pb-5 pt-6 sm:pb-7 sm:pt-8"
      builderSectionId={section?.id}
    >
      <div
        className={clsx(
          "relative overflow-hidden shadow-[0_28px_80px_-50px_rgba(15,23,42,0.38)]",
          theme.corner,
          hasImage
            ? "bg-slate-950"
            : "border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7f8fb_58%,#eef2f7_100%)]",
        )}
      >
        {hasImage ? (
          <>
            <CatalogImage
              src={image?.src ?? WEBSITE_MEDIA_PLACEHOLDERS.hero}
              alt={image?.alt || translate(locale, title)}
              className="absolute inset-0 h-full w-full object-cover object-center"
              sizes="(min-width: 1280px) 1240px, 100vw"
              fill
              priority
              loading="eager"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12)_0%,rgba(2,6,23,0.38)_38%,rgba(2,6,23,0.84)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.16),transparent_34%)]" />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.07),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.12),transparent_36%)]" />
            <div className="pointer-events-none absolute left-8 top-8 h-24 w-24 rounded-full bg-[var(--site-accent)]/8 blur-2xl sm:h-32 sm:w-32" />
            <div className="pointer-events-none absolute bottom-10 right-10 h-px w-24 bg-slate-300/70" />
          </>
        )}
        <div
          className={clsx(
            "relative z-10 w-full",
            hasImage
              ? "px-5 pb-12 pt-14 sm:px-10 sm:pb-16 sm:pt-16 lg:px-14 lg:pb-18 lg:pt-18"
              : "px-5 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14",
          )}
        >
          <div className="max-w-[44rem]">
            <p
              className={clsx(
                "ciseco-home-eyebrow inline-flex rounded-full px-3 py-1",
                hasImage
                  ? "border border-white/16 bg-white/10 text-white/86"
                  : "border border-slate-200 bg-white/88 text-slate-600",
              )}
            >
              {translate(locale, eyebrow)}
            </p>
            <h1
              className={clsx(
                "ciseco-home-title mt-4 max-w-[14ch] text-[2.05rem] [overflow-wrap:anywhere] [text-wrap:pretty] sm:text-[3.15rem] lg:text-[4rem]",
                hasImage ? "text-white" : "text-slate-950",
              )}
            >
              {translate(locale, title)}
            </h1>
            <p
              className={clsx(
                "ciseco-home-subtitle mt-4 max-w-[40rem] text-[0.98rem] sm:text-[1.04rem]",
                hasImage ? "text-white/82" : "text-slate-600",
              )}
            >
              {translate(locale, subtitle)}
            </p>
            <p
              className={clsx(
                "mt-4 max-w-[38rem] text-sm leading-6",
                hasImage ? "text-white/64" : "text-slate-500",
              )}
            >
              {translate(locale, note)}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3">
              {(buttons.length ? buttons : [
                {
                  id: "home-hero-default-primary",
                  label: "Collections",
                  href: "/collections",
                  style: "primary" as const,
                },
              ]).map((button) => {
                const href = localizeHref(
                  locale,
                  resolveCisecoNavigationHref({
                    href: button.href,
                    homeHref,
                    fallbackPath: "/collections",
                  }),
                );
                return (
                  <a
                    key={button.id}
                    href={href}
                    className={clsx(
                      theme.buttonShape,
                      "inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold leading-5 shadow-none sm:px-5",
                      hasImage
                        ? button.style === "secondary"
                          ? "border border-white/22 bg-white/12 text-white hover:bg-white/18"
                          : "bg-white text-slate-950 hover:bg-white/92"
                        : button.style === "secondary"
                          ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                          : "bg-slate-950 text-white hover:bg-slate-900",
                    )}
                  >
                    {translate(locale, button.label)}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 text-[12px] font-medium text-slate-500 sm:text-[13px]">
            {[
              "Fast mobile-first opening",
              "Focused catalogue discovery",
              "Preserved product detail flow",
            ].map((label) => (
              <span
                key={label}
                className={clsx(
                  "inline-flex items-center rounded-full px-3 py-1.5",
                  hasImage
                    ? "border border-white/12 bg-white/8 text-white/78"
                    : "border border-black/5 bg-white/82 text-slate-600",
                )}
              >
                {translate(locale, label)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function ServerBestSellersSection({
  theme,
  section,
  locale,
  products,
  status,
  baseLink,
  catalogSlug,
  wishlistLoginHref,
  loadWishlistOnMount,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  locale: CisecoLocale;
  products: HomeProduct[];
  status: HomeProductStatus;
  baseLink: (target: string) => string;
  catalogSlug: string;
  wishlistLoginHref: string;
  loadWishlistOnMount: boolean;
}) {
  const items = products.slice(0, 4);
  const eyebrow = section?.eyebrow ?? "Top picks";
  const title = section?.title ?? "Best sellers";
  const subtitle =
    section?.subtitle ??
    "Use this section for high-visibility items, featured offers, or important listings.";

  return (
    <Section
      theme={theme}
      id="best-sellers"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="ciseco-home-eyebrow">{translate(locale, eyebrow)}</p>
          <h2 className="ciseco-home-title max-w-3xl text-[34px] sm:text-[42px]">
            {translate(locale, title)}
          </h2>
          <p className="ciseco-home-subtitle max-w-2xl">
            {translate(locale, subtitle)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {status === "error" ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600">
              {translate(locale, "We could not load the catalog right now. Please refresh the page.")}
            </div>
          ) : null}
          {status === "empty" ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600">
              {translate(locale, "No items are available yet. Please check back soon.")}
            </div>
          ) : null}
          {status === "ready"
            ? items.map((product) => (
                <article
                  key={product.id}
                  className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white/95 p-3.5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.55)]"
                >
                  <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(241,245,249,0.95)_44%,_rgba(226,232,240,0.92))]">
                    <a
                      href={baseLink(`/produit/${product.slug}`)}
                      className="block"
                      aria-label={`${translate(locale, "View details")} ${translate(locale, product.name)}`}
                    >
                      <div className="relative aspect-square overflow-hidden">
                        <CatalogImage
                          src={product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0]}
                          alt={translate(locale, product.name)}
                          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.05]"
                          sizes="(min-width: 1024px) 22vw, (min-width: 640px) 44vw, 92vw"
                          loading="lazy"
                          fill
                        />
                      </div>
                    </a>
                    {product.badge ? (
                      <span className="absolute left-3 top-3 z-20 rounded-full border border-white/75 bg-white/90 px-2.5 py-1 text-[9px] font-semibold tracking-[0.08em] text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.65)] backdrop-blur-sm">
                        {translate(locale, product.badge)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3.5 flex flex-1 flex-col">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <span className="ciseco-card-meta">
                        {translate(locale, product.category)}
                      </span>
                      <span
                        className="ciseco-price-chip inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                        style={{
                          backgroundColor: "var(--site-accent-soft)",
                          borderColor: "var(--site-accent-strong)",
                        }}
                      >
                        {product.price}
                      </span>
                    </div>
                    <h3 className="mt-2 ciseco-card-title line-clamp-2 text-[17px] leading-[1.32] text-slate-950">
                      <a
                        href={baseLink(`/produit/${product.slug}`)}
                        className="rounded-sm transition-colors duration-200 hover:text-slate-700"
                      >
                        {translate(locale, product.name)}
                      </a>
                    </h3>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 rounded-full bg-slate-100/80 px-2.5 py-1 font-medium text-slate-600">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-500">
                          <path
                            d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                            fill="currentColor"
                          />
                        </svg>
                        <span className="tabular-nums text-slate-700">
                          {product.rating.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {product.colors.map((color, index) => (
                          <span
                            key={`${product.id}-color-${index}`}
                            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-3.5">
                      <HomeProductActions
                        product={product}
                        catalogSlug={catalogSlug}
                        loginHref={wishlistLoginHref}
                        loadWishlistOnMount={loadWishlistOnMount}
                      />
                    </div>
                  </div>
                </article>
              ))
            : null}
        </div>
      </div>
    </Section>
  );
}

function ServerFeaturedProductsSection({
  theme,
  section,
  locale,
  products,
  status,
  baseLink,
}: {
  theme: ThemeTokens;
  section: WebsiteBuilderSection;
  locale: CisecoLocale;
  products: HomeProduct[];
  status: HomeProductStatus;
  baseLink: (target: string) => string;
}) {
  const heroCards = products.slice(0, 3);
  const stripCards = products.slice(0, 9);
  const eyebrow = section.eyebrow ?? "Featured";
  const title = section.title ?? "Shopping essentials";
  const subtitle =
    section.subtitle ??
    "Use this area to surface important items, launches, or offers.";

  return (
    <Section
      theme={theme}
      id="featured"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section.id}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="ciseco-home-eyebrow">{translate(locale, eyebrow)}</p>
          <h2 className="ciseco-home-title max-w-3xl text-[34px] sm:text-[42px]">
            {translate(locale, title)}
          </h2>
          <p className="ciseco-home-subtitle max-w-2xl">
            {translate(locale, subtitle)}
          </p>
        </div>
        {status === "ready" && heroCards.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {heroCards.map((card, index) => (
                <a
                  key={`${card.id}-feature-${index}`}
                  href={baseLink(`/produit/${card.slug}`)}
                  className="group overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <CatalogImage
                      src={card.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0]}
                      alt={translate(locale, card.name)}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      sizes="(min-width: 1024px) 29vw, (min-width: 640px) 46vw, 92vw"
                      loading="lazy"
                      fill
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 text-sm">
                    <span className="font-semibold text-slate-900">
                      {translate(locale, card.name)}
                    </span>
                    <span className="ciseco-card-meta">
                      {translate(locale, card.category)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
            {stripCards.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-9">
                {stripCards.map((card, index) => (
                  <a
                    key={`${card.id}-thumb-${index}`}
                    href={baseLink(`/produit/${card.slug}`)}
                    className="overflow-hidden rounded-xl border border-black/5 bg-white"
                    aria-label={`${translate(locale, "View details")} ${translate(locale, card.name)}`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100">
                      <CatalogImage
                        src={card.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0]}
                        alt={translate(locale, card.name)}
                        className="h-full w-full object-cover"
                        sizes="(min-width: 1024px) 9vw, (min-width: 640px) 22vw, 30vw"
                        loading="lazy"
                        fill
                      />
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600">
            {translate(locale, "No items are available yet. Please check back soon.")}
          </div>
        )}
      </div>
    </Section>
  );
}

function ServerBlogSection({
  theme,
  section,
  mediaLibrary,
  homeHref,
  locale,
}: {
  theme: ThemeTokens;
  section: WebsiteBuilderSection;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  homeHref: string;
  locale: CisecoLocale;
}) {
  const eyebrow = section.eyebrow ?? "Latest updates";
  const title = section.title ?? "Stories, notes, and ideas";
  const subtitle =
    section.subtitle ??
    "Use this area for announcements, guides, or editorial content.";
  const posts =
    section.items?.length
      ? section.items.map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          const fallback = BLOG_POSTS[index];
          return {
            id: item.id,
            title: item.title ?? fallback?.title ?? "Blog post",
            excerpt: item.description ?? fallback?.excerpt ?? "",
            image: asset?.src ?? fallback?.image ?? "",
            tag: item.tag ?? fallback?.tag ?? "Story",
            date: item.badge ?? fallback?.date ?? "",
            href: item.href ?? fallback?.href ?? "/blog",
          };
        })
      : BLOG_POSTS;
  const [featured, ...rest] = posts;

  return (
    <Section
      theme={theme}
      id="blog"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section.id}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="ciseco-home-eyebrow">{translate(locale, eyebrow)}</p>
          <h2 className="ciseco-home-title max-w-3xl text-[34px] sm:text-[42px]">
            {translate(locale, title)}
          </h2>
          <p className="ciseco-home-subtitle max-w-2xl">
            {translate(locale, subtitle)}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {featured ? (
            <a
              href={localizeHref(
                locale,
                resolveCisecoNavigationHref({
                  href: featured.href,
                  homeHref,
                  fallbackPath: "/blog",
                }),
              )}
              className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white/95 shadow-[0_22px_54px_-38px_rgba(15,23,42,0.46)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_28px_60px_-34px_rgba(15,23,42,0.45)]"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <CatalogImage
                  src={featured.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0]}
                  alt={translate(locale, featured.title)}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  fill
                />
              </div>
              <div className="flex flex-1 flex-col gap-2.5 p-5 sm:p-6">
                <p className="ciseco-home-eyebrow text-[0.68rem] text-[var(--site-accent)]">
                  {translate(locale, featured.tag)}
                </p>
                <h3 className="ciseco-card-title text-[21px] leading-[1.16] text-slate-950 transition-colors duration-200 group-hover:text-slate-700">
                  {translate(locale, featured.title)}
                </h3>
                <p className="text-[15px] leading-7 text-slate-500">
                  {translate(locale, featured.excerpt)}
                </p>
                <span className="mt-auto text-[12px] font-semibold tracking-[0.01em] text-slate-500">
                  {translate(locale, featured.date)}
                </span>
              </div>
            </a>
          ) : null}
          <div className="grid gap-4">
            {rest.map((post) => (
              <a
                key={post.id}
                href={localizeHref(
                  locale,
                  resolveCisecoNavigationHref({
                    href: post.href,
                    homeHref,
                    fallbackPath: "/blog",
                  }),
                )}
                className="group flex items-center gap-3 rounded-[24px] border border-black/5 bg-white/95 p-3 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.42)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-black/10 hover:shadow-[0_24px_52px_-32px_rgba(15,23,42,0.42)]"
              >
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  <CatalogImage
                    src={post.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0]}
                    alt={translate(locale, post.title)}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                    fill
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="ciseco-home-eyebrow text-[0.66rem] text-[var(--site-accent)]">
                    {translate(locale, post.tag)}
                  </p>
                  <p className="ciseco-card-title text-[15px] leading-[1.28] text-slate-900 transition-colors duration-200 group-hover:text-slate-700">
                    {translate(locale, post.title)}
                  </p>
                  <p className="text-[12px] font-medium tracking-[0.01em] text-slate-500">
                    {translate(locale, post.date)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function ServerTestimonialsSection({
  theme,
  section,
  mediaLibrary,
  locale,
}: {
  theme: ThemeTokens;
  section: WebsiteBuilderSection;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  locale: CisecoLocale;
}) {
  const eyebrow = section.eyebrow ?? "What people are saying";
  const title = section.title ?? "People love our products";
  const subtitle =
    section.subtitle ??
    "Neutral testimonials make it easy to preview social proof placement.";
  const testimonials =
    section.items?.length
      ? section.items.map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          const fallback = TESTIMONIALS[index];
          return {
            id: item.id,
            quote: item.description ?? fallback?.quote ?? "",
            name: item.title ?? fallback?.name ?? "Customer",
            role: item.tag ?? fallback?.role ?? "",
            rating: fallback?.rating ?? 4.8,
            avatar: asset?.src ?? fallback?.avatar ?? "",
          };
        })
      : TESTIMONIALS;
  const [featured] = testimonials;
  const avatars = testimonials.slice(0, 6).map((item) => item.avatar);

  if (!featured) {
    return null;
  }

  return (
    <Section
      theme={theme}
      id="testimonials"
      className="py-10 sm:py-12"
      builderSectionId={section.id}
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <p className="ciseco-home-eyebrow">{translate(locale, eyebrow)}</p>
          <h2 className="ciseco-home-title text-[34px] sm:text-[42px]">
            {translate(locale, title)}
          </h2>
          <p className="ciseco-home-subtitle">{translate(locale, subtitle)}</p>
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="rounded-3xl bg-white/40 p-6 text-center sm:p-8">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, index) => (
                <svg
                  key={`star-${index}`}
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                    fill="currentColor"
                  />
                </svg>
              ))}
            </div>
            <p className="mt-4 text-[24px] leading-relaxed text-slate-700 [font-family:var(--ciseco-font-display),var(--font-geist-sans),serif]">
              &ldquo;{translate(locale, featured.quote)}&rdquo;
            </p>
            <div className="mt-5 ciseco-card-title text-[15px] text-slate-900">
              {translate(locale, featured.name)}
            </div>
            <div className="text-[13px] text-slate-500">
              {translate(locale, featured.role)}
            </div>
            <div className="mt-1 text-[12px] font-semibold text-slate-700">
              {featured.rating.toFixed(1)}
            </div>
          </div>
          <div className="pointer-events-none hidden sm:block">
            {avatars.map((avatar, index) => (
              <div
                key={`${avatar}-${index}`}
                className={clsx(
                  "absolute h-10 w-10 overflow-hidden rounded-full border-4 border-white shadow-sm",
                  index === 0 && "-left-2 top-8",
                  index === 1 && "left-10 -bottom-2",
                  index === 2 && "right-12 -bottom-3",
                  index === 3 && "-right-2 top-9",
                  index === 4 && "left-20 -top-2",
                  index === 5 && "right-24 -top-3",
                )}
              >
                <CatalogImage
                  src={avatar || WEBSITE_MEDIA_PLACEHOLDERS.team[0]}
                  alt=""
                  className="h-full w-full object-cover"
                  width={40}
                  height={40}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function ServerFooter({
  theme,
  companyName,
  homeHref,
  locale,
  cmsPages,
}: {
  theme: ThemeTokens;
  companyName: string;
  homeHref: string;
  locale: CisecoLocale;
  cmsPages: Array<{ id: string; title: string; path: string; showInFooter?: boolean | null }>;
}) {
  const footerCmsPages = cmsPages.filter((page) => page.showInFooter);

  return (
    <footer className="mt-8 border-t border-black/5 bg-white">
      <div
        className={clsx(
          "mx-auto grid grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:gap-8 lg:px-8",
          footerCmsPages.length
            ? "lg:grid-cols-[1.2fr_repeat(5,1fr)]"
            : "lg:grid-cols-[1.2fr_repeat(4,1fr)]",
          theme.containerClass,
        )}
      >
        <div className="col-span-2 space-y-4 sm:col-span-3 lg:col-span-1">
          <a
            href={homeHref}
            className="inline-flex min-w-0 max-w-full items-baseline text-[24px] font-bold leading-none tracking-tight text-slate-900 sm:text-[30px]"
          >
            <span>{companyName}</span>
            <span className="shrink-0 text-[var(--site-accent)]">.</span>
          </a>
          <p className="max-w-[20rem] text-sm text-slate-600">
            {translate(
              locale,
              "A clean and adaptable starting point for catalog, service, or content-driven websites.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { href: "/about", label: "About us", icon: <AboutIcon /> },
              { href: "/blog", label: "Blog", icon: <BlogIcon /> },
              { href: "/contact", label: "Contact", icon: <ContactIcon /> },
            ].map((item) => (
              <a
                key={item.label}
                href={localizeHref(
                  locale,
                  resolveCisecoNavigationHref({
                    href: item.href,
                    homeHref,
                  }),
                )}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 hover:text-slate-900"
                aria-label={translate(locale, item.label)}
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>
        {FOOTER_LINKS.map((group) => (
          <div key={group.title} className="min-w-0 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{translate(locale, group.title)}</p>
            <div className="grid gap-2 text-slate-600">
              {group.links.map((link) => (
                <a
                  key={`${group.title}-${link.label}`}
                  href={localizeHref(
                    locale,
                    resolveCisecoNavigationHref({
                      href: link.href,
                      homeHref,
                    }),
                  )}
                  className="break-words hover:text-slate-900"
                >
                  {translate(locale, link.label)}
                </a>
              ))}
            </div>
          </div>
        ))}
        {footerCmsPages.length ? (
          <div className="min-w-0 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">
              {translate(locale, "Information")}
            </p>
            <div className="grid gap-2 text-slate-600">
              {footerCmsPages.map((page) => (
                <a
                  key={page.id}
                  href={localizeHref(locale, buildCisecoHref(homeHref, page.path))}
                  className="break-words hover:text-slate-900"
                >
                  {page.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="border-t border-black/5 px-4 py-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
        {companyName}. {translate(locale, "All rights reserved.")}
      </div>
    </footer>
  );
}

function AboutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M6.5 18c1.2-2.6 3.2-4 5.5-4s4.3 1.4 5.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function BlogIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 6.5h12M6 11h12M6 15.5h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="4.75"
        y="4.75"
        width="14.5"
        height="14.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 7.5C4 6.1 5.1 5 6.5 5h11c1.4 0 2.5 1.1 2.5 2.5v9c0 1.4-1.1 2.5-2.5 2.5h-11C5.1 19 4 17.9 4 16.5v-9z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M5 7l7 5 7-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
