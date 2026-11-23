import { describe, expect, it } from "vitest";
import {
  codeFormatForSku,
  DIGITAL_PRODUCT_FAMILIES,
  DIGITAL_PRODUCT_SKUS,
  familyOfSku,
  getDigitalProductVariant,
  isFamilySku,
} from "@/lib/digital-products/catalog";
import { KASPERSKY_SKUS } from "@/lib/digital-products/kaspersky-catalog";
import {
  formatLicenceCode,
  isValidLicenceCode,
  KASPERSKY_CODE_FORMAT,
  maskLicenceCode,
  parseLicenceCodeInput,
  WINDOWS_CODE_FORMAT,
} from "@/lib/digital-products/licence-code-format";
import { getWindowsVariant, WINDOWS_11_PRO_SKU } from "@/lib/digital-products/windows-catalog";
import { licenceApiPayloadSchema } from "@/server/digital-products/api";
import { digitalOrderPayloadSchema } from "@/server/digital-products/fulfilment";
import {
  buildLicenceDocumentHtml,
  licencePdfFilename,
  parseLicenceRequest,
} from "@/server/digital-products/licences";
import { DEFAULT_SELLER_BRANDING } from "@/server/digital-products/kaspersky-licence-html";
import {
  buildWindowsLicenceHtml,
  WINDOWS_11_PRO_GENERIC_KEY,
} from "@/server/digital-products/windows-licence-html";
import { buildPayload } from "./fixtures/prestashop-order";

const KEY_A = "BCDFGHJKMPQRTVWXY2346789B"; // 25 chars, fake
const KEY_B = "HJKMPQRTVWXY2346789BCDFGH";

describe("Windows 11 Pro catalogue", () => {
  it("registers windows-11-pro next to the Kaspersky SKUs without changing them", () => {
    expect(DIGITAL_PRODUCT_SKUS.slice(0, KASPERSKY_SKUS.length + 1)).toEqual([...KASPERSKY_SKUS, WINDOWS_11_PRO_SKU]);
    const variant = getDigitalProductVariant(WINDOWS_11_PRO_SKU);
    expect(variant).toMatchObject({ family: "windows", edition: "pro", devices: 1, durationMonths: null });
    expect(familyOfSku(WINDOWS_11_PRO_SKU)?.basePath).toBe("/produits-digitaux/windows");
    expect(familyOfSku("kaspersky-plus-3p-1y")?.basePath).toBe("/produits-digitaux/kaspersky");
    expect(familyOfSku("unknown")).toBeNull();
    expect(isFamilySku(DIGITAL_PRODUCT_FAMILIES.windows, "kaspersky-plus-3p-1y")).toBe(false);
    expect(isFamilySku(DIGITAL_PRODUCT_FAMILIES.kaspersky, WINDOWS_11_PRO_SKU)).toBe(false);
  });

  it("uses a 25-character key format for Windows and keeps 20 for Kaspersky", () => {
    expect(codeFormatForSku(WINDOWS_11_PRO_SKU)).toBe(WINDOWS_CODE_FORMAT);
    expect(codeFormatForSku("kaspersky-plus-3p-1y")).toBe(KASPERSKY_CODE_FORMAT);
    expect(isValidLicenceCode(KEY_A, WINDOWS_CODE_FORMAT)).toBe(true);
    expect(isValidLicenceCode(KEY_A, KASPERSKY_CODE_FORMAT)).toBe(false);
    expect(isValidLicenceCode(KEY_A.slice(0, 20), WINDOWS_CODE_FORMAT)).toBe(false);
    expect(isValidLicenceCode(KEY_A.slice(0, 20))).toBe(true); // default = Kaspersky
    expect(formatLicenceCode(KEY_A, WINDOWS_CODE_FORMAT)).toBe("BCDFG-HJKMP-QRTVW-XY234-6789B");
    expect(maskLicenceCode("789B", WINDOWS_CODE_FORMAT)).toBe("•••••-•••••-•••••-•••••-•789B");
    expect(maskLicenceCode("7890")).toBe("•••••-•••••-•••••-•7890");
  });

  it("refuses Microsoft's public generic keys at import", () => {
    expect(isValidLicenceCode("VK7JGNPHTMC97JM9MPGT3V66T", WINDOWS_CODE_FORMAT)).toBe(false);
    const parsed = parseLicenceCodeInput(
      ["Clé produit", "bcdfg-hjkmp-qrtvw-xy234-6789b", WINDOWS_11_PRO_GENERIC_KEY, KEY_B, KEY_A, "SHORT-KEY"].join("\n"),
      WINDOWS_CODE_FORMAT,
    );
    expect(parsed.valid.map((line) => line.code)).toEqual([KEY_A, KEY_B]);
    expect(parsed.invalidLines).toEqual([3, 6]);
    expect(parsed.duplicateLines).toEqual([5]);
  });

  it("is accepted by the manual form, the licence API and the PrestaShop endpoint", () => {
    expect(parseLicenceRequest({ sku: WINDOWS_11_PRO_SKU, quantity: 1 }).sku).toBe(WINDOWS_11_PRO_SKU);
    expect(licenceApiPayloadSchema.safeParse({ schemaVersion: 1, sku: WINDOWS_11_PRO_SKU, quantity: 1 }).success).toBe(true);
    const order = digitalOrderPayloadSchema.safeParse({
      schemaVersion: 1,
      invoice: buildPayload(),
      licences: [{ lineId: 1, sku: WINDOWS_11_PRO_SKU, quantity: 1 }],
    });
    expect(order.success).toBe(true);
    expect(licenceApiPayloadSchema.safeParse({ schemaVersion: 1, sku: "windows-11-home", quantity: 1 }).success).toBe(false);
  });

  it("names the PDF after the product", () => {
    expect(licencePdfFilename({ number: "LIC-20261116-ABC123", productSku: WINDOWS_11_PRO_SKU })).toBe(
      "licence-windows-11-pro-LIC-20261116-ABC123.pdf",
    );
    expect(licencePdfFilename({ number: "LIC-1", productSku: "kaspersky-plus-3p-1y" })).toBe(
      "licence-kaspersky-plus-3p-LIC-1.pdf",
    );
  });
});

