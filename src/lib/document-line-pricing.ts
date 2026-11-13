import { documentAmountSchema, parseDocumentAmount, roundDecimalProduct } from "@/lib/document-precision";
import { z } from "zod";
import { fromCents } from "@/lib/money";
import { MAX_PRODUCT_PRICE_CENTS } from "@/lib/product-price-input";
import type { TaxConfiguration } from "@/lib/taxes";

export const documentLinePriceFields = {
  unitPriceHTCents: documentAmountSchema,
  unitPriceTTCCents: documentAmountSchema.optional(),
  vatRate: z.number().min(0).max(100),
};

export function normalizeDocumentLinePrice<T extends {
  unitPriceHTCents: number; unitPriceTTCCents?: number; vatRate: number;
}>(line: T): T {
  if (line.unitPriceTTCCents == null) return line;
  return {
    ...line,
    unitPriceHTCents: calculateDocumentPrices(line.unitPriceTTCCents, "TTC", line.vatRate).priceHTCents,
  };
}

export type DocumentLinePriceForm = {
  unitPrice: number | string;
  unitPriceTTC?: number | string;
  vatRate: number;
};

export function documentLinePricePayload(line: DocumentLinePriceForm, currency: string, preview = false) {
  const inclusive = line.unitPriceTTC != null;
  try {
    const amount = parseDocumentAmount(String(inclusive ? line.unitPriceTTC : line.unitPrice), currency);
    const prices = calculateDocumentPrices(amount, inclusive ? "TTC" : "HT", line.vatRate);
    return {
      unitPriceHTCents: prices.priceHTCents,
      ...(inclusive ? { unitPriceTTCCents: prices.priceTTCCents } : {}),
    };
  } catch {
    // Keep incomplete input editable. JSON serializes NaN as null, which the
    // server schema rejects; previews use zero instead of displaying NaN.
    return { unitPriceHTCents: preview ? 0 : NaN };
  }
}

export function documentLinePricingSnapshot(lines: { position: number; unitPriceTTCCents?: number }[]) {
  return lines.flatMap((line) => line.unitPriceTTCCents == null ? [] : [{
    position: line.position, unitPriceTTCCents: line.unitPriceTTCCents,
  }]);
}

export function restoreDocumentLineTTC(config: TaxConfiguration | null, position: number, currency: string) {
  const entry = config?.linePricing?.find((line) => line.position === position);
  return entry ? fromCents(entry.unitPriceTTCCents, currency) : undefined;
}

// Preserve the entered price; derived prices retain the historical minor-unit
// rounding rule. Extended amounts are computed from the entered basis.
export function calculateDocumentPrices(amount: number, basis: "HT" | "TTC", vatRate: number) {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_PRODUCT_PRICE_CENTS ||
    !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error("Prix invalide");
  const priceHTCents = basis === "HT" ? amount : Math.round(amount * 100 / (100 + vatRate));
  const priceTTCCents = basis === "TTC" ? amount : roundDecimalProduct(amount, 1 + vatRate / 100);
  if (priceTTCCents > MAX_PRODUCT_PRICE_CENTS) throw new Error("Prix maximal dépassé");
  return { priceHTCents, priceTTCCents, vatAmountCents: priceTTCCents - priceHTCents };
}
