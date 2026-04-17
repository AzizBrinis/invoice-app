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

vi.mock(
  "@/components/website/templates/ecommerce-ciseco/components/layout/PageShell",
  () => ({
    PageShell: ({ children }: { children: unknown }) => children,
  }),
);

vi.mock(
  "@/components/website/templates/ecommerce-ciseco/components/layout/Navbar",
  () => ({
    Navbar: () => null,
  }),
);

vi.mock(
  "@/components/website/templates/ecommerce-ciseco/components/layout/Footer",
  () => ({
    Footer: () => null,
  }),
);

vi.mock(
  "@/components/website/templates/ecommerce-ciseco/components/shared/Reveal",
  () => ({
    Reveal: ({ children }: { children: unknown }) => children,
  }),
);

vi.mock(
  "@/components/website/templates/ecommerce-ciseco/components/shared/CatalogImage",
  () => ({
    CatalogImage: ({
      src,
      alt,
    }: {
      src: string;
      alt: string;
    }) => createElement("img", { src, alt }),
  }),
);

import {
  createDefaultBuilderConfig,
  ensureCisecoPageConfigs,
} from "@/lib/website/builder";
import { buildCisecoInlineStyles, buildCisecoTheme } from "@/components/website/templates/ecommerce-ciseco/template-shared";
import { BlogDetailPage } from "@/components/website/templates/ecommerce-ciseco/pages/BlogDetailPage";
import { BlogPage } from "@/components/website/templates/ecommerce-ciseco/pages/BlogPage";
import type { CatalogPayload } from "@/server/website";

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
      cmsPages: [],
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
      all: [],
    },
    siteReviews: [],
    blogPosts: [
      {
        id: "blog-managed-1",
        title: "Managed launch note",
        slug: "managed-launch-note",
        excerpt: "A concise editorial note about the new launch.",
        coverImageUrl: "https://example.com/blog-cover.jpg",
        socialImageUrl: null,
        category: "Launches",
        tags: ["launch", "seo"],
        authorName: "Jane Doe",
        publishDate: "2026-04-10",
        featured: true,
        readingTimeMinutes: 4,
        wordCount: 860,
        metaTitle: "Managed SEO Title",
        metaDescription: "Managed SEO description.",
      },
      {
        id: "blog-managed-2",
        title: "Second managed post",
        slug: "second-managed-post",
        excerpt: "Another note for the listing page.",
        coverImageUrl: "https://example.com/blog-second.jpg",
        socialImageUrl: null,
        category: "Guides",
        tags: ["guides"],
        authorName: "John Doe",
        publishDate: "2026-04-11",
        featured: false,
        readingTimeMinutes: 5,
        wordCount: 910,
        metaTitle: null,
        metaDescription: null,
      },
    ],
    currentBlogPost: {
      id: "blog-managed-1",
      title: "Managed launch note",
      slug: "managed-launch-note",
      excerpt: "A concise editorial note about the new launch.",
      coverImageUrl: "https://example.com/blog-cover.jpg",
      socialImageUrl: null,
      category: "Launches",
      tags: ["launch", "seo"],
      authorName: "Jane Doe",
      publishDate: "2026-04-10",
      featured: true,
      readingTimeMinutes: 4,
      wordCount: 860,
      metaTitle: "Managed SEO Title",
      metaDescription: "Managed SEO description.",
      bodyHtml:
        "<h2 id=\"launch-summary\">Launch summary</h2><p>The body is now rendered from managed admin data.</p>",
      headings: [
        {
          id: "launch-summary",
          text: "Launch summary",
          level: 2,
        },
      ],
    },
    currentCmsPage: null,
  };
}

describe("website blog pages", () => {
  it("renders managed blog posts on the public listing page", () => {
    const payload = createPayload();
    const theme = buildCisecoTheme(payload.website.accentColor);
    const html = renderToStaticMarkup(
      createElement(BlogPage, {
        theme,
        inlineStyles: buildCisecoInlineStyles(theme),
        companyName: payload.website.contact.companyName,
        homeHref: "/catalogue/demo",
        baseLink: (target: string) => `/catalogue/demo${target}`,
        path: "/blog",
        builder: payload.website.builder?.pages.blog ?? null,
        blogPosts: payload.blogPosts,
      }),
    );

    expect(html).toContain("Managed launch note");
    expect(html).toContain("Second managed post");
    expect(html).toContain("/catalogue/demo/blog/managed-launch-note");
  });

  it("renders the managed article detail page with headings and body content", () => {
    const payload = createPayload();
    const theme = buildCisecoTheme(payload.website.accentColor);
    const html = renderToStaticMarkup(
      createElement(BlogDetailPage, {
        theme,
        inlineStyles: buildCisecoInlineStyles(theme),
        companyName: payload.website.contact.companyName,
        homeHref: "/catalogue/demo",
        baseLink: (target: string) => `/catalogue/demo${target}`,
        catalogSlug: payload.website.slug,
        mode: "public",
        postSlug: "managed-launch-note",
        post: payload.currentBlogPost,
        blogPosts: payload.blogPosts,
        builder: payload.website.builder?.pages["blog-detail"] ?? null,
      }),
    );

    expect(html).toContain("Managed launch note");
    expect(html).toContain("Launch summary");
    expect(html).toContain("The body is now rendered from managed admin data.");
    expect(html).toContain("Table of contents");
    expect(html).toContain("Jane Doe");
  });
});
