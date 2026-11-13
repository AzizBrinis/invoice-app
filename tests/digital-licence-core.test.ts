import { afterEach, describe, expect, it } from "vitest";
import {
  getKasperskyVariant,
  KASPERSKY_SKUS,
  KASPERSKY_VARIANTS,
} from "@/lib/digital-products/kaspersky-catalog";
import {
  formatLicenceCode,
  isValidLicenceCode,
  LicenceImportTooLargeError,
  licenceCodeHint,
  maskLicenceCode,
  normalizeLicenceCode,
  parseLicenceCodeInput,
} from "@/lib/digital-products/licence-code-format";
import {
  decryptLicenceCode,
  encryptLicenceCode,
  fingerprintLicenceCode,
  isLicenceEncryptionConfigured,
  LicenceEncryptionConfigError,
  assertLicenceEncryptionConfigured,
  resetLicenceKeyCacheForTests,
} from "@/server/digital-products/licence-crypto";
import {
  buildKasperskyLicenceHtml,
  DEFAULT_SELLER_BRANDING,
  formatFrenchDate,
} from "@/server/digital-products/kaspersky-licence-html";
import {
  hashLicenceRequest,
  LicenceValidationError,
  parseLicenceRequest,
} from "@/server/digital-products/licences";

const CODE_A = "ABCDE12345FGHIJ67890";
const CODE_B = "KLMNO12345PQRST67890";

describe("Kaspersky catalogue", () => {
  it("exposes exactly the 8 requested 1-year variants", () => {
    const matrix = KASPERSKY_VARIANTS.map((variant) => `${variant.tier}-${variant.devices}`);
    expect(matrix).toEqual([
      "standard-1",
      "standard-3",
      "plus-1",
      "plus-3",
      "plus-5",
      "plus-10",
      "premium-3",
      "premium-5",
    ]);
    expect(new Set(KASPERSKY_SKUS).size).toBe(8);
    expect(KASPERSKY_VARIANTS.every((variant) => variant.durationMonths === 12)).toBe(true);
    expect(getKasperskyVariant("kaspersky-plus-10p-1y")?.label).toBe("Kaspersky Plus | 1 an | 10 Postes");
    expect(getKasperskyVariant("kaspersky-standard-1p-1y")?.label).toBe("Kaspersky Standard | 1 an | 1 Poste");
    expect(getKasperskyVariant("kaspersky-premium-1p-1y")).toBeNull();
  });
});

describe("activation code format", () => {
  it("normalizes, validates, formats and masks codes", () => {
    expect(normalizeLicenceCode(" abcde-12345 fghij_67890 ")).toBe(CODE_A);
    expect(isValidLicenceCode(CODE_A)).toBe(true);
    expect(isValidLicenceCode("ABCDE12345")).toBe(false);
    expect(isValidLicenceCode("ABCDE12345FGHIJ6789É")).toBe(false);
    expect(formatLicenceCode(CODE_A)).toBe("ABCDE-12345-FGHIJ-67890");
    expect(licenceCodeHint(CODE_A)).toBe("7890");
    expect(maskLicenceCode("7890")).toBe("•••••-•••••-•••••-•7890");
    expect(maskLicenceCode(`<b>${CODE_A}`)).not.toContain("ABCDE");
  });

  it("parses bulk input: header, CSV cells, in-batch duplicates and invalid lines", () => {
    const parsed = parseLicenceCodeInput(
      [
        "Code d'activation;Lot",
        `${formatLicenceCode(CODE_A)};lot-1`,
        "",
        `"${CODE_B.toLowerCase()}",x`,
        "not-a-code",
        CODE_A,
      ].join("\r\n"),
    );
    expect(parsed.valid).toEqual([
      { line: 2, code: CODE_A },
      { line: 4, code: CODE_B },
    ]);
    expect(parsed.invalidLines).toEqual([5]);
    expect(parsed.duplicateLines).toEqual([6]);
  });

  it("rejects oversized imports", () => {
    const text = Array.from({ length: 5001 }, () => CODE_A).join("\n");
    expect(() => parseLicenceCodeInput(text)).toThrow(LicenceImportTooLargeError);
  });
});

