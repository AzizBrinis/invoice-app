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

type HomePageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  products: CatalogPayload["products"];
  showPrices: boolean;
  builder?: WebsiteBuilderPageConfig | null;
};

// Smoke test checklist:
// - Home renders tenant products with TND prices.
// - Product card click opens the detail route.
// - Add to bag stores items in the cart.
// - Category tabs filter products and show empty states.
export function HomePage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
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
  const shouldUseTemplateFallback = useCallback(
    (source: ReturnType<typeof buildHomeProducts>) =>
      source.length === 0 ||
      !source.some((product) =>
        /(women|men|kids|beauty|sport|home|accessories|collection|femme|homme|maison|beaute)/i.test(
          product.category,
        ),
      ),
    [],
  );
  const homeProducts = useMemo(
    () => {
      const mapped = buildHomeProducts({
        products: productSource,
        showPrices,
      });
      return normalizeProductCount(
        shouldUseTemplateFallback(mapped) ? fallbackProducts : mapped,
        12,
      );
    },
    [
      fallbackProducts,
      normalizeProductCount,
      productSource,
      shouldUseTemplateFallback,
      showPrices,
    ],
  );
  const featuredProducts = useMemo(
    () => {
      const mapped = buildHomeProducts({
        products: featuredSource,
        showPrices,
      });
      return normalizeProductCount(
        shouldUseTemplateFallback(mapped) ? fallbackProducts : mapped,
        8,
      );
    },
    [
      fallbackProducts,
      featuredSource,
      normalizeProductCount,
      shouldUseTemplateFallback,
      showPrices,
    ],
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
          baseLink={baseLink}
          sections={builder?.sections ?? []}
          mediaLibrary={builder?.mediaLibrary ?? []}
          hasBuilder={Boolean(builder)}
        />
      </main>
      <Footer theme={theme} companyName={companyName} />
    </PageShell>
  );
}
