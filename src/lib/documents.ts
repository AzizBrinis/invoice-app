import { fromCents, toCents } from "@/lib/money";
import {
  allocateProportionalAmounts,
  DEFAULT_TAX_CONFIGURATION,
  roundAmount,
  TaxConfiguration,
  RoundingMode,
} from "@/lib/taxes";

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
  fodecRate?: number | null;
  fodecAmountCents: number;
};

export type VatEntry = {
  rate: number;
  baseHTCents: number;
  totalTVACents: number;
};

export type TaxSummaryEntry = {
  type: "TVA" | "FODEC" | "TIMBRE";
  rate?: number | null;
  label: string;
  baseCents: number;
  amountCents: number;
};

export type DocumentTotals = {
  subtotalHTCents: number;
  totalDiscountCents: number;
  totalTVACents: number;
  totalTTCCents: number;
  vatEntries: VatEntry[];
  globalDiscountAppliedCents: number;
  fodecAmountCents: number;
  timbreAmountCents: number;
  taxSummary: TaxSummaryEntry[];
};

export type LineCalculationOptions = {
  fodecRate?: number | null;
  fodecCalculationOrder?: "BEFORE_TVA" | "AFTER_TVA";
  roundingMode?: RoundingMode;
};

export type DocumentTaxOptions = {
  taxConfiguration?: TaxConfiguration;
  applyFodec?: boolean;
  applyTimbre?: boolean;
  documentFodecRate?: number | null;
  timbreAmountCents?: number | null;
};

export function calculateLineTotals(
  input: LineComputationInput,
  options?: LineCalculationOptions,
): LineComputationResult {
  const baseAmount = Math.round(input.quantity * input.unitPriceHTCents);
  const computedDiscount =
    input.discountAmountCents ??
    (input.discountRate
      ? Math.round(baseAmount * (input.discountRate / 100))
      : 0);
  const discountAmountCents = Math.min(computedDiscount, baseAmount);
  const totalHTCents = baseAmount - discountAmountCents;
  const roundingMode = options?.roundingMode ?? "nearest-cent";

  const effectiveFodecRate = options?.fodecRate ?? null;
  const fodecAmountCents = effectiveFodecRate
    ? roundAmount(totalHTCents * (effectiveFodecRate / 100), roundingMode)
    : 0;

  const vatBaseCents =
    options?.fodecCalculationOrder === "BEFORE_TVA"
      ? totalHTCents + fodecAmountCents
      : totalHTCents;

  const totalTVACents = roundAmount(vatBaseCents * (input.vatRate / 100), roundingMode);
  const totalTTCCents = totalHTCents + fodecAmountCents + totalTVACents;

  return {
    quantity: input.quantity,
    unitPriceHTCents: input.unitPriceHTCents,
    vatRate: input.vatRate,
    discountRate: input.discountRate ?? null,
    discountAmountCents,
    totalHTCents,
    totalTVACents,
    totalTTCCents,
    fodecRate: effectiveFodecRate,
    fodecAmountCents,
  };
}

