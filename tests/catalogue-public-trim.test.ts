import { describe, expect, it } from "vitest";
import { trimCatalogProductForListing } from "@/lib/catalogue-public";
import type { CatalogProduct, CatalogWebsiteSummary } from "@/server/website";

const WEBSITE = {
  slug: "demo",
} as CatalogWebsiteSummary;

const PRODUCT: CatalogProduct = {
  id: "product-1",
  name: "Demo product",
  description: "Demo",
  descriptionHtml: "<p>Demo</p>",
  shortDescriptionHtml: null,
  excerpt: null,
  metaTitle: null,
  metaDescription: null,
  coverImageUrl: "/demo.jpg",
  gallery: [{ src: "/gallery.jpg" }],
  faqItems: [{ question: "Q", answer: "A" }],
  quoteFormSchema: {
    fields: [
      {
        id: "color",
        label: "Color",
        options: ["Oak"],
      },
    ],
  },
  optionConfig: {
    colors: [
      {
        id: "oak",
        label: "Oak",
        swatch: "#b08968",
        enabled: true,
      },
    ],
    sizes: [],
    options: [],
  },
  variantStock: [{ sku: "oak", quantity: 4 }],
  category: "Living",
  unit: "piece",
  stockQuantity: 4,
  priceHTCents: 10000,
  priceTTCCents: 11900,
  vatRate: 0.19,
  defaultDiscountRate: null,
  defaultDiscountAmountCents: null,
  sku: "SKU-1",
  publicSlug: "demo-product",
  saleMode: "INSTANT",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("public catalog payload trimming", () => {
  it("preserves lightweight filter metadata for collection listings", () => {
    const trimmed = trimCatalogProductForListing(PRODUCT, WEBSITE);

    expect(trimmed.optionConfig).toEqual(PRODUCT.optionConfig);
    expect(trimmed.quoteFormSchema).toBeNull();
    expect(trimmed.gallery).toBeNull();
    expect(trimmed.faqItems).toBeNull();
  });

  it("keeps quote form schema when no option config exists", () => {
    const trimmed = trimCatalogProductForListing(
      {
        ...PRODUCT,
        optionConfig: null,
      },
      WEBSITE,
    );

    expect(trimmed.optionConfig).toBeNull();
    expect(trimmed.quoteFormSchema).toEqual(PRODUCT.quoteFormSchema);
  });
});
