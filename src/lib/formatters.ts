import { getCurrencyInfo } from "@/lib/currency";

export function formatCurrency(value: number, currency?: string) {
  const info = getCurrencyInfo(currency);
  return new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: info.code,
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  }).format(value);
}

export function formatDecimal(value: number, currency?: string) {
  const info = getCurrencyInfo(currency);
  const fractionDigits = info.decimals === 3 ? 3 : 2;
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
  return new Intl.NumberFormat(info.locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatDate(
  date: Date | string,
  locale: string = "fr-FR",
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
) {
  const dt = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(dt);
}
