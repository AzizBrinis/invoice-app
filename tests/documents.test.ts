import { describe, it, expect } from "vitest";
import { calculateLineTotals, calculateDocumentTotals } from "@/lib/documents";
import { toCents } from "@/lib/money";

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

    const totals = calculateDocumentTotals(lines, 5, undefined);

    expect(totals.subtotalHTCents).toBe(25000 - 250); // includes line discount
    expect(totals.totalTVACents).toBeGreaterThan(0);
    const netSubtotal =
      totals.subtotalHTCents - totals.globalDiscountAppliedCents;
    expect(totals.totalTTCCents).toBe(netSubtotal + totals.totalTVACents);
    expect(totals.vatEntries.length).toBe(2);
  });
});
