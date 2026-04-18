"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/website/cart/cart-context";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import { normalizeCatalogCategorySlug } from "@/lib/catalog-category";
import { normalizeProductFaqItems } from "@/lib/product-faq";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import {
  computeAdjustedUnitPriceHTCents,
  computeAdjustedUnitPriceTTCCents,
  formatPriceAdjustmentLabel,
} from "@/lib/product-pricing";
import type { CatalogPayload } from "@/server/website";
import type {
  HomeProduct,
  ProductAccordionItem,
  ProductReviewCard,
  ThemeTokens,
} from "../../types";
import { PRODUCT_INFO_CARDS } from "../../data/product";
import {
  buildProductGallery,
  formatCisecoLabel,
  resolveVariantOptions,
  toCartProduct,
} from "../../utils";
import { ExtraSections } from "../builder/ExtraSections";
import { Section } from "../layout/Section";
import { CatalogImage } from "../shared/CatalogImage";
import { WishlistHeartIcon } from "../shared/Icons";
import { ProductCard } from "../shared/ProductCard";
import { RatingStars } from "../shared/RatingStars";
import { AccordionItem } from "./AccordionItem";
import { InfoCard } from "./InfoCard";
import { KidsOfferBanner } from "./KidsOfferBanner";
import { ReviewCard } from "./ReviewCard";
import { useWishlist } from "../../hooks/useWishlist";
import { useAccountProfile } from "../../hooks/useAccountProfile";
import { useCisecoI18n } from "../../i18n";

type ProductDetailStatus = "loading" | "error" | "not-found" | "ready";

