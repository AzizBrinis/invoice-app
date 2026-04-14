import type { CartProduct } from "@/components/website/cart/cart-context";
import { slugify } from "@/lib/slug";
import type { CatalogPayload } from "@/server/website";
import { formatCisecoLabel, buildHomeProducts, resolveVariantOptions, toCartProduct } from "./utils";
import type { ProductColorOption } from "./types";

export const COLLECTIONS_PAGE_SIZE = 12;

export const COLLECTION_SORT_OPTIONS = [
  { id: "featured", label: "Most Popular" },
  { id: "newest", label: "Newest" },
  { id: "price-low-high", label: "Price Low - High" },
  { id: "price-high-low", label: "Price High - Low" },
  { id: "name-a-z", label: "Name (A-Z)" },
] as const;

export type CollectionSortValue = (typeof COLLECTION_SORT_OPTIONS)[number]["id"];

export type CollectionFacetOption = {
  id: string;
  label: string;
  count: number;
  swatch?: string;
};

export type CollectionCatalogItem = {
  id: string;
  name: string;
  slug: string;
  categoryLabel: string;
  categorySlug: string;
  price: string;
  image: string;
  saleMode: CatalogPayload["products"]["all"][number]["saleMode"];
  unitAmountCents: number | null;
  stockQuantity: number | null;
  createdAtMs: number;
  cartProduct: CartProduct | null;
  colorOptions: Array<ProductColorOption & { disabled?: boolean }>;
  sizeOptions: Array<{ id: string; label: string; disabled?: boolean }>;
  isFeatured: boolean;
};

export type CollectionFilterInput = {
  collectionSlug?: string | null;
  colorIds?: string[];
  sizeIds?: string[];
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
};

export type CollectionQueryState = {
  colorIds: string[];
  sizeIds: string[];
  minPrice: string;
  maxPrice: string;
  sort: CollectionSortValue;
  page: number;
};

const COLLECTION_PERSISTED_QUERY_KEYS = ["lang", "domain"] as const;

export function normalizeCollectionSort(
  value?: string | null,
): CollectionSortValue {
  return COLLECTION_SORT_OPTIONS.some((entry) => entry.id === value)
    ? (value as CollectionSortValue)
    : "featured";
}

export function parseCollectionPageValue(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.floor(parsed));
}

