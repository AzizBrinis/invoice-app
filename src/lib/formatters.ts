import { getCurrencyInfo } from "@/lib/currency";

export function formatCurrency(value: number, currency?: string) {
  const info = getCurrencyInfo(currency);
  const fractionDigits = Math.max(info.decimals, 0);
  return new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: info.code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDecimal(value: number, currency?: string) {
  const info = getCurrencyInfo(currency);
  const fractionDigits = Math.max(info.decimals, 0);
  return new Intl.NumberFormat(info.locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(
  value: number,
  currency?: string,
) {
  const info = getCurrencyInfo(currency);
  const percentValue = Math.abs(value) < 1 ? value * 100 : value;
  const formatted = new Intl.NumberFormat(info.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(percentValue);
  return `${formatted}\u00a0%`;
}

export function formatDate(
  date: Date | string,
  locale: string = "fr-TN",
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
) {
  const dt = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(dt);
}

// Input prices can have more precision than a currency's posted totals.
export function formatDocumentAmount(value: number, currency?: string) {
  const info = getCurrencyInfo(currency);
  return new Intl.NumberFormat(info.locale, {
    style: "currency", currency: info.code,
    minimumFractionDigits: info.decimals, maximumFractionDigits: 3,
  }).format(value);
}

export function formatDocumentRate(value: number, currency?: string) {
  return new Intl.NumberFormat(getCurrencyInfo(currency).locale, {
    maximumFractionDigits: 3,
  }).format(value) + " %";
}
