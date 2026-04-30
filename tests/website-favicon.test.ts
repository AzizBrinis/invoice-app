import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebsiteDomainStatus } from "@/lib/db/prisma";
import {
  resolveCatalogFaviconUrl,
  saveWebsiteFaviconFile,
  validateWebsiteFaviconFile,
} from "@/server/website";

const TEST_USER_ID = "tenant-favicon-test";

function createPngFile(options?: { size?: number; name?: string; type?: string }) {
  const size = options?.size ?? 16;
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File(
    [bytes],
    options?.name ?? "favicon.png",
    { type: options?.type ?? "image/png" },
  );
}

describe("website favicon helpers", () => {
  it("stores favicon uploads as managed image assets", async () => {
    const faviconUrl = await saveWebsiteFaviconFile(createPngFile(), TEST_USER_ID);

    expect(faviconUrl).toMatch(
      /^\/uploads\/favicons\/tenant-favicon-test\/favicon\/[a-f0-9]{64}\.png$/,
    );
  });

  it("rejects oversized or unsupported favicon uploads", () => {
    expect(() =>
      validateWebsiteFaviconFile(createPngFile({ size: 600 * 1024 })),
    ).toThrow("Le favicon dépasse la taille maximale de 512 Ko.");
  });

  it("rejects unsupported favicon binary formats", async () => {
    await expect(
      saveWebsiteFaviconFile(
        new File([new Uint8Array([1, 2, 3, 4])], "favicon.svg", {
          type: "image/svg+xml",
        }),
        TEST_USER_ID,
      ),
    ).rejects.toThrow("Format de favicon non supporté. Utilisez PNG ou ICO.");
  });

  it("builds public favicon route URLs and falls back cleanly", () => {
    const faviconDataUrl = "data:image/png;base64,AAAA";
    const version = createHash("sha1")
      .update(faviconDataUrl)
      .digest("hex")
      .slice(0, 12);

    expect(
      resolveCatalogFaviconUrl({
        slug: "demo-shop",
        customDomain: "shop.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
        faviconUrl: faviconDataUrl,
      }),
    ).toBe(`/api/catalogue/site-favicon?slug=demo-shop&v=${version}`);

    expect(
      resolveCatalogFaviconUrl(
        {
          slug: "demo-shop",
          customDomain: "shop.example.com",
          domainStatus: WebsiteDomainStatus.ACTIVE,
          faviconUrl: faviconDataUrl,
        },
        { resolvedByDomain: true },
      ),
    ).toBe(`/api/catalogue/site-favicon?v=${version}`);

    expect(
      resolveCatalogFaviconUrl({
        slug: "demo-shop",
        customDomain: null,
        domainStatus: WebsiteDomainStatus.PENDING,
        faviconUrl: faviconDataUrl,
      }),
    ).toBe(`/api/catalogue/site-favicon?slug=demo-shop&v=${version}`);

    expect(
      resolveCatalogFaviconUrl({
        slug: "demo-shop",
        customDomain: null,
        domainStatus: WebsiteDomainStatus.PENDING,
        faviconUrl: null,
      }),
    ).toBeNull();
  });
});
