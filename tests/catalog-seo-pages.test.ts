import { describe, expect, it, vi } from "vitest";
import { WebsiteDomainStatus, WebsiteThemeMode } from "@/lib/db/prisma";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

import {
  createDefaultBuilderConfig,
  ensureCisecoPageConfigs,
} from "@/lib/website/builder";
import {
  resolveCatalogSeo,
  resolveCatalogStructuredData,
  type CatalogPayload,
} from "@/server/website";

function createPayload(): CatalogPayload {
  const builder = ensureCisecoPageConfigs(
    createDefaultBuilderConfig({
      heroTitle: "Demo",
    }),
    { override: true },
  );

  return {
    website: {
      id: "website-demo",
      slug: "demo",
      templateKey: "ecommerce-ciseco-home",
      heroEyebrow: null,
      heroTitle: "Demo",
      heroSubtitle: null,
      heroPrimaryCtaLabel: "CTA",
      heroSecondaryCtaLabel: null,
      heroSecondaryCtaUrl: null,
      aboutTitle: null,
      aboutBody: null,
      contactBlurb: "Contact us anytime.",
      accentColor: "#22c55e",
      theme: WebsiteThemeMode.LIGHT,
      showPrices: true,
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
          countryCode: "",
          rate: null,
          handlingMinDays: null,
          handlingMaxDays: null,
          transitMinDays: null,
          transitMaxDays: null,
        },
        returns: {
          countryCode: "",
          policyCategory: null,
          merchantReturnDays: null,
          returnFees: null,
          returnMethod: null,
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
      leadThanksMessage: null,
      spamProtectionEnabled: false,
      published: true,
      domainStatus: WebsiteDomainStatus.PENDING,
      customDomain: null,
      currencyCode: "TND",
      socialLinks: [],
      contact: {
        companyName: "Demo",
        email: "demo@example.com",
        phone: null,
        address: "Tunis, Tunisie",
        logoUrl: null,
        logoData: null,
      },
      cmsPages: [
        {
          id: "cms-delivery",
          title: "Delivery information",
          path: "/delivery",
          showInFooter: true,
        },
      ],
      metadata: {
        title: "Demo catalogue",
        description: "Base description",
        canonicalUrl: "https://example.com/catalogue/demo",
        socialImageUrl: null,
        keywords: null,
      },
      builder,
    },
    products: {
      featured: [],
      all: [
        {
          id: "prod-1",
          name: "Chaise Design",
          description: "Une chaise ergonomique.",
          descriptionHtml: null,
          shortDescriptionHtml: null,
          excerpt: "Confort premium pour votre bureau.",
          metaTitle: null,
          metaDescription: null,
          coverImageUrl: "https://example.com/chair.jpg",
          gallery: [],
          faqItems: [],
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
        {
          id: "prod-2",
          name: "Lampe Atelier",
          description: "Une lampe réglable.",
          descriptionHtml: null,
          shortDescriptionHtml: null,
          excerpt: "Éclairage précis pour chaque espace.",
          metaTitle: null,
          metaDescription: null,
          coverImageUrl: "https://example.com/lamp.jpg",
          gallery: [],
          faqItems: [],
          quoteFormSchema: null,
          optionConfig: null,
          variantStock: null,
          category: "Luminaires",
          unit: "pièce",
          stockQuantity: 3,
          priceHTCents: 8000,
          priceTTCCents: 9520,
          vatRate: 19,
          defaultDiscountRate: null,
          sku: "LAMP-001",
          publicSlug: "lampe-atelier",
          saleMode: "INSTANT",
          isActive: true,
        },
      ],
    },
    currentCmsPage: null,
  };
}

describe("catalog seo pages", () => {
  it("builds localized canonical URLs and hreflang alternates", () => {
    const payload = createPayload();

    const seo = resolveCatalogSeo({
      payload,
      path: "/about-us",
      locale: "en",
    });

    expect(seo.metadata.canonicalUrl).toBe(
      "http://localhost:3000/catalogue/demo/about?lang=en",
    );
    expect(seo.alternatesLanguages).toEqual({
      fr: "http://localhost:3000/catalogue/demo/about?lang=fr",
      en: "http://localhost:3000/catalogue/demo/about?lang=en",
      "x-default": "http://localhost:3000/catalogue/demo/about?lang=fr",
    });
    expect(seo.openGraphType).toBe("website");
    expect(seo.locale).toBe("en");
  });

  it("keeps paginated collections indexable and noindexes filtered collections", () => {
    const payload = createPayload();

    const paginatedSeo = resolveCatalogSeo({
      payload,
      path: "/collections/mobilier",
      locale: "fr",
      searchParams: {
        page: "2",
      },
    });

    expect(paginatedSeo.metadata.canonicalUrl).toBe(
      "http://localhost:3000/catalogue/demo/collections/mobilier?page=2&lang=fr",
    );
    expect(paginatedSeo.robots).toBeNull();

    const filteredSeo = resolveCatalogSeo({
      payload,
      path: "/collections/mobilier",
      locale: "fr",
      searchParams: {
        color: "blue",
        sort: "price-desc",
      },
    });

    expect(filteredSeo.metadata.canonicalUrl).toBe(
      "http://localhost:3000/catalogue/demo/collections/mobilier?lang=fr",
    );
    expect(filteredSeo.robots).toEqual({
      index: false,
      follow: true,
    });
  });

  it("builds collection and article structured data for ciseco pages", () => {
    const payload = createPayload();

    const collectionStructuredData = resolveCatalogStructuredData({
      payload,
      path: "/collections/mobilier",
      locale: "fr",
    });
    expect(
      collectionStructuredData.some(
        (entry) => entry["@type"] === "CollectionPage",
      ),
    ).toBe(true);

    const articleStructuredData = resolveCatalogStructuredData({
      payload,
      path: "/blog/graduation-dresses-style-guide",
      locale: "fr",
    });
    expect(
      articleStructuredData.some((entry) => entry["@type"] === "Article"),
    ).toBe(true);
  });
});
