import { describe, it, expect } from "vitest";
import { formatCurrency, formatDecimal, formatPercent } from "@/lib/formatters";
import { calculateLineTotals } from "@/lib/documents";
import { fromCents } from "@/lib/money";

describe("formatters", () => {
  it("formats percentage values in Tunisian locale", () => {
    expect(formatPercent(19, "TND")).toBe("19,00\u00a0%");
    expect(formatPercent(7.5, "TND")).toBe("7,50\u00a0%");
    expect(formatPercent(7, "TND")).toBe("7,00\u00a0%");
    expect(formatPercent(0.19, "TND")).toBe("19,00\u00a0%");
    expect(formatPercent(0.075, "TND")).toBe("7,50\u00a0%");
    expect(formatPercent(0.07, "TND")).toBe("7,00\u00a0%");
  });

  it("renders Tunisian dinar amounts with millimes", () => {
    expect(formatCurrency(12.345, "TND")).toBe("12,345\u00a0DT");
    expect(formatDecimal(98.765, "TND")).toBe("98,765");
  });

  it("formats cart totals with discount and VAT", () => {
    const line = calculateLineTotals({
      quantity: 2,
      unitPriceHTCents: 10000,
      vatRate: 19,
      discountRate: 10,
    });

    const total = fromCents(line.totalTTCCents, "TND");
    const tax = fromCents(line.totalTVACents, "TND");
    const discount = fromCents(line.discountAmountCents, "TND");

    expect(formatCurrency(total, "TND")).toBe("21,420\u00a0DT");
    expect(formatDecimal(tax, "TND")).toBe("3,420");
    expect(formatDecimal(discount, "TND")).toBe("2,000");
  });

  it("keeps two decimals for euro amounts", () => {
    expect(formatCurrency(12.3, "EUR")).toBe("12,30\u00a0€");
    expect(formatDecimal(98.7, "EUR")).toBe("98,70");
  });
});
