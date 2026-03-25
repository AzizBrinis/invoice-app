import { describe, expect, it } from "vitest";
import {
  builderConfigSchema,
  createDefaultBuilderConfig,
  ensureCisecoPageConfigs,
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
});
