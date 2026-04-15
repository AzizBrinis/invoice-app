import { describe, expect, it } from "vitest";
import { buildCollectionCatalogItems } from "@/components/website/templates/ecommerce-ciseco/collections";
import { buildHomeProducts } from "@/components/website/templates/ecommerce-ciseco/utils";
import type { CatalogPayload } from "@/server/website";

function createCatalogProduct(
  overrides: Partial<CatalogPayload["products"]["all"][number]> = {},
): CatalogPayload["products"]["all"][number] {
  return {
    id: "product-1",
    name: "Oak Chair",
    description: null,
    descriptionHtml: null,
    shortDescriptionHtml: null,
    excerpt: null,
    metaTitle: null,
    metaDescription: null,
    coverImageUrl: null,
    gallery: null,
    faqItems: null,
    quoteFormSchema: null,
    optionConfig: null,
    variantStock: null,
    category: "Living",
    unit: "piece",
    stockQuantity: 3,
    priceHTCents: 120000,
    priceTTCCents: 142800,
    vatRate: 0.19,
    defaultDiscountRate: null,
    defaultDiscountAmountCents: null,
    sku: "oak-chair",
    publicSlug: "oak-chair",
    saleMode: "INSTANT",
    isActive: true,
    createdAt: "2026-04-01T00:00:00.000Z",
    reviews: [],
    ...overrides,
  };
}

describe("ciseco product review mappers", () => {
  it("buildHomeProducts uses approved product reviews instead of synthetic card data", () => {
    const products = buildHomeProducts({
      products: [
        createCatalogProduct({
          id: "reviewed-product",
          reviews: [
            {
              id: "review-1",
              productId: "reviewed-product",
              authorName: "Amina",
              rating: 5,
              title: "Excellent",
              body: "Solid build quality.",
              createdAt: "2026-04-10T00:00:00.000Z",
            },
            {
              id: "review-2",
              productId: "reviewed-product",
              authorName: "Sami",
              rating: 4,
              title: null,
              body: "Comfortable for daily use.",
              createdAt: "2026-04-11T00:00:00.000Z",
            },
            {
              id: "review-3",
              productId: "reviewed-product",
              authorName: "Bad Data",
              rating: 8,
              title: null,
              body: "Should be ignored.",
              createdAt: "2026-04-12T00:00:00.000Z",
            },
          ],
        }),
        createCatalogProduct({
          id: "unreviewed-product",
          publicSlug: "unreviewed-product",
          sku: "unreviewed-product",
          reviews: [],
        }),
      ],
      showPrices: true,
    });

    expect(products[0]).toMatchObject({
      id: "reviewed-product",
      rating: 4.5,
      reviewCount: 2,
      colors: [],
    });
    expect(products[1]).toMatchObject({
      id: "unreviewed-product",
      rating: null,
      reviewCount: 0,
      colors: [],
    });
  });

  it("buildCollectionCatalogItems carries real review aggregates into collection cards", () => {
    const items = buildCollectionCatalogItems({
      products: {
        featured: [],
        all: [
          createCatalogProduct({
            id: "reviewed-product",
            reviews: [
              {
                id: "review-1",
                productId: "reviewed-product",
                authorName: "Amina",
                rating: 5,
                title: "Excellent",
                body: "Solid build quality.",
                createdAt: "2026-04-10T00:00:00.000Z",
              },
            ],
          }),
          createCatalogProduct({
            id: "plain-product",
            publicSlug: "plain-product",
            sku: "plain-product",
            reviews: [],
          }),
        ],
      },
      showPrices: true,
    });

    expect(items.find((item) => item.id === "plain-product")).toMatchObject({
      id: "plain-product",
      rating: null,
      reviewCount: 0,
    });
    expect(items.find((item) => item.id === "reviewed-product")).toMatchObject({
      id: "reviewed-product",
      rating: 5,
      reviewCount: 1,
    });
  });
});
