import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({
  prisma: {},
}));
import { resolveCatalogMetadataTarget } from "@/server/website";
import {
  buildCisecoHrefWithQuery,
  resolveCisecoNavigationHref,
  resolvePage,
} from "@/components/website/templates/ecommerce-ciseco/utils";
import {
  isOwnedCisecoPathname,
  resolveAuthoritativeCisecoNavigationState,
  resolveCisecoLogicalPath,
  resolveCisecoNavigationState,
  shouldUseLocalViewTransition,
  shouldUseServerNavigationForOwnedPath,
} from "@/components/website/templates/ecommerce-ciseco/navigation";
import {
  appendCisecoLocaleToHref,
  resolveCisecoLocale,
} from "@/components/website/templates/ecommerce-ciseco/locale";

describe("ciseco collection routing", () => {
  it("resolves collection paths with optional slug", () => {
    expect(resolvePage("/collections")).toEqual({ page: "collections" });
    expect(resolvePage("/collections/summer-edit")).toEqual({
      page: "collections",
      collectionSlug: "summer-edit",
    });
    expect(resolvePage("/collection/new-arrivals")).toEqual({
      page: "collections",
      collectionSlug: "new-arrivals",
    });
    expect(resolvePage("/shop/accessories")).toEqual({
      page: "collections",
      collectionSlug: "accessories",
    });
  });

  it("resolves custom CMS paths after built-in routes", () => {
    expect(
      resolvePage("/delivery", { cmsPaths: ["/delivery", "/legal-notice"] }),
    ).toEqual({
      page: "cms",
      cmsPath: "/delivery",
    });
    expect(
      resolvePage("/about", { cmsPaths: ["/about", "/delivery"] }),
    ).toEqual({
      page: "about",
    });
  });

  it("resolves category aliases to collections page", () => {
    expect(resolvePage("/category/men")).toEqual({
      page: "collections",
      collectionSlug: "men",
    });
    expect(resolvePage("/categories/women")).toEqual({
      page: "collections",
      collectionSlug: "women",
    });
  });

  it("resolves metadata target for collections URLs", () => {
    expect(resolveCatalogMetadataTarget("/collections/summer-edit")).toEqual({
      kind: "category",
      slug: "summer-edit",
    });
    expect(resolveCatalogMetadataTarget("/catalogue/collections/summer-edit")).toEqual(
      {
        kind: "category",
        slug: "summer-edit",
      },
    );
    expect(resolveCatalogMetadataTarget("/shop/accessories")).toEqual({
      kind: "category",
      slug: "accessories",
    });
  });

  it("scopes internal links to the active catalogue route", () => {
    expect(
      resolveCisecoNavigationHref({
        href: "/about",
        homeHref: "/catalogue/acme",
      }),
    ).toBe("/catalogue/acme/about");
    expect(
      resolveCisecoNavigationHref({
        href: "#discover",
        homeHref: "/catalogue/acme",
        fallbackPath: "/collections",
      }),
    ).toBe("#discover");
    expect(
      resolveCisecoNavigationHref({
        href: "#",
        homeHref: "/catalogue/acme",
        fallbackPath: "/collections",
      }),
    ).toBe("/catalogue/acme/collections");
  });

  it("downgrades unsafe external hrefs into scoped internal paths", () => {
    expect(
      resolveCisecoNavigationHref({
        href: "javascript:alert(1)",
        homeHref: "/catalogue/acme",
      }),
    ).toBe("/catalogue/acme/javascript:alert(1)");
    expect(
      resolveCisecoNavigationHref({
        href: "//evil.example/collection",
        homeHref: "/catalogue/acme",
      }),
    ).toBe("/catalogue/acme/evil.example/collection");
  });

  it("preserves scoped preview routing when adding search params", () => {
    expect(
      buildCisecoHrefWithQuery("/catalogue/acme", "/search", {
        q: "linen",
      }),
    ).toBe("/catalogue/acme/search?q=linen");
    expect(
      buildCisecoHrefWithQuery("/preview?path=%2F", "/search", {
        q: "linen",
      }),
    ).toBe("/preview?path=%2Fsearch&q=linen");
  });

  it("persists the active locale in generated links", () => {
    expect(
      buildCisecoHrefWithQuery("/catalogue/acme?lang=fr", "/search", {
        q: "linen",
      }),
    ).toBe("/catalogue/acme/search?lang=fr&q=linen");
    expect(appendCisecoLocaleToHref("/collections/summer-edit", "fr")).toBe(
      "/collections/summer-edit?lang=fr",
    );
    expect(
      appendCisecoLocaleToHref("/preview?path=%2Fcheckout#summary", "en"),
    ).toBe("/preview?path=%2Fcheckout&lang=en#summary");
  });

  it("resolves locale from query and persisted hints", () => {
    expect(resolveCisecoLocale(undefined, "fr-FR", "en")).toBe("fr");
    expect(resolveCisecoLocale(undefined, "de-DE", "en-US")).toBe("en");
    expect(resolveCisecoLocale(undefined, null, "")).toBe("fr");
  });

  it("detects urls that stay inside the active ciseco scope", () => {
    expect(isOwnedCisecoPathname("/catalogue/acme", "public", "acme")).toBe(
      true,
    );
    expect(
      isOwnedCisecoPathname("/catalogue/acme/product/linen-chair", "public", "acme"),
    ).toBe(true);
    expect(isOwnedCisecoPathname("/catalogue/other", "public", "acme")).toBe(
      false,
    );
    expect(isOwnedCisecoPathname("/preview", "preview", "acme")).toBe(true);
  });

  it("treats custom-domain root paths as owned public routes", () => {
    expect(isOwnedCisecoPathname("/collections", "public", "acme", "/")).toBe(
      true,
    );
    expect(isOwnedCisecoPathname("/about", "public", "acme", "/")).toBe(true);
  });

  it("resolves logical paths from public and preview urls", () => {
    expect(
      resolveCisecoLogicalPath(
        new URL("https://example.com/catalogue/acme/about?lang=en"),
        "public",
        "acme",
      ),
    ).toBe("/about");
    expect(
      resolveCisecoLogicalPath(
        new URL("https://example.com/preview?path=%2Fcheckout&lang=fr"),
        "preview",
        "acme",
      ),
    ).toBe("/checkout");
  });

  it("resolves logical paths from custom-domain urls", () => {
    expect(
      resolveCisecoLogicalPath(
        new URL("https://shop.example.com/collections?lang=en&page=2"),
        "public",
        "acme",
        "/",
        "/",
      ),
    ).toBe("/collections");
  });

  it("resolves scoped navigation state from relative hrefs", () => {
    expect(
      resolveCisecoNavigationState({
        href: "/catalogue/acme/search?q=linen",
        mode: "public",
        slug: "acme",
      }),
    ).toMatchObject({
      pathname: "/catalogue/acme/search",
      logicalPath: "/search",
      isOwned: true,
    });
    expect(
      resolveCisecoNavigationState({
        href: "/preview?path=%2Fproduct%2Fchair&lang=en",
        mode: "preview",
        slug: "acme",
      }),
    ).toMatchObject({
      pathname: "/preview",
      logicalPath: "/product/chair",
      isOwned: true,
    });
    expect(
      resolveCisecoNavigationState({
        href: "/collections?lang=en&page=2",
        mode: "public",
        slug: "acme",
        publicBasePath: "/",
      }),
    ).toMatchObject({
      pathname: "/collections",
      logicalPath: "/collections",
      isOwned: true,
    });
  });

  it("prefers the committed server route when local state is stale after navigation", () => {
    const localState = resolveCisecoNavigationState({
      href: "/catalogue/acme/collections/summer-edit?lang=en",
      mode: "public",
      slug: "acme",
    });
    const incomingState = resolveCisecoNavigationState({
      href: "/catalogue/acme/produit/linen-chair?lang=en",
      mode: "public",
      slug: "acme",
    });

    expect(
      resolveAuthoritativeCisecoNavigationState({
        localState,
        incomingState,
        browserHref: incomingState.href,
      }),
    ).toMatchObject({
      pathname: "/catalogue/acme/produit/linen-chair",
      logicalPath: "/produit/linen-chair",
      isOwned: true,
    });

    expect(
      resolveAuthoritativeCisecoNavigationState({
        localState,
        incomingState,
        browserHref: localState.href,
      }),
    ).toEqual(localState);
  });

  it("matches explicitly configured server-routed paths", () => {
    expect(
      shouldUseServerNavigationForOwnedPath("/delivery", [
        "/delivery",
        "/legal-notice",
      ]),
    ).toBe(true);
    expect(
      shouldUseServerNavigationForOwnedPath("delivery", [
        "delivery",
        "/legal-notice",
      ]),
    ).toBe(true);
    expect(
      shouldUseServerNavigationForOwnedPath("/search", [
        "/delivery",
        "/legal-notice",
      ]),
    ).toBe(false);
  });

  it("skips view transitions for in-page query updates", () => {
    expect(
      shouldUseLocalViewTransition({
        currentUrl: new URL("https://example.com/catalogue/acme/collections?lang=en"),
        nextUrl: new URL("https://example.com/catalogue/acme/collections?lang=en&page=2"),
        currentLogicalPath: "/collections",
        nextLogicalPath: "/collections",
      }),
    ).toBe(false);

    expect(
      shouldUseLocalViewTransition({
        currentUrl: new URL("https://example.com/catalogue/acme/collections?lang=en"),
        nextUrl: new URL("https://example.com/catalogue/acme/produit/chair?lang=en"),
        currentLogicalPath: "/collections",
        nextLogicalPath: "/produit/chair",
      }),
    ).toBe(true);
  });
});
