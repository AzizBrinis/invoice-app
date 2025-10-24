import { describe, expect, it } from "vitest";
import { toCents } from "@/lib/money";
import { formatPercent } from "@/lib/formatters";
import { calculateLineTotals } from "@/lib/documents";

// These tests document the current incorrect behaviour observed during the audit.
describe("audit regressions", () => {
  it("preserves tunisian millimes when converting amounts", () => {
    const cents = toCents(1.234, "TND");
    expect(cents).toBe(1234);
  });

  it("formats percentages as rates", () => {
    const rendered = formatPercent(7);
    expect(rendered).toBe("7,00\u00a0%");
  });

  it("accepts negative discounts leading to inflated totals", () => {
    const line = calculateLineTotals({
      quantity: 1,
      unitPriceHTCents: 1000,
      vatRate: 19,
      discountAmountCents: -100,
    });
    expect(line.totalHTCents).toBe(1100);
  });
});
