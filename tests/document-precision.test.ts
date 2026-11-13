import { describe, expect, it } from "vitest";
import { documentDecimalNumber, parseDocumentAmount } from "@/lib/document-precision";
import { documentLinePricePayload } from "@/lib/document-line-pricing";
import { calculateLineTotals, calculateDocumentTotals } from "@/lib/documents";
import { invoiceInputSchema } from "@/server/invoices";
import { quoteInputSchema } from "@/server/quotes";
import { formatCurrency, formatDocumentAmount, formatDocumentRate } from "@/lib/formatters";

const line = { description: "Service", unit: "unité", position: 0, quantity: 3, unitPriceHTCents: 1234.5, vatRate: 19, discountRate: 12.345 };

describe("three-decimal document inputs", () => {
  it.each(["EUR", "USD", "GBP", "CAD", "TND"])("preserves comma and dot inputs in %s", (currency) => {
    const expected = currency === "TND" ? 12345 : 1234.5;
    for (const value of ["12,345", "12.345", 12.345]) {
      expect(parseDocumentAmount(value, currency)).toBe(expected);
      expect(documentLinePricePayload({ unitPrice: value, vatRate: 19 }, currency).unitPriceHTCents).toBe(expected);
    }
    for (const value of ["12.3456", "1,234.5", "NaN", "Infinity", "1e3", "-1", ""]) {
      expect(parseDocumentAmount(value, currency)).toBeNaN();
    }
  });

  for (const [kind, schema] of [["invoice", invoiceInputSchema], ["quote", quoteInputSchema]] as const) {
    it(`validates ${kind} prices, line/global fixed discounts and rates on the server`, () => {
      const input = { clientId: "client", issueDate: new Date(), currency: "EUR", globalDiscountRate: 1.234,
        globalDiscountAmountCents: 123.4, lines: [{ ...line, discountAmountCents: 12.3 }] };
      expect(schema.parse(input).lines[0].unitPriceHTCents).toBe(1234.5);
      for (const field of ["unitPriceHTCents", "unitPriceTTCCents", "discountAmountCents", "discountRate"]) {
        for (const invalid of [-1, Infinity, NaN, field === "discountRate" ? 12.3456 : 12.345]) {
          expect(schema.safeParse({ ...input, lines: [{ ...line, [field]: invalid }] }).success).toBe(false);
        }
      }
      expect(schema.safeParse({ ...input, globalDiscountRate: 100.001 }).success).toBe(false);
      expect(schema.safeParse({ ...input, globalDiscountRate: 0.0001 }).success).toBe(false);
      expect(schema.safeParse({ ...input, globalDiscountAmountCents: 123.45 }).success).toBe(false);
      expect(schema.safeParse({ ...input, currency: "TND" }).success).toBe(false);
      expect(schema.parse({ ...input, currency: "TND", globalDiscountAmountCents: 12345,
        lines: [{ ...line, unitPriceHTCents: 12345 }] }).lines[0].unitPriceHTCents).toBe(12345);
    });
  }

  it("extends the precise unit price before rounding, then calculates discounts and taxes", () => {
    const computed = calculateLineTotals(line);
    expect(computed).toMatchObject({ totalHTCents: 3247, discountAmountCents: 457 });
    expect(calculateDocumentTotals([computed], 1.234)).toMatchObject({
      subtotalHTCents: 3247, globalDiscountAppliedCents: 40, totalTVACents: 609, totalTTCCents: 3816,
    });
    expect(calculateLineTotals({ ...line, unitPriceHTCents: 14.5, quantity: 100, discountRate: null }).totalHTCents).toBe(1450);
    expect(calculateLineTotals({ ...line, unitPriceHTCents: 10000, quantity: 1, discountRate: 0.005 }).discountAmountCents).toBe(1);
    expect(calculateDocumentTotals([calculateLineTotals(line)], null, 123.4)).toMatchObject({
      globalDiscountAppliedCents: 123, totalTVACents: 594, totalTTCCents: 3718,
    });
  });

  it("rounds fixed discounts at the existing monetary boundary and caps full discounts", () => {
    expect(calculateLineTotals({ ...line, discountAmountCents: 12.5 }).discountAmountCents).toBe(13);
    expect(calculateDocumentTotals([calculateLineTotals({ ...line, discountRate: 100 })]).totalTTCCents).toBe(0);
    expect(calculateDocumentTotals([calculateLineTotals(line)], 100).totalTTCCents).toBe(0);
  });

  it("keeps legacy totals and formatting while showing the full input precision", () => {
    expect(calculateLineTotals({ ...line, unitPriceHTCents: 1234, discountRate: 12.34 })).toMatchObject({ totalHTCents: 3245, totalTVACents: 617, totalTTCCents: 3862 });
    expect(formatDocumentAmount(12.345, "EUR")).toContain("12,345");
    expect(formatDocumentAmount(12.34, "EUR")).toContain("12,34");
    expect(formatCurrency(12.34, "EUR")).toContain("12,34");
    expect(formatDocumentRate(0.125, "EUR")).toBe("0,125 %");
    expect(documentDecimalNumber("12,345")).toBe(12.345);
  });
});
