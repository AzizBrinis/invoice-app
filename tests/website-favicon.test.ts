import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebsiteDomainStatus } from "@/lib/db/prisma";
import {
  deleteManagedWebsiteFavicon,
  resolveCatalogFaviconUrl,
  saveWebsiteFaviconFile,
  validateWebsiteFaviconFile,
} from "@/server/website";

const TEST_USER_ID = "tenant-favicon-test";
const TEST_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "site-favicons",
  TEST_USER_ID,
);

function createPngFile(options?: { size?: number; name?: string; type?: string }) {
  const size = options?.size ?? 8;
  return new File(
    [new Uint8Array(size)],
    options?.name ?? "favicon.png",
    { type: options?.type ?? "image/png" },
  );
}

afterEach(async () => {
  await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
});

describe("website favicon helpers", () => {
  it("stores and deletes tenant-scoped favicon uploads", async () => {
    const faviconUrl = await saveWebsiteFaviconFile(createPngFile(), TEST_USER_ID);

    expect(faviconUrl).toMatch(
      /^\/uploads\/site-favicons\/tenant-favicon-test\/.+\.png$/,
    );
    await expect(
      fs.access(path.join(process.cwd(), "public", faviconUrl.replace(/^\//, ""))),
    ).resolves.toBeUndefined();

    await deleteManagedWebsiteFavicon(faviconUrl, TEST_USER_ID);

    await expect(
      fs.access(path.join(process.cwd(), "public", faviconUrl.replace(/^\//, ""))),
    ).rejects.toThrow();
  });

  it("rejects oversized or unsupported favicon uploads", () => {
    expect(() =>
      validateWebsiteFaviconFile(createPngFile({ size: 600 * 1024 })),
    ).toThrow("Le favicon dépasse la taille maximale de 512 Ko.");

    expect(() =>
      validateWebsiteFaviconFile(
        createPngFile({
          name: "favicon.svg",
          type: "image/svg+xml",
        }),
      ),
    ).toThrow("Format de favicon non supporté. Utilisez PNG ou ICO.");
  });

  it("builds favicon URLs against the active website origin and falls back cleanly", () => {
    expect(
      resolveCatalogFaviconUrl({
        slug: "demo-shop",
        customDomain: "shop.example.com",
        domainStatus: WebsiteDomainStatus.ACTIVE,
        faviconUrl: "/uploads/site-favicons/tenant-favicon-test/demo.png",
      }),
    ).toBe("https://shop.example.com/uploads/site-favicons/tenant-favicon-test/demo.png");

    expect(
      resolveCatalogFaviconUrl({
        slug: "demo-shop",
        customDomain: null,
        domainStatus: WebsiteDomainStatus.PENDING,
        faviconUrl: "/uploads/site-favicons/tenant-favicon-test/demo.png",
      }),
    ).toBe("http://localhost:3000/uploads/site-favicons/tenant-favicon-test/demo.png");

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
