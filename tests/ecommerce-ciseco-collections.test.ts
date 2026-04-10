import { describe, expect, it } from "vitest";
import {
  buildPaginationSequence,
  filterCollectionCatalogItems,
  normalizeCollectionSort,
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
    image: "/alpha.jpg",
    saleMode: "INSTANT",
    unitAmountCents: 12000,
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
    image: "/beta.jpg",
    saleMode: "INSTANT",
    unitAmountCents: 8000,
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
      minPriceCents: 10000,
      maxPriceCents: 15000,
    });

    expect(filtered.map((item) => item.id)).toEqual(["p1"]);
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
