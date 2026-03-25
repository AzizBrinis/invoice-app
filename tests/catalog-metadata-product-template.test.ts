import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  createDefaultBuilderConfig,
  ensureCisecoPageConfigs,
} from "@/lib/website/builder";
import { resolveCatalogMetadata, type CatalogPayload } from "@/server/website";

function createBaseBuilder() {
  return ensureCisecoPageConfigs(
    createDefaultBuilderConfig({
      heroTitle: "Demo",
    }),
    { override: true },
  );
}

function createPayload() {
  const builder = createBaseBuilder();
  builder.pages.product = {
    ...builder.pages.product,
    seo: {
      ...builder.pages.product.seo,
      title: "{{product.name}} | {{site.name}}",
      description:
        "Découvrez {{product.name}} ({{product.category}}) sur {{company.name}}.",
    },
  };

  return {
    website: {
      templateKey: "ecommerce-ciseco-home",
      builder,
      contact: {
        companyName: "Acme Store",
      },
      metadata: {
        title: "Catalogue Acme",
        description: "Découvrez nos produits.",
        canonicalUrl: "https://example.com/catalogue/acme",
        socialImageUrl: null,
        keywords: null,
      },
    },
    products: {
      featured: [],
      all: [
        {
          id: "prod-1",
          name: "Chaise Design",
          description: "Une chaise ergonomique.",
          descriptionHtml: null,
          excerpt: "Confort premium pour votre bureau.",
          metaTitle: null,
          metaDescription: null,
          coverImageUrl: "https://example.com/chair.jpg",
          gallery: [],
          quoteFormSchema: null,
          optionConfig: null,
          variantStock: null,
          category: "Mobilier",
          unit: "pièce",
          stockQuantity: 10,
          priceHTCents: 10000,
          priceTTCCents: 11900,
          vatRate: 19,
          defaultDiscountRate: null,
          sku: "CHAIR-001",
          publicSlug: "chaise-design",
          saleMode: "INSTANT",
          isActive: true,
        },
      ],
    },
  } as const;
}

describe("catalog metadata - product seo templates", () => {
  it("applies product template tokens for ciseco product pages", () => {
    const payload = createPayload();

    const metadata = resolveCatalogMetadata({
      payload: payload as unknown as CatalogPayload,
      path: "/produit/chaise-design",
    });

    expect(metadata.title).toBe("Chaise Design | Acme Store");
    expect(metadata.description).toBe(
      "Découvrez Chaise Design (Mobilier) sur Acme Store.",
    );
  });

  it("falls back to product metadata when template fields are empty", () => {
    const payload = createPayload();
    payload.website.builder.pages.product = {
      ...payload.website.builder.pages.product,
      seo: {
        title: "",
        description: "",
      },
    };

    const metadata = resolveCatalogMetadata({
      payload: payload as unknown as CatalogPayload,
      path: "/produit/chaise-design",
    });

    expect(metadata.title).toBe("Chaise Design — Acme Store");
    expect(metadata.description).toBe("Confort premium pour votre bureau.");
  });
});
