import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WebsiteDomainStatus, WebsiteThemeMode } from "@/lib/db/prisma";
import { describe, expect, it, vi } from "vitest";
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
import { type CatalogPayload } from "@/server/website";
import {
  builderConfigSchema,
  createCisecoSectionFromTemplate,
  createDefaultBuilderConfig,
  createSectionTemplate,
  ensureCisecoPageConfigs,
  getCisecoPageSectionCatalog,
  resolveCisecoBuilderPageConfig,
  resolveCisecoSectionTemplate,
  resolveSectionCustomerPhotosVisibility,
  sanitizeBuilderPages,
} from "@/lib/website/builder";

function createCisecoConfig() {
  return ensureCisecoPageConfigs(
    createDefaultBuilderConfig({
      heroTitle: "Demo",
    }),
    { override: true },
  );
}

function createCisecoCatalogPayload(
  config: ReturnType<typeof createCisecoConfig>,
): CatalogPayload {
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
      contactBlurb: "Intro",
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
      published: false,
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
        title: "Demo",
        description: "Demo description",
        canonicalUrl: "https://example.com",
        socialImageUrl: null,
        keywords: null,
      },
      builder: config,
    },
    products: {
      featured: [],
      all: [],
    },
    currentCmsPage: null,
  };
}

function createLegacyHomeSection(input: {
  id: string;
  type: "hero" | "services" | "products" | "categories" | "promo" | "gallery" | "content" | "testimonials";
  layout: string;
  title: string;
  subtitle: string | null;
  description?: string | null;
  eyebrow: string | null;
}) {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description ?? null,
    eyebrow: input.eyebrow,
    layout: input.layout,
    animation: "fade" as const,
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [],
  };
}

function createLegacyCisecoConfig() {
  const config = createDefaultBuilderConfig({
    heroTitle: "Demo",
  });

  return {
    ...config,
    version: 1,
    pages: {
      ...config.pages,
      home: {
        sections: [
          createLegacyHomeSection({
            id: "ciseco-home-hero",
            type: "hero",
            layout: "home-hero",
            title: "Exclusive collection for everyone",
            subtitle:
              "Discover fresh styles and everyday essentials curated for every mood. Lorem ipsum dolor sit amet.",
            description: "Trusted by 32k+ shoppers worldwide",
            eyebrow: "Handpicked trend",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-new-arrivals",
            type: "products",
            layout: "new-arrivals",
            title: "Fresh drops for the week",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "New arrivals",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-features",
            type: "services",
            layout: "features",
            title: "Shopping essentials",
            subtitle: "Highlights that make every purchase easy.",
            eyebrow: null,
          }),
          createLegacyHomeSection({
            id: "ciseco-home-categories",
            type: "categories",
            layout: "explore",
            title: "Explore categories",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Start exploring",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-best-sellers",
            type: "products",
            layout: "best-sellers",
            title: "Best sellers of the month",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Best sellers",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-kids-promo",
            type: "promo",
            layout: "kids-banner",
            title: "Special offer in kids products",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Special offer",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-featured-products",
            type: "products",
            layout: "featured",
            title: "Featured for your wishlist",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Featured products",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-favorites",
            type: "products",
            layout: "favorites",
            title: "Find your favorite products",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Find your favorite",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-departments",
            type: "gallery",
            layout: "departments",
            title: "Explore the absolute",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Shop by department",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-blog",
            type: "content",
            layout: "home-blog",
            title: "From the Ciseco blog",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Our latest news",
          }),
          createLegacyHomeSection({
            id: "ciseco-home-testimonials",
            type: "testimonials",
            layout: "home-testimonials",
            title: "People love our products",
            subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            eyebrow: "Good news from far away",
          }),
        ],
        mediaLibrary: [],
        seo: {},
      },
    },
  };
}

function createLegacyHeroOnlyPage(
  id: string,
  title: string,
  subtitle: string,
) {
  return {
    sections: [
      {
        id,
        type: "hero" as const,
        title,
        subtitle,
        description: null,
        eyebrow: null,
        layout: "page-hero",
        animation: "fade" as const,
        visible: true,
        mediaId: null,
        secondaryMediaId: null,
        items: [],
        buttons: [],
      },
    ],
    mediaLibrary: [],
    seo: {},
  };
}

