import { describe, expect, it } from "vitest";
import {
  codeFormatForSku,
  DIGITAL_PRODUCT_FAMILIES,
  DIGITAL_PRODUCT_SKUS,
  familyOfSku,
  getDigitalProductVariant,
  isFamilySku,
  variantDurationLabel,
  variantGroupKey,
} from "@/lib/digital-products/catalog";
import {
  getIdmVariant,
  IDM_ANNUAL_SKU,
  IDM_LIFETIME_SKU,
} from "@/lib/digital-products/idm-catalog";
import { KASPERSKY_SKUS } from "@/lib/digital-products/kaspersky-catalog";
import {
  formatLicenceCode,
  IDM_CODE_FORMAT,
  isValidLicenceCode,
  KASPERSKY_CODE_FORMAT,
  maskLicenceCode,
  parseLicenceCodeInput,
} from "@/lib/digital-products/licence-code-format";
import { WINDOWS_11_PRO_SKU } from "@/lib/digital-products/windows-catalog";
import { licenceApiPayloadSchema } from "@/server/digital-products/api";
import { digitalOrderPayloadSchema } from "@/server/digital-products/fulfilment";
import { buildIdmLicenceHtml } from "@/server/digital-products/idm-licence-html";
import { DEFAULT_SELLER_BRANDING } from "@/server/digital-products/kaspersky-licence-html";
import {
  buildLicenceDocumentHtml,
  licencePdfFilename,
  parseLicenceRequest,
} from "@/server/digital-products/licences";
import { buildPayload } from "./fixtures/prestashop-order";

const SERIAL_A = "TSTID0A1B2C3D4E5F6G7"; // 20 chars, fake
const SERIAL_B = "TSTID9Z8Y7X6W5V4U3T2";

describe("IDM catalogue", () => {
  it("registers the annual and lifetime SKUs after the existing ones without changing them", () => {
    expect(DIGITAL_PRODUCT_SKUS).toEqual([...KASPERSKY_SKUS, WINDOWS_11_PRO_SKU, IDM_ANNUAL_SKU, IDM_LIFETIME_SKU]);
    expect(getDigitalProductVariant(IDM_ANNUAL_SKU)).toMatchObject({
      family: "idm",
      plan: "annual",
      devices: 1,
      durationMonths: 12,
      label: "Internet Download Manager | 1 an | 1 PC",
    });
    expect(getDigitalProductVariant(IDM_LIFETIME_SKU)).toMatchObject({
      family: "idm",
      plan: "lifetime",
      devices: 1,
      durationMonths: null,
      label: "Internet Download Manager | À vie | 1 PC",
    });
    expect(familyOfSku(IDM_LIFETIME_SKU)?.basePath).toBe("/produits-digitaux/idm");
    expect(isFamilySku(DIGITAL_PRODUCT_FAMILIES.idm, IDM_ANNUAL_SKU)).toBe(true);
    expect(isFamilySku(DIGITAL_PRODUCT_FAMILIES.idm, "kaspersky-plus-3p-1y")).toBe(false);
    expect(isFamilySku(DIGITAL_PRODUCT_FAMILIES.idm, WINDOWS_11_PRO_SKU)).toBe(false);
    expect(isFamilySku(DIGITAL_PRODUCT_FAMILIES.kaspersky, IDM_ANNUAL_SKU)).toBe(false);
    expect(isFamilySku(DIGITAL_PRODUCT_FAMILIES.windows, IDM_ANNUAL_SKU)).toBe(false);
  });

  it("groups variants by plan and exposes their own duration", () => {
    const [annual, lifetime] = DIGITAL_PRODUCT_FAMILIES.idm.variants;
    expect(DIGITAL_PRODUCT_FAMILIES.idm.groups.map((group) => group.key)).toEqual(["annual", "lifetime"]);
    expect(variantGroupKey(annual)).toBe("annual");
    expect(variantDurationLabel(annual)).toBe("1 an");
    expect(variantDurationLabel(lifetime)).toBe("À vie");
    // Other families keep their family-level duration.
    expect(variantDurationLabel(getDigitalProductVariant(WINDOWS_11_PRO_SKU)!)).toBe("Perpétuelle");
    expect(variantDurationLabel(getDigitalProductVariant("kaspersky-plus-3p-1y")!)).toBe("1 an");
  });

  it("uses a 20-character serial format of its own", () => {
    expect(codeFormatForSku(IDM_ANNUAL_SKU)).toBe(IDM_CODE_FORMAT);
    expect(codeFormatForSku("kaspersky-plus-3p-1y")).toBe(KASPERSKY_CODE_FORMAT);
    expect(isValidLicenceCode(SERIAL_A, IDM_CODE_FORMAT)).toBe(true);
    expect(isValidLicenceCode(SERIAL_A.slice(0, 19), IDM_CODE_FORMAT)).toBe(false);
    expect(isValidLicenceCode(`${SERIAL_A}AAAAA`, IDM_CODE_FORMAT)).toBe(false);
    expect(formatLicenceCode(SERIAL_A, IDM_CODE_FORMAT)).toBe("TSTID-0A1B2-C3D4E-5F6G7");
    expect(maskLicenceCode("6G7", IDM_CODE_FORMAT)).toBe("•••••-•••••-•••••-••6G7");

    const parsed = parseLicenceCodeInput(
      ["Numéro de série", "tstid-0a1b2-c3d4e-5f6g7", SERIAL_B, SERIAL_A, "SHORT-KEY"].join("\n"),
      IDM_CODE_FORMAT,
    );
    expect(parsed.valid.map((row) => row.code)).toEqual([SERIAL_A, SERIAL_B]);
    expect(parsed.duplicateLines).toEqual([4]);
    expect(parsed.invalidLines).toEqual([5]);
  });

  it("is accepted by the licence API, the PrestaShop order payload and the PDF naming", () => {
    expect(parseLicenceRequest({ sku: IDM_LIFETIME_SKU, quantity: 2 }).sku).toBe(IDM_LIFETIME_SKU);
    expect(licenceApiPayloadSchema.safeParse({ schemaVersion: 1, sku: IDM_ANNUAL_SKU, quantity: 1 }).success).toBe(true);
    expect(licenceApiPayloadSchema.safeParse({ schemaVersion: 1, sku: "idm-2p-1y", quantity: 1 }).success).toBe(false);
    const order = digitalOrderPayloadSchema.safeParse({
      schemaVersion: 1,
      invoice: buildPayload(),
      licences: [
        { lineId: 1, sku: IDM_ANNUAL_SKU, quantity: 1 },
        { lineId: 2, sku: IDM_LIFETIME_SKU, quantity: 1 },
      ],
    });
    expect(order.success).toBe(true);
    expect(licencePdfFilename({ number: "LIC-20261123-ABC123", productSku: IDM_LIFETIME_SKU })).toBe(
      "licence-idm-1p-lifetime-LIC-20261123-ABC123.pdf",
    );
  });
});