type ProductDetailPageProps = {
  theme: ThemeTokens;
  baseLink: (path: string) => string;
  catalogSlug: string;
  status: ProductDetailStatus;
  product: CatalogPayload["products"]["all"][number] | null;
  cartProduct: HomeProduct | null;
  relatedProducts: HomeProduct[];
  sections?: WebsiteBuilderSection[];
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  mode: "public" | "preview";
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

function formatReviewDate(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

export function ProductDetailPage({
  theme,
  baseLink,
  catalogSlug,
  status,
  product,
  cartProduct,
  relatedProducts,
  sections = [],
  mediaLibrary = [],
  mode,
}: ProductDetailPageProps) {
  const { t, localizeHref } = useCisecoI18n();
  const { authStatus, profile } = useAccountProfile({
    redirectOnUnauthorized: false,
    loadStrategy: "manual",
  });
  const translateTemplateSource = useCallback(
    (value: string | null | undefined) => (value ? t(value) : value),
    [t],
  );
  const { isWishlisted, toggleWishlist, pendingIds } = useWishlist({
    redirectOnLoad: false,
    redirectOnAction: true,
    slug: catalogSlug,
    loginHref: baseLink("/login"),
    loadStrategy: authStatus === "authenticated" ? "idle" : "manual",
  });
  const resolvedStatus: ProductDetailStatus =
    status === "ready" && (!product || !cartProduct) ? "not-found" : status;

  const categoryLabel = t(formatCisecoLabel(product?.category, "Collection"));
  const description = product?.description?.trim() ?? "";
  const excerpt = product?.excerpt?.trim() ?? "";
  const shortDescriptionHtml = product?.shortDescriptionHtml?.trim() ?? "";
  const descriptionHtml = product?.descriptionHtml?.trim() ?? "";
  const faqItems = useMemo(
    () => normalizeProductFaqItems(product?.faqItems),
    [product?.faqItems],
  );
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
    if (product?.sku) bullets.push(`${t("SKU")}: ${product.sku}`);
    if (product?.unit) bullets.push(`${t("Unit")}: ${product.unit}`);
    if (product?.category) bullets.push(`${t("Category")}: ${product.category}`);
    if (typeof product?.vatRate === "number") {
      bullets.push(`${t("VAT")}: ${product.vatRate}%`);
    }
    if (product?.saleMode) {
      bullets.push(
        `${t("Sale mode")}: ${t(
          product.saleMode === "INSTANT" ? "Instant" : "Quote",
        )}`,
      );
    }
    return bullets;
  }, [product, t]);
  const gallery = useMemo(() => {
    if (!product) return [];
    return buildProductGallery({
      product,
      fallbackImage: cartProduct?.image,
      title: product.name,
    });
  }, [cartProduct?.image, product]);
  const { addItem } = useCart();
  const reviews = useMemo<ProductReviewCard[]>(() => {
    return (product?.reviews ?? []).map((review) => ({
      id: review.id,
      name: review.authorName,
      date: formatReviewDate(review.createdAt),
      rating: review.rating,
      title: review.title,
      body: review.body,
    }));
  }, [product?.reviews]);
  const reviewCount = reviews.length;
  const rating = reviewCount
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
    : 0;
  const infoCards = useMemo(() => {
    const threshold = formatCurrency(50, "TND");
    const shippingDescription = t("On orders over {{amount}}").replace(
      "{{amount}}",
      threshold,
    );
    return PRODUCT_INFO_CARDS.map((item) =>
      item.id === "info-shipping"
        ? { ...item, description: shippingDescription }
        : item,
    );
  }, [t]);

  const [activeColor, setActiveColor] = useState(
    variantOptions.colors[0]?.id ?? "",
  );
  const [activeSize, setActiveSize] = useState(
    variantOptions.sizes[0]?.id ?? "",
  );
  const [customSelections, setCustomSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState("specs");
  const [openFaqId, setOpenFaqId] = useState("");
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewAuthorName, setReviewAuthorName] = useState(
    profile?.name ?? "",
  );
  const [reviewAuthorEmail, setReviewAuthorEmail] = useState(
    profile?.email ?? "",
  );
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewStatus, setReviewStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [reviewFeedback, setReviewFeedback] = useState("");

  useEffect(() => {
    if (profile?.name && !reviewAuthorName) {
      setReviewAuthorName(profile.name);
    }
    if (profile?.email && !reviewAuthorEmail) {
      setReviewAuthorEmail(profile.email);
    }
  }, [profile?.name, profile?.email, reviewAuthorEmail, reviewAuthorName]);

  const useVariantStock =
    hasVariantStock &&
    (variantOptions.colors.length > 0 || variantOptions.sizes.length > 0);
  const categorySlug = normalizeCatalogCategorySlug(product?.category) ?? "";
  const categoryHref = categorySlug
    ? localizeHref(baseLink(`/collections/${categorySlug}`))
    : localizeHref(baseLink("/collections"));

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
            kind: "custom" as const,
            groupId: group.id,
            valueId: selectedValue.id,
            name: group.name,
            value: selectedValue.label,
            priceAdjustmentCents: selectedValue.priceAdjustmentCents ?? null,
          },
        ];
      }),
    [customSelections, resolvedCustomOptions],
  );
  const selectedOptionAdjustmentCents = useMemo(
    () =>
      selectedCustomOptions.reduce(
        (sum, option) => sum + (option.priceAdjustmentCents ?? 0),
        0,
      ),
    [selectedCustomOptions],
  );
  const selectedUnitPriceHTCents = useMemo(
    () =>
      computeAdjustedUnitPriceHTCents(
        cartProduct?.unitPriceHTCents,
        selectedOptionAdjustmentCents,
      ),
    [cartProduct?.unitPriceHTCents, selectedOptionAdjustmentCents],
  );
  const selectedUnitAmountCents = useMemo(
    () =>
      computeAdjustedUnitPriceTTCCents({
        saleMode: cartProduct?.saleMode ?? product?.saleMode ?? "QUOTE",
        priceHTCents: cartProduct?.unitPriceHTCents ?? null,
        priceTTCCents: cartProduct?.unitAmountCents ?? null,
        vatRate: cartProduct?.vatRate ?? null,
        adjustmentCents: selectedOptionAdjustmentCents,
        discountRate: cartProduct?.discountRate ?? null,
        discountAmountCents: cartProduct?.discountAmountCents ?? null,
      }),
    [
      cartProduct?.discountAmountCents,
      cartProduct?.discountRate,
      cartProduct?.saleMode,
      cartProduct?.unitAmountCents,
      cartProduct?.unitPriceHTCents,
      cartProduct?.vatRate,
      product?.saleMode,
      selectedOptionAdjustmentCents,
    ],
  );
  const selectedPriceLabel = useMemo(() => {
    if (!cartProduct) return "";
    if (selectedUnitAmountCents != null) {
      return formatCurrency(
        fromCents(selectedUnitAmountCents, cartProduct.currencyCode),
        cartProduct.currencyCode,
      );
    }
    return cartProduct.price;
  }, [cartProduct, selectedUnitAmountCents]);
  const displayPriceLabel =
    selectedPriceLabel || cartProduct?.price || t("Price on request");
  const selectedPriceAdjustmentLabel =
    selectedOptionAdjustmentCents !== 0
      ? formatPriceAdjustmentLabel(
          selectedOptionAdjustmentCents,
          cartProduct?.currencyCode ?? "TND",
        )
      : null;

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
  const stockLabel = isOutOfStock ? t("Rupture de stock") : t("Disponible");
  const canIncreaseQuantity =
    !isOutOfStock &&
    (typeof selectedStock !== "number" || quantity < selectedStock);

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
      "product.price": selectedPriceLabel || cartProduct?.price || "",
      productPrice: selectedPriceLabel || cartProduct?.price || "",
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
    [
      cartProduct?.price,
      categoryLabel,
      description,
      excerpt,
      product?.name,
      product?.sku,
      rating,
      reviewCount,
      selectedPriceLabel,
      stockLabel,
    ],
  );

  const optionsSection = useMemo(
    () =>
      visibleSections.find(
        (section) => resolveProductSectionKind(section) === "options",
      ) ?? null,
    [visibleSections],
  );

  const addToCartLabel = applyTemplate(
    translateTemplateSource(
      optionsSection?.buttons?.find((button) => button.style === "primary")?.label,
    ),
    templateContext,
    t("Add to cart"),
  );
  const sizeChartButton =
    optionsSection?.buttons?.find((button) => button.style !== "primary") ?? null;
  const sizeChartLabel = applyTemplate(
    translateTemplateSource(sizeChartButton?.label),
    templateContext,
    t("See sizing chart"),
  );
  const sizeChartHref = sizeChartButton?.href?.trim() || "#";

  const accordionItems = useMemo<ProductAccordionItem[]>(() => {
    const specs: string[] = [];
    if (product?.sku) specs.push(`${t("SKU")}: ${product.sku}`);
    if (product?.unit) specs.push(`${t("Unit")}: ${product.unit}`);
    if (typeof product?.vatRate === "number") {
      specs.push(`${t("VAT")}: ${product.vatRate}%`);
    }
    return [
      {
        id: "specs",
        title: applyTemplate(
          translateTemplateSource(
            findSectionItem(
              optionsSection,
              "ciseco-product-options-accordion-specs",
            )?.title,
          ),
          templateContext,
          t("Details"),
        ),
        body: specs.length ? specs.join(" | ") : t("Details coming soon."),
      },
      {
        id: "category",
        title: applyTemplate(
          translateTemplateSource(
            findSectionItem(
              optionsSection,
              "ciseco-product-options-accordion-category",
            )?.title,
          ),
          templateContext,
          t("Category"),
        ),
        body: categoryLabel,
      },
      {
        id: "availability",
        title: applyTemplate(
          translateTemplateSource(
            findSectionItem(
              optionsSection,
              "ciseco-product-options-accordion-availability",
            )?.title,
          ),
          templateContext,
          t("Availability"),
        ),
        body: stockLabel,
      },
    ];
  }, [
    categoryLabel,
    optionsSection,
    product,
    stockLabel,
    t,
    templateContext,
    translateTemplateSource,
  ]);

  const getOptionChipClassName = ({
    isActive,
    isDisabled,
    compact = false,
  }: {
    isActive: boolean;
    isDisabled: boolean;
    compact?: boolean;
  }) =>
    clsx(
      "inline-flex max-w-full items-center justify-center gap-x-1.5 gap-y-0.5 whitespace-normal rounded-full border px-4 py-2.5 text-center text-sm font-semibold leading-tight shadow-[0_14px_28px_-26px_rgba(15,23,42,0.45)] transition-transform duration-200",
      compact ? "min-h-10 min-w-[3.5rem]" : "min-h-11",
      isActive && !isDisabled
        ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_34px_-24px_rgba(15,23,42,0.65)]"
        : "border-black/10 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-900/70 hover:bg-slate-50 hover:shadow-[0_18px_34px_-26px_rgba(15,23,42,0.5)]",
      isDisabled && "cursor-not-allowed opacity-45 hover:translate-y-0 hover:border-black/10 hover:bg-white hover:shadow-[0_14px_28px_-26px_rgba(15,23,42,0.45)]",
    );

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
    setOpenAccordion(accordionItems[0]?.id ?? "specs");
  }, [accordionItems]);

  useEffect(() => {
    if (product?.id) {
      setQuantity(1);
    }
  }, [product?.id]);

  useEffect(() => {
    setOpenFaqId(faqItems[0]?.question ?? "");
  }, [faqItems]);

  useEffect(() => {
    if (typeof selectedStock !== "number") return;
    setQuantity((current) => {
      if (selectedStock <= 0) return 1;
      return Math.min(current, selectedStock);
    });
  }, [selectedStock]);

  if (resolvedStatus === "loading") {
    return <ProductDetailSkeleton theme={theme} />;
  }

  if (resolvedStatus === "error") {
    return (
      <ProductDetailMessage
        theme={theme}
        title={t("Something went wrong")}
        description={t(
          "We could not load this product right now. Please refresh and try again.",
        )}
        action={
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "bg-slate-900 px-6 text-white hover:opacity-90",
            )}
          >
            <a href={localizeHref(baseLink("/"))}>{t("Back to home")}</a>
          </Button>
        }
      />
    );
  }

  if (resolvedStatus === "not-found") {
    return (
      <ProductDetailMessage
        theme={theme}
        title={t("Product not found")}
        description={t("We could not find this product for the current catalog.")}
        action={
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "bg-slate-900 px-6 text-white hover:opacity-90",
            )}
          >
            <a href={localizeHref(baseLink("/"))}>{t("Browse products")}</a>
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
  const isCurrentWishlisted = product?.id ? isWishlisted(product.id) : false;
  const isCurrentWishlistBusy = product?.id ? pendingIds.has(product.id) : false;

  const renderGalleryPanel = (section?: WebsiteBuilderSection | null) => (
    <div className="space-y-4" data-builder-section={section?.id}>
      <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => {
            if (!product?.id || isCurrentWishlistBusy) return;
            void toggleWishlist(product.id);
          }}
          disabled={!product?.id || isCurrentWishlistBusy}
          aria-label={
            isCurrentWishlisted
              ? `${t("Remove from wishlist")} ${product?.name ?? ""}`
              : `${t("Add to wishlist")} ${product?.name ?? ""}`
          }
          aria-pressed={isCurrentWishlisted}
          aria-busy={isCurrentWishlistBusy}
          className={clsx(
            "absolute left-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/85 bg-white/92 text-xs shadow-[0_18px_34px_-24px_rgba(15,23,42,0.75)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5 active:scale-95",
            isCurrentWishlisted
              ? "border-rose-200/80 bg-rose-50 text-rose-600 shadow-[0_18px_34px_-24px_rgba(244,63,94,0.65)]"
              : "text-slate-600 hover:border-rose-100 hover:bg-white hover:text-rose-500",
            isCurrentWishlistBusy ? "cursor-wait opacity-80" : null,
          )}
        >
          {isCurrentWishlistBusy ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500"
              aria-hidden="true"
            />
          ) : (
            <WishlistHeartIcon
              key={isCurrentWishlisted ? "wishlisted" : "idle"}
              className={clsx(
                "h-[22px] w-[22px] transition-transform duration-300",
                isCurrentWishlisted && "animate-ciseco-heart-pop",
              )}
              filled={isCurrentWishlisted}
              strokeWidth={1.9}
            />
          )}
        </button>
        <div className="relative aspect-square w-full">
          {mainImage ? (
            <CatalogImage
              src={mainImage.src}
              alt={mainImage.alt}
              className="h-full w-full object-contain"
              sizes="(min-width: 1024px) 42vw, 92vw"
              priority
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
              <div className="relative aspect-square w-full">
                <CatalogImage
                  src={image.src}
                  alt={image.alt}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  sizes="(min-width: 1024px) 18vw, 44vw"
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
    const heading = applyTemplate(
      translateTemplateSource(section?.title),
      templateContext,
      product?.name ?? "",
    );
    const subtitle = section?.subtitle
      ? applyTemplate(
          translateTemplateSource(section.subtitle),
          templateContext,
          translateTemplateSource(section.subtitle) ?? section.subtitle,
        )
      : null;

    return (
      <div className="space-y-6" data-builder-section={section?.id}>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {heading}
          </h1>
          <div className="flex flex-wrap items-start gap-3">
            <div className="relative min-w-[220px] max-w-full flex-1">
              <div
                className="pointer-events-none absolute -left-6 top-5 h-16 w-40 rounded-full blur-3xl"
                style={{ backgroundColor: "rgba(59, 130, 246, 0.12)" }}
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "#2563eb" }}
                  />
                  {t("Price")}
                </span>
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1.5">
                  <span className="text-[1.86rem] font-semibold leading-none tracking-[-0.05em] text-sky-950 tabular-nums sm:text-[2.08rem]">
                    {displayPriceLabel}
                  </span>
                  {selectedPriceAdjustmentLabel ? (
                    <span className="text-[13px] font-medium text-slate-600">
                      {selectedPriceAdjustmentLabel}
                    </span>
                  ) : null}
                </div>
                <div
                  className="mt-2.5 h-[2px] w-full max-w-[11rem] rounded-full opacity-95"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(37,99,235,0.95) 0%, rgba(147,197,253,0.5) 62%, rgba(255,255,255,0) 100%)",
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              {categoryLabel ? (
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.35)]">
                  {categoryLabel}
                </span>
              ) : null}
              {reviewCount > 0 ? (
                <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.35)]">
                  <RatingStars rating={rating} />
                  <span className="text-slate-900">{rating.toFixed(1)}</span>
                  <span className="text-slate-400">|</span>
                  <span>{reviewCount} {t("Reviews")}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div
            className={clsx(
              "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[0_12px_24px_-24px_rgba(15,23,42,0.3)]",
              isOutOfStock
                ? "border-rose-100 bg-rose-50 text-rose-600"
                : "border-emerald-100 bg-emerald-50 text-emerald-700",
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
          {shortDescriptionHtml ? (
            <div
              className="text-sm leading-6 text-slate-600 [&_a]:text-sky-600 [&_a]:underline [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: shortDescriptionHtml }}
            />
          ) : excerpt ? (
            <p className="text-sm text-slate-600">{excerpt}</p>
          ) : null}
        </div>
        {hasColors ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                {t("Color")}
              </p>
              {activeColorOption?.label ? (
                <span className="text-sm font-medium text-slate-700">
                  {activeColorOption.label}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
                      "flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-[0_14px_28px_-24px_rgba(15,23,42,0.42)] transition-transform duration-200 hover:-translate-y-0.5",
                      isActive && !isDisabled
                        ? "border-slate-900 ring-2 ring-slate-900/15 shadow-[0_18px_34px_-22px_rgba(15,23,42,0.5)]"
                        : "border-black/10 hover:border-slate-400",
                      isDisabled && "cursor-not-allowed opacity-40 hover:translate-y-0",
                    )}
                    onClick={() => {
                      if (isDisabled) return;
                      setActiveColor(color.id);
                    }}
                  >
                    <span
                      className="h-[22px] w-[22px] rounded-full border border-black/5"
                      style={{ backgroundColor: color.swatch }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {hasSizes ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                {t("Size")}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {activeSizeOption?.label ? (
                  <span className="text-sm font-medium text-slate-700">
                    {activeSizeOption.label}
                  </span>
                ) : null}
                <a
                  href={localizeHref(sizeChartHref)}
                  className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
                >
                  {t(sizeChartLabel)}
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {resolvedSizes.map((size) => {
                const isActive = size.id === activeSize;
                const isDisabled = size.disabled === true;
                return (
                  <button
                    key={size.id}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isDisabled}
                    className={getOptionChipClassName({
                      isActive,
                      isDisabled,
                      compact: true,
                    })}
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
            {resolvedCustomOptions.map((group) => {
              const selectedValue =
                group.values.find((value) => customSelections[group.id] === value.id) ?? null;

              return (
                <div key={group.id} className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                      {group.name}
                    </p>
                    {selectedValue ? (
                      <span className="text-sm font-medium text-slate-700">
                        {selectedValue.label}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {group.values.map((value) => {
                      const isActive = customSelections[group.id] === value.id;
                      const isDisabled = value.disabled === true;
                      const priceAdjustmentLabel = formatPriceAdjustmentLabel(
                        value.priceAdjustmentCents,
                        cartProduct?.currencyCode ?? "TND",
                      );
                      return (
                        <button
                          key={value.id}
                          type="button"
                          aria-pressed={isActive}
                          disabled={isDisabled}
                          className={getOptionChipClassName({
                            isActive,
                            isDisabled,
                          })}
                          onClick={() => {
                            if (isDisabled) return;
                            setCustomSelections((prev) => ({
                              ...prev,
                              [group.id]: value.id,
                            }));
                          }}
                        >
                          <span className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center">
                            <span className="break-words">{value.label}</span>
                            {priceAdjustmentLabel ? (
                              <span
                                className={clsx(
                                  "text-[11px] font-medium",
                                  isActive && !isDisabled
                                    ? "text-white/75"
                                    : "text-slate-600",
                                )}
                              >
                                {priceAdjustmentLabel}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center justify-between rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm sm:w-32">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={quantity <= 1}
              onClick={() =>
                setQuantity((value) => Math.max(1, value - 1))
              }
              aria-label={t("Decrease quantity")}
            >
              -
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canIncreaseQuantity}
              onClick={() =>
                setQuantity((value) => {
                  if (isOutOfStock) return value;
                  if (typeof selectedStock === "number") {
                    return Math.min(selectedStock, value + 1);
                  }
                  return value + 1;
                })
              }
              aria-label={t("Increase quantity")}
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
                ...(activeColorOption?.label
                  ? [
                      {
                        kind: "color" as const,
                        groupId: "color",
                        valueId: activeColorOption.id,
                        name: "Color",
                        value: activeColorOption.label,
                      },
                    ]
                  : []),
                ...(activeSizeOption?.label
                  ? [
                      {
                        kind: "size" as const,
                        groupId: "size",
                        valueId: activeSizeOption.id,
                        name: "Size",
                        value: activeSizeOption.label,
                      },
                    ]
                  : []),
                ...selectedCustomOptions,
              ];
              const nextCartProduct = toCartProduct(cartProduct);
              addItem(
                {
                  ...nextCartProduct,
                  price: selectedPriceLabel || nextCartProduct.price,
                  unitAmountCents:
                    selectedUnitAmountCents ?? nextCartProduct.unitAmountCents,
                  unitPriceHTCents:
                    selectedUnitPriceHTCents ??
                    nextCartProduct.unitPriceHTCents,
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
            <span>{t(addToCartLabel)}</span>
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
            aria-label={t("Breadcrumb")}
            className="text-xs text-slate-600"
          >
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <a
                  href={localizeHref(baseLink("/"))}
                  className="transition hover:text-slate-900"
                >
                  {t("Home")}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <a
                  href={categoryHref}
                  className="transition hover:text-slate-900"
                >
                  {categoryLabel}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-900">{product?.name ?? ""}</li>
            </ol>
          </nav>
          <div className={clsx("grid gap-8", columns)}>
            {showGallery ? renderGalleryPanel(gallerySection) : null}
            {showOptions ? renderOptionsPanel(detailSection) : null}
          </div>
        </div>
      </Section>
    );
  };

  const renderFaqSection = () => {
    if (!faqItems.length) {
      return null;
    }

    return (
      <Section
        theme={theme}
        key="product-faq"
        deferRendering
        containIntrinsicSize="1px 760px"
      >
        <div className="max-w-3xl space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">
              {t("Questions fréquentes")}
            </h2>
            <p className="text-sm text-slate-600">
              {t("Réponses utiles pour mieux choisir ce produit avant achat ou demande de devis.")}
            </p>
          </div>
          <div className="space-y-2">
            {faqItems.map((item, index) => {
              const itemId = `${product?.id ?? "product"}-faq-${index + 1}`;
              return (
                <AccordionItem
                  key={itemId}
                  id={itemId}
                  title={item.question}
                  isOpen={openFaqId === item.question}
                  onToggle={() =>
                    setOpenFaqId((current) =>
                      current === item.question ? "" : item.question,
                    )
                  }
                >
                  {item.answer}
                </AccordionItem>
              );
            })}
          </div>
        </div>
      </Section>
    );
  };

  const handleReviewSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product) {
      return;
    }

    const trimmedName = reviewAuthorName.trim();
    const trimmedEmail = reviewAuthorEmail.trim();
    const trimmedBody = reviewBody.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setReviewStatus("error");
      setReviewFeedback(t("Please enter your name."));
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setReviewStatus("error");
      setReviewFeedback(t("Please enter a valid email address."));
      return;
    }
    if (trimmedBody.length < 10) {
      setReviewStatus("error");
      setReviewFeedback(t("Please write a review of at least 10 characters."));
      return;
    }

    setReviewStatus("submitting");
    setReviewFeedback("");
    try {
      const response = await fetch("/api/catalogue/reviews", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          rating: reviewRating,
          title: reviewTitle,
          body: trimmedBody,
          authorName: trimmedName,
          authorEmail: trimmedEmail,
          slug: catalogSlug,
          mode,
          path:
            typeof window !== "undefined"
              ? window.location.pathname
              : `/product/${product.publicSlug}`,
          website: "",
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || t("Unable to submit your review."));
      }

      setReviewStatus("success");
      setReviewFeedback(
        result.message || t("Thanks! Your review is awaiting moderation."),
      );
      setReviewTitle("");
      setReviewBody("");
    } catch (error) {
      setReviewStatus("error");
      setReviewFeedback(
        error instanceof Error
          ? error.message
          : t("Unable to submit your review."),
      );
    }
  };

  const renderDescriptionSection = (section?: WebsiteBuilderSection | null) => {
    const heading = applyTemplate(
      translateTemplateSource(section?.title),
      templateContext,
      t("Product Details"),
    );
    const intro = section?.description
      ? applyTemplate(
          translateTemplateSource(section.description),
          templateContext,
          translateTemplateSource(section.description) ?? section.description,
        )
      : null;

    return (
      <Section
        theme={theme}
        className="pt-0"
        builderSectionId={section?.id}
        key={section?.id ?? "description-default"}
        deferRendering
        containIntrinsicSize="1px 960px"
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
                {t(paragraph)}
              </p>
            ))
          )}
          {detailBullets.length ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {detailBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{t(item)}</span>
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
      translateTemplateSource(section?.title),
      templateContext,
      `${reviewCount} ${t("Reviews")}`,
    );
    const emptyLabel = applyTemplate(
      translateTemplateSource(section?.description),
      templateContext,
      t("No reviews yet. Be the first to share your feedback."),
    );
    const reviewButton = section?.buttons?.[0] ?? null;
    const reviewButtonLabel = applyTemplate(
      translateTemplateSource(reviewButton?.label),
      templateContext,
      t("Write a review"),
    );

    return (
      <Section
        theme={theme}
        builderSectionId={section?.id}
        key={section?.id ?? "reviews-default"}
        deferRendering
        containIntrinsicSize="1px 920px"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <RatingStars rating={rating} starClassName="h-5 w-5" />
            <span>{rating.toFixed(1)}</span>
            <span className="text-sm font-medium text-slate-600">
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
            type="button"
            className={clsx(
              theme.buttonShape,
              "w-fit bg-slate-900 px-5 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] hover:opacity-90",
            )}
            onClick={() => {
              setReviewFormOpen((current) => !current);
              setReviewStatus("idle");
              setReviewFeedback("");
            }}
          >
            {reviewButtonLabel}
          </Button>
          {reviewFormOpen ? (
            <form
              className="grid gap-4 rounded-2xl border border-black/5 bg-white p-5 text-sm shadow-sm"
              onSubmit={handleReviewSubmit}
            >
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("Name")}
                  </span>
                  <input
                    value={reviewAuthorName}
                    onChange={(event) => setReviewAuthorName(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    maxLength={120}
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("Email")}
                  </span>
                  <input
                    type="email"
                    value={reviewAuthorEmail}
                    onChange={(event) => setReviewAuthorEmail(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    maxLength={160}
                    required
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("Rating")}
                </span>
                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 sm:max-w-48"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value}/5
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("Title")}
                </span>
                <input
                  value={reviewTitle}
                  onChange={(event) => setReviewTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  maxLength={140}
                  placeholder={t("Optional")}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("Review")}
                </span>
                <textarea
                  value={reviewBody}
                  onChange={(event) => setReviewBody(event.target.value)}
                  className="min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  maxLength={2000}
                  required
                />
              </label>
              {reviewFeedback ? (
                <p
                  className={clsx(
                    "rounded-lg px-3 py-2 text-xs",
                    reviewStatus === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700",
                  )}
                  role="status"
                >
                  {reviewFeedback}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={reviewStatus === "submitting"}
                loading={reviewStatus === "submitting"}
                className={clsx(theme.buttonShape, "w-fit bg-slate-900 text-white")}
              >
                {reviewStatus === "submitting"
                  ? t("Submitting...")
                  : t("Submit review")}
              </Button>
              <p className="text-xs text-slate-500">
                {t("Reviews are published after moderation.")}
              </p>
            </form>
          ) : null}
        </div>
      </Section>
    );
  };

  const renderRelatedSection = (section?: WebsiteBuilderSection | null) => {
    const heading = applyTemplate(
      translateTemplateSource(section?.title),
      templateContext,
      t("Customers also purchased"),
    );
    const emptyLabel = applyTemplate(
      translateTemplateSource(section?.description),
      templateContext,
      t("No related products are available yet."),
    );

    return (
      <Section
        theme={theme}
        builderSectionId={section?.id}
        key={section?.id ?? "related-default"}
        deferRendering
        containIntrinsicSize="1px 920px"
      >
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            {heading}
          </h2>
          {relatedProducts.length ? (
            <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
              {relatedProducts.map((item) => (
                <div key={item.id} className="min-w-[240px] snap-start sm:min-w-0">
                  <ProductCard
                    product={item}
                    variant="compact"
                    href={baseLink(`/produit/${item.slug}`)}
                    isWishlisted={isWishlisted(item.id)}
                    isWishlistBusy={pendingIds.has(item.id)}
                    onToggleWishlist={() => toggleWishlist(item.id)}
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
      {renderFaqSection()}
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
  let hasRenderedFaq = false;
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
        if (!hasRenderedFaq && faqItems.length) {
          rendered.push(renderFaqSection());
          hasRenderedFaq = true;
        }
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

  if (!hasRenderedFaq && faqItems.length) {
    rendered.push(renderFaqSection());
  }

  return <>{rendered}</>;
}
