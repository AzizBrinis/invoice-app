import { calculateLineTotals, type LineComputationResult } from "@/lib/documents";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";

export type ProductDiscountInput = {
  defaultDiscountRate?: number | null;
  defaultDiscountAmountCents?: number | null;
};

export type ResolvedProductDiscount = {
  discountRate: number | null;
  discountAmountCents: number | null;
};

export function resolveProductDiscount(
  input: ProductDiscountInput,
): ResolvedProductDiscount {
  if (input.defaultDiscountAmountCents != null) {
    return {
      discountRate: null,
      discountAmountCents: input.defaultDiscountAmountCents,
    };
  }

  return {
    discountRate: input.defaultDiscountRate ?? null,
    discountAmountCents: null,
  };
}

export function resolveLineDiscountInput(options: {
  quantity: number;
  discountRate?: number | null;
  discountAmountCents?: number | null;
}): ResolvedProductDiscount {
  if (options.discountAmountCents != null) {
    const normalizedQuantity = Number.isFinite(options.quantity)
      ? Math.max(options.quantity, 0)
      : 0;
    return {
      discountRate: null,
      discountAmountCents: Math.round(
        Math.max(options.discountAmountCents, 0) * normalizedQuantity,
      ),
    };
  }

  return {
    discountRate: options.discountRate ?? null,
    discountAmountCents: null,
  };
}

export function calculateDiscountedLineTotals(input: {
  quantity: number;
  unitPriceHTCents: number;
  vatRate: number;
  discountRate?: number | null;
  discountAmountCents?: number | null;
}): LineComputationResult {
  const discount = resolveLineDiscountInput({
    quantity: input.quantity,
    discountRate: input.discountRate,
    discountAmountCents: input.discountAmountCents,
  });

  return calculateLineTotals({
    quantity: input.quantity,
    unitPriceHTCents: input.unitPriceHTCents,
    vatRate: input.vatRate,
    discountRate: discount.discountRate,
    discountAmountCents: discount.discountAmountCents,
  });
}

export function computeAdjustedUnitPriceHTCents(
  basePriceHTCents: number | null | undefined,
  adjustmentCents: number | null | undefined,
) {
  if (basePriceHTCents == null) return null;
  return Math.max(0, basePriceHTCents + (adjustmentCents ?? 0));
}

export function computeAdjustedUnitPriceTTCCents(options: {
  saleMode: "INSTANT" | "QUOTE";
  priceHTCents: number | null | undefined;
  priceTTCCents: number | null | undefined;
  vatRate: number | null | undefined;
  adjustmentCents?: number | null;
  discountRate?: number | null;
  discountAmountCents?: number | null;
}) {
  if (options.saleMode !== "INSTANT") return null;
  const adjustmentCents = options.adjustmentCents ?? 0;
  if (
    !adjustmentCents &&
    options.priceTTCCents != null &&
    options.discountRate == null &&
    options.discountAmountCents == null
  ) {
    return options.priceTTCCents;
  }
  if (options.priceHTCents == null || options.vatRate == null) {
    return options.priceTTCCents ?? null;
  }
  return calculateDiscountedLineTotals({
    quantity: 1,
    unitPriceHTCents: computeAdjustedUnitPriceHTCents(
      options.priceHTCents,
      adjustmentCents,
    ) ?? 0,
    vatRate: options.vatRate,
    discountRate: options.discountRate ?? null,
    discountAmountCents: options.discountAmountCents ?? null,
  }).totalTTCCents;
}

export function formatProductDiscount(options: {
  discountRate?: number | null;
  discountAmountCents?: number | null;
  currencyCode: string;
}) {
  if (options.discountAmountCents != null) {
    return formatCurrency(
      fromCents(options.discountAmountCents, options.currencyCode),
      options.currencyCode,
    );
  }
  if (options.discountRate != null) {
    return `${options.discountRate}%`;
  }
  return "—";
}

export function formatPriceAdjustmentLabel(
  amountCents: number | null | undefined,
  currencyCode: string,
) {
  if (!amountCents) return null;
  const absolute = formatCurrency(
    fromCents(Math.abs(amountCents), currencyCode),
    currencyCode,
  );
  return `${amountCents > 0 ? "+" : "-"} ${absolute}`;
}
