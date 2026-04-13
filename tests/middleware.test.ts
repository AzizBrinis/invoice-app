import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

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

describe("custom-domain middleware routing", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.APP_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    process.env.APP_HOSTNAMES = "app.example.com";
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("rewrites a forwarded custom-domain request to the public catalogue", () => {
    const response = middleware(
      new NextRequest("https://app.example.com/about", {
        headers: {
          host: "app.example.com",
          "x-forwarded-host": "shop.example.com",
        },
      }),
    );

    const rewrite = response.headers.get("x-middleware-rewrite");
    expect(rewrite).toBe(
      "https://app.example.com/catalogue/about?domain=shop.example.com&path=%2Fabout",
    );
  });

  it("lets the configured app domain load the app normally", () => {
    const response = middleware(
      new NextRequest("https://app.example.com/", {
        headers: {
          host: "app.example.com",
        },
      }),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
