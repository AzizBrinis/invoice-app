import { describe, expect, it } from "vitest";
import {
  calculateDiscountedLineTotals,
  computeAdjustedUnitPriceTTCCents,
  resolveLineDiscountInput,
} from "@/lib/product-pricing";

describe("product pricing", () => {
  it("scales fixed product discounts by quantity for line totals", () => {
    const discount = resolveLineDiscountInput({
      quantity: 3,
      discountAmountCents: 125,
    });

    expect(discount).toEqual({
      discountRate: null,
      discountAmountCents: 375,
    });
  });

  it("applies a fixed product discount per unit when computing line totals", () => {
    const line = calculateDiscountedLineTotals({
      quantity: 2,
      unitPriceHTCents: 1000,
      vatRate: 20,
      discountAmountCents: 100,
    });

    expect(line.discountAmountCents).toBe(200);
    expect(line.totalHTCents).toBe(1800);
    expect(line.totalTVACents).toBe(360);
    expect(line.totalTTCCents).toBe(2160);
  });

  it("applies a fixed product discount to the displayed unit TTC price", () => {
    const unitAmountCents = computeAdjustedUnitPriceTTCCents({
      saleMode: "INSTANT",
      priceTTCCents: 1200,
      priceHTCents: 1000,
      vatRate: 20,
      discountAmountCents: 100,
    });

    expect(unitAmountCents).toBe(1080);
  });

  it("keeps option adjustments and fixed discounts working together", () => {
    const unitAmountCents = computeAdjustedUnitPriceTTCCents({
      saleMode: "INSTANT",
      priceTTCCents: 1200,
      priceHTCents: 1000,
      vatRate: 20,
      adjustmentCents: 250,
      discountAmountCents: 100,
    });

    expect(unitAmountCents).toBe(1380);
  });
});
