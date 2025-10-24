import {
  getCurrencyInfo,
  getDefaultCurrencyCode,
} from "@/lib/currency";

function resolveCurrency(code?: string) {
  if (code && code.trim().length > 0) {
    const upper = code.trim().toUpperCase();
    return upper;
  }
  return getDefaultCurrencyCode();
}

function storageDecimals(code?: string) {
  const currency = resolveCurrency(code);
  const { decimals } = getCurrencyInfo(currency);
  return Math.min(Math.max(decimals, 0), 2);
}

function minorUnitFactor(code?: string) {
  const decimals = storageDecimals(code);
  return 10 ** decimals;
}

export function toCents(
  amount: number,
  currencyCode?: string,
): number {
  const factor = minorUnitFactor(currencyCode);
  return Math.round(amount * factor);
}

export function fromCents(
  amountCents: number,
  currencyCode?: string,
): number {
  const factor = minorUnitFactor(currencyCode);
  return amountCents / factor;
}

export function applyDiscount(
  unitAmountCents: number,
  discountRate?: number | null,
): number {
  if (!discountRate) {
    return unitAmountCents;
  }
  return Math.round(unitAmountCents * (1 - discountRate / 100));
}

export function percentageOf(
  baseCents: number,
  rate: number,
): number {
  return Math.round(baseCents * (rate / 100));
}
