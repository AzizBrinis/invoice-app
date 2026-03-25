import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import type { CatalogPayload } from "@/server/website";
import type { WebsiteBuilderPageConfig } from "@/lib/website/builder";
import type { HomeProduct, PurchasedProductCard, ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { ProductDetailPage } from "../components/product/ProductDetailPage";
import { buildHomeProducts, resolveVariantOptions } from "../utils";

type ProductPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (path: string) => string;
  products: CatalogPayload["products"] | null;
  showPrices: boolean;
  productSlug?: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type ProductDetailStatus = "loading" | "error" | "ready" | "not-found";

// Smoke test checklist:
// - Product detail renders real data for the tenant slug.
// - Price shows TND and quantity affects add-to-cart payload.
// - Variant selectors update selection when options exist.
// - Related products resolve by category/featured fallback.
// - Loading, not-found, and error states display correctly.
export function ProductPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  products,
  showPrices,
  productSlug,
  builder,
}: ProductPageProps) {
  const productSource = Array.isArray(products?.all) ? products.all : [];
  const featuredSource = Array.isArray(products?.featured) ? products.featured : [];
  const status: ProductDetailStatus = !products
    ? "loading"
    : Array.isArray(products.all)
      ? "ready"
      : "error";
  const homeProducts = useMemo(
    () =>
      buildHomeProducts({
        products: productSource,
        showPrices,
      }),
    [productSource, showPrices],
  );
  const activeHomeProduct = useMemo<HomeProduct | null>(() => {
    if (!productSlug) return null;
    return homeProducts.find((product) => product.slug === productSlug) ?? null;
  }, [homeProducts, productSlug]);
  const activeProduct = useMemo(() => {
    if (!activeHomeProduct) return null;
    return (
      productSource.find((product) => product.id === activeHomeProduct.id) ?? null
    );
  }, [activeHomeProduct, productSource]);
  const resolvedStatus: ProductDetailStatus =
    status === "ready" && (!activeProduct || !activeHomeProduct)
      ? "not-found"
      : status;

  useEffect(() => {
    if (resolvedStatus === "error") {
      console.error("[ciseco-product] Failed to load product data.", {
        productSlug,
      });
    }
  }, [productSlug, resolvedStatus]);

  const relatedProducts = useMemo<PurchasedProductCard[]>(() => {
    if (!activeProduct) return [];
    const category = activeProduct.category?.trim().toLowerCase() ?? "";
    const byCategory = category
      ? productSource.filter(
          (product) =>
            product.id !== activeProduct.id &&
            product.category?.trim().toLowerCase() === category,
        )
      : [];
    const featured = featuredSource.filter(
      (product) => product.id !== activeProduct.id,
    );
    const fallback = byCategory.length
      ? byCategory
      : featured.length
        ? featured
        : productSource.filter((product) => product.id !== activeProduct.id).slice(-4);
    const homeMap = new Map(homeProducts.map((product) => [product.id, product]));
    return fallback
      .slice(0, 4)
      .map((product) => {
        const home = homeMap.get(product.id);
        if (!home) return null;
        const variantColors = resolveVariantOptions(
          product.quoteFormSchema,
          product.optionConfig,
        ).colors;
        return {
          id: product.id,
          name: product.name,
          price: home.price,
          rating: 0,
          reviewCount: 0,
          image: home.image,
          colors: variantColors.map((color) => color.swatch),
        };
      })
      .filter((entry): entry is PurchasedProductCard => Boolean(entry));
  }, [activeProduct, featuredSource, homeProducts, productSource]);
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const consumedIds = new Set<string>();
  if (heroSection) {
    consumedIds.add(heroSection.id);
  }
  const detailSections = sections.filter(
    (section) => !consumedIds.has(section.id),
  );

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        {heroSection ? (
          <section
            className="mx-auto px-6 pt-8 sm:px-8"
            data-builder-section={heroSection.id}
          >
            <div className="max-w-3xl space-y-2">
              {heroSection.eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                  {heroSection.eyebrow}
                </p>
              ) : null}
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {heroSection.title ?? "Product details"}
              </h1>
              {heroSection.subtitle ?? heroSection.description ? (
                <p className="text-sm text-slate-600">
                  {heroSection.subtitle ?? heroSection.description}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
        <ProductDetailPage
          theme={theme}
          baseLink={baseLink}
          status={resolvedStatus}
          product={activeProduct}
          cartProduct={activeHomeProduct}
          relatedProducts={relatedProducts}
          sections={detailSections}
          mediaLibrary={mediaLibrary}
        />
      </main>
      <Footer theme={theme} companyName={companyName} />
    </PageShell>
  );
}