export function normalizeCollectionFacetValues(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

export function normalizeCollectionPriceInput(value: string | null) {
  if (!value) {
    return "";
  }

  const compact = value.trim().replace(/\s+/g, "");
  if (!compact) {
    return "";
  }

  const sanitized = compact.replace(/[^0-9,.-]/g, "");
  const signless = sanitized.startsWith("-") ? sanitized.slice(1) : sanitized;
  const lastCommaIndex = signless.lastIndexOf(",");
  const lastDotIndex = signless.lastIndexOf(".");
  const decimalIndex = Math.max(lastCommaIndex, lastDotIndex);

  let integerPart = signless;
  let fractionPart = "";

  if (decimalIndex >= 0) {
    integerPart = signless.slice(0, decimalIndex);
    fractionPart = signless.slice(decimalIndex + 1);
  }

  const normalizedInteger = integerPart.replace(/[.,]/g, "");
  const normalizedFraction = fractionPart.replace(/[.,]/g, "").slice(0, 2);

  if (!/^\d*$/.test(normalizedInteger) || !/^\d*$/.test(normalizedFraction)) {
    return "";
  }

  if (!normalizedInteger && !normalizedFraction) {
    return "";
  }

  const canonicalInteger = normalizedInteger.length > 0 ? normalizedInteger : "0";
  return normalizedFraction.length > 0
    ? `${canonicalInteger}.${normalizedFraction}`
    : canonicalInteger;
}

export function parseCollectionPriceToCents(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

export function buildCollectionQueryParams(options: {
  currentSearchParams: URLSearchParams;
  baseSearchParams?: URLSearchParams;
  state: CollectionQueryState;
}) {
  const params = new URLSearchParams();

  COLLECTION_PERSISTED_QUERY_KEYS.forEach((key) => {
    const values = options.currentSearchParams.getAll(key);
    if (!values.length) {
      return;
    }
    values.forEach((value) => {
      params.append(key, value);
    });
  });

  options.baseSearchParams?.forEach((value, key) => {
    params.set(key, value);
  });

  params.delete("color");
  options.state.colorIds.forEach((value) => {
    params.append("color", value);
  });

  params.delete("size");
  options.state.sizeIds.forEach((value) => {
    params.append("size", value);
  });

  if (options.state.sort !== "featured") {
    params.set("sort", options.state.sort);
  } else {
    params.delete("sort");
  }

  if (options.state.minPrice) {
    params.set("minPrice", options.state.minPrice);
  } else {
    params.delete("minPrice");
  }

  if (options.state.maxPrice) {
    params.set("maxPrice", options.state.maxPrice);
  } else {
    params.delete("maxPrice");
  }

  if (options.state.page > 1) {
    params.set("page", String(options.state.page));
  } else {
    params.delete("page");
  }

  return params;
}

export function buildCollectionCatalogItems(options: {
  products: CatalogPayload["products"] | null;
  showPrices: boolean;
}): CollectionCatalogItem[] {
  const productSource = Array.isArray(options.products?.all)
    ? options.products.all
    : [];
  if (!productSource.length) {
    return [];
  }

  const homeProducts = buildHomeProducts({
    products: productSource,
    showPrices: options.showPrices,
  });
  const homeProductMap = new Map(
    homeProducts.map((product) => [product.id, product]),
  );
  const featuredIds = new Set(
    Array.isArray(options.products?.featured)
      ? options.products.featured.map((product) => product.id)
      : [],
  );

  return productSource.flatMap((product) => {
    const homeProduct = homeProductMap.get(product.id);
    if (!homeProduct) {
      return [];
    }

    const variantOptions = resolveVariantOptions(
      product.quoteFormSchema,
      product.optionConfig,
    );
    const categoryLabel = formatCisecoLabel(product.category, "General");
    const categorySlug = slugify(categoryLabel) || "general";
    const createdAtMs = resolveCollectionCreatedAtMs(product.createdAt);
    const cartProduct =
      product.saleMode === "INSTANT" && product.stockQuantity !== 0
        ? toCartProduct(homeProduct)
        : null;

    return [
      {
        id: product.id,
        name: homeProduct.name,
        slug: homeProduct.slug,
        categoryLabel,
        categorySlug,
        price: homeProduct.price,
        image: homeProduct.image,
        saleMode: product.saleMode,
        unitAmountCents: homeProduct.unitAmountCents,
        stockQuantity: product.stockQuantity,
        createdAtMs,
        cartProduct,
        colorOptions: variantOptions.colors.filter(
          (option) => option.disabled !== true,
        ),
        sizeOptions: variantOptions.sizes.filter(
          (option) => option.disabled !== true,
        ),
        isFeatured: featuredIds.has(product.id),
      } satisfies CollectionCatalogItem,
    ];
  });
}

export function buildCollectionFacets(items: CollectionCatalogItem[]) {
  const collections = new Map<string, CollectionFacetOption>();
  const colors = new Map<string, CollectionFacetOption>();
  const sizes = new Map<string, CollectionFacetOption>();

  items.forEach((item) => {
    incrementFacetMap(collections, {
      id: item.categorySlug,
      label: item.categoryLabel,
    });

    item.colorOptions.forEach((color) => {
      incrementFacetMap(colors, {
        id: color.id,
        label: color.label,
        swatch: color.swatch,
      });
    });

    item.sizeOptions.forEach((size) => {
      incrementFacetMap(sizes, {
        id: size.id,
        label: size.label,
      });
    });
  });

  return {
    collections: sortFacetOptions(collections),
    colors: sortFacetOptions(colors),
    sizes: sortFacetOptions(sizes, { numericFirst: true }),
  };
}

export function filterCollectionCatalogItems(
  items: CollectionCatalogItem[],
  filters: CollectionFilterInput,
) {
  const selectedColors = new Set(filters.colorIds ?? []);
  const selectedSizes = new Set(filters.sizeIds ?? []);

  return items.filter((item) => {
    if (filters.collectionSlug && item.categorySlug !== filters.collectionSlug) {
      return false;
    }

    if (
      selectedColors.size > 0 &&
      !item.colorOptions.some((option) => selectedColors.has(option.id))
    ) {
      return false;
    }

    if (
      selectedSizes.size > 0 &&
      !item.sizeOptions.some((option) => selectedSizes.has(option.id))
    ) {
      return false;
    }

    if (filters.minPriceCents != null || filters.maxPriceCents != null) {
      if (item.unitAmountCents == null) {
        return false;
      }
      if (
        filters.minPriceCents != null &&
        item.unitAmountCents < filters.minPriceCents
      ) {
        return false;
      }
      if (
        filters.maxPriceCents != null &&
        item.unitAmountCents > filters.maxPriceCents
      ) {
        return false;
      }
    }

    return true;
  });
}

export function sortCollectionCatalogItems(
  items: CollectionCatalogItem[],
  sort: CollectionSortValue,
) {
  const sorted = [...items];

  sorted.sort((left, right) => {
    switch (sort) {
      case "newest": {
        return compareNumbers(right.createdAtMs, left.createdAtMs) || compareNames(left, right);
      }
      case "price-low-high": {
        return compareNullableNumbers(left.unitAmountCents, right.unitAmountCents) || compareNames(left, right);
      }
      case "price-high-low": {
        return compareNullableNumbersDescending(left.unitAmountCents, right.unitAmountCents) || compareNames(left, right);
      }
      case "name-a-z": {
        return compareNames(left, right);
      }
      case "featured":
      default: {
        return (
          compareNumbers(Number(right.isFeatured), Number(left.isFeatured)) ||
          compareNumbers(right.createdAtMs, left.createdAtMs) ||
          compareNames(left, right)
        );
      }
    }
  });

  return sorted;
}

export function paginateCollectionCatalogItems(
  items: CollectionCatalogItem[],
  requestedPage: number,
  pageSize = COLLECTIONS_PAGE_SIZE,
) {
  const total = items.length;
  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 1;
  const page = clampPage(requestedPage, pageCount);
  const startIndex = total > 0 ? (page - 1) * pageSize : 0;
  const endIndex = total > 0 ? Math.min(startIndex + pageSize, total) : 0;

  return {
    page,
    pageCount,
    startIndex,
    endIndex,
    items: items.slice(startIndex, endIndex),
    total,
  };
}

export function buildPaginationSequence(
  currentPage: number,
  pageCount: number,
): Array<number | "ellipsis"> {
  if (pageCount <= 1) {
    return [1];
  }

  const pages = new Set<number>([1, pageCount, currentPage]);

  for (let offset = 1; offset <= 1; offset += 1) {
    pages.add(clampPage(currentPage - offset, pageCount));
    pages.add(clampPage(currentPage + offset, pageCount));
  }

  const ordered = Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);
  const sequence: Array<number | "ellipsis"> = [];

  ordered.forEach((page, index) => {
    const previous = ordered[index - 1];
    if (previous && page - previous > 1) {
      sequence.push("ellipsis");
    }
    sequence.push(page);
  });

  return sequence;
}

function compareNames(left: CollectionCatalogItem, right: CollectionCatalogItem) {
  return left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  });
}

