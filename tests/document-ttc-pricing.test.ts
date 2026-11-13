import { describe, expect, it } from "vitest";
import { calculateDocumentTotals, calculateLineTotals } from "@/lib/documents";
import { documentLinePricePayload, documentLinePricingSnapshot, restoreDocumentLineTTC } from "@/lib/document-line-pricing";
import { DEFAULT_TAX_CONFIGURATION, normalizeTaxConfiguration } from "@/lib/taxes";
import { invoiceInputSchema } from "@/server/invoices";
import { quoteInputSchema } from "@/server/quotes";

const vatOnly = { taxConfiguration: DEFAULT_TAX_CONFIGURATION, applyFodec: false, applyTimbre: false };
const baseLine = { quantity: 1, unitPriceHTCents: 100000, unitPriceTTCCents: 119000, vatRate: 19 };

describe("quote/invoice TTC calculations", () => {
  it.each([1, 2, 1.5])("preserves VAT-inclusive prices with quantity %s", (quantity) => {
    const line = calculateLineTotals({ ...baseLine, quantity });
    const totals = calculateDocumentTotals([line], null, null, vatOnly);
    expect(line.totalHTCents).toBe(100000 * quantity);
    expect(totals.totalTVACents).toBe(19000 * quantity);
    expect(totals.totalTTCCents).toBe(119000 * quantity);
  });

  it.each([0, 7, 13, 19])("uses %s%% VAT with TTC as the source", (vatRate) => {
    const line = calculateLineTotals({ ...baseLine, unitPriceTTCCents: (100 + vatRate) * 1000, vatRate });
    expect(line.totalHTCents).toBe(100000);
    expect(calculateDocumentTotals([line], null, null, vatOnly).totalTVACents).toBe(vatRate * 1000);
  });

  it.each([1, 2, 3, 0.5])("does not reconstruct gross prices from rounded unit HT (quantity %s)", (quantity) => {
    const line = calculateLineTotals({ ...baseLine, unitPriceHTCents: 3, unitPriceTTCCents: 3, quantity });
    const totals = calculateDocumentTotals([line], null, null, vatOnly);
    expect(totals.totalTTCCents).toBe(Math.round(3 * quantity));
    expect(line.totalHTCents + line.totalTVACents).toBe(line.totalTTCCents);
  });

  it("retains line and global discounts, FODEC, and fiscal stamps", () => {
    const line = calculateLineTotals({ ...baseLine, discountRate: 10 });
    const totals = calculateDocumentTotals([line], 10, null, {
      taxConfiguration: DEFAULT_TAX_CONFIGURATION, applyFodec: true, applyTimbre: true,
    });
    expect(totals.subtotalHTCents).toBe(90000);
    expect(totals.globalDiscountAppliedCents).toBe(9000);
    expect(totals.fodecAmountCents).toBe(810);
    expect(totals.totalTVACents).toBe(15544);
    expect(totals.totalTTCCents).toBe(98354);
    expect(totals.taxSummary.find((tax) => tax.type === "TVA")?.amountCents).toBe(15544);
  });

  it("supports fixed HT discounts and 100% discounts", () => {
    const fixed = calculateLineTotals({ ...baseLine, quantity: 2, discountAmountCents: 10000 });
    expect(calculateDocumentTotals([fixed], null, null, vatOnly).totalTTCCents).toBe(226100);
    const free = calculateLineTotals({ ...baseLine, discountRate: 100 });
    expect(calculateDocumentTotals([free], null, null, vatOnly).totalTTCCents).toBe(0);
    const remainder = calculateLineTotals({ ...baseLine, unitPriceHTCents: 13, unitPriceTTCCents: 16, discountRate: 100 });
    expect(calculateDocumentTotals([remainder], null, null, vatOnly).totalTTCCents).toBe(0);
    const globalFree = calculateLineTotals({ ...baseLine, unitPriceHTCents: 13, unitPriceTTCCents: 16 });
    expect(calculateDocumentTotals([globalFree], 100, null, vatOnly).totalTTCCents).toBe(0);
  });

  it.each(["nearest-cent", "up", "down"] as const)("honors %s rounding without losing the entered gross", (mode) => {
    const config = { ...DEFAULT_TAX_CONFIGURATION, rounding: { line: mode, total: mode } };
    const line = calculateLineTotals({ ...baseLine, unitPriceTTCCents: 1000 }, { roundingMode: mode });
    expect(calculateDocumentTotals([line], null, null, { ...vatOnly, taxConfiguration: config }).totalTTCCents).toBe(1000);
  });

  it("keeps HT-only documents unchanged and supports mixed pricing bases", () => {
    const ht = calculateLineTotals({ unitPriceHTCents: 3, quantity: 1, vatRate: 19 });
    const ttc = calculateLineTotals({ ...baseLine, unitPriceTTCCents: 3, unitPriceHTCents: 3 });
    expect(ht.totalTTCCents).toBe(4);
    expect(calculateDocumentTotals([ht, ttc], null, null, vatOnly).totalTTCCents).toBe(7);
  });
});

describe("document price payloads and snapshots", () => {
  it("derives HT from the selected TTC and rejects incomplete input instead of saving zero", () => {
    expect(documentLinePricePayload({ unitPrice: 999, unitPriceTTC: "119.000", vatRate: 19 }, "TND"))
      .toEqual({ unitPriceHTCents: 100000, unitPriceTTCCents: 119000 });
    expect(documentLinePricePayload({ unitPrice: "", vatRate: 19 }, "TND").unitPriceHTCents).toBeNaN();
    expect(documentLinePricePayload({ unitPrice: "1.0001", vatRate: 19 }, "TND").unitPriceHTCents).toBeNaN();
    expect(documentLinePricePayload({ unitPrice: "1.001", vatRate: 19 }, "TND").unitPriceHTCents).toBe(1001);
  });

  it("restores exact TTC by persisted position, including zero, after JSON normalization", () => {
    const config = normalizeTaxConfiguration({ ...DEFAULT_TAX_CONFIGURATION, linePricing: documentLinePricingSnapshot([
      { position: 4, unitPriceTTCCents: 3 }, { position: 2 }, { position: 8, unitPriceTTCCents: 0 },
    ]) });
    expect(restoreDocumentLineTTC(config, 4, "TND")).toBe(0.003);
    expect(restoreDocumentLineTTC(config, 8, "TND")).toBe(0);
    expect(restoreDocumentLineTTC(config, 2, "TND")).toBeUndefined();
    expect(restoreDocumentLineTTC(normalizeTaxConfiguration(), 0, "TND")).toBeUndefined();
  });

  for (const [kind, schema] of [["quote", quoteInputSchema], ["invoice", invoiceInputSchema]] as const) {
    it(`validates ${kind} TTC and recomputes untrusted HT on the server`, () => {
      const input = { clientId: "client", issueDate: new Date(), lines: [{
        ...baseLine, unitPriceHTCents: 999999, description: "Produit", unit: "unité", position: 0,
      }] };
      expect(schema.parse(input).lines[0].unitPriceHTCents).toBe(100000);
      for (const invalid of [-1, 1.5, Infinity, 2147483648, null]) {
        expect(schema.safeParse({ ...input, lines: [{ ...input.lines[0], unitPriceTTCCents: invalid }] }).success).toBe(false);
      }
      const legacy = { ...input.lines[0], unitPriceTTCCents: undefined };
      expect(schema.parse({ ...input, lines: [legacy] }).lines[0].unitPriceHTCents).toBe(999999);
    });
  }
});
