"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/website/cart/cart-context";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import { formatCurrency } from "@/lib/formatters";
import type { CatalogPayload } from "@/server/website";
import type {
  HomeProduct,
  ProductAccordionItem,
  ProductReviewCard,
  PurchasedProductCard,
  ThemeTokens,
} from "../../types";
import { PRODUCT_INFO_CARDS } from "../../data/product";
import {
  buildProductGallery,
  resolveVariantOptions,
  toCartProduct,
} from "../../utils";
import { ExtraSections } from "../builder/ExtraSections";
import { Section } from "../layout/Section";
import { RatingStars } from "../shared/RatingStars";
import { AccordionItem } from "./AccordionItem";
import { InfoCard } from "./InfoCard";
import { KidsOfferBanner } from "./KidsOfferBanner";
import { PurchasedCard } from "./PurchasedCard";
import { ReviewCard } from "./ReviewCard";
import { useWishlist } from "../../hooks/useWishlist";

type ProductDetailStatus = "loading" | "error" | "not-found" | "ready";

type ProductDetailPageProps = {
  theme: ThemeTokens;
  baseLink: (path: string) => string;
  status: ProductDetailStatus;
  product: CatalogPayload["products"]["all"][number] | null;
  cartProduct: HomeProduct | null;
  relatedProducts: PurchasedProductCard[];
  sections?: WebsiteBuilderSection[];
  mediaLibrary?: WebsiteBuilderMediaAsset[];
};

type VariantStockEntry = {
  colorId: string | null;
  sizeId: string | null;
  stock: number;
};

type ProductSectionKind =
  | "gallery"
  | "options"
  | "description"
  | "reviews"
  | "related"
  | "banner"
  | "extra";

function normalizeVariantStock(value: unknown): VariantStockEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const colorId =
        typeof record.colorId === "string" ? record.colorId : null;
      const sizeId =
        typeof record.sizeId === "string" ? record.sizeId : null;
      const rawStock =
        typeof record.stock === "number"
          ? record.stock
          : typeof record.stock === "string"
            ? Number(record.stock)
            : null;
      if (rawStock === null || !Number.isFinite(rawStock)) return null;
      return {
        colorId,
        sizeId,
        stock: Math.max(0, Math.floor(rawStock)),
      } satisfies VariantStockEntry;
    })
    .filter((entry): entry is VariantStockEntry => Boolean(entry));
}

type ProductDetailMessageProps = {
  theme: ThemeTokens;
  title: string;
  description: string;
  action?: ReactNode;
};

function ProductDetailMessage({
  theme,
  title,
  description,
  action,
}: ProductDetailMessageProps) {
  return (
    <Section theme={theme} className="pt-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-black/5 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </Section>
  );
}

function ProductDetailSkeleton({ theme }: { theme: ThemeTokens }) {
  return (
    <>
      <Section theme={theme} className="pt-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <div className="h-3 w-12 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-3 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-4">
              <div className="aspect-square w-full animate-pulse rounded-3xl border border-black/5 bg-slate-100 shadow-sm" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={`thumb-${index}`}
                    className="aspect-square w-full animate-pulse rounded-3xl border border-black/5 bg-slate-100 shadow-sm"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="h-7 w-52 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="space-y-3">
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`color-${index}`}
                      className="h-8 w-8 animate-pulse rounded-full bg-slate-200"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-3 w-12 animate-pulse rounded bg-slate-200" />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`size-${index}`}
                      className="h-7 animate-pulse rounded-full bg-slate-200"
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="h-11 w-full animate-pulse rounded-full bg-slate-200 sm:w-32" />
                <div className="h-11 w-full animate-pulse rounded-full bg-slate-200 sm:flex-1" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`accordion-${index}`}
                    className="h-12 animate-pulse rounded-2xl bg-slate-100"
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`info-${index}`}
                    className="h-16 animate-pulse rounded-2xl bg-slate-100"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>
      <Section theme={theme} className="pt-0">
        <div className="max-w-3xl space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`detail-${index}`}
              className="h-4 w-full animate-pulse rounded bg-slate-200"
            />
          ))}
        </div>
      </Section>
      <Section theme={theme}>
        <div className="space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`review-${index}`}
                className="h-24 animate-pulse rounded-3xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      </Section>
      <Section theme={theme}>
        <div className="space-y-4">
          <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`related-${index}`}
                className="h-48 animate-pulse rounded-3xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

