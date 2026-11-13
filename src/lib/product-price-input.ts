import { ZodError } from "zod";
import { getCurrencyInfo } from "@/lib/currency";
import type { TaxConfiguration } from "@/lib/taxes";

export type ProductPriceBasis = "HT" | "TTC";

// Existing Product price columns are signed 32-bit integers in minor units.
export const MAX_PRODUCT_PRICE_CENTS = 2_147_483_647;

function invalidPrice(field: string, message: string): never {
  throw new ZodError([{ code: "custom", path: [field], message }]);
}

export function parseProductPrice(value: unknown, currencyCode: string, field: string) {
  const { decimals } = getCurrencyInfo(currencyCode);
  const text = typeof value === "string" ? value.trim().replace(",", ".") : "";
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    return invalidPrice(field, "Saisissez un prix positif ou nul.");
  }
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) {
    return invalidPrice(field, `Le prix doit contenir au maximum ${decimals} décimales.`);
  }
  // Parse decimal digits directly to avoid binary floating-point rounding losses.
  const amount = Number(`${whole || "0"}${fraction.padEnd(decimals, "0")}`);
  if (!Number.isSafeInteger(amount) || amount > MAX_PRODUCT_PRICE_CENTS) {
    return invalidPrice(field, "Le prix dépasse le montant maximal autorisé.");
  }
  return amount;
}

export function getProductVatRates(config: TaxConfiguration, existingRate?: number) {
  const rates = config.tva.rates.filter(({ rate }) =>
    Number.isFinite(rate) && rate >= 0 && rate <= 100 &&
    (config.tva.allowExemption || rate !== 0),
  );
  // A product using an old rate must remain editable after settings change.
  if (existingRate != null && Number.isFinite(existingRate) && existingRate >= 0 &&
    existingRate <= 100 && !rates.some(({ rate }) => rate === existingRate)) {
    return [...rates, { code: "EXISTING", label: `TVA ${existingRate}% (taux existant)`, rate: existingRate }];
  }
  return rates;
}

export function calculateProductPrices(amountCents: number, basis: ProductPriceBasis, vatRate: number) {
  const field = basis === "TTC" ? "priceTTCCents" : "priceHTCents";
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > MAX_PRODUCT_PRICE_CENTS) {
    return invalidPrice(field, "Prix invalide ou supérieur au montant maximal autorisé.");
  }
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return invalidPrice("vatRate", "Taux de TVA invalide.");
  }
  // Exact rational arithmetic also supports fractional configurable VAT rates.
  const [mantissa, exponent = "0"] = String(vatRate).split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const places = fraction.length - Number(exponent);
  const scale = BigInt(10) ** BigInt(Math.max(0, places));
  const rate = BigInt(whole + fraction) * BigInt(10) ** BigInt(Math.max(0, -places));
  const hundred = BigInt(100) * scale;
  const roundHalfUp = (numerator: bigint, denominator: bigint) =>
    Number((numerator * BigInt(2) + denominator) / (denominator * BigInt(2)));
  const priceHTCents = basis === "HT" ? amountCents :
    roundHalfUp(BigInt(amountCents) * hundred, hundred + rate);
  const priceTTCCents = basis === "TTC" ? amountCents :
    roundHalfUp(BigInt(amountCents) * (hundred + rate), hundred);
  if (priceTTCCents > MAX_PRODUCT_PRICE_CENTS) {
    return invalidPrice(field, "Le prix TTC dépasse le montant maximal autorisé.");
  }
  // Preserve the entered TTC exactly; rounding HT and VAT separately can lose a millime.
  return { priceHTCents, priceTTCCents, vatAmountCents: priceTTCCents - priceHTCents };
}

export function parseProductPriceFields(
  formData: FormData,
  currencyCode: string,
  config: TaxConfiguration,
  existingRate?: number,
) {
  const basis = formData.get("priceBasis") ?? "HT";
  if (basis !== "HT" && basis !== "TTC") {
    return invalidPrice("priceBasis", "Choisissez une saisie HT ou TTC.");
  }
  const rawRate = formData.get("vatRate");
  const vatRate = typeof rawRate === "string" && rawRate.trim() !== ""
    ? Number(rawRate.replace(",", ".")) : NaN;
  if (!getProductVatRates(config, existingRate).some(({ rate }) => rate === vatRate)) {
    return invalidPrice("vatRate", "Sélectionnez un taux de TVA configuré.");
  }
  const amount = parseProductPrice(
    formData.get(basis === "TTC" ? "priceTTC" : "priceHT"),
    currencyCode,
    basis === "TTC" ? "priceTTCCents" : "priceHTCents",
  );
  const { priceHTCents, priceTTCCents } = calculateProductPrices(amount, basis, vatRate);
  return { priceHTCents, priceTTCCents, vatRate };
}
