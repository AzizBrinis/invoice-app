import { fromCents, toCents } from "@/lib/money";

export type LineComputationInput = {
  quantity: number;
  unitPriceHTCents: number;
  vatRate: number;
  discountRate?: number | null;
  discountAmountCents?: number | null;
};

export type LineComputationResult = {
  quantity: number;
  unitPriceHTCents: number;
  vatRate: number;
  discountRate?: number | null;
  discountAmountCents: number;
  totalHTCents: number;
  totalTVACents: number;
  totalTTCCents: number;
};

export type VatEntry = {
  rate: number;
  baseHTCents: number;
  totalTVACents: number;
};

export type DocumentTotals = {
  subtotalHTCents: number;
  totalDiscountCents: number;
  totalTVACents: number;
  totalTTCCents: number;
  vatEntries: VatEntry[];
  globalDiscountAppliedCents: number;
};

export function calculateLineTotals(
  input: LineComputationInput,
): LineComputationResult {
  const baseAmount = Math.round(input.quantity * input.unitPriceHTCents);
  const computedDiscount =
    input.discountAmountCents ??
    (input.discountRate
      ? Math.round(baseAmount * (input.discountRate / 100))
      : 0);
  const discountAmountCents = Math.min(computedDiscount, baseAmount);
  const totalHTCents = baseAmount - discountAmountCents;
  const totalTVACents = Math.round(totalHTCents * (input.vatRate / 100));
  const totalTTCCents = totalHTCents + totalTVACents;

  return {
    quantity: input.quantity,
    unitPriceHTCents: input.unitPriceHTCents,
    vatRate: input.vatRate,
    discountRate: input.discountRate ?? null,
    discountAmountCents,
    totalHTCents,
    totalTVACents,
    totalTTCCents,
  };
}

export function calculateDocumentTotals(
  lines: LineComputationResult[],
  globalDiscountRate?: number | null,
  globalDiscountAmountCents?: number | null,
): DocumentTotals {
  const subtotalHTCents = lines.reduce(
    (sum, line) => sum + line.totalHTCents,
    0,
  );

  const perLineDiscountCents = lines.reduce(
    (sum, line) => sum + line.discountAmountCents,
    0,
  );

  const vatMap = new Map<
    number,
    {
      baseHTCents: number;
    }
  >();

  for (const line of lines) {
    const entry = vatMap.get(line.vatRate) ?? { baseHTCents: 0 };
    entry.baseHTCents += line.totalHTCents;
    vatMap.set(line.vatRate, entry);
  }

  let globalDiscountAppliedCents = 0;

  if (subtotalHTCents > 0) {
    const computedGlobalDiscount =
      globalDiscountAmountCents ??
      (globalDiscountRate
        ? Math.round(subtotalHTCents * (globalDiscountRate / 100))
        : 0);

    globalDiscountAppliedCents = Math.min(
      computedGlobalDiscount,
      subtotalHTCents,
    );
  }

  const subtotalAfterGlobal = subtotalHTCents - globalDiscountAppliedCents;

  const vatEntries: VatEntry[] = [];
  let accumulatedDiscount = 0;
  const vatRates = Array.from(vatMap.keys());

  vatRates.forEach((rate, index) => {
    const base = vatMap.get(rate)!;
    const share =
      globalDiscountAppliedCents > 0
        ? Math.round(
            globalDiscountAppliedCents *
              (base.baseHTCents / subtotalHTCents),
          )
        : 0;

    accumulatedDiscount += share;

    // Adjust remainder on last iteration
    const adjustedShare =
      index === vatRates.length - 1
        ? share + (globalDiscountAppliedCents - accumulatedDiscount)
        : share;

    const adjustedBase = base.baseHTCents - adjustedShare;
    const totalTVACents = Math.round(adjustedBase * (rate / 100));
    vatEntries.push({
      rate,
      baseHTCents: adjustedBase,
      totalTVACents,
    });
  });

  const totalTVACents = vatEntries.reduce(
    (sum, entry) => sum + entry.totalTVACents,
    0,
  );

  const totalTTCCents = subtotalAfterGlobal + totalTVACents;

  return {
    subtotalHTCents,
    totalDiscountCents: perLineDiscountCents + globalDiscountAppliedCents,
    totalTVACents,
    totalTTCCents,
    vatEntries,
    globalDiscountAppliedCents,
  };
}

export function computeDueStatus(
  dueDate: Date | null | undefined,
  status: string,
  amountDueCents: number,
): "a-temps" | "retard" | "paye" | "partiel" | "brouillon" {
  if (status === "BROUILLON") return "brouillon";
  if (amountDueCents <= 0) return "paye";
  if (!dueDate) return "a-temps";
  return dueDate.getTime() < Date.now() ? "retard" : "a-temps";
}

export function centsToEuro(value: number): number {
  return fromCents(value);
}

export function euroToCents(value: number): number {
  return toCents(value);
}