function resolveProductSectionKind(section: WebsiteBuilderSection): ProductSectionKind {
  if (section.layout === "product-gallery" || section.id === "ciseco-product-gallery") {
    return "gallery";
  }
  if (section.layout === "product-options" || section.id === "ciseco-product-options") {
    return "options";
  }
  if (section.layout === "product-description" || section.id === "ciseco-product-description") {
    return "description";
  }
  if (section.layout === "product-reviews" || section.id === "ciseco-product-reviews") {
    return "reviews";
  }
  if (
    section.layout === "product-related" ||
    section.id === "ciseco-product-related" ||
    section.layout === "related"
  ) {
    return "related";
  }
  if (
    section.layout === "kids-banner" ||
    section.layout === "product-banner" ||
    section.id === "ciseco-product-banner"
  ) {
    return "banner";
  }
  return "extra";
}

function applyTemplate(
  value: string | null | undefined,
  context: Record<string, string>,
  fallback: string,
) {
  const template = value?.trim();
  if (!template) return fallback;
  const replaced = template
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, rawKey: string) => {
      return context[rawKey] ?? "";
    })
    .trim();
  return replaced.length ? replaced : fallback;
}

function findSectionItem(
  section: WebsiteBuilderSection | null | undefined,
  id: string,
) {
  return section?.items?.find((item) => item.id === id) ?? null;
}

