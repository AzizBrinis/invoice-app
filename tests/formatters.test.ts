import { describe, it, expect } from "vitest";
import { formatCurrency, formatDecimal, formatPercent } from "@/lib/formatters";

describe("formatters", () => {
  it("formats percentage values in Tunisian locale", () => {
    expect(formatPercent(19, "TND")).toBe("19,00\u00a0%");
    expect(formatPercent(7.5, "TND")).toBe("7,50\u00a0%");
  });

  it("renders Tunisian dinar amounts with millimes", () => {
    expect(formatCurrency(12.345, "TND")).toBe("12,345\u00a0DT");
    expect(formatDecimal(98.765, "TND")).toBe("98,765");
  });

  it("keeps two decimals for euro amounts", () => {
    expect(formatCurrency(12.3, "EUR")).toBe("12,30\u00a0€");
    expect(formatDecimal(98.7, "EUR")).toBe("98,70");
  });
});
