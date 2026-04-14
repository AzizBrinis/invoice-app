import { describe, expect, it, vi } from "vitest";
import { WebsiteDomainStatus } from "@/lib/db/prisma";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

import {
  createDefaultBuilderConfig,
  ensureCisecoPageConfigs,
} from "@/lib/website/builder";
import {
  resolveCatalogMetadata,
  resolveCatalogStructuredData,
  type CatalogPayload,
} from "@/server/website";

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
      slug: "acme",
      customDomain: null,
      domainStatus: WebsiteDomainStatus.PENDING,
      templateKey: "ecommerce-ciseco-home",
      showPrices: true,
      currencyCode: "TND",
      ecommerceSettings: {
        payments: {
          methods: {
            card: false,
            bankTransfer: false,
            cashOnDelivery: false,
          },
          bankTransfer: {
            instructions: "",
          },
        },
        checkout: {
          requirePhone: false,
          allowNotes: true,
          termsUrl: "",
        },
        shipping: {
          countryCode: "TN",
          rate: 7,
          handlingMinDays: 0,
          handlingMaxDays: 1,
          transitMinDays: 1,
          transitMaxDays: 3,
        },
        returns: {
          countryCode: "TN",
          policyCategory: "FINITE",
          merchantReturnDays: 14,
          returnFees: "FREE",
          returnMethod: "BY_MAIL",
          returnShippingFeesAmount: null,
        },
        featuredProductIds: [],
        signup: {
          redirectTarget: "home",
          providers: {
            facebook: {
              enabled: false,
              useEnv: true,
              clientId: null,
              clientSecret: null,
            },
            google: {
              enabled: false,
              useEnv: true,
              clientId: null,
              clientSecret: null,
            },
            twitter: {
              enabled: false,
              useEnv: true,
              clientId: null,
              clientSecret: null,
            },
          },
        },
      },
      builder,
      contact: {
        companyName: "Acme Store",
        address: "Tunis, Tunisie",
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
          faqItems: [
            {
              question: "Livrez-vous en Tunisie ?",
              answer: "Oui, la livraison est disponible partout en Tunisie.",
            },
          ],
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

    expect(metadata.title).toBe("Chaise Design en Tunisie — Acme Store");
    expect(metadata.description).toContain("Confort premium pour votre bureau.");
    expect(metadata.description).toContain("prix en TND");
    expect(metadata.keywords).toContain("Tunisie");
  });

  it("builds product, breadcrumb, and faq structured data", () => {
    const payload = createPayload();
    payload.website.builder.pages.product = {
      ...payload.website.builder.pages.product,
      seo: {
        title: "",
        description: "",
      },
    };

    const structuredData = resolveCatalogStructuredData({
      payload: payload as unknown as CatalogPayload,
      path: "/produit/chaise-design",
    });

    expect(structuredData).toHaveLength(4);
    expect(structuredData[0]).toMatchObject({
      "@type": "BreadcrumbList",
    });
    expect(structuredData[1]).toMatchObject({
      "@type": "Product",
      name: "Chaise Design",
      sku: "CHAIR-001",
    });
    expect(
      (structuredData[1] as { offers?: unknown } | undefined)?.offers,
    ).toMatchObject({
      "@type": "Offer",
      priceCurrency: "TND",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "TN",
        },
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "7.00",
          currency: "TND",
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "TN",
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnFees: "https://schema.org/FreeReturn",
        returnMethod: "https://schema.org/ReturnByMail",
      },
      eligibleRegion: {
        "@type": "Country",
        name: "Tunisie",
      },
    });
    expect(structuredData[1]).not.toHaveProperty("aggregateRating");
    expect(structuredData[1]).not.toHaveProperty("review");
    expect(structuredData[2]).toMatchObject({
      "@type": "Organization",
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "TN",
      },
    });
    expect(structuredData[3]).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Livrez-vous en Tunisie ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Oui, la livraison est disponible partout en Tunisie.",
          },
        },
      ],
    });
  });

  it("omits merchant shipping and return fields when policy data is incomplete", () => {
    const payload = createPayload();
    payload.website.ecommerceSettings.shipping = {
      countryCode: "TN",
      rate: null,
      handlingMinDays: null,
      handlingMaxDays: null,
      transitMinDays: null,
      transitMaxDays: null,
    };
    payload.website.ecommerceSettings.returns = {
      countryCode: "TN",
      policyCategory: null,
      merchantReturnDays: null,
      returnFees: null,
      returnMethod: null,
      returnShippingFeesAmount: null,
    };
    payload.website.ecommerceSettings.checkout.termsUrl = "/conditions-generales";

    const structuredData = resolveCatalogStructuredData({
      payload: payload as unknown as CatalogPayload,
      path: "/produit/chaise-design",
    });

    expect(
      (structuredData[1] as { offers?: Record<string, unknown> } | undefined)
        ?.offers,
    ).not.toHaveProperty("shippingDetails");
    expect(
      (structuredData[1] as { offers?: Record<string, unknown> } | undefined)
        ?.offers,
    ).toMatchObject({
      hasMerchantReturnPolicy: {
        "@id": "http://localhost:3000/conditions-generales#policy",
      },
    });
    expect(structuredData[2]).toMatchObject({
      "@type": "Organization",
      hasMerchantReturnPolicy: {
        "@id": "http://localhost:3000/conditions-generales#policy",
        merchantReturnLink: "http://localhost:3000/conditions-generales",
      },
    });
  });

  it("falls back to digital delivery shipping details when product copy verifies it", () => {
    const payload = createPayload();
    payload.website.ecommerceSettings.shipping = {
      countryCode: "TN",
      rate: null,
      handlingMinDays: null,
      handlingMaxDays: null,
      transitMinDays: null,
      transitMaxDays: null,
    };
    payload.website.metadata.description =
      "Accès immédiat à vos licences Microsoft en Tunisie avec livraison par email en 24h max.";
    payload.products.all[0] = {
      ...payload.products.all[0],
      name: "Windows 11 Professionnel (Téléchargement numérique)",
      description:
        "Code d'activation envoyé par email. Pas de frais de livraison.",
      category: "Software",
      faqItems: [
        {
          question: "Ce produit est-il livré en version physique ou numérique ?",
          answer:
            "Il s’agit d’un téléchargement numérique envoyé par email après validation.",
        },
      ],
    };

    const structuredData = resolveCatalogStructuredData({
      payload: payload as unknown as CatalogPayload,
      path: "/produit/chaise-design",
    });

    expect(
      (structuredData[1] as { offers?: Record<string, unknown> } | undefined)
        ?.offers,
    ).toMatchObject({
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "TN",
        },
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0.00",
          currency: "TND",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 1,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 0,
            unitCode: "DAY",
          },
        },
      },
    });
  });
});
