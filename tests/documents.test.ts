import { describe, it, expect } from "vitest";
import { calculateLineTotals, calculateDocumentTotals } from "@/lib/documents";
import { toCents } from "@/lib/money";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";

describe("calculations helpers", () => {
  it("compute line totals with discount", () => {
    const input = {
      quantity: 3,
      unitPriceHTCents: toCents(120.5),
      vatRate: 20,
      discountRate: 10,
    } as const;
    const result = calculateLineTotals(input);
    expect(result.totalHTCents).toBe(32535);
    expect(result.totalTVACents).toBe(6507);
    expect(result.totalTTCCents).toBe(39042);
    expect(result.fodecAmountCents).toBe(0);
  });

  it("aggregate document totals with global discount", () => {
    const lines = [
      calculateLineTotals({
        quantity: 2,
        unitPriceHTCents: toCents(100),
        vatRate: 20,
      }),
      calculateLineTotals({
        quantity: 1,
        unitPriceHTCents: toCents(50),
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

    expect(totals.subtotalHTCents).toBe(25000 - 250); // includes line discount
    expect(totals.totalTVACents).toBeGreaterThan(0);
    const netSubtotal =
      totals.subtotalHTCents - totals.globalDiscountAppliedCents;
    expect(totals.totalTTCCents).toBe(netSubtotal + totals.totalTVACents);
    expect(totals.vatEntries.length).toBe(2);
  });
});
