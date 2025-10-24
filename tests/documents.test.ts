import { describe, it, expect } from "vitest";
import { calculateLineTotals, calculateDocumentTotals } from "@/lib/documents";
import { fromCents, toCents } from "@/lib/money";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";

describe("calculations helpers", () => {
  it("compute line totals with discount", () => {
    const currency = "TND";
    const input = {
      quantity: 3,
      unitPriceHTCents: toCents(120.5, currency),
      vatRate: 20,
      discountRate: 10,
    } as const;
    const result = calculateLineTotals(input);
    expect(fromCents(result.totalHTCents, currency)).toBeCloseTo(325.35);
    expect(fromCents(result.totalTVACents, currency)).toBeCloseTo(65.07);
    expect(fromCents(result.totalTTCCents, currency)).toBeCloseTo(390.42);
    expect(result.fodecAmountCents).toBe(0);
  });

  it("aggregate document totals with global discount", () => {
    const currency = "TND";
    const lines = [
      calculateLineTotals({
        quantity: 2,
        unitPriceHTCents: toCents(100, currency),
        vatRate: 20,
      }),
      calculateLineTotals({
        quantity: 1,
        unitPriceHTCents: toCents(50, currency),
        vatRate: 10,
        discountRate: 5,
      }),
    ];

    const taxConfig = {
      ...DEFAULT_TAX_CONFIGURATION,
      fodec: { ...DEFAULT_TAX_CONFIGURATION.fodec, enabled: false },
      timbre: { ...DEFAULT_TAX_CONFIGURATION.timbre, enabled: false, amountCents: 0 },
    };

    const totals = calculateDocumentTotals(lines, 5, undefined, {
      taxConfiguration: taxConfig,
      applyFodec: false,
      applyTimbre: false,
    });

    expect(fromCents(totals.subtotalHTCents, currency)).toBeCloseTo(247.5); // includes line discount
    expect(fromCents(totals.totalTVACents, currency)).toBeGreaterThan(0);
    const netSubtotal =
      totals.subtotalHTCents - totals.globalDiscountAppliedCents;
    expect(totals.totalTTCCents).toBe(netSubtotal + totals.totalTVACents);
    expect(totals.vatEntries.length).toBe(2);
  });

  it("handles millimes conversions for Tunisian dinar", () => {
    const amount = 12.345;
    const cents = toCents(amount, "TND");
    expect(cents).toBe(12345);
    expect(fromCents(cents, "TND")).toBeCloseTo(amount);
  });
});
