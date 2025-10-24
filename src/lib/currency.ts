export const CURRENCY_CODES = ["TND", "EUR", "USD", "GBP", "CAD"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export type CurrencyInfo = {
  code: CurrencyCode;
  label: string;
  locale: string;
  decimals: number;
};

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  {
    code: "TND",
    label: "Dinar tunisien (TND)",
    locale: "fr-TN",
    decimals: 3,
  },
  {
    code: "EUR",
    label: "Euro (EUR)",
    locale: "fr-FR",
    decimals: 2,
  },
  {
    code: "USD",
    label: "Dollar américain (USD)",
    locale: "en-US",
    decimals: 2,
  },
  {
    code: "GBP",
    label: "Livre sterling (GBP)",
    locale: "en-GB",
    decimals: 2,
  },
  {
    code: "CAD",
    label: "Dollar canadien (CAD)",
    locale: "fr-CA",
    decimals: 2,
  },
];

const DEFAULT_CURRENCY_CODE = "TND";

const currencyMap = new Map<CurrencyCode, CurrencyInfo>(
  SUPPORTED_CURRENCIES.map((info) => [info.code, info]),
);

function normalizeCode(code?: string): CurrencyCode | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  if (currencyMap.has(upper as CurrencyCode)) {
    return upper as CurrencyCode;
  }
  return undefined;
}

export function getCurrencyInfo(code?: string): CurrencyInfo {
  const normalized = normalizeCode(code);
  if (normalized) {
    return currencyMap.get(normalized)!;
  }
  return currencyMap.get(DEFAULT_CURRENCY_CODE)!;
}

export function getCurrencyLabel(code?: string): string {
  return getCurrencyInfo(code).label;
}

export function getDefaultCurrencyCode(): CurrencyCode {
  return DEFAULT_CURRENCY_CODE;
}
