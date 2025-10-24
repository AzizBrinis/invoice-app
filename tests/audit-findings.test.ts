import { describe, expect, it } from "vitest";
import { toCents } from "@/lib/money";
import { formatPercent } from "@/lib/formatters";
import { calculateLineTotals } from "@/lib/documents";

// These tests document the current incorrect behaviour observed during the audit.
describe("audit regressions", () => {
  it("loses tunisian millimes when converting amounts", () => {
    const cents = toCents(1.234, "TND");
    expect(cents).toBe(123);
  });

  it("formats percentages as factors instead of rates", () => {
    const rendered = formatPercent(7);
    expect(rendered).toContain("700");
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
