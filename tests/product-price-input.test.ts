import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  calculateProductPrices, getProductVatRates, MAX_PRODUCT_PRICE_CENTS,
  parseProductPrice, parseProductPriceFields,
} from "@/lib/product-price-input";
import { DEFAULT_TAX_CONFIGURATION, normalizeTaxConfiguration } from "@/lib/taxes";

describe("product price entry", () => {
  it.each([19, 13, 7, 0])("splits TTC at %s%% with three TND decimals", (rate) => {
    expect(calculateProductPrices((100 + rate) * 1000, "TTC", rate)).toEqual({
      priceHTCents: 100000, priceTTCCents: (100 + rate) * 1000, vatAmountCents: rate * 1000,
    });
  });

  it("rounds ties half up and retains the entered TTC even when HT cannot round-trip", () => {
    expect(calculateProductPrices(119, "TTC", 19)).toEqual({ priceHTCents: 100, priceTTCCents: 119, vatAmountCents: 19 });
    expect(calculateProductPrices(3, "TTC", 19)).toEqual({ priceHTCents: 3, priceTTCCents: 3, vatAmountCents: 0 });
    expect(calculateProductPrices(3, "TTC", 100)).toEqual({ priceHTCents: 2, priceTTCCents: 3, vatAmountCents: 1 });
    expect(calculateProductPrices(50, "HT", 13).priceTTCCents).toBe(57);
    expect(calculateProductPrices(0, "TTC", 19).vatAmountCents).toBe(0);
  });

  it("keeps HT + VAT equal to TTC across millime rounding boundaries", () => {
    for (const rate of [0, 7, 13, 19, 5.5, 100]) {
      for (let amount = 0; amount < 2000; amount++) {
        const result = calculateProductPrices(amount, "TTC", rate);
        expect(result.priceHTCents + result.vatAmountCents).toBe(amount);
        expect(Math.abs(result.priceHTCents - amount / (1 + rate / 100))).toBeLessThanOrEqual(0.500000001);
      }
    }
  });

  it("parses decimal prices exactly, including decimal commas and other currencies", () => {
    expect(parseProductPrice("1.001", "TND", "priceTTCCents")).toBe(1001);
    expect(parseProductPrice(" 119,000 ", "TND", "priceTTCCents")).toBe(119000);
    expect(parseProductPrice(".001", "TND", "priceTTCCents")).toBe(1);
    expect(parseProductPrice("1.01", "EUR", "priceTTCCents")).toBe(101);
  });

  it.each(["", " ", "-1", "NaN", "Infinity", "1e3", "0x10", "1.0001", "2147483.648", null])(
    "rejects invalid price %s", (value) => {
      expect(() => parseProductPrice(value, "TND", "priceTTCCents")).toThrow(ZodError);
    },
  );

  it("validates database limits on the entered and calculated prices", () => {
    expect(parseProductPrice("2147483.647", "TND", "priceTTCCents")).toBe(MAX_PRODUCT_PRICE_CENTS);
    expect(() => calculateProductPrices(MAX_PRODUCT_PRICE_CENTS, "HT", 19)).toThrow(ZodError);
    expect(() => calculateProductPrices(1, "TTC", Infinity)).toThrow(ZodError);
    expect(() => calculateProductPrices(1, "TTC", -1)).toThrow(ZodError);
    expect(() => calculateProductPrices(1.5, "TTC", 19)).toThrow(ZodError);
  });

  it("uses configured categories and exemption policy without replacing custom rates", () => {
    expect(getProductVatRates(DEFAULT_TAX_CONFIGURATION).map(({ rate }) => rate)).toEqual([19, 13, 7, 0]);
    const custom = normalizeTaxConfiguration({ tva: { rates: [
      { code: "CUSTOM", label: "Taux spécial", rate: 5.5 },
      { code: "EXON", label: "Exonération", rate: 0 },
    ], allowExemption: false } });
    expect(getProductVatRates(custom).map(({ rate }) => rate)).toEqual([5.5]);
    expect(getProductVatRates(custom, 20).map(({ rate }) => rate)).toEqual([5.5, 20]);
    expect(getProductVatRates(custom, 0).map(({ rate }) => rate)).toEqual([5.5, 0]);
  });

  it("recomputes derived fields on the server and supports legacy HT submissions", () => {
    const form = new FormData();
    form.set("priceBasis", "TTC");
    form.set("priceTTC", "119.000");
    form.set("priceHT", "99999");
    form.set("vatRate", "19");
    expect(parseProductPriceFields(form, "TND", DEFAULT_TAX_CONFIGURATION)).toEqual({
      priceHTCents: 100000, priceTTCCents: 119000, vatRate: 19,
    });
    form.delete("priceBasis");
    form.set("priceHT", "100.001");
    expect(parseProductPriceFields(form, "TND", DEFAULT_TAX_CONFIGURATION).priceTTCCents).toBe(119001);
    form.set("vatRate", "20");
    expect(() => parseProductPriceFields(form, "TND", DEFAULT_TAX_CONFIGURATION)).toThrow(ZodError);
    expect(parseProductPriceFields(form, "TND", DEFAULT_TAX_CONFIGURATION, 20).vatRate).toBe(20);
    form.set("priceBasis", "garbage");
    expect(() => parseProductPriceFields(form, "TND", DEFAULT_TAX_CONFIGURATION, 20)).toThrow(ZodError);
  });
});
