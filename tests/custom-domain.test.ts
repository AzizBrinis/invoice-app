import { describe, expect, it } from "vitest";
import { WebsiteDomainStatus } from "@/lib/db/prisma";
import {
  buildActiveCustomDomainUrl,
  buildPublicWebsiteHref,
  hasActiveCustomDomain,
  isSameCustomDomain,
} from "@/lib/website/custom-domain";

describe("custom domain helpers", () => {
  it("uses root-relative paths on active custom domains", () => {
    expect(
      buildPublicWebsiteHref({
        slug: "demo-shop",
        targetPath: "/about",
        mode: "public",
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBe("/about");
  });

  it("keeps slug-scoped paths when rendering an app-domain route for a site with an active custom domain", () => {
    expect(
      buildPublicWebsiteHref({
        slug: "demo-shop",
        targetPath: "/about",
        mode: "public",
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
        useCustomDomainPaths: false,
      }),
    ).toBe("/catalogue/demo-shop/about");
  });

  it("keeps slug-based catalogue paths before custom-domain activation", () => {
    expect(
      buildPublicWebsiteHref({
        slug: "demo-shop",
        targetPath: "/about",
        mode: "public",
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.VERIFIED,
      }),
    ).toBe("/catalogue/demo-shop/about");
  });

  it("builds preview URLs with the path query parameter", () => {
    expect(
      buildPublicWebsiteHref({
        slug: "demo-shop",
        targetPath: "/contact",
        mode: "preview",
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBe("/preview?path=%2Fcontact");
  });

  it("sanitizes protocol-relative target paths into local paths", () => {
    expect(
      buildPublicWebsiteHref({
        slug: "demo-shop",
        targetPath: "//evil.example/checkout",
        mode: "public",
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBe("/evil.example/checkout");
  });

  it("builds an absolute custom-domain URL only for active domains", () => {
    expect(
      buildActiveCustomDomainUrl({
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBe("https://www.example.com");
    expect(
      buildActiveCustomDomainUrl({
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.VERIFIED,
      }),
    ).toBeNull();
    expect(
      buildActiveCustomDomainUrl({
        customDomain: null,
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBeNull();
  });

  it("normalizes protocol and path fragments before opening the active custom domain", () => {
    expect(
      buildActiveCustomDomainUrl({
        customDomain: "https://WWW.Example.com/shop?ref=1#top",
        domainStatus: WebsiteDomainStatus.ACTIVE,
        path: "/contact",
      }),
    ).toBe("https://www.example.com/contact");
  });

  it("returns null for malformed legacy custom-domain values", () => {
    expect(
      buildActiveCustomDomainUrl({
        customDomain: "https://www.example.com:443",
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBeNull();
    expect(
      buildActiveCustomDomainUrl({
        customDomain: "javascript:alert(1)",
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBeNull();
  });

  it("detects active custom domains only when the status is ACTIVE", () => {
    expect(
      hasActiveCustomDomain({
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBe(true);
    expect(
      hasActiveCustomDomain({
        customDomain: "www.example.com",
        domainStatus: WebsiteDomainStatus.PENDING,
      }),
    ).toBe(false);
    expect(
      hasActiveCustomDomain({
        customDomain: null,
        domainStatus: WebsiteDomainStatus.ACTIVE,
      }),
    ).toBe(false);
  });

  it("compares submitted domains case-insensitively", () => {
    expect(isSameCustomDomain("WWW.Example.com", "www.example.com")).toBe(true);
    expect(isSameCustomDomain("shop.example.com", "www.example.com")).toBe(false);
  });
});
