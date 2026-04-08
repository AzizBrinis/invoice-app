import { useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import type { CatalogPayload } from "@/server/website";
import type { WebsiteBuilderPageConfig } from "@/lib/website/builder";
import type { HomeProductStatus, ThemeTokens } from "../types";
import { HomeSections } from "../components/home/HomeSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { buildHomeProducts } from "../utils";
import { PRODUCT_CARDS } from "../data/home";

function resolveVisibleSectionDescriptors(builder?: WebsiteBuilderPageConfig | null) {
  return (builder?.sections ?? []).filter((section) => section.visible !== false);
}

function resolveHomeProductLimit(
  sections: ReturnType<typeof resolveVisibleSectionDescriptors>,
) {
  let limit = 0;

  for (const section of sections) {
    const identifiers = [section.layout, section.type];
    if (identifiers.includes("favorites")) {
      return null;
    }
    if (identifiers.includes("best-sellers")) {
      limit = Math.max(limit, 8);
    }
    if (identifiers.includes("new-arrivals") || identifiers.includes("products")) {
      limit = Math.max(limit, 4);
    }
  }

  return limit;
}

function resolveFeaturedProductLimit(
  sections: ReturnType<typeof resolveVisibleSectionDescriptors>,
) {
  return sections.some((section) =>
    [section.layout, section.type].includes("featured"),
  )
    ? 9
    : 0;
}

type HomePageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  catalogSlug: string;
  baseLink: (target: string) => string;
  products: CatalogPayload["products"];
  showPrices: boolean;
  builder?: WebsiteBuilderPageConfig | null;
};

// Smoke test checklist:
// - Home renders tenant products with TND prices.
// - Product card click opens the detail route.
// - Add to cart stores items in the cart.
// - Category tabs filter products and show empty states.
export function HomePage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  catalogSlug,
  baseLink,
  products,
  showPrices,
  builder,
}: HomePageProps) {
  const productSource = useMemo(
    () => (Array.isArray(products?.all) ? products.all : []),
    [products],
  );
  const featuredSource = useMemo(
    () => (Array.isArray(products?.featured) ? products.featured : []),
    [products],
  );
  const visibleSections = useMemo(
    () => resolveVisibleSectionDescriptors(builder),
    [builder],
  );
  const homeProductLimit = useMemo(
    () => (builder ? resolveHomeProductLimit(visibleSections) : null),
    [builder, visibleSections],
  );
  const featuredProductLimit = useMemo(
    () => (builder ? resolveFeaturedProductLimit(visibleSections) : null),
    [builder, visibleSections],
  );
  const homeProductSource = useMemo(
    () =>
      homeProductLimit == null
        ? productSource
        : productSource.slice(0, homeProductLimit),
    [homeProductLimit, productSource],
  );
  const featuredProductSource = useMemo(
    () =>
      featuredProductLimit == null
        ? featuredSource
        : featuredSource.slice(0, featuredProductLimit),
    [featuredProductLimit, featuredSource],
  );
  const status: HomeProductStatus = !products
    ? "loading"
    : Array.isArray(products.all)
      ? products.all.length > 0
        ? "ready"
        : "empty"
      : "error";
  const fallbackProducts = useMemo(
    () =>
      PRODUCT_CARDS.map((product, index) => ({
        ...product,
        slug: `fallback-${index + 1}`,
        saleMode: "INSTANT" as const,
        unitAmountCents: null,
        unitPriceHTCents: null,
        vatRate: null,
        discountRate: null,
        currencyCode: "TND",
      })),
    [],
  );
  const normalizeProductCount = useCallback(
    (source: ReturnType<typeof buildHomeProducts>, minimum: number) => {
      if (source.length >= minimum) return source;
      if (!source.length) return fallbackProducts.slice(0, minimum);
      const padded = [...source];
      let index = 0;
      while (padded.length < minimum) {
        padded.push(source[index % source.length]);
        index += 1;
      }
      return padded;
    },
    [fallbackProducts],
  );
  const homeProducts = useMemo(
    () => {
      const mapped = buildHomeProducts({
        products: homeProductSource,
        showPrices,
      });
      return normalizeProductCount(mapped.length ? mapped : fallbackProducts, 12);
    },
    [fallbackProducts, homeProductSource, normalizeProductCount, showPrices],
  );
  const featuredProducts = useMemo(
    () => {
      const mapped = buildHomeProducts({
        products: featuredProductSource,
        showPrices,
      });
      return normalizeProductCount(mapped.length ? mapped : fallbackProducts, 8);
    },
    [fallbackProducts, featuredProductSource, normalizeProductCount, showPrices],
  );
  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        <HomeSections
          theme={theme}
          products={homeProducts}
          featuredProducts={featuredProducts}
          status={status}
          homeHref={homeHref}
          catalogSlug={catalogSlug}
          baseLink={baseLink}
          sections={builder?.sections ?? []}
          mediaLibrary={builder?.mediaLibrary ?? []}
          hasBuilder={Boolean(builder)}
        />
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}
