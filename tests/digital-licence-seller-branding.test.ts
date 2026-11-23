import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: { companySettings: { findUnique } } }));

import { getDigitalProductVariant } from "@/lib/digital-products/catalog";
import { buildLicenceDocumentHtml, getSellerBranding } from "@/server/digital-products/licences";

const PHONE = "+216 99 699 280";

describe("licence documents seller branding", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue({ companyName: "Techno Smart", email: "support@techno-smart.tn", phone: PHONE });
  });

  it("never reads nor returns the company phone number", async () => {
    const seller = await getSellerBranding("tenant-1");
    expect(seller).toMatchObject({ name: "Techno Smart", email: "support@techno-smart.tn", phone: null });
    expect(findUnique.mock.calls[0][0].select).not.toHaveProperty("phone");
  });

  it.each([
    ["kaspersky-plus-3p-1y", "ABCDE12345FGHIJ67890"],
    ["windows-11-pro", "BCDFGHJKMPQRTVWXY2346789B"],
    ["idm-1p-1y", "TSTID0A1B2C3D4E5F6G7"],
    ["idm-1p-lifetime", "TSTID0A1B2C3D4E5F6G7"],
  ])("prints no phone number on the %s document", async (sku, code) => {
    const html = buildLicenceDocumentHtml({
      variant: getDigitalProductVariant(sku)!,
      codes: [code],
      licenceNumber: "LIC-1",
      seller: await getSellerBranding("tenant-1"),
    });
    expect(html).not.toContain("99 699 280");
    expect(html).not.toContain("tel:");
    expect(html).toContain("support@techno-smart.tn");
  });
});
