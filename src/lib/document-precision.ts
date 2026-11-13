import { z } from "zod";
import { getCurrencyInfo } from "@/lib/currency";

export const DOCUMENT_DECIMALS = 3;
const MAX_AMOUNT = 2_147_483_647;
export const documentAmountSchema = z.number().nonnegative().max(MAX_AMOUNT);
export const documentDiscountRateSchema = z.number().min(0).max(100).refine(
  (value) => hasDecimalPlaces(value, DOCUMENT_DECIMALS),
  "La remise doit contenir au maximum 3 décimales.",
);

export function hasDecimalPlaces(value: number, places: number) {
  return Number.isFinite(value) && value === Number(value.toFixed(places));
}

export function documentDecimalNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  const text = value?.trim().replace(",", ".") ?? "";
  return /^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(text) ? Number(text) : NaN;
}

// Preserve fractions of a minor unit for document inputs only. Payments and
// posted totals retain their existing currency-specific integer minor units.
export function parseDocumentAmount(value: string | number, currency: string): number {
  const amount = documentDecimalNumber(value);
  if (!Number.isFinite(amount) || amount < 0 || !hasDecimalPlaces(amount, 3)) return NaN;
  const thousandths = Math.round(amount * 1000);
  const minor = thousandths / (10 ** (3 - getCurrencyInfo(currency).decimals));
  return minor <= MAX_AMOUNT ? minor : NaN;
}

export function validateDocumentPrecision(document: {
  currency: string;
  globalDiscountAmountCents?: number | null;
  lines: { unitPriceHTCents: number; unitPriceTTCCents?: number; discountAmountCents?: number | null }[];
}, ctx: z.RefinementCtx) {
  const places = Math.max(0, 3 - getCurrencyInfo(document.currency).decimals);
  const check = (value: number | null | undefined, path: (string | number)[]) => {
    if (value != null && !hasDecimalPlaces(value, places)) {
      ctx.addIssue({ code: "custom", path, message: "Le montant doit contenir au maximum 3 décimales." });
    }
  };
  check(document.globalDiscountAmountCents, ["globalDiscountAmountCents"]);
  document.lines.forEach((line, index) => {
    check(line.unitPriceHTCents, ["lines", index, "unitPriceHTCents"]);
    check(line.unitPriceTTCCents, ["lines", index, "unitPriceTTCCents"]);
    check(line.discountAmountCents, ["lines", index, "discountAmountCents"]);
  });
}

// Multiply decimal inputs as exact rationals before rounding at the monetary
// boundary (e.g. 0.145 EUR x 100 must produce 14.50, without binary drift).
export function roundDecimalProduct(...values: number[]) {
  let numerator = BigInt(1);
  let denominator = BigInt(1);
  for (const value of values) {
    const [mantissa, exponent = "0"] = String(value).split("e");
    const [whole, fraction = ""] = mantissa.split(".");
    const places = fraction.length - Number(exponent);
    numerator *= BigInt(whole + fraction) * BigInt(10) ** BigInt(Math.max(0, -places));
    denominator *= BigInt(10) ** BigInt(Math.max(0, places));
  }
  return Number((numerator * BigInt(2) + denominator) / (denominator * BigInt(2)));
}