function normalizeForSave(config: ReturnType<typeof createCisecoConfig>) {
  return builderConfigSchema.parse({
    ...config,
    pages: sanitizeBuilderPages(config.pages),
  });
}

describe("website builder page persistence", () => {
  it("includes dedicated product sections in ciseco defaults", () => {
    const config = createCisecoConfig();
    const productSections = config.pages.product?.sections ?? [];

    expect(productSections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "ciseco-product-gallery",
        "ciseco-product-options",
        "ciseco-product-description",
        "ciseco-product-reviews",
        "ciseco-product-related",
        "ciseco-product-banner",
      ]),
    );
  });

  it("syncs the ciseco blog and article defaults with the template section set", () => {
    const config = createCisecoConfig();

    expect(config.pages.blog?.sections.map((section) => section.id)).toEqual([
      "ciseco-blog-hero",
      "ciseco-blog-featured",
      "ciseco-blog-mini",
      "ciseco-blog-ads",
      "ciseco-blog-latest",
      "ciseco-blog-promo",
    ]);
    expect(config.pages["blog-detail"]?.sections.map((section) => section.id)).toEqual([
      "ciseco-blog-detail-hero",
      "ciseco-blog-detail-body",
      "ciseco-blog-detail-related",
    ]);
  });

  it("limits the ciseco home defaults to the core visible sections", () => {
    const config = createCisecoConfig();
    const homeSections = config.pages.home?.sections ?? [];
    const visibleHomeIds = homeSections
      .filter((section) => section.visible !== false)
      .map((section) => section.id);
    const hiddenHomeIds = homeSections
      .filter((section) => section.visible === false)
      .map((section) => section.id);

    expect(visibleHomeIds).toEqual([
      "ciseco-home-hero",
      "ciseco-home-best-sellers",
      "ciseco-home-featured-products",
      "ciseco-home-favorites",
      "ciseco-home-testimonials",
    ]);

    expect(hiddenHomeIds).toEqual(
      expect.arrayContaining([
        "ciseco-home-discovery",
        "ciseco-home-new-arrivals",
        "ciseco-home-features",
        "ciseco-home-promo",
        "ciseco-home-categories",
        "ciseco-home-kids-promo",
        "ciseco-home-departments",
        "ciseco-home-blog",
      ]),
    );

    const heroSection = homeSections.find((section) => section.id === "ciseco-home-hero");
    const testimonialsSection = homeSections.find(
      (section) => section.id === "ciseco-home-testimonials",
    );
    expect(heroSection?.settings?.sliderMode).toBe("image");
    expect(heroSection?.settings?.autoSlideIntervalMs).toBe(5500);
    expect(resolveSectionCustomerPhotosVisibility(testimonialsSection)).toBe(true);
    expect(heroSection?.items.length).toBeGreaterThan(0);
    expect(heroSection?.items[0]?.buttons?.length).toBeGreaterThan(0);
  });

  it("migrates legacy ciseco home defaults to the simplified visible set", () => {
    const config = ensureCisecoPageConfigs(createLegacyCisecoConfig());
    const homeSections = config.pages.home?.sections ?? [];
    const visibleHomeIds = homeSections
      .filter((section) => section.visible !== false)
      .map((section) => section.id);

    expect(config.version).toBe(5);
    expect(visibleHomeIds).toEqual([
      "ciseco-home-hero",
      "ciseco-home-best-sellers",
      "ciseco-home-featured-products",
      "ciseco-home-favorites",
      "ciseco-home-testimonials",
    ]);
    expect(homeSections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "ciseco-home-discovery",
        "ciseco-home-promo",
        "ciseco-home-blog",
      ]),
    );
    expect(
      homeSections.find((section) => section.id === "ciseco-home-featured-products")?.title,
    ).toBe("Shopping essentials");
    const heroSection = homeSections.find((section) => section.id === "ciseco-home-hero");
    expect(heroSection?.settings?.sliderMode).toBe("image");
    expect(heroSection?.settings?.autoSlideIntervalMs).toBe(5500);
    expect(heroSection?.items.length).toBeGreaterThan(0);
  });

  it("preserves hidden home sections after normalization", () => {
    const config = createCisecoConfig();
    const home = config.pages.home;
    const promoId = "ciseco-home-promo";

    const nextConfig = {
      ...config,
      pages: {
        ...config.pages,
        home: {
          ...home,
          sections: home.sections.map((section) =>
            section.id === promoId
              ? { ...section, visible: false }
              : section,
          ),
        },
      },
    };

    const normalized = normalizeForSave(nextConfig);
    const normalizedPromo = normalized.pages.home?.sections.find(
      (section) => section.id === promoId,
    );

    expect(normalizedPromo).toBeDefined();
    expect(normalizedPromo?.visible).toBe(false);
  });

  it("persists the home testimonials customer photo setting without breaking defaults", () => {
    const config = createCisecoConfig();
    const home = config.pages.home;

    const nextConfig = {
      ...config,
      pages: {
        ...config.pages,
        home: {
          ...home,
          sections: home.sections.map((section) =>
            section.id === "ciseco-home-testimonials"
              ? {
                  ...section,
                  settings: {
                    ...(section.settings ?? {}),
                    showCustomerPhotos: false,
                  },
                }
              : section,
          ),
        },
      },
    };

    const normalized = normalizeForSave(nextConfig);
    const normalizedTestimonials = normalized.pages.home?.sections.find(
      (section) => section.id === "ciseco-home-testimonials",
    );
    const defaultTestimonials = normalizeForSave(config).pages.home?.sections.find(
      (section) => section.id === "ciseco-home-testimonials",
    );

    expect(normalizedTestimonials?.settings?.showCustomerPhotos).toBe(false);
    expect(resolveSectionCustomerPhotosVisibility(normalizedTestimonials)).toBe(false);
    expect(resolveSectionCustomerPhotosVisibility(defaultTestimonials)).toBe(true);
  });

  it("preserves deleted home sections and keeps other sections intact", () => {
    const config = createCisecoConfig();
    const home = config.pages.home;
    const promoId = "ciseco-home-promo";
    const expectedRemainingIds = home.sections
      .map((section) => section.id)
      .filter((id) => id !== promoId);

    const nextConfig = {
      ...config,
      pages: {
        ...config.pages,
        home: {
          ...home,
          sections: home.sections.filter((section) => section.id !== promoId),
        },
      },
    };

    const normalized = normalizeForSave(nextConfig);
    const resolved = ensureCisecoPageConfigs(normalized);
    const resolvedHomeIds = resolved.pages.home?.sections.map(
      (section) => section.id,
    );

    expect(resolvedHomeIds).toEqual(expectedRemainingIds);
    expect(resolvedHomeIds).not.toContain(promoId);
  });

  it("backfills product sections for legacy configs that only had product hero", () => {
    const config = createCisecoConfig();
    const legacyConfig = {
      ...config,
      pages: {
        ...config.pages,
        product: {
          ...config.pages.product,
          sections: config.pages.product.sections.filter(
            (section) => section.id === "ciseco-product-hero",
          ),
        },
      },
    };

    const resolved = ensureCisecoPageConfigs(legacyConfig);
    const resolvedIds = resolved.pages.product?.sections.map((section) => section.id) ?? [];

    expect(resolvedIds).toContain("ciseco-product-hero");
    expect(resolvedIds).toContain("ciseco-product-gallery");
    expect(resolvedIds).toContain("ciseco-product-options");
    expect(resolvedIds).toContain("ciseco-product-description");
    expect(resolvedIds).toContain("ciseco-product-reviews");
    expect(resolvedIds).toContain("ciseco-product-related");
    expect(resolvedIds).toContain("ciseco-product-banner");
  });

  it("migrates legacy hero-only blog pages to the synced template defaults", () => {
    const config = ensureCisecoPageConfigs({
      ...createDefaultBuilderConfig({
        heroTitle: "Demo",
      }),
      version: 2,
      pages: {
        blog: createLegacyHeroOnlyPage(
          "ciseco-blog-hero",
          "Journal",
          "Suivez nos dernières actualités et inspirations.",
        ),
        "blog-detail": createLegacyHeroOnlyPage(
          "ciseco-blog-detail-hero",
          "Article",
          "Racontez l’histoire derrière vos collections.",
        ),
      },
    });

    expect(config.version).toBe(5);
    expect(config.pages.blog?.sections.map((section) => section.id)).toEqual([
      "ciseco-blog-hero",
      "ciseco-blog-featured",
      "ciseco-blog-mini",
      "ciseco-blog-ads",
      "ciseco-blog-latest",
      "ciseco-blog-promo",
    ]);
    expect(config.pages["blog-detail"]?.sections.map((section) => section.id)).toEqual([
      "ciseco-blog-detail-hero",
      "ciseco-blog-detail-body",
      "ciseco-blog-detail-related",
    ]);
  });

  it("exposes optional Ciseco sections through the shared page catalog", () => {
    const contactCatalog = getCisecoPageSectionCatalog("contact");
    const contactPromoPreset = contactCatalog.presets.find(
      (preset) => preset.key === "ciseco-contact-promo",
    );

    expect(contactCatalog.presets.map((preset) => preset.key)).toEqual(
      expect.arrayContaining([
        "ciseco-contact-hero",
        "ciseco-contact-promo",
      ]),
    );
    expect(contactPromoPreset?.includedByDefault).toBe(false);
    expect(
      createCisecoSectionFromTemplate("contact", "ciseco-contact-promo")?.id,
    ).toBe("ciseco-contact-promo");
  });

  it("does not classify generic sections as built-in Ciseco presets", () => {
    expect(
      resolveCisecoSectionTemplate("contact", {
        id: "generic-contact-banner",
        type: "promo",
        title: "Support banner",
        subtitle: "Generic banner content",
        description: null,
        eyebrow: null,
        layout: "banner",
        animation: "fade",
        visible: true,
        mediaId: null,
        secondaryMediaId: null,
        items: [],
        buttons: [],
      }),
    ).toBeNull();
  });

  it("falls back to the requested page defaults instead of home when a page config is missing", () => {
    const config = createCisecoConfig();
    const pagesWithoutContact = { ...config.pages };
    delete pagesWithoutContact.contact;
    const brokenConfig = {
      ...config,
      pages: pagesWithoutContact,
    };

    const resolvedContact = resolveCisecoBuilderPageConfig(
      brokenConfig,
      "contact",
    );

    expect(resolvedContact?.sections[0]?.id).toBe("ciseco-contact-hero");
    expect(resolvedContact?.sections[0]?.id).not.toBe("ciseco-home-hero");
  });

  it("does not render fallback hero copy or CTA placeholders when content is cleared", () => {
    const config = createCisecoConfig();
    config.pages.home.sections = config.pages.home.sections.map((section) =>
      section.id === "ciseco-home-hero"
        ? {
            ...section,
            eyebrow: "",
            title: "Custom hero title",
            subtitle: "",
            description: "",
            buttons: [],
            items: [
              {
                id: "custom-empty-slide",
                title: "",
                description: "",
                badge: "",
                tag: "",
                mediaId: null,
                buttons: [],
                stats: [],
              },
            ],
          }
        : section,
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("Custom hero title");
    expect(html).not.toContain("Collection signature");
    expect(html).not.toContain(
      "Use full-size imagery when you want a stronger first impression",
    );
    expect(html).not.toContain("Browse collections");
    expect(html).not.toContain("Highlight a campaign");
  });

  it("keeps inactive home hero slides out of layout flow and restores image ghost links", () => {
    const config = createCisecoConfig();

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("absolute inset-0 z-0");
    expect(html).toContain("underline decoration-white/30");
  });

  it("renders content-mode hero ghost buttons as underlined text links with per-slide backgrounds", () => {
    const config = createCisecoConfig();
    config.pages.home.sections = config.pages.home.sections.map((section) =>
      section.id === "ciseco-home-hero"
        ? {
            ...section,
            settings: {
              ...section.settings,
              sliderMode: "content",
              contentBackground: "linen",
            },
            buttons: [
              {
                id: "hero-ghost-link",
                label: "Discover more",
                href: "/contact",
                style: "ghost",
              },
            ],
            items: [
              {
                id: "hero-secondary-slide",
                title: "Secondary slide",
                description: "Another tone for the same content slider.",
                badge: "Editorial",
                tag: "",
                contentBackground: "navy",
                buttons: [
                  {
                    id: "hero-secondary-slide-btn-1",
                    label: "Dark slide CTA",
                    href: "/collections",
                    style: "secondary",
                  },
                  {
                    id: "hero-secondary-slide-btn-2",
                    label: "Dark slide link",
                    href: "/contact",
                    style: "ghost",
                  },
                ],
                stats: [],
              },
            ],
          }
        : section,
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("underline decoration-slate-300");
    expect(html).not.toContain("border-white/16 bg-white/10 text-white/88");
    expect(html).toContain(
      "bg-[linear-gradient(135deg,#fffdf8_0%,#faf6ee_56%,#f2ecdf_100%)]",
    );
    expect(html).toContain(
      "bg-[linear-gradient(135deg,#0f172a_0%,#172036_56%,#243250_100%)]",
    );
    expect(html).toContain("text-white/82");
    expect(html).toContain("border border-white/24 bg-white/10 text-white");
    expect(html).toContain("text-white/88 underline decoration-white/30");
  });

  it("migrates legacy global content backgrounds onto each home hero slide", () => {
    const config = createCisecoConfig();
    const heroSection = config.pages.home.sections.find(
      (section) => section.id === "ciseco-home-hero",
    );

    expect(heroSection).toBeTruthy();

    const legacyConfig = {
      ...config,
      version: 4,
      pages: {
        ...config.pages,
        home: {
          ...config.pages.home,
          sections: config.pages.home.sections.map((section) =>
            section.id === "ciseco-home-hero"
              ? {
                  ...section,
                  settings: {
                    ...section.settings,
                    sliderMode: "content" as const,
                    contentBackground: "sage" as const,
                  },
                  items: (section.items ?? []).map((item) => ({
                    ...item,
                    contentBackground: undefined,
                  })),
                }
              : section,
          ),
        },
      },
    };

    const resolved = ensureCisecoPageConfigs(legacyConfig);
    const resolvedHero = resolved.pages.home.sections.find(
      (section) => section.id === "ciseco-home-hero",
    );

    expect(resolved.version).toBe(5);
    expect(resolvedHero?.settings?.contentBackground).toBe("sage");
    expect(
      resolvedHero?.items.every((item) => item.contentBackground === "sage"),
    ).toBe(true);
  });

  it("renders an added optional contact preset through the catalog page pipeline", () => {
    const config = createCisecoConfig();
    const promo = createCisecoSectionFromTemplate(
      "contact",
      "ciseco-contact-promo",
    );

    expect(promo).toBeTruthy();

    config.pages.contact.sections.push(promo!);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/contact",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("Need help choosing the right collection?");
    expect(html).toContain("Browse collections");
  });

  it("renders customer photos in the home testimonials section by default", () => {
    const config = createCisecoConfig();

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("Alex Morgan");
    expect(html).toContain("/images/placeholders/portrait-1.svg");
  });

  it("renders the home testimonials section without customer photos when disabled", () => {
    const config = createCisecoConfig();
    config.pages.home.sections = config.pages.home.sections.map((section) =>
      section.id === "ciseco-home-testimonials"
        ? {
            ...section,
            settings: {
              ...(section.settings ?? {}),
              showCustomerPhotos: false,
            },
          }
        : section,
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("Alex Morgan");
    expect(html).toContain("The neutral defaults gave us a polished starting point");
    expect(html).not.toContain("/images/placeholders/portrait-1.svg");
    expect(html).not.toContain("/images/placeholders/portrait-2.svg");
    expect(html).not.toContain("/images/placeholders/portrait-3.svg");
  });

  it("renders an added generic extra section on contact pages", () => {
    const config = createCisecoConfig();
    const extraSection = {
      ...createSectionTemplate("content"),
      id: "contact-extra-content",
      title: "Extra content block",
      subtitle: "Visible after the contact form",
    };

    config.pages.contact.sections.push(extraSection);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/contact",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("Extra content block");
    expect(html).toContain("Visible after the contact form");
  });

  it("does not render removed blog sections when a builder config is present", () => {
    const config = createCisecoConfig();
    config.pages.blog = createLegacyHeroOnlyPage(
      "ciseco-blog-hero",
      "Journal",
      "Only the hero should remain",
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const html = (() => {
      try {
        return renderToStaticMarkup(
          createElement(CatalogPage, {
            data: createCisecoCatalogPayload(config),
            mode: "preview",
            path: "/blog",
          }),
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    })();

    expect(html).toContain("Only the hero should remain");
    expect(html).not.toContain("Latest articles");
    expect(html).not.toContain("Special offer");
    expect(html).not.toContain("A.D.S");
  });
});