export function calculateDocumentTotals(
  lines: LineComputationResult[],
  globalDiscountRate?: number | null,
  globalDiscountAmountCents?: number | null,
  taxOptions?: DocumentTaxOptions,
): DocumentTotals {
  const taxConfig = taxOptions?.taxConfiguration ?? DEFAULT_TAX_CONFIGURATION;
  const subtotalHTCents = lines.reduce(
    (sum, line) => sum + line.totalHTCents,
    0,
  );

  const perLineDiscountCents = lines.reduce(
    (sum, line) => sum + line.discountAmountCents,
    0,
  );

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

  const lineBases = lines.map((line) => line.totalHTCents);
  const discountShares =
    subtotalHTCents > 0 && globalDiscountAppliedCents > 0
      ? allocateProportionalAmounts(
          globalDiscountAppliedCents,
          lineBases,
          taxConfig.rounding.total,
        )
      : lineBases.map(() => 0);

  const lineNetHT = lines.map(
    (line, index) => line.totalHTCents - discountShares[index],
  );

  const subtotalAfterGlobal = lineNetHT.reduce((sum, value) => sum + value, 0);

  const applyFodec =
    taxConfig.fodec.enabled &&
    (taxOptions?.applyFodec ?? true) &&
    (taxConfig.fodec.application === "line"
      ? (lines.some((line) => (line.fodecRate ?? taxConfig.fodec.rate) > 0))
      : (taxOptions?.documentFodecRate ?? taxConfig.fodec.rate) > 0);

  const lineFodecAmounts = new Array<number>(lines.length).fill(0);
  let fodecAmountCents = 0;
  let effectiveFodecRate = taxConfig.fodec.rate;

  if (applyFodec) {
    if (taxConfig.fodec.application === "line") {
      lines.forEach((line, index) => {
        const rate = line.fodecRate ?? taxConfig.fodec.rate;
        if (rate && rate > 0) {
          const amount = roundAmount(
            lineNetHT[index] * (rate / 100),
            taxConfig.rounding.line,
          );
          lineFodecAmounts[index] = amount;
          fodecAmountCents += amount;
          lines[index].fodecAmountCents = amount;
          lines[index].fodecRate = rate;
        } else {
          lines[index].fodecAmountCents = 0;
          lines[index].fodecRate = null;
        }
      });
    } else {
      effectiveFodecRate = taxOptions?.documentFodecRate ?? taxConfig.fodec.rate;
      const rawAmount = subtotalAfterGlobal * (effectiveFodecRate / 100);
      fodecAmountCents = roundAmount(rawAmount, taxConfig.rounding.total);
      const allocations = allocateProportionalAmounts(
        fodecAmountCents,
        lineNetHT,
        taxConfig.rounding.total,
      );
      allocations.forEach((value, index) => {
        lineFodecAmounts[index] = value;
        lines[index].fodecAmountCents = value;
        lines[index].fodecRate = effectiveFodecRate;
      });
    }
  } else {
    lines.forEach((line) => {
      line.fodecAmountCents = 0;
      line.fodecRate = null;
    });
  }

  const vatAggregates = new Map<
    number,
    {
      baseHTCents: number;
      totalTVACents: number;
    }
  >();

  let totalTVACents = 0;

  lines.forEach((line, index) => {
    const vatRate = line.vatRate;
    const baseForVat =
      lineNetHT[index] +
      (applyFodec && taxConfig.fodec.calculationOrder === "BEFORE_TVA"
        ? lineFodecAmounts[index]
        : 0);

    const vatAmount = roundAmount(
      baseForVat * (vatRate / 100),
      taxConfig.rounding.line,
    );

    totalTVACents += vatAmount;

    const aggregate = vatAggregates.get(vatRate) ?? {
      baseHTCents: 0,
      totalTVACents: 0,
    };
    aggregate.baseHTCents += baseForVat;
    aggregate.totalTVACents += vatAmount;
    vatAggregates.set(vatRate, aggregate);

    lines[index].totalTVACents = vatAmount;
    lines[index].totalTTCCents =
      line.totalHTCents + lineFodecAmounts[index] + vatAmount;
  });

  const vatEntries: VatEntry[] = Array.from(vatAggregates.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, data]) => ({
      rate,
      baseHTCents: data.baseHTCents,
      totalTVACents: data.totalTVACents,
    }));

  const applyTimbre =
    taxConfig.timbre.enabled &&
    (taxOptions?.applyTimbre ?? taxConfig.timbre.autoApply);

  const timbreAmountCents = applyTimbre
    ? Math.max(
        0,
        Math.round(
          taxOptions?.timbreAmountCents ?? taxConfig.timbre.amountCents,
        ),
      )
    : 0;

  const totalTTCCents =
    subtotalAfterGlobal + fodecAmountCents + totalTVACents + timbreAmountCents;

  const taxSummary: TaxSummaryEntry[] = [];

  if (applyFodec && fodecAmountCents > 0) {
    taxSummary.push({
      type: "FODEC",
      rate: effectiveFodecRate,
      label: "FODEC",
      baseCents: subtotalAfterGlobal,
      amountCents: fodecAmountCents,
    });
  }

  vatEntries.forEach((entry) => {
    taxSummary.push({
      type: "TVA",
      rate: entry.rate,
      label: `TVA ${entry.rate}%`,
      baseCents: entry.baseHTCents,
      amountCents: entry.totalTVACents,
    });
  });

  if (timbreAmountCents > 0) {
    taxSummary.push({
      type: "TIMBRE",
      label: "Timbre fiscal",
      baseCents: 0,
      amountCents: timbreAmountCents,
    });
  }

  const orderIndex = new Map<TaxSummaryEntry["type"], number>();
  taxConfig.order.forEach((item, index) => {
    orderIndex.set(item, index);
  });

  taxSummary.sort((a, b) => {
    const orderA = orderIndex.get(a.type) ?? 0;
    const orderB = orderIndex.get(b.type) ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    if (a.type === "TVA" && b.type === "TVA") {
      return (a.rate ?? 0) - (b.rate ?? 0);
    }
    return a.label.localeCompare(b.label);
  });

  return {
    subtotalHTCents,
    totalDiscountCents: perLineDiscountCents + globalDiscountAppliedCents,
    totalTVACents,
    totalTTCCents,
    vatEntries,
    globalDiscountAppliedCents,
    fodecAmountCents,
    timbreAmountCents,
    taxSummary,
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

export function centsToCurrencyUnit(
  value: number,
  currencyCode?: string,
): number {
  return fromCents(value, currencyCode);
}

export function currencyUnitToCents(
  value: number,
  currencyCode?: string,
): number {
  return toCents(value, currencyCode);
}

// Deprecated aliases maintained for backwards compatibility
export const centsToEuro = centsToCurrencyUnit;
export const euroToCents = currencyUnitToCents;
