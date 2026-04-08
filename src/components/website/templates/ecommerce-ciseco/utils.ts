import type { CartProduct } from "@/components/website/cart/cart-context";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { normalizeProductOptionConfig } from "@/lib/product-options";
import { buildProductImageAlt } from "@/lib/product-seo";
import {
  computeAdjustedUnitPriceTTCCents,
  resolveProductDiscount,
} from "@/lib/product-pricing";
import { slugify } from "@/lib/slug";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { CatalogPayload } from "@/server/website";
import type { HomeProduct, PageDescriptor, ProductColorOption, ProductGalleryImage } from "./types";

const CISECO_CURRENCY_CODE = "TND";
const DEFAULT_PRICE_LABEL = "Price on request";
const SWATCH_PALETTES = [
  ["#e2e8f0", "#94a3b8", "#0f172a"],
  ["#fecaca", "#fda4af", "#fb7185"],
  ["#bbf7d0", "#86efac", "#22c55e"],
  ["#e5e7eb", "#cbd5f5", "#6366f1"],
  ["#fef9c3", "#fde68a", "#f59e0b"],
  ["#dbeafe", "#93c5fd", "#1d4ed8"],
  ["#fecdd3", "#f472b6", "#db2777"],
  ["#ddd6fe", "#c4b5fd", "#8b5cf6"],
];
const VARIANT_COLOR_KEYS = ["color", "colour", "couleur"];
const VARIANT_SIZE_KEYS = ["size", "taille"];
const DEFAULT_COLOR_SWATCHES = [
  "#111827",
  "#9a6b3b",
  "#eab308",
  "#2563eb",
  "#16a34a",
  "#be185d",
  "#f97316",
  "#64748b",
];

export function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) return color;
  return `${color}${alphaHex}`;
}

