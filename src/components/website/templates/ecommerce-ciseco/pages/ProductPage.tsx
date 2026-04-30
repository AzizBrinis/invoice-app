import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CatalogPayload } from "@/server/website";
import type { WebsiteBuilderPageConfig } from "@/lib/website/builder";
import type { HomeProduct, ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { ProductDetailPage } from "../components/product/ProductDetailPage";
import { useCisecoI18n } from "../i18n";
import { buildHomeProducts, resolveVariantOptions } from "../utils";

type ProductPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  catalogSlug: string;
  baseLink: (path: string) => string;
  products: CatalogPayload["products"] | null;
  showPrices: boolean;
  productSlug?: string;
  mode: "public" | "preview";
  requiresClientProductData?: boolean;
  builder?: WebsiteBuilderPageConfig | null;
};

type ProductDetailStatus = "loading" | "error" | "ready" | "not-found";

const productDetailCache = new Map<
  string,
  CatalogPayload["products"]["all"][number] | null
>();
const productDetailRequestCache = new Map<
  string,
  Promise<CatalogPayload["products"]["all"][number] | null>
>();

async function loadProductDetail(options: {
  catalogSlug: string;
  productSlug: string;
}) {
  const cacheKey = `${options.catalogSlug}:${options.productSlug}`;
  const cached = productDetailCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const inflight = productDetailRequestCache.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = fetch(
    `/api/catalogue/products?slug=${encodeURIComponent(options.catalogSlug)}&product=${encodeURIComponent(options.productSlug)}`,
    {
      method: "GET",
      cache: "force-cache",
    },
  )
    .then(async (response) => {
      const result = (await response.json()) as {
        product?: CatalogPayload["products"]["all"][number] | null;
      };

      if (response.status === 404) {
        productDetailCache.set(cacheKey, null);
        return null;
      }

      if (!response.ok) {
        throw new Error("Unable to load product details.");
      }

      const product = result.product ?? null;
      productDetailCache.set(cacheKey, product);
      return product;
    })
    .finally(() => {
      productDetailRequestCache.delete(cacheKey);
    });

  productDetailRequestCache.set(cacheKey, request);
  return request;
}

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
  catalogSlug,
  baseLink,
  products,
  showPrices,
  productSlug,
  mode,
  requiresClientProductData = false,
  builder,
}: ProductPageProps) {
  const { t } = useCisecoI18n();
  const productSource = useMemo(
    () => (Array.isArray(products?.all) ? products.all : []),
    [products],
  );
  const featuredSource = useMemo(
    () => (Array.isArray(products?.featured) ? products.featured : []),
    [products],
  );
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
  const listProduct = useMemo(() => {
    if (!activeHomeProduct) return null;
    return (
      productSource.find((product) => product.id === activeHomeProduct.id) ?? null
    );
  }, [activeHomeProduct, productSource]);
  const detailCacheKey = productSlug ? `${catalogSlug}:${productSlug}` : null;
  const [clientProduct, setClientProduct] = useState<
    CatalogPayload["products"]["all"][number] | null
  >(() => {
    if (!requiresClientProductData || !detailCacheKey) {
      return null;
    }
    return productDetailCache.get(detailCacheKey) ?? null;
  });
  const [clientStatus, setClientStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >(() =>
    !requiresClientProductData || !detailCacheKey
      ? "idle"
      : productDetailCache.has(detailCacheKey)
        ? "ready"
        : "loading",
  );

  useEffect(() => {
    if (
      !requiresClientProductData ||
      !productSlug ||
      !detailCacheKey ||
      productDetailCache.has(detailCacheKey)
    ) {
      return;
    }

    let cancelled = false;

    void loadProductDetail({
      catalogSlug,
      productSlug,
    })
      .then((product) => {
        if (cancelled) {
          return;
        }
        setClientProduct(product);
        setClientStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setClientProduct(null);
        setClientStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [catalogSlug, detailCacheKey, productSlug, requiresClientProductData]);

  const activeProduct =
    requiresClientProductData
      ? clientStatus === "ready"
        ? clientProduct
        : null
      : listProduct;
  const relationSourceProduct =
    activeProduct ?? (requiresClientProductData ? null : listProduct);
  const resolvedStatus: ProductDetailStatus =
    status === "error" || clientStatus === "error"
      ? "error"
      : requiresClientProductData && clientStatus === "loading"
        ? "loading"
        : status === "ready" && (!relationSourceProduct || !activeHomeProduct)
          ? "not-found"
          : status;

  useEffect(() => {
    if (resolvedStatus === "error") {
      console.error("[ciseco-product] Failed to load product data.", {
        productSlug,
      });
    }
  }, [productSlug, resolvedStatus]);

  const relatedProducts = useMemo<HomeProduct[]>(() => {
    if (!relationSourceProduct) return [];
    const category = relationSourceProduct.category?.trim().toLowerCase() ?? "";
    const byCategory = category
      ? productSource.filter(
          (product) =>
            product.id !== relationSourceProduct.id &&
            product.category?.trim().toLowerCase() === category,
        )
      : [];
    const featured = featuredSource.filter(
      (product) => product.id !== relationSourceProduct.id,
    );
    const fallback = byCategory.length
      ? byCategory
        : featured.length
          ? featured
        : productSource.filter((product) => product.id !== relationSourceProduct.id).slice(-4);
    const homeMap = new Map(homeProducts.map((product) => [product.id, product]));
    const entries: HomeProduct[] = [];
    fallback.slice(0, 4).forEach((product) => {
      const home = homeMap.get(product.id);
      if (!home) return;
      const variantColors = resolveVariantOptions(product.quoteFormSchema, product.optionConfig).colors;
      entries.push({
        ...home,
        colors: variantColors.length
          ? variantColors.map((color) => color.swatch)
          : home.colors,
        });
    });
    return entries;
  }, [featuredSource, homeProducts, productSource, relationSourceProduct]);
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
            className="pt-8 sm:pt-9 lg:pt-10"
            data-builder-section={heroSection.id}
          >
            <div
              className={clsx(
                "mx-auto w-full px-4 sm:px-6 lg:px-8",
                theme.containerClass,
              )}
            >
              <div className="max-w-3xl space-y-2">
                {heroSection.eyebrow ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                    {t(heroSection.eyebrow)}
                  </p>
                ) : null}
                <p className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                  {t(heroSection.title ?? "Product details")}
                </p>
                {heroSection.subtitle ?? heroSection.description ? (
                  <p className="text-sm text-slate-600">
                    {t(heroSection.subtitle ?? heroSection.description ?? "")}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
        <ProductDetailPage
          theme={theme}
          baseLink={baseLink}
          catalogSlug={catalogSlug}
          status={resolvedStatus}
          product={activeProduct}
          cartProduct={activeHomeProduct}
          relatedProducts={relatedProducts}
          sections={detailSections}
          mediaLibrary={mediaLibrary}
          mode={mode}
        />
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}
