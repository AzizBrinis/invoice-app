import { describe, expect, it } from "vitest";
import { WebsiteDomainStatus } from "@/lib/db/prisma";
import {
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
