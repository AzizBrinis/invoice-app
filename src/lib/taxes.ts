export const TAX_ORDER_ITEMS = ["FODEC", "TVA", "TIMBRE"] as const;

export type TaxOrderItem = (typeof TAX_ORDER_ITEMS)[number];

export type RoundingMode = "nearest-cent" | "up" | "down";

export type TaxRateDefinition = {
  code: string;
  label: string;
  rate: number;
};

export type TaxConfiguration = {
  tva: {
    rates: TaxRateDefinition[];
    applyMode: "line" | "document";
    allowExemption: boolean;
  };
  fodec: {
    enabled: boolean;
    rate: number;
    application: "line" | "document";
    calculationOrder: "BEFORE_TVA" | "AFTER_TVA";
  };
  timbre: {
    enabled: boolean;
    amountCents: number;
    autoApply: boolean;
  };
  order: TaxOrderItem[];
  rounding: {
    line: RoundingMode;
    total: RoundingMode;
  };
};

export const DEFAULT_TAX_CONFIGURATION: TaxConfiguration = {
  tva: {
    rates: [
      { code: "T19", label: "TVA 19%", rate: 19 },
      { code: "T7", label: "TVA 7%", rate: 7 },
      { code: "EXON", label: "Exonération", rate: 0 },
    ],
    applyMode: "line",
    allowExemption: true,
  },
  fodec: {
    enabled: true,
    rate: 1,
    application: "line",
    calculationOrder: "BEFORE_TVA",
  },
  timbre: {
    enabled: true,
    amountCents: 1000,
    autoApply: true,
  },
  order: ["FODEC", "TVA", "TIMBRE"],
  rounding: {
    line: "nearest-cent",
    total: "nearest-cent",
  },
};

function isValidOrderItem(value: string): value is TaxOrderItem {
  return (TAX_ORDER_ITEMS as readonly string[]).includes(value);
}

function normalizeOrder(order?: unknown): TaxOrderItem[] {
  const seen = new Set<TaxOrderItem>();
  const normalized: TaxOrderItem[] = [];

  if (Array.isArray(order)) {
    for (const item of order) {
      if (typeof item === "string" && isValidOrderItem(item) && !seen.has(item)) {
        seen.add(item);
        normalized.push(item);
      }
    }
  }

  for (const fallback of TAX_ORDER_ITEMS) {
    if (!seen.has(fallback)) {
      normalized.push(fallback);
      seen.add(fallback);
    }
  }

  return normalized;
}

function normalizeRates(rates?: unknown): TaxRateDefinition[] {
  if (!Array.isArray(rates)) {
    return DEFAULT_TAX_CONFIGURATION.tva.rates;
  }

  const normalized: TaxRateDefinition[] = [];

  for (const item of rates) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<TaxRateDefinition>;
    if (typeof candidate.rate !== "number") continue;
    const code = typeof candidate.code === "string" && candidate.code.trim().length > 0
      ? candidate.code.trim()
      : `T${candidate.rate}`;
    const label = typeof candidate.label === "string" && candidate.label.trim().length > 0
      ? candidate.label.trim()
      : `TVA ${candidate.rate}%`;
    normalized.push({ code, label, rate: candidate.rate });
  }

  if (normalized.length === 0) {
    return DEFAULT_TAX_CONFIGURATION.tva.rates;
  }

  return normalized;
}

function normalizeRounding(section?: unknown, fallback?: RoundingMode): RoundingMode {
  const allowed: RoundingMode[] = ["nearest-cent", "up", "down"];
  if (typeof section === "string" && allowed.includes(section as RoundingMode)) {
    return section as RoundingMode;
  }
  return fallback ?? "nearest-cent";
}

export function normalizeTaxConfiguration(input?: unknown): TaxConfiguration {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_TAX_CONFIGURATION };
  }

  const config = input as Partial<TaxConfiguration> & Record<string, unknown>;

  const tva = config.tva ?? {};
  const fodec = config.fodec ?? {};
  const timbre = config.timbre ?? {};
  const rounding = config.rounding ?? {};

  return {
    tva: {
      rates: normalizeRates((tva as Record<string, unknown>).rates),
      applyMode:
        (tva as Record<string, unknown>).applyMode === "document" ? "document" : "line",
      allowExemption:
        typeof (tva as Record<string, unknown>).allowExemption === "boolean"
          ? (tva as Record<string, unknown>).allowExemption as boolean
          : DEFAULT_TAX_CONFIGURATION.tva.allowExemption,
    },
    fodec: {
      enabled:
        typeof (fodec as Record<string, unknown>).enabled === "boolean"
          ? (fodec as Record<string, unknown>).enabled as boolean
          : DEFAULT_TAX_CONFIGURATION.fodec.enabled,
      rate:
        typeof (fodec as Record<string, unknown>).rate === "number"
          ? (fodec as Record<string, unknown>).rate as number
          : DEFAULT_TAX_CONFIGURATION.fodec.rate,
      application:
        (fodec as Record<string, unknown>).application === "document"
          ? "document"
          : "line",
      calculationOrder:
        (fodec as Record<string, unknown>).calculationOrder === "AFTER_TVA"
          ? "AFTER_TVA"
          : "BEFORE_TVA",
    },
    timbre: {
      enabled:
        typeof (timbre as Record<string, unknown>).enabled === "boolean"
          ? (timbre as Record<string, unknown>).enabled as boolean
          : DEFAULT_TAX_CONFIGURATION.timbre.enabled,
      amountCents:
        typeof (timbre as Record<string, unknown>).amountCents === "number"
          ? Math.max(0, Math.round((timbre as Record<string, unknown>).amountCents as number))
          : DEFAULT_TAX_CONFIGURATION.timbre.amountCents,
      autoApply:
        typeof (timbre as Record<string, unknown>).autoApply === "boolean"
          ? (timbre as Record<string, unknown>).autoApply as boolean
          : DEFAULT_TAX_CONFIGURATION.timbre.autoApply,
    },
    order: normalizeOrder(config.order),
    rounding: {
      line: normalizeRounding((rounding as Record<string, unknown>).line, DEFAULT_TAX_CONFIGURATION.rounding.line),
      total: normalizeRounding((rounding as Record<string, unknown>).total, DEFAULT_TAX_CONFIGURATION.rounding.total),
    },
  };
}

export function roundAmount(value: number, mode: RoundingMode): number {
  switch (mode) {
    case "up":
      return Math.ceil(value);
    case "down":
      return Math.floor(value);
    default:
      return Math.round(value);
  }
}

export function allocateProportionalAmounts(
  total: number,
  bases: number[],
  mode: RoundingMode,
): number[] {
  if (bases.length === 0) return [];
  const sumBases = bases.reduce((acc, value) => acc + (value > 0 ? value : 0), 0);
  if (sumBases === 0) {
    const perPart = Math.floor(total / bases.length);
    const result = bases.map(() => perPart);
    let remainder = total - perPart * bases.length;
    let index = 0;
    while (remainder > 0 && index < result.length) {
      result[index] += 1;
      remainder -= 1;
      index += 1;
    }
    return result;
  }

  const allocations: number[] = [];
  let accumulated = 0;

  bases.forEach((base, index) => {
    if (index === bases.length - 1) {
      allocations.push(total - accumulated);
      return;
    }

    const share = total * (base / sumBases);
    const roundedShare = roundAmount(share, mode);
    allocations.push(roundedShare);
    accumulated += roundedShare;
  });

  if (bases.length === 1) {
    allocations[0] = total;
  }

  return allocations;
}
