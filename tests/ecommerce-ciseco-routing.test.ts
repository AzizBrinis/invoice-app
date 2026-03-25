import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));
import { resolveCatalogMetadataTarget } from "@/server/website";
import { resolvePage } from "@/components/website/templates/ecommerce-ciseco/utils";

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
});