describe("IDM licence certificate", () => {
  const annual = getIdmVariant(IDM_ANNUAL_SKU)!;
  const lifetime = getIdmVariant(IDM_LIFETIME_SKU)!;

  it("prints one certificate per serial with the order details", () => {
    const html = buildIdmLicenceHtml({
      variant: annual,
      codes: [SERIAL_A, SERIAL_B],
      licenceNumber: "LIC-20261123-ABC123",
      orderReference: "XKBKNABJK",
      customerName: "Amine Ben Salah",
      useBefore: "2026-12-01",
      seller: DEFAULT_SELLER_BRANDING,
    });
    expect((html.match(/<main class="certificate/g) ?? []).length).toBe(2);
    expect(html).toContain('<div class="key">TSTID-0A1B2-C3D4E-5F6G7</div>');
    expect(html).toContain('<div class="key">TSTID-9Z8Y7-X6W5V-4U3T2</div>');
    expect(html).toContain('<span class="plan-pill">1 an · 1 PC</span>');
    expect(html).toContain("Validité · 1 an");
    expect(html).toContain("Votre licence <span>Internet Download</span><span>Manager</span>");
    expect(html).toContain("LIC-20261123-ABC123");
    expect(html).toContain("XKBKNABJK");
    expect(html).toContain("Amine Ben Salah");
    expect(html).toContain("1er décembre 2026");
    expect(html).toContain("1 / 2");
    expect(html).toContain("2 / 2");
    expect(html).toContain("support@techno-smart.tn");
    expect(html).toContain("https://www.internetdownloadmanager.com/download.html");
    expect(html).toContain('src="data:image/png;base64,'); // white Techno Smart logo
    // SVG gradient ids are unique per page.
    expect(html).toContain('id="idm0-globeB"');
    expect(html).toContain('id="idm1-globeB"');
    // Static document: no script, no form field, no external resource.
    expect(html).not.toMatch(/<script|<input|<button|<select|<link /i);
    expect(html).not.toMatch(/src="https?:/i);
  });

  it("uses the lifetime wording for the lifetime plan", () => {
    const html = buildIdmLicenceHtml({
      variant: lifetime,
      codes: [SERIAL_A],
      licenceNumber: "LIC-1",
      seller: DEFAULT_SELLER_BRANDING,
    });
    expect(html).toContain('<span class="plan-pill">À vie · 1 PC</span>');
    expect(html).toContain("Validité · À vie");
    expect(html).not.toContain("Validité · 1 an");
  });

  it("escapes every dynamic value and brands other sellers by name", () => {
    const html = buildIdmLicenceHtml({
      variant: annual,
      codes: [SERIAL_A],
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
    expect(html).toContain("help@acme.test");
    expect(html).not.toContain("data:image/png");
  });

  it("is selected by the shared renderer for IDM only", () => {
    const common = { codes: [SERIAL_A], licenceNumber: "LIC-1", seller: DEFAULT_SELLER_BRANDING };
    const idm = buildLicenceDocumentHtml({ ...common, variant: lifetime });
    expect(idm).toContain("Certificat de licence Internet Download Manager | À vie | 1 PC");
    const kaspersky = buildLicenceDocumentHtml({ ...common, variant: getDigitalProductVariant("kaspersky-plus-3p-1y")! });
    expect(kaspersky).toContain('class="wordmark">kaspersky');
    expect(kaspersky).not.toContain("Internet Download Manager");
  });
});