describe("activation code encryption", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
    resetLicenceKeyCacheForTests();
  });

  it("round-trips and binds ciphertexts to tenant + row", () => {
    const ciphertext = encryptLicenceCode({ tenantId: "t1", codeId: "c1", code: CODE_A });
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(ciphertext).not.toContain(CODE_A);
    expect(decryptLicenceCode({ tenantId: "t1", codeId: "c1", ciphertext })).toBe(CODE_A);
    expect(() => decryptLicenceCode({ tenantId: "t1", codeId: "c2", ciphertext })).toThrow();
    expect(() => decryptLicenceCode({ tenantId: "t2", codeId: "c1", ciphertext })).toThrow();
    // Random IV: same code encrypts differently.
    expect(encryptLicenceCode({ tenantId: "t1", codeId: "c1", code: CODE_A })).not.toBe(ciphertext);
  });

  it("produces deterministic, tenant-scoped fingerprints", () => {
    expect(fingerprintLicenceCode("t1", CODE_A)).toBe(fingerprintLicenceCode("t1", CODE_A));
    expect(fingerprintLicenceCode("t1", CODE_A)).not.toBe(fingerprintLicenceCode("t2", CODE_A));
    expect(fingerprintLicenceCode("t1", CODE_A)).not.toContain(CODE_A);
  });

  it("requires a valid key in production and accepts base64/hex keys", () => {
    process.env = { ...originalEnv, NODE_ENV: "production" };
    delete process.env.DIGITAL_LICENCE_ENCRYPTION_KEY;
    resetLicenceKeyCacheForTests();
    expect(isLicenceEncryptionConfigured()).toBe(false);
    expect(() => assertLicenceEncryptionConfigured()).toThrow(LicenceEncryptionConfigError);

    process.env.DIGITAL_LICENCE_ENCRYPTION_KEY = "too-short";
    expect(() => assertLicenceEncryptionConfigured()).toThrow(LicenceEncryptionConfigError);

    process.env.DIGITAL_LICENCE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(isLicenceEncryptionConfigured()).toBe(true);
    const ciphertext = encryptLicenceCode({ tenantId: "t", codeId: "c", code: CODE_A });

    process.env.DIGITAL_LICENCE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("hex");
    expect(decryptLicenceCode({ tenantId: "t", codeId: "c", ciphertext })).toBe(CODE_A);

    process.env.DIGITAL_LICENCE_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("hex");
    expect(() => decryptLicenceCode({ tenantId: "t", codeId: "c", ciphertext })).toThrow();
  });
});

describe("licence request validation", () => {
  it("normalizes optional fields and hashes the business content", () => {
    const request = parseLicenceRequest({
      sku: "kaspersky-premium-5p-1y",
      quantity: "2",
      customerName: "  Amine  ",
      customerEmail: "Client@Example.com",
      useBefore: "",
    });
    expect(request).toMatchObject({
      quantity: 2,
      customerName: "Amine",
      customerEmail: "client@example.com",
      useBefore: null,
      orderReference: null,
    });
    expect(hashLicenceRequest(request)).toBe(hashLicenceRequest({ ...request }));
    expect(hashLicenceRequest(request)).not.toBe(hashLicenceRequest({ ...request, quantity: 3 }));
  });

  it("rejects unknown products, bad quantities and impossible dates", () => {
    expect(() => parseLicenceRequest({ sku: "kaspersky-plus-2p-1y", quantity: 1 })).toThrow(LicenceValidationError);
    expect(() => parseLicenceRequest({ sku: "kaspersky-plus-1p-1y", quantity: 0 })).toThrow(LicenceValidationError);
    expect(() => parseLicenceRequest({ sku: "kaspersky-plus-1p-1y", quantity: 51 })).toThrow(LicenceValidationError);
    expect(() => parseLicenceRequest({ sku: "kaspersky-plus-1p-1y", quantity: 1.5 })).toThrow(LicenceValidationError);
    expect(() =>
      parseLicenceRequest({ sku: "kaspersky-plus-1p-1y", quantity: 1, useBefore: "2026-02-30" }),
    ).toThrow(LicenceValidationError);
    expect(() =>
      parseLicenceRequest({ sku: "kaspersky-plus-1p-1y", quantity: 1, customerEmail: "nope" }),
    ).toThrow(LicenceValidationError);
  });
});

describe("licence HTML document", () => {
  const base = {
    licenceNumber: "LIC-20261110-ABCDEF",
    seller: DEFAULT_SELLER_BRANDING,
  };

  it("renders one A4 sheet per code with the variant theme and reference sections", () => {
    const html = buildKasperskyLicenceHtml({
      ...base,
      variant: getKasperskyVariant("kaspersky-premium-5p-1y")!,
      codes: [CODE_A, CODE_B],
      orderReference: "CMD-1",
      useBefore: "2027-01-01",
    });
    expect(html.match(/<article class="sheet"/g)).toHaveLength(2);
    expect(html).toContain('data-tier="premium"');
    expect(html).toContain("ABCDE-12345-FGHIJ-67890");
    expect(html).toContain("KLMNO-12345-PQRST-67890");
    expect(html).toContain("5 appareils");
    expect(html).toContain("1 / 2");
    expect(html).toContain("1er janvier 2027");
    expect(html).toContain("Code QR vers my.kaspersky.com");
    expect(html).toContain("https://www.kaspersky.com/downloads/premium");
    expect(html).toContain("support@techno-smart.tn");
    expect(html).toContain("size: A4 portrait");
    expect(html).not.toContain("<script");
  });

  it("escapes every customer-provided value", () => {
    const html = buildKasperskyLicenceHtml({
      ...base,
      variant: getKasperskyVariant("kaspersky-standard-1p-1y")!,
      codes: [CODE_A],
      customerName: '<img src=x onerror="alert(1)">',
      activationRegion: "Maghreb & Europe",
      seller: { ...DEFAULT_SELLER_BRANDING, name: "<script>x</script>" },
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Maghreb &amp; Europe");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain('data-tier="standard"');
    expect(html).toContain("1 appareil<");
  });

  it("formats French dates like the reference generator", () => {
    expect(formatFrenchDate("2026-03-01")).toBe("1er mars 2026");
    expect(formatFrenchDate("2026-03-15")).toBe("15 mars 2026");
    expect(formatFrenchDate("2026-02-30")).toBe("");
  });
});
