import { describe, expect, it } from "vitest";
import {
  buildPaginationSequence,
  buildCollectionQueryParams,
  filterCollectionCatalogItems,
  normalizeCollectionPriceInput,
  normalizeCollectionSort,
  parseCollectionPriceToCents,
  paginateCollectionCatalogItems,
  sortCollectionCatalogItems,
  type CollectionCatalogItem,
} from "@/components/website/templates/ecommerce-ciseco/collections";
import { resolveCisecoPageKey } from "@/lib/website/ciseco-pages";

const ITEMS: CollectionCatalogItem[] = [
  {
    id: "p1",
    name: "Alpha Chair",
    slug: "alpha-chair",
    categoryLabel: "Living",
    categorySlug: "living",
    price: "120 TND",
    rating: 4.7,
    reviewCount: 5,
    image: "/alpha.jpg",
    saleMode: "INSTANT",
    unitAmountCents: 120000,
    stockQuantity: 4,
    createdAtMs: 100,
    cartProduct: null,
    colorOptions: [{ id: "oak", label: "Oak", swatch: "#b08968" }],
    sizeOptions: [{ id: "m", label: "M" }],
    isFeatured: true,
  },
  {
    id: "p2",
    name: "Beta Lamp",
    slug: "beta-lamp",
    categoryLabel: "Lighting",
    categorySlug: "lighting",
    price: "80 TND",
    rating: null,
    reviewCount: 0,
    image: "/beta.jpg",
    saleMode: "INSTANT",
    unitAmountCents: 80000,
    stockQuantity: 2,
    createdAtMs: 250,
    cartProduct: null,
    colorOptions: [{ id: "sand", label: "Sand", swatch: "#d6bfa7" }],
    sizeOptions: [{ id: "s", label: "S" }],
    isFeatured: false,
  },
  {
    id: "p3",
    name: "Gamma Sofa",
    slug: "gamma-sofa",
    categoryLabel: "Living",
    categorySlug: "living",
    price: "Price on request",
    rating: 4.2,
    reviewCount: 2,
    image: "/gamma.jpg",
    saleMode: "QUOTE",
    unitAmountCents: null,
    stockQuantity: null,
    cartProduct: null,
    createdAtMs: 180,
    colorOptions: [{ id: "oak", label: "Oak", swatch: "#b08968" }],
    sizeOptions: [{ id: "l", label: "L" }],
    isFeatured: false,
  },
];

describe("ciseco collections helpers", () => {
  it("normalizes the sort value", () => {
    expect(normalizeCollectionSort("newest")).toBe("newest");
    expect(normalizeCollectionSort("invalid")).toBe("featured");
    expect(normalizeCollectionSort(null)).toBe("featured");
  });

  it("filters using real collection, color, size, and price facets", () => {
    const filtered = filterCollectionCatalogItems(ITEMS, {
      collectionSlug: "living",
      colorIds: ["oak"],
      sizeIds: ["m"],
      minPriceCents: 100000,
      maxPriceCents: 150000,
    });

    expect(filtered.map((item) => item.id)).toEqual(["p1"]);
  });

  it("normalizes flexible price inputs before filtering", () => {
    expect(normalizeCollectionPriceInput(" 1 500,5 ")).toBe("1500.5");
    expect(normalizeCollectionPriceInput("TND 1,500.50")).toBe("1500.50");
    expect(normalizeCollectionPriceInput("TND 1,500.500")).toBe("1500.500");
    expect(parseCollectionPriceToCents("1500.50")).toBe(1500500);
    expect(normalizeCollectionPriceInput("abc")).toBe("");
  });

  it("builds canonical collection query params without stale page data", () => {
    const params = buildCollectionQueryParams({
      currentSearchParams: new URLSearchParams(
        "lang=en&q=chair&page=4&color=oak&size=m",
      ),
      baseSearchParams: new URLSearchParams("path=%2Fcollections"),
      state: {
        colorIds: ["oak"],
        sizeIds: [],
        minPrice: "120",
        maxPrice: "",
        sort: "price-low-high",
        page: 2,
      },
    });

    expect(params.toString()).toBe(
      "lang=en&path=%2Fcollections&color=oak&sort=price-low-high&minPrice=120&page=2",
    );
  });

  it("sorts featured and price-based views consistently", () => {
    expect(sortCollectionCatalogItems(ITEMS, "featured").map((item) => item.id)).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
    expect(
      sortCollectionCatalogItems(ITEMS, "price-low-high").map((item) => item.id),
    ).toEqual(["p2", "p1", "p3"]);
    expect(
      sortCollectionCatalogItems(ITEMS, "price-high-low").map((item) => item.id),
    ).toEqual(["p1", "p2", "p3"]);
  });

  it("clamps pagination and builds compact page sequences", () => {
    const pagination = paginateCollectionCatalogItems(ITEMS, 5, 2);

    expect(pagination.page).toBe(2);
    expect(pagination.pageCount).toBe(2);
    expect(pagination.items.map((item) => item.id)).toEqual(["p3"]);
    expect(buildPaginationSequence(5, 10)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      10,
    ]);
  });

  it("resolves deep-linked Ciseco page keys", () => {
    expect(resolveCisecoPageKey("collections")).toBe("collections");
    expect(resolveCisecoPageKey("home")).toBe("home");
    expect(resolveCisecoPageKey("unknown")).toBeNull();
  });
});