export function formatCisecoLabel(
  value: string | null | undefined,
  fallback = "",
) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const lettersOnly = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  const isUppercaseLabel =
    lettersOnly.length > 1 && lettersOnly === lettersOnly.toUpperCase();

  if (!isUppercaseLabel) {
    return trimmed;
  }

  return trimmed
    .toLocaleLowerCase()
    .replace(/(^|[\s/-])([a-zÀ-ÿ])/g, (_match, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase()}`;
    });
}

export function normalizePath(path?: string | null): string {
  if (!path) return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeComparablePath(path?: string | null) {
  const normalized = normalizePath(path);
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function buildCisecoHref(homeHref: string, targetPath: string) {
  const normalizedTarget = normalizePath(targetPath);
  if (!homeHref || homeHref === "#") return normalizedTarget;

  const [baseHref, hash = ""] = homeHref.split("#");
  const [pathname, query = ""] = baseHref.split("?");
  const params = new URLSearchParams(query);

  if (pathname.startsWith("/preview")) {
    params.set("path", normalizedTarget);
    const queryString = params.toString();
    return `${pathname}${queryString ? `?${queryString}` : ""}${hash ? `#${hash}` : ""}`;
  }

  const trimmed = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const queryString = params.toString();
  return `${trimmed}${normalizedTarget}${queryString ? `?${queryString}` : ""}${hash ? `#${hash}` : ""}`;
}

export function buildCisecoHrefWithQuery(
  homeHref: string,
  targetPath: string,
  params: Record<string, string | number | null | undefined>,
) {
  const baseHref = buildCisecoHref(homeHref, targetPath);
  const [pathname, query = ""] = baseHref.split("?");
  const searchParams = new URLSearchParams(query);

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") {
      searchParams.delete(key);
      return;
    }
    searchParams.set(key, String(value));
  });

  const nextQuery = searchParams.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

const EXTERNAL_HREF_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const SCOPED_CISECO_HREF_PATTERN = /^\/(?:catalogue\/|preview(?:[/?]|$))/i;

function resolveInternalCisecoHref(
  value: string,
  options: {
    homeHref?: string;
    baseLink?: ((target: string) => string) | undefined;
  },
) {
  const normalizedTarget = normalizePath(value);
  if (options.baseLink) {
    return options.baseLink(normalizedTarget);
  }
  if (options.homeHref) {
    return buildCisecoHref(options.homeHref, normalizedTarget);
  }
  return normalizedTarget;
}

export function resolveCisecoNavigationHref(options: {
  href?: string | null;
  homeHref?: string;
  baseLink?: (target: string) => string;
  fallbackPath?: string;
  fallbackHref?: string;
}) {
  const candidate = options.href?.trim();

  if (candidate && candidate !== "#") {
    if (
      candidate.startsWith("#") ||
      EXTERNAL_HREF_PATTERN.test(candidate) ||
      SCOPED_CISECO_HREF_PATTERN.test(candidate)
    ) {
      return candidate;
    }
    return resolveInternalCisecoHref(candidate, options);
  }

  if (options.fallbackHref) {
    return options.fallbackHref;
  }

  if (options.fallbackPath) {
    return resolveInternalCisecoHref(options.fallbackPath, options);
  }

  return candidate === "#" ? "#" : options.homeHref ?? "/";
}

export function resolvePage(
  path?: string | null,
  options?: { cmsPaths?: string[] | null },
): PageDescriptor {
  const normalized = normalizeComparablePath(path);
  const segments = normalized.split("/").filter(Boolean);
  const [head, second, third] = segments;
  if (head === "cart" || head === "panier") {
    return { page: "cart" };
  }
  if (head === "blog" || head === "journal") {
    if (second && /^page-\d+$/i.test(second)) {
      return { page: "blog" };
    }
    if (second) {
      return { page: "blog-detail", slug: second };
    }
    return { page: "blog" };
  }
  if (head === "search" || head === "recherche") {
    return { page: "search" };
  }
  if (head === "about" || head === "about-us" || head === "a-propos") {
    return { page: "about" };
  }
  if (head === "contact" || head === "contact-us" || head === "contactez-nous") {
    return { page: "contact" };
  }
  if (head === "checkout" || head === "paiement" || head === "payment") {
    return { page: "checkout" };
  }
  if (
    head === "login" ||
    head === "sign-in" ||
    head === "signin" ||
    head === "connexion"
  ) {
    return { page: "login" };
  }
  if (
    head === "signup" ||
    head === "sign-up" ||
    head === "register" ||
    head === "inscription"
  ) {
    return { page: "signup" };
  }
  if (
    head === "forgot-password" ||
    head === "reset-password" ||
    head === "password-reset"
  ) {
    return { page: "forgot-password" };
  }
  if (
    head === "confirmation" ||
    head === "merci" ||
    head === "order-success" ||
    head === "order-successful" ||
    head === "payment-success" ||
    head === "payment-successful" ||
    (head === "order" && second === "success") ||
    (head === "payment" && second === "success")
  ) {
    return { page: "order-success" };
  }
  if (
    head === "account" &&
    (second === "orders" || second === "orders-history")
  ) {
    if (third) {
      return { page: "account-order-detail", orderId: third };
    }
    return { page: "account-orders-history" };
  }
  if (head === "account" && second === "wishlists") {
    return { page: "account-wishlists" };
  }
  if (
    head === "account" &&
    (second === "change-password" || second === "password")
  ) {
    return { page: "account-change-password" };
  }
  if (head === "account") {
    return { page: "account" };
  }
  if (
    head === "collections" ||
    head === "collection" ||
    head === "shop" ||
    head === "categories" ||
    head === "category" ||
    head === "categorie"
  ) {
    if (second) {
      return { page: "collections", collectionSlug: second };
    }
    return { page: "collections" };
  }
  if (
    (head === "product" ||
      head === "products" ||
      head === "produit" ||
      head === "produits") &&
    second
  ) {
    return { page: "product", productSlug: second };
  }
  const cmsPaths = options?.cmsPaths ?? [];
  if (normalized !== "/" && cmsPaths.includes(normalized)) {
    return {
      page: "cms",
      cmsPath: normalized,
    };
  }
  return { page: "home" };
}

type GalleryEntry = {
  src: string;
  alt?: string | null;
  isPrimary?: boolean;
  position?: number | null;
};

function normalizeGalleryEntries(value: unknown): GalleryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: GalleryEntry[] = [];
  value.forEach((entry, index) => {
    if (typeof entry === "string") {
      const src = entry.trim();
      if (!src) return;
      entries.push({ src, position: index });
      return;
    }
    if (!isRecord(entry)) return;
    const src =
      typeof entry.src === "string"
        ? entry.src.trim()
        : typeof entry.url === "string"
          ? entry.url.trim()
          : "";
    if (!src) return;
    entries.push({
      src,
      alt: typeof entry.alt === "string" ? entry.alt : null,
      isPrimary: typeof entry.isPrimary === "boolean" ? entry.isPrimary : undefined,
      position: typeof entry.position === "number" ? entry.position : index,
    });
  });
  return entries.sort((left, right) => {
    const leftPos = left.position ?? 0;
    const rightPos = right.position ?? 0;
    if (leftPos === rightPos) return 0;
    return leftPos - rightPos;
  });
}

function normalizeGallery(value: unknown): string[] {
  return normalizeGalleryEntries(value).map((entry) => entry.src);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeVariantOption(option: unknown): string | null {
  if (typeof option === "string") {
    const trimmed = option.trim();
    return trimmed.length ? trimmed : null;
  }
  if (!isRecord(option)) return null;
  const label =
    typeof option.label === "string"
      ? option.label
      : typeof option.title === "string"
        ? option.title
        : "";
  const value =
    typeof option.value === "string"
      ? option.value
      : typeof option.id === "string"
        ? option.id
        : "";
  const resolved = (label || value).trim();
  return resolved.length ? resolved : null;
}

function normalizeVariantFields(schema: unknown) {
  const source = Array.isArray(schema)
    ? schema
    : isRecord(schema) && Array.isArray(schema.fields)
      ? schema.fields
      : [];
  if (!source.length) return [];
  return source.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const rawId =
      typeof entry.id === "string"
        ? entry.id
        : typeof entry.name === "string"
          ? entry.name
          : typeof entry.key === "string"
            ? entry.key
            : "";
    const id = rawId.trim();
    const label =
      typeof entry.label === "string"
        ? entry.label
        : typeof entry.title === "string"
          ? entry.title
          : id;
    const type = typeof entry.type === "string" ? entry.type.toLowerCase() : "";
    const isSelect = type === "select" || type === "dropdown";
    if (!isSelect) return [];
    const rawOptions = Array.isArray(entry.options)
      ? entry.options
      : Array.isArray(entry.choices)
        ? entry.choices
        : [];
    const options = rawOptions
      .map(normalizeVariantOption)
      .filter((value): value is string => Boolean(value));
    if (!options.length) return [];
    return [
      {
        id,
        label,
        options,
      },
    ];
  });
}

function resolveSwatch(label: string, index: number) {
  const normalized = label.toLowerCase();
  if (normalized.includes("black") || normalized.includes("noir")) return "#111827";
  if (normalized.includes("white") || normalized.includes("blanc")) return "#f8fafc";
  if (normalized.includes("gray") || normalized.includes("grey") || normalized.includes("gris")) {
    return "#94a3b8";
  }
  if (normalized.includes("red") || normalized.includes("rouge")) return "#ef4444";
  if (normalized.includes("blue") || normalized.includes("bleu")) return "#3b82f6";
  if (normalized.includes("green") || normalized.includes("vert")) return "#22c55e";
  if (normalized.includes("yellow") || normalized.includes("jaune")) return "#eab308";
  if (normalized.includes("pink") || normalized.includes("rose")) return "#ec4899";
  if (normalized.includes("orange")) return "#f97316";
  if (normalized.includes("brown") || normalized.includes("marron")) return "#92400e";
  if (normalized.includes("beige")) return "#f5e6d3";
  return DEFAULT_COLOR_SWATCHES[index % DEFAULT_COLOR_SWATCHES.length];
}

function resolveProductSlug(
  product: CatalogPayload["products"]["all"][number],
) {
  if (product.publicSlug && product.publicSlug.trim().length > 0) {
    return product.publicSlug;
  }
  const base = product.sku || product.name || product.id;
  return slugify(base) || product.id.slice(0, 8);
}

function resolveProductImage(
  product: CatalogPayload["products"]["all"][number],
  index: number,
) {
  const galleryEntries = normalizeGalleryEntries(product.gallery);
  const primaryEntry = galleryEntries.find((entry) => entry.isPrimary);
  const coverImage = product.coverImageUrl?.trim();
  const candidates = [primaryEntry?.src, coverImage, galleryEntries[0]?.src].filter(
    (entry): entry is string => Boolean(entry && entry.trim().length > 0),
  );
  return (
    candidates[0] ||
    WEBSITE_MEDIA_PLACEHOLDERS.products[
      index % WEBSITE_MEDIA_PLACEHOLDERS.products.length
    ]
  );
}

export function buildProductGallery(options: {
  product: CatalogPayload["products"]["all"][number];
  fallbackImage?: string | null;
  title?: string | null;
  maxItems?: number;
}): ProductGalleryImage[] {
  const title = options.title?.trim() || options.product.name || "Product";
  const galleryEntries = normalizeGalleryEntries(options.product.gallery);
  const primaryEntry = galleryEntries.find((entry) => entry.isPrimary);
  const candidates: Array<{ src: string; alt?: string | null }> = [];
  const seen = new Set<string>();
  const pushCandidate = (src?: string | null, alt?: string | null) => {
    const trimmed = src?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push({ src: trimmed, alt: alt ?? null });
  };
  if (primaryEntry) {
    pushCandidate(primaryEntry.src, primaryEntry.alt ?? null);
  }
  const coverImage = options.product.coverImageUrl?.trim();
  if (coverImage && (!primaryEntry || primaryEntry.src !== coverImage)) {
    pushCandidate(coverImage, primaryEntry?.alt ?? null);
  }
  galleryEntries.forEach((entry) => {
    pushCandidate(entry.src, entry.alt ?? null);
  });
  if (!candidates.length && options.fallbackImage) {
    pushCandidate(options.fallbackImage, null);
  }
  if (!candidates.length) {
    WEBSITE_MEDIA_PLACEHOLDERS.products.forEach((src) => {
      pushCandidate(src, null);
    });
  }
  const capped = candidates.slice(0, options.maxItems ?? 5);
  return capped.map((entry, index) => ({
    id: `${options.product.id}-image-${index + 1}`,
    src: entry.src,
    alt: buildProductImageAlt({
      explicitAlt: entry.alt ?? null,
      name: title,
      category: options.product.category,
      index,
    }),
  }));
}

type VariantOptionValue = {
  id: string;
  label: string;
  enabled: boolean;
  swatch?: string | null;
  priceAdjustmentCents?: number | null;
};

export function resolveVariantOptions(
  schema: unknown,
  optionConfig?: unknown,
): {
  colors: Array<ProductColorOption & { disabled?: boolean }>;
  sizes: Array<{ id: string; label: string; disabled?: boolean }>;
  custom: Array<{
    id: string;
    name: string;
    values: Array<{
      id: string;
      label: string;
      disabled?: boolean;
      priceAdjustmentCents?: number | null;
    }>;
  }>;
} {
  const normalizedConfig = normalizeProductOptionConfig(optionConfig);
  if (
    normalizedConfig.colors.length ||
    normalizedConfig.sizes.length ||
    normalizedConfig.options.length
  ) {
    return {
      colors: normalizedConfig.colors.map((option, index) => ({
        id: option.id,
        label: option.label,
        swatch: option.swatch ?? resolveSwatch(option.label, index),
        disabled: option.enabled === false,
      })),
      sizes: normalizedConfig.sizes.map((option) => ({
        id: option.id,
        label: option.label,
        disabled: option.enabled === false,
      })),
      custom: normalizedConfig.options
        .map((group) => ({
          id: group.id,
          name: group.name,
          values: group.values
            .map((value) => ({
              id: value.id,
              label: value.label,
              disabled: value.enabled === false,
              priceAdjustmentCents: value.priceAdjustmentCents ?? null,
            }))
            .filter((value) => value.label.trim().length > 0),
        }))
        .filter((group) => group.values.length > 0 && group.name.trim().length > 0),
    };
  }

  const fields = normalizeVariantFields(schema);
  const colors: string[] = [];
  const sizes: string[] = [];

  fields.forEach((field) => {
    const label = `${field.id} ${field.label}`.toLowerCase();
    if (VARIANT_COLOR_KEYS.some((key) => label.includes(key))) {
      colors.push(...field.options);
      return;
    }
    if (VARIANT_SIZE_KEYS.some((key) => label.includes(key))) {
      sizes.push(...field.options);
    }
  });

  const uniqueColors = Array.from(
    colors.reduce((set, value) => {
      const cleaned = value.trim();
      if (cleaned) set.add(cleaned);
      return set;
    }, new Set<string>()),
  );
  const uniqueSizes = Array.from(
    sizes.reduce((set, value) => {
      const cleaned = value.trim();
      if (cleaned) set.add(cleaned);
      return set;
    }, new Set<string>()),
  );

  return {
    colors: uniqueColors.map((label, index) => ({
      id: slugify(label) || `color-${index + 1}`,
      label,
      swatch: resolveSwatch(label, index),
    })),
    sizes: uniqueSizes.map((label, index) => ({
      id: slugify(label) || `size-${index + 1}`,
      label,
    })),
    custom: [],
  };
}

function resolveUnitAmountCents(options: {
  saleMode: CatalogPayload["products"]["all"][number]["saleMode"];
  priceTTCCents: number | null;
  priceHTCents: number | null;
  vatRate: number | null;
  adjustmentCents?: number | null;
  discountRate?: number | null;
  discountAmountCents?: number | null;
}) {
  return computeAdjustedUnitPriceTTCCents({
    saleMode: options.saleMode,
    priceTTCCents: options.priceTTCCents,
    priceHTCents: options.priceHTCents,
    vatRate: options.vatRate,
    adjustmentCents: options.adjustmentCents,
    discountRate: options.discountRate ?? null,
    discountAmountCents: options.discountAmountCents ?? null,
  });
}

export function formatCisecoPrice(options: {
  saleMode: CatalogPayload["products"]["all"][number]["saleMode"];
  showPrices: boolean;
  amountCents?: number | null;
}) {
  if (options.saleMode === "QUOTE" || !options.showPrices) {
    return DEFAULT_PRICE_LABEL;
  }
  if (options.amountCents != null) {
    return formatCurrency(
      fromCents(options.amountCents, CISECO_CURRENCY_CODE),
      CISECO_CURRENCY_CODE,
    );
  }
  return DEFAULT_PRICE_LABEL;
}

export function buildHomeProducts(options: {
  products: CatalogPayload["products"]["all"];
  showPrices: boolean;
}): HomeProduct[] {
  if (!options.products.length) return [];
  return options.products.map((product, index) => {
    const category = formatCisecoLabel(product.category, "General");
    const rating = Math.max(4.3, 4.9 - index * 0.06);
    const unitPriceHTCents =
      product.saleMode === "INSTANT" ? product.priceHTCents : null;
    const vatRate = product.saleMode === "INSTANT" ? product.vatRate : null;
    const discount = resolveProductDiscount(product);
    const unitAmountCents = resolveUnitAmountCents({
      saleMode: product.saleMode,
      priceTTCCents: product.priceTTCCents ?? null,
      priceHTCents: unitPriceHTCents,
      vatRate,
      discountRate: discount.discountRate,
      discountAmountCents: discount.discountAmountCents,
    });
    return {
      id: product.id,
      name: product.name,
      category,
      price: formatCisecoPrice({
        saleMode: product.saleMode,
        showPrices: options.showPrices,
        amountCents: unitAmountCents,
      }),
      rating: Number(rating.toFixed(1)),
      image: resolveProductImage(product, index),
      colors: SWATCH_PALETTES[index % SWATCH_PALETTES.length],
      badge: index < 2 ? "New" : index === 2 ? "Featured" : undefined,
      slug: resolveProductSlug(product),
      saleMode: product.saleMode,
      unitAmountCents,
      unitPriceHTCents,
      vatRate,
      discountRate: discount.discountRate,
      discountAmountCents: discount.discountAmountCents,
      currencyCode: CISECO_CURRENCY_CODE,
    };
  });
}

export function buildCartCatalogProducts(options: {
  products: CatalogPayload["products"]["all"];
  showPrices: boolean;
}): CartProduct[] {
  if (!options.products.length) return [];
  return options.products.map((product, index) => {
    const unitPriceHTCents =
      product.saleMode === "INSTANT" ? product.priceHTCents : null;
    const vatRate = product.saleMode === "INSTANT" ? product.vatRate : null;
    const discount = resolveProductDiscount(product);
    const unitAmountCents = resolveUnitAmountCents({
      saleMode: product.saleMode,
      priceTTCCents: product.priceTTCCents ?? null,
      priceHTCents: unitPriceHTCents,
      vatRate,
      discountRate: discount.discountRate,
      discountAmountCents: discount.discountAmountCents,
    });

    return {
      id: product.id,
      title: product.name,
      price: formatCisecoPrice({
        saleMode: product.saleMode,
        showPrices: options.showPrices,
        amountCents: unitAmountCents,
      }),
      unitAmountCents,
      unitPriceHTCents,
      vatRate,
      discountRate: discount.discountRate,
      discountAmountCents: discount.discountAmountCents,
      currencyCode: CISECO_CURRENCY_CODE,
      image: resolveProductImage(product, index),
      tag: formatCisecoLabel(product.category, "General"),
      slug: resolveProductSlug(product),
      saleMode: product.saleMode,
    };
  });
}

export function toCartProduct(product: HomeProduct): CartProduct {
  return {
    id: product.id,
    title: product.name,
    price: product.price,
    unitAmountCents: product.unitAmountCents,
    unitPriceHTCents: product.unitPriceHTCents,
    vatRate: product.vatRate,
    discountRate: product.discountRate,
    discountAmountCents: product.discountAmountCents,
    currencyCode: product.currencyCode,
    image: product.image,
    tag: product.category,
    slug: product.slug,
    saleMode: product.saleMode,
  };
}

export function buildCategoryFilters(
  products: HomeProduct[],
  options?: { includeAll?: boolean },
) {
  const entries = new Map<string, string>();
  products.forEach((product) => {
    const category = product.category?.trim();
    if (!category) return;
    const key = category.toLowerCase();
    if (!entries.has(key)) {
      entries.set(key, category);
    }
  });
  const categories = Array.from(entries.values()).sort((left, right) =>
    left.localeCompare(right),
  );
  if (options?.includeAll) {
    return ["All", ...categories];
  }
  return categories;
}
