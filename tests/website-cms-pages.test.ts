import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WebsiteDomainStatus, WebsiteThemeMode } from "@/lib/db/prisma";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/website/templates/ecommerce-ciseco/i18n", () => ({
  CisecoLocaleProvider: ({ children }: { children: unknown }) => children,
  useCisecoI18n: () => ({
    locale: "fr",
    setLocale: () => undefined,
    t: (text: string) => text,
    localizeHref: (href: string) => href,
  }),
}));

import { CatalogPage } from "@/components/website/catalog-page";
import {
  createDefaultBuilderConfig,
  ensureCisecoPageConfigs,
} from "@/lib/website/builder";
import {
  isReservedWebsiteCmsPagePath,
  normalizeWebsiteCmsPagePath,
  renderWebsiteCmsPageContent,
} from "@/lib/website/cms";
import {
  resolveCatalogMetadata,
  type CatalogPayload,
} from "@/server/website";

function createPayload(path: string) {
  const builder = ensureCisecoPageConfigs(
    createDefaultBuilderConfig({
      heroTitle: "Demo",
    }),
    { override: true },
  );
  const content = renderWebsiteCmsPageContent(
    [
      "# Delivery information",
      "",
      "Shipping windows, handling times and special conditions are listed below.",
      "",
      "## Tunisia",
      "- Tunis: 24 to 48h",
      "- Sfax: 48 to 72h",
    ].join("\n"),
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
      faviconUrl: null,
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
        address: null,
        logoUrl: null,
        logoData: null,
      },
      cmsPages: [
        {
          id: "cms-delivery",
          title: "Delivery information",
          path,
          showInFooter: true,
        },
      ],
      metadata: {
        title: "Demo catalogue",
        description: "Base description",
        canonicalUrl: `https://example.com/catalogue/demo${path}`,
        socialImageUrl: null,
        keywords: null,
      },
      builder,
    },
    products: {
      featured: [],
      all: [],
    },
    siteReviews: [],
    currentCmsPage: {
      id: "cms-delivery",
      title: "Delivery information",
      path,
      showInFooter: true,
      contentHtml: content.html,
      excerpt: content.excerpt,
      headings: content.headings,
    },
  } satisfies CatalogPayload;
}

describe("website cms pages", () => {
  it("normalizes paths and protects reserved template routes", () => {
    expect(normalizeWebsiteCmsPagePath("delivery")).toBe("/delivery");
    expect(normalizeWebsiteCmsPagePath("/Legal Notice")).toBe("/legal-notice");
    expect(isReservedWebsiteCmsPagePath("/checkout")).toBe(true);
    expect(isReservedWebsiteCmsPagePath("/collections/spring")).toBe(true);
    expect(isReservedWebsiteCmsPagePath("/delivery")).toBe(false);
  });

  it("renders markdown-like CMS content into structured HTML", () => {
    const rendered = renderWebsiteCmsPageContent(
      [
        "# Secure payment",
        "",
        "Use encrypted channels for every card payment.",
        "",
        "## Guarantees",
        "- 3D Secure",
        "- Fraud checks",
      ].join("\n"),
    );

    expect(rendered.html).toContain("<h2 id=\"secure-payment\">");
    expect(rendered.html).toContain("<ul>");
    expect(rendered.headings).toEqual([
      {
        id: "secure-payment",
        text: "Secure payment",
        level: 2,
      },
      {
        id: "guarantees",
        text: "Guarantees",
        level: 3,
      },
    ]);
    expect(rendered.excerpt).toContain("Use encrypted channels");
  });

  it("renders CMS pages inside the ciseco template and exposes footer links", () => {
    const payload = createPayload("/delivery");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: payload,
            mode: "public",
            path: "/delivery",
            initialLocale: "fr",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("Delivery information");
    expect(html).toContain("Shipping windows, handling times");
    expect(html).toContain("Table of contents");
    expect(html).toContain("/catalogue/demo/delivery");
    expect(html).toContain(">Information<");
  });

  it("uses the CMS page title and excerpt for metadata", () => {
    const payload = createPayload("/delivery");

    const metadata = resolveCatalogMetadata({
      payload,
      path: "/delivery",
    });

    expect(metadata.title).toBe("Delivery information — Demo");
    expect(metadata.description).toContain("Shipping windows, handling times");
  });
});