function compareNumbers(left: number, right: number) {
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return compareNumbers(left, right);
}

function compareNullableNumbersDescending(
  left: number | null,
  right: number | null,
) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return compareNumbers(right, left);
}

function clampPage(page: number, pageCount: number) {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.floor(page)), Math.max(pageCount, 1));
}

function resolveCollectionCreatedAtMs(value: string | Date | undefined) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function incrementFacetMap(
  map: Map<string, CollectionFacetOption>,
  entry: Omit<CollectionFacetOption, "count">,
) {
  const existing = map.get(entry.id);
  if (existing) {
    existing.count += 1;
    return;
  }

  map.set(entry.id, {
    ...entry,
    count: 1,
  });
}

function sortFacetOptions(
  map: Map<string, CollectionFacetOption>,
  options?: { numericFirst?: boolean },
) {
  return Array.from(map.values()).sort((left, right) => {
    if (options?.numericFirst) {
      const leftNumber = Number(left.label);
      const rightNumber = Number(right.label);
      const leftIsNumber = Number.isFinite(leftNumber);
      const rightIsNumber = Number.isFinite(rightNumber);

      if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      if (leftIsNumber !== rightIsNumber) {
        return leftIsNumber ? -1 : 1;
      }
    }

    return left.label.localeCompare(right.label, undefined, {
      sensitivity: "base",
    });
  });
}