describe("Windows 11 Pro licence document", () => {
  const variant = getWindowsVariant(WINDOWS_11_PRO_SKU)!;

  it("prints each key with the order details, then the Famille → Pro notice", () => {
    const html = buildWindowsLicenceHtml({
      variant,
      codes: [KEY_A, KEY_B],
      licenceNumber: "LIC-20261116-ABC123",
      orderReference: "XKBKNABJK",
      customerName: "Amine Ben Salah",
      useBefore: "2026-12-01",
      seller: DEFAULT_SELLER_BRANDING,
    });
    expect(html).toContain("BCDFG-HJKMP-QRTVW-XY234-6789B");
    expect(html).toContain("HJKMP-QRTVW-XY234-6789B-CDFGH");
    expect((html.match(/class="page box"/g) ?? []).length).toBe(2);
    expect((html.match(/class="page leaflet"/g) ?? []).length).toBe(1);
    expect(html).toContain("LIC-20261116-ABC123");
    expect(html).toContain("XKBKNABJK");
    expect(html).toContain("Amine Ben Salah");
    expect(html).toContain("1er décembre 2026");
    expect(html).toContain("1 / 3");
    expect(html).toContain("3 / 3");
    expect(html).toContain(WINDOWS_11_PRO_GENERIC_KEY);
    expect(html).toContain("support@techno-smart.tn");
    expect(html).toContain('src="data:image/png;base64,'); // Techno Smart logo
    // Static document: no script, no form field, no external resource.
    expect(html).not.toMatch(/<script|<input|<button|<link /i);
    expect(html).not.toMatch(/src="https?:/i);
  });

  it("escapes every dynamic value and brands other sellers by name", () => {
    const html = buildWindowsLicenceHtml({
      variant,
      codes: [KEY_A],
      licenceNumber: "LIC-<1>",
      orderReference: '"><img src=x onerror=alert(1)>',
      customerName: "<script>alert(1)</script>",
      seller: { name: "Acme & Co", email: "help@acme.test", phone: "+216 70 000 000", website: "acme.test" },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("LIC-&lt;1&gt;");
    expect(html).toContain('<span class="brand-text">Acme &amp; Co</span>');
    expect(html).not.toContain("data:image/png");
    expect(html).toContain("2 / 2");
  });

  it("is selected by the shared renderer for Windows only", () => {
    const common = { codes: [KEY_A.slice(0, 20)], licenceNumber: "LIC-1", seller: DEFAULT_SELLER_BRANDING };
    const kaspersky = buildLicenceDocumentHtml({ ...common, variant: getDigitalProductVariant("kaspersky-plus-3p-1y")! });
    expect(kaspersky).toContain('class="wordmark">kaspersky');
    const windows = buildLicenceDocumentHtml({ ...common, codes: [KEY_A], variant });
    expect(windows).toContain("Windows 11<span>Professionnel</span>");
    expect(windows).not.toContain("kaspersky");
  });
});