export function ProductDetailPage({
  theme,
  baseLink,
  status,
  product,
  cartProduct,
  relatedProducts,
  sections = [],
  mediaLibrary = [],
}: ProductDetailPageProps) {
  const { isWishlisted, toggleWishlist, pendingIds } = useWishlist({
    redirectOnLoad: false,
    redirectOnAction: true,
  });
  const resolvedStatus: ProductDetailStatus =
    status === "ready" && (!product || !cartProduct) ? "not-found" : status;

  const categoryLabel = product?.category?.trim() || "Collection";
  const description = product?.description?.trim() ?? "";
  const excerpt = product?.excerpt?.trim() ?? "";
  const descriptionHtml = product?.descriptionHtml?.trim() ?? "";
  const detailParagraphs = useMemo(() => {
    if (descriptionHtml) return [];
    const paragraphs: string[] = [];
    if (description) paragraphs.push(description);
    if (excerpt && excerpt !== description) paragraphs.push(excerpt);
    if (!paragraphs.length) {
      paragraphs.push("Details coming soon.");
    }
    return paragraphs;
  }, [description, descriptionHtml, excerpt]);
  const variantOptions = useMemo(
    () => resolveVariantOptions(product?.quoteFormSchema, product?.optionConfig),
    [product?.optionConfig, product?.quoteFormSchema],
  );
  const variantStockEntries = useMemo(
    () => normalizeVariantStock(product?.variantStock),
    [product?.variantStock],
  );
  const variantStockMap = useMemo(() => {
    const map = new Map<string, number>();
    variantStockEntries.forEach((entry) => {
      const key = `${entry.colorId ?? ""}::${entry.sizeId ?? ""}`;
      map.set(key, entry.stock);
    });
    return map;
  }, [variantStockEntries]);
  const hasVariantStock = variantStockMap.size > 0;
  const baseStock =
    typeof product?.stockQuantity === "number" ? product.stockQuantity : null;

  const detailBullets = useMemo(() => {
    const bullets: string[] = [];
    if (product?.sku) bullets.push(`SKU: ${product.sku}`);
    if (product?.unit) bullets.push(`Unit: ${product.unit}`);
    if (product?.category) bullets.push(`Category: ${product.category}`);
    if (typeof product?.vatRate === "number") {
      bullets.push(`VAT: ${product.vatRate}%`);
    }
    if (product?.saleMode) {
      bullets.push(
        `Sale mode: ${product.saleMode === "INSTANT" ? "Instant" : "Quote"}`,
      );
    }
    return bullets;
  }, [product]);
  const gallery = useMemo(() => {
    if (!product) return [];
    return buildProductGallery({
      product,
      fallbackImage: cartProduct?.image,
      title: product.name,
    });
  }, [cartProduct?.image, product]);
  const { addItem } = useCart();
  const reviews: ProductReviewCard[] = [];
  const reviewCount = reviews.length;
  const rating = reviewCount
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
    : 0;
  const infoCards = useMemo(() => {
    const threshold = formatCurrency(50, "TND");
    return PRODUCT_INFO_CARDS.map((item) =>
      item.id === "info-shipping"
        ? { ...item, description: `On orders over ${threshold}` }
        : item,
    );
  }, []);

  const [activeColor, setActiveColor] = useState(
    variantOptions.colors[0]?.id ?? "",
  );
  const [activeSize, setActiveSize] = useState(
    variantOptions.sizes[0]?.id ?? "",
  );
  const [customSelections, setCustomSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState("description");

  const useVariantStock =
    hasVariantStock &&
    (variantOptions.colors.length > 0 || variantOptions.sizes.length > 0);

  const resolvedColors = useMemo(() => {
    return variantOptions.colors.map((color) => {
      const disabledByConfig = color.disabled === true;
      if (!useVariantStock || disabledByConfig) {
        return { ...color, disabled: disabledByConfig };
      }
      const available = variantOptions.sizes.length
        ? activeSize
          ? (variantStockMap.get(`${color.id}::${activeSize}`) ?? 0) > 0
          : variantOptions.sizes.some(
              (size) =>
                (variantStockMap.get(`${color.id}::${size.id}`) ?? 0) > 0,
            )
        : (variantStockMap.get(`${color.id}::`) ?? 0) > 0;
      return { ...color, disabled: !available };
    });
  }, [
    activeSize,
    useVariantStock,
    variantOptions.colors,
    variantOptions.sizes,
    variantStockMap,
  ]);

  const resolvedSizes = useMemo(() => {
    return variantOptions.sizes.map((size) => {
      const disabledByConfig = size.disabled === true;
      if (!useVariantStock || disabledByConfig) {
        return { ...size, disabled: disabledByConfig };
      }
      const available = variantOptions.colors.length
        ? activeColor
          ? (variantStockMap.get(`${activeColor}::${size.id}`) ?? 0) > 0
          : variantOptions.colors.some(
              (color) =>
                (variantStockMap.get(`${color.id}::${size.id}`) ?? 0) > 0,
            )
        : (variantStockMap.get(`::${size.id}`) ?? 0) > 0;
      return { ...size, disabled: !available };
    });
  }, [
    activeColor,
    useVariantStock,
    variantOptions.colors,
    variantOptions.sizes,
    variantStockMap,
  ]);

  const resolvedCustomOptions = useMemo(
    () => variantOptions.custom.filter((group) => group.values.length > 0),
    [variantOptions.custom],
  );

  const activeColorOption =
    resolvedColors.find((color) => color.id === activeColor) ?? null;
  const activeSizeOption =
    resolvedSizes.find((size) => size.id === activeSize) ?? null;
  const selectedCustomOptions = useMemo(
    () =>
      resolvedCustomOptions.flatMap((group) => {
        const selectedId = customSelections[group.id];
        const selectedValue = group.values.find(
          (value) => value.id === selectedId && !value.disabled,
        );
        if (!selectedValue) return [];
        return [
          {
            name: group.name,
            value: selectedValue.label,
          },
        ];
      }),
    [customSelections, resolvedCustomOptions],
  );

  const selectedStock = useMemo(() => {
    if (!useVariantStock) {
      return baseStock;
    }
    const colorId = activeColorOption?.id ?? null;
    const sizeId = activeSizeOption?.id ?? null;
    const key = `${colorId ?? ""}::${sizeId ?? ""}`;
    return variantStockMap.get(key) ?? 0;
  }, [activeColorOption, activeSizeOption, baseStock, useVariantStock, variantStockMap]);

  const isOutOfStock =
    product?.isActive === false ||
    (typeof selectedStock === "number" ? selectedStock <= 0 : false);
  const stockLabel = isOutOfStock ? "Rupture de stock" : "Disponible";

  const visibleSections = useMemo(
    () => sections.filter((section) => section.visible !== false),
    [sections],
  );

  const templateContext = useMemo(
    () => ({
      "product.name": product?.name ?? "",
      productName: product?.name ?? "",
      "product.category": categoryLabel,
      productCategory: categoryLabel,
      "product.price": cartProduct?.price ?? "",
      productPrice: cartProduct?.price ?? "",
      "product.sku": product?.sku ?? "",
      productSku: product?.sku ?? "",
      "product.excerpt": excerpt,
      productExcerpt: excerpt,
      "product.description": description,
      productDescription: description,
      "product.stock": stockLabel,
      productStock: stockLabel,
      "product.rating": rating.toFixed(1),
      productRating: rating.toFixed(1),
      "product.reviewCount": String(reviewCount),
      productReviewCount: String(reviewCount),
      "review.count": String(reviewCount),
      reviewCount: String(reviewCount),
    }),
    [cartProduct?.price, categoryLabel, description, excerpt, product?.name, product?.sku, rating, reviewCount, stockLabel],
  );

  const optionsSection = useMemo(
    () =>
      visibleSections.find(
        (section) => resolveProductSectionKind(section) === "options",
      ) ?? null,
    [visibleSections],
  );

  const addToCartLabel = applyTemplate(
    optionsSection?.buttons?.find((button) => button.style === "primary")?.label,
    templateContext,
    "Add to cart",
  );
  const sizeChartButton =
    optionsSection?.buttons?.find((button) => button.style !== "primary") ?? null;
  const sizeChartLabel = applyTemplate(
    sizeChartButton?.label,
    templateContext,
    "See sizing chart",
  );
  const sizeChartHref = sizeChartButton?.href?.trim() || "#";

  const accordionItems = useMemo<ProductAccordionItem[]>(() => {
    const specs: string[] = [];
    if (product?.sku) specs.push(`SKU: ${product.sku}`);
    if (product?.unit) specs.push(`Unit: ${product.unit}`);
    if (typeof product?.vatRate === "number") {
      specs.push(`VAT: ${product.vatRate}%`);
    }
    const descriptionBody = descriptionHtml ? (
      <div
        className="space-y-2 text-xs text-slate-600 [&_a]:text-sky-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
      />
    ) : (
      detailParagraphs[0] ?? "Details coming soon."
    );
    return [
      {
        id: "description",
        title: applyTemplate(
          findSectionItem(optionsSection, "ciseco-product-options-accordion-description")?.title,
          templateContext,
          "Description",
        ),
        body: descriptionBody,
      },
      {
        id: "specs",
        title: applyTemplate(
          findSectionItem(optionsSection, "ciseco-product-options-accordion-specs")?.title,
          templateContext,
          "Details",
        ),
        body: specs.length ? specs.join(" | ") : "Details coming soon.",
      },
      {
        id: "category",
        title: applyTemplate(
          findSectionItem(optionsSection, "ciseco-product-options-accordion-category")?.title,
          templateContext,
          "Category",
        ),
        body: categoryLabel,
      },
      {
        id: "availability",
        title: applyTemplate(
          findSectionItem(optionsSection, "ciseco-product-options-accordion-availability")?.title,
          templateContext,
          "Availability",
        ),
        body: stockLabel,
      },
    ];
  }, [categoryLabel, descriptionHtml, detailParagraphs, optionsSection, product, stockLabel, templateContext]);

  useEffect(() => {
    const nextColor =
      resolvedColors.find((color) => !color.disabled)?.id ?? "";
    setActiveColor((current) =>
      current && resolvedColors.some((color) => color.id === current && !color.disabled)
        ? current
        : nextColor,
    );
  }, [resolvedColors]);

  useEffect(() => {
    const nextSize =
      resolvedSizes.find((size) => !size.disabled)?.id ?? "";
    setActiveSize((current) =>
      current && resolvedSizes.some((size) => size.id === current && !size.disabled)
        ? current
        : nextSize,
    );
  }, [resolvedSizes]);

  useEffect(() => {
    if (!resolvedCustomOptions.length) {
      setCustomSelections((prev) =>
        Object.keys(prev).length > 0 ? {} : prev,
      );
      return;
    }
    setCustomSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      resolvedCustomOptions.forEach((group) => {
        const available =
          group.values.find((value) => !value.disabled)?.id ?? "";
        const current = prev[group.id];
        if (!current || !group.values.some((value) => value.id === current && !value.disabled)) {
          if (available) {
            next[group.id] = available;
          } else if (current) {
            delete next[group.id];
          }
          changed = true;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!resolvedCustomOptions.some((group) => group.id === key)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [resolvedCustomOptions]);

  useEffect(() => {
    setOpenAccordion(accordionItems[0]?.id ?? "description");
  }, [accordionItems]);

  useEffect(() => {
    if (product?.id) {
      setQuantity(1);
    }
  }, [product?.id]);

  useEffect(() => {
    if (typeof selectedStock !== "number" || selectedStock <= 0) return;
    setQuantity((current) => Math.min(current, selectedStock));
  }, [selectedStock]);

  if (resolvedStatus === "loading") {
    return <ProductDetailSkeleton theme={theme} />;
  }

  if (resolvedStatus === "error") {
    return (
      <ProductDetailMessage
        theme={theme}
        title="Something went wrong"
        description="We could not load this product right now. Please refresh and try again."
        action={
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "bg-slate-900 px-6 text-white hover:opacity-90",
            )}
          >
            <a href={baseLink("/")}>Back to home</a>
          </Button>
        }
      />
    );
  }

  if (resolvedStatus === "not-found") {
    return (
      <ProductDetailMessage
        theme={theme}
        title="Product not found"
        description="We could not find this product for the current catalog."
        action={
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "bg-slate-900 px-6 text-white hover:opacity-90",
            )}
          >
            <a href={baseLink("/")}>Browse products</a>
          </Button>
        }
      />
    );
  }

  const mainImage = gallery[0];
  const thumbnailImages = gallery.slice(1);
  const hasColors = resolvedColors.length > 0;
  const hasSizes = resolvedSizes.length > 0;
  const hasCustomOptions = resolvedCustomOptions.length > 0;

  const renderGalleryPanel = (section?: WebsiteBuilderSection | null) => (
    <div className="space-y-4" data-builder-section={section?.id}>
      <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <button
          type="button"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-slate-600 shadow-sm transition hover:scale-105"
          aria-label="Quick view"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="9" cy="10" r="1" fill="currentColor" />
            <circle cx="15" cy="10" r="1" fill="currentColor" />
            <path
              d="M8 14c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
        <div className="aspect-square w-full">
          {mainImage ? (
            <img
              src={mainImage.src}
              alt={mainImage.alt}
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>
      </div>
      {thumbnailImages.length ? (
        <div className="grid grid-cols-2 gap-4">
          {thumbnailImages.map((image) => (
            <div
              key={image.id}
              className="group overflow-hidden rounded-3xl border border-black/5 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="aspect-square w-full">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  const renderOptionsPanel = (section?: WebsiteBuilderSection | null) => {
    const heading = applyTemplate(section?.title, templateContext, product?.name ?? "");
    const subtitle = section?.subtitle
      ? applyTemplate(section.subtitle, templateContext, section.subtitle)
      : null;

    return (
      <div className="space-y-6" data-builder-section={section?.id}>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {heading}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              {cartProduct?.price ?? ""}
            </span>
            <div className="flex items-center gap-2">
              <RatingStars rating={rating} />
              <span className="text-xs font-semibold text-slate-900">
                {rating.toFixed(1)}
              </span>
              <span className="text-slate-400">|</span>
              <span>{reviewCount} Reviews</span>
            </div>
          </div>
          <div
            className={clsx(
              "flex items-center gap-2 text-xs",
              isOutOfStock ? "text-rose-600" : "text-emerald-600",
            )}
          >
            <span
              className={clsx(
                "h-2 w-2 rounded-full",
                isOutOfStock ? "bg-rose-500" : "bg-emerald-500",
              )}
            />
            <span>{stockLabel}</span>
          </div>
          {subtitle ? (
            <p className="text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {hasColors ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Color
            </p>
            <div className="flex items-center gap-3">
              {resolvedColors.map((color) => {
                const isActive = color.id === activeColor;
                const isDisabled = color.disabled === true;
                return (
                  <button
                    key={color.id}
                    type="button"
                    aria-label={color.label}
                    aria-pressed={isActive}
                    disabled={isDisabled}
                    className={clsx(
                      "flex h-8 w-8 items-center justify-center rounded-full border transition",
                      isActive && !isDisabled
                        ? "border-slate-900 ring-2 ring-slate-900/20"
                        : "border-black/10 hover:border-slate-400",
                      isDisabled && "cursor-not-allowed opacity-40",
                    )}
                    onClick={() => {
                      if (isDisabled) return;
                      setActiveColor(color.id);
                    }}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: color.swatch }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {hasSizes ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Size
              </p>
              <a
                href={sizeChartHref}
                className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
              >
                {sizeChartLabel}
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {resolvedSizes.map((size) => {
                const isActive = size.id === activeSize;
                const isDisabled = size.disabled === true;
                return (
                  <button
                    key={size.id}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isDisabled}
                    className={clsx(
                      "rounded-full border px-2 py-1.5 text-xs font-semibold transition",
                      isActive && !isDisabled
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-black/10 bg-white text-slate-600 hover:border-slate-900",
                      isDisabled && "cursor-not-allowed opacity-40",
                    )}
                    onClick={() => {
                      if (isDisabled) return;
                      setActiveSize(size.id);
                    }}
                  >
                    {size.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {hasCustomOptions ? (
          <div className="space-y-4">
            {resolvedCustomOptions.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {group.name}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {group.values.map((value) => {
                    const isActive = customSelections[group.id] === value.id;
                    const isDisabled = value.disabled === true;
                    return (
                      <button
                        key={value.id}
                        type="button"
                        aria-pressed={isActive}
                        disabled={isDisabled}
                        className={clsx(
                          "rounded-full border px-2 py-1.5 text-xs font-semibold transition",
                          isActive && !isDisabled
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-black/10 bg-white text-slate-600 hover:border-slate-900",
                          isDisabled && "cursor-not-allowed opacity-40",
                        )}
                        onClick={() => {
                          if (isDisabled) return;
                          setCustomSelections((prev) => ({
                            ...prev,
                            [group.id]: value.id,
                          }));
                        }}
                      >
                        {value.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center justify-between rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm sm:w-32">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-black/5"
              onClick={() =>
                setQuantity((value) => Math.max(1, value - 1))
              }
              aria-label="Decrease quantity"
            >
              -
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-black/5"
              onClick={() => setQuantity((value) => value + 1)}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <Button
            type="button"
            className={clsx(
              theme.buttonShape,
              "w-full bg-slate-900 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] hover:opacity-90 sm:flex-1",
              isOutOfStock && "cursor-not-allowed opacity-60",
            )}
            disabled={isOutOfStock}
            onClick={() => {
              if (!cartProduct || isOutOfStock) return;
              const selectedOptions = [
                activeColorOption?.label
                  ? { name: "Color", value: activeColorOption.label }
                  : null,
                activeSizeOption?.label
                  ? { name: "Size", value: activeSizeOption.label }
                  : null,
                ...selectedCustomOptions,
              ].filter(
                (entry): entry is { name: string; value: string } =>
                  Boolean(entry),
              );
              addItem(
                {
                  ...toCartProduct(cartProduct),
                  selectedOptions: selectedOptions.length ? selectedOptions : null,
                },
                quantity,
              );
            }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M6 7h13l-2 9H8L6 7z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
              <circle cx="9" cy="19" r="1.5" fill="currentColor" />
              <circle cx="16" cy="19" r="1.5" fill="currentColor" />
            </svg>
            <span>{addToCartLabel}</span>
          </Button>
        </div>
        <div className="space-y-2">
          {accordionItems.map((item) => (
            <AccordionItem
              key={item.id}
              id={item.id}
              title={item.title}
              isOpen={openAccordion === item.id}
              onToggle={() =>
                setOpenAccordion(openAccordion === item.id ? "" : item.id)
              }
            >
              {item.body}
            </AccordionItem>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {infoCards.map((item) => (
            <InfoCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    );
  };

  const renderGalleryAndOptionsSection = (
    gallerySection?: WebsiteBuilderSection | null,
    detailSection?: WebsiteBuilderSection | null,
    key?: string,
  ) => {
    const showGallery = Boolean(gallerySection) || (!gallerySection && !detailSection);
    const showOptions = Boolean(detailSection) || (!gallerySection && !detailSection);
    const columns =
      showGallery && showOptions
        ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
        : "lg:grid-cols-1";

    return (
      <Section theme={theme} className="pt-8" key={key}>
        <div className="space-y-6">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-xs text-slate-500"
          >
            <a href={baseLink("/")} className="transition hover:text-slate-900">
              Home
            </a>
            <span>/</span>
            <a href={baseLink("/")} className="transition hover:text-slate-900">
              {categoryLabel}
            </a>
            <span>/</span>
            <span className="text-slate-900">{product?.name ?? ""}</span>
          </nav>
          <div className={clsx("grid gap-8", columns)}>
            {showGallery ? renderGalleryPanel(gallerySection) : null}
            {showOptions ? renderOptionsPanel(detailSection) : null}
          </div>
        </div>
      </Section>
    );
  };

  const renderDescriptionSection = (section?: WebsiteBuilderSection | null) => {
    const heading = applyTemplate(section?.title, templateContext, "Product Details");
    const intro = section?.description
      ? applyTemplate(section.description, templateContext, section.description)
      : null;

    return (
      <Section
        theme={theme}
        className="pt-0"
        builderSectionId={section?.id}
        key={section?.id ?? "description-default"}
      >
        <div className="max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">{heading}</h2>
          {intro ? (
            <p className="text-sm text-slate-600">{intro}</p>
          ) : null}
          {descriptionHtml ? (
            <div
              className="space-y-3 text-sm text-slate-600 [&_a]:text-sky-600 [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          ) : (
            detailParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm text-slate-600">
                {paragraph}
              </p>
            ))
          )}
          {detailBullets.length ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {detailBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Section>
    );
  };

  const renderReviewsSection = (section?: WebsiteBuilderSection | null) => {
    const countLabel = applyTemplate(
      section?.title,
      templateContext,
      `${reviewCount} Reviews`,
    );
    const emptyLabel = applyTemplate(
      section?.description,
      templateContext,
      "No reviews yet. Be the first to share your feedback.",
    );
    const reviewButton = section?.buttons?.[0] ?? null;
    const reviewButtonLabel = applyTemplate(
      reviewButton?.label,
      templateContext,
      "Write a review",
    );

    return (
      <Section
        theme={theme}
        builderSectionId={section?.id}
        key={section?.id ?? "reviews-default"}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <RatingStars rating={rating} starClassName="h-5 w-5" />
            <span>{rating.toFixed(1)}</span>
            <span className="text-sm font-medium text-slate-500">
              {countLabel}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.length ? (
              reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            ) : (
              <div className="rounded-3xl border border-black/5 bg-white p-6 text-sm text-slate-600 shadow-sm sm:col-span-2">
                {emptyLabel}
              </div>
            )}
          </div>
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "w-fit bg-slate-900 px-5 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] hover:opacity-90",
            )}
          >
            <a href={reviewButton?.href ?? "#"}>{reviewButtonLabel}</a>
          </Button>
        </div>
      </Section>
    );
  };

  const renderRelatedSection = (section?: WebsiteBuilderSection | null) => {
    const heading = applyTemplate(
      section?.title,
      templateContext,
      "Customers also purchased",
    );
    const emptyLabel = applyTemplate(
      section?.description,
      templateContext,
      "No related products are available yet.",
    );

    return (
      <Section
        theme={theme}
        builderSectionId={section?.id}
        key={section?.id ?? "related-default"}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-slate-900">
              {heading}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-slate-600 transition hover:text-slate-900"
                aria-label="Previous"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M15 6l-6 6 6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-slate-600 transition hover:text-slate-900"
                aria-label="Next"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
            </div>
          </div>
          {relatedProducts.length ? (
            <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
              {relatedProducts.map((item) => (
                <div key={item.id} className="min-w-[220px] lg:min-w-0">
                  <PurchasedCard
                    product={item}
                    isWishlisted={isWishlisted(item.id)}
                    isWishlistBusy={pendingIds.has(item.id)}
                    onToggleWishlist={() => {
                      void toggleWishlist(item.id);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-black/5 bg-white p-6 text-sm text-slate-600 shadow-sm">
              {emptyLabel}
            </div>
          )}
        </div>
      </Section>
    );
  };

  const defaultContent = (
    <>
      {renderGalleryAndOptionsSection(null, null, "default-main")}
      {renderDescriptionSection(null)}
      {renderReviewsSection(null)}
      {renderRelatedSection(null)}
      <KidsOfferBanner theme={theme} />
    </>
  );

  if (!visibleSections.length) {
    return defaultContent;
  }

  const sectionEntries = visibleSections.map((section) => ({
    section,
    kind: resolveProductSectionKind(section),
  }));

  if (!sectionEntries.some((entry) => entry.kind !== "extra")) {
    return (
      <>
        {defaultContent}
        <ExtraSections
          theme={theme}
          sections={visibleSections}
          mediaLibrary={mediaLibrary}
        />
      </>
    );
  }

  const rendered: ReactNode[] = [];
  for (let index = 0; index < sectionEntries.length; index += 1) {
    const current = sectionEntries[index];
    if (!current) continue;
    const next = sectionEntries[index + 1];

    const isCurrentMain =
      current.kind === "gallery" || current.kind === "options";
    const isNextMain = next
      ? next.kind === "gallery" || next.kind === "options"
      : false;

    if (isCurrentMain && isNextMain && current.kind !== next?.kind) {
      const gallerySection =
        current.kind === "gallery" ? current.section : next?.section ?? null;
      const optionsDetailSection =
        current.kind === "options" ? current.section : next?.section ?? null;
      rendered.push(
        renderGalleryAndOptionsSection(
          gallerySection,
          optionsDetailSection,
          `${current.section.id}-${next?.section.id ?? "main"}`,
        ),
      );
      index += 1;
      continue;
    }

    switch (current.kind) {
      case "gallery":
        rendered.push(
          renderGalleryAndOptionsSection(current.section, null, current.section.id),
        );
        break;
      case "options":
        rendered.push(
          renderGalleryAndOptionsSection(null, current.section, current.section.id),
        );
        break;
      case "description":
        rendered.push(renderDescriptionSection(current.section));
        break;
      case "reviews":
        rendered.push(renderReviewsSection(current.section));
        break;
      case "related":
        rendered.push(renderRelatedSection(current.section));
        break;
      case "banner":
        rendered.push(
          <KidsOfferBanner
            key={current.section.id}
            theme={theme}
            section={current.section}
            mediaLibrary={mediaLibrary}
          />,
        );
        break;
      case "extra":
      default:
        rendered.push(
          <ExtraSections
            key={current.section.id}
            theme={theme}
            sections={[current.section]}
            mediaLibrary={mediaLibrary}
          />,
        );
        break;
    }
  }

  return <>{rendered}</>;
}
