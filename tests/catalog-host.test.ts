import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isReservedPublicHostname,
  resolveCatalogDomainFromHeaders,
  resolveRequestHost,
} from "@/lib/catalog-host";

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_HOSTNAMES: process.env.APP_HOSTNAMES,
  CATALOG_EDGE_DOMAIN: process.env.CATALOG_EDGE_DOMAIN,
  VERCEL_URL: process.env.VERCEL_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("catalog host resolution", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.APP_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.APP_HOSTNAMES = "admin.example.com, app.example.com";
    process.env.CATALOG_EDGE_DOMAIN = "cname.example.net";
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("prefers the forwarded host over the app host", () => {
    const headers = new Headers({
      host: "app.example.com",
      "x-forwarded-host": "Shop.Example.com, internal.proxy",
    });

    expect(resolveRequestHost(headers)).toBe("shop.example.com");
    expect(resolveCatalogDomainFromHeaders(headers)).toBe("shop.example.com");
  });

  it("keeps configured app hosts out of catalog domain resolution", () => {
    expect(
      resolveCatalogDomainFromHeaders(
        new Headers({ host: "app.example.com:443" }),
      ),
    ).toBeNull();
    expect(
      resolveCatalogDomainFromHeaders(
        new Headers({ host: "admin.example.com" }),
      ),
    ).toBeNull();
  });

  it("marks app and edge hostnames as reserved public domains", () => {
    expect(isReservedPublicHostname("app.example.com")).toBe(true);
    expect(isReservedPublicHostname("cname.example.net")).toBe(true);
    expect(isReservedPublicHostname("shop.example.com")).toBe(false);
  });
});
