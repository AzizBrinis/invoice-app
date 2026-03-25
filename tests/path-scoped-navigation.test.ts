import { describe, expect, it } from "vitest";
import { canApplyPathScopedNavigationUpdate } from "@/lib/path-scoped-navigation";

describe("canApplyPathScopedNavigationUpdate", () => {
  it("allows updates that stay on the page that owns the sync", () => {
    expect(
      canApplyPathScopedNavigationUpdate({
        currentHref: "https://app.example.com/clients?recherche=acme",
        ownedPathname: "/clients",
        nextHref: "/clients?recherche=atlas",
      }),
    ).toBe(true);
  });

  it("blocks stale updates after navigation moved to another pathname", () => {
    expect(
      canApplyPathScopedNavigationUpdate({
        currentHref: "https://app.example.com/devis",
        ownedPathname: "/clients",
        nextHref: "/clients?recherche=atlas",
      }),
    ).toBe(false);
  });

  it("blocks updates that would replace the current route with another pathname", () => {
    expect(
      canApplyPathScopedNavigationUpdate({
        currentHref: "https://app.example.com/produits",
        ownedPathname: "/produits",
        nextHref: "/clients",
      }),
    ).toBe(false);
  });

  it("normalizes trailing slashes before comparing pathnames", () => {
    expect(
      canApplyPathScopedNavigationUpdate({
        currentHref: "https://app.example.com/messagerie/recus/",
        ownedPathname: "/messagerie/recus",
        nextHref: "/messagerie/recus?message=42",
      }),
    ).toBe(true);
  });
});
