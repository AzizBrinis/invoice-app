"use client";

import { useId } from "react";
import { DocumentDecimalInput } from "@/components/document-decimal-input";
import { fromCents } from "@/lib/money";
import { getProductVatRates } from "@/lib/product-price-input";
import { calculateDocumentPrices, documentLinePricePayload, type DocumentLinePriceForm } from "@/lib/document-line-pricing";
import type { TaxConfiguration } from "@/lib/taxes";

export function DocumentLinePriceInput({ line, currency, onChange, id, error }: {
  line: DocumentLinePriceForm;
  currency: string;
  onChange: (updates: Partial<DocumentLinePriceForm>) => void;
  id?: string;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inclusive = line.unitPriceTTC != null;
  const decimals = 3;
  const payload = documentLinePricePayload(line, currency);
  const valid = Number.isFinite(payload.unitPriceHTCents);
  const prices = valid ? calculateDocumentPrices(
    payload.unitPriceTTCCents ?? payload.unitPriceHTCents,
    inclusive ? "TTC" : "HT", line.vatRate,
  ) : null;
  const format = (value: number) => fromCents(value, currency).toFixed(decimals);
  const value = inclusive ? line.unitPriceTTC : line.unitPrice;
  return (
    <div className="min-w-40 space-y-1">
      <select className="input" aria-label="Mode de saisie du prix" value={inclusive ? "TTC" : "HT"}
        onChange={(event) => {
          if (event.target.value === "TTC") {
            onChange({ unitPriceTTC: prices ? format(prices.priceTTCCents) : "" });
          } else {
            onChange({ unitPrice: prices ? format(prices.priceHTCents) : "", unitPriceTTC: undefined });
          }
        }}>
        <option value="HT">Prix HT ({currency})</option>
        <option value="TTC">Prix TTC ({currency})</option>
      </select>
      <DocumentDecimalInput id={inputId} min="0" required
        aria-label={`Prix unitaire ${inclusive ? "TTC" : "HT"} (${currency})`}
        aria-invalid={Boolean(error) || !valid || undefined}
        aria-describedby={`${inputId}-summary`}
        value={typeof value === "number" ? value.toFixed(decimals) : value}
        onChange={(event) => onChange(inclusive
          ? { unitPriceTTC: event.target.value }
          : { unitPrice: event.target.value })}
        onBlur={() => {
          if (prices) onChange(inclusive
            ? { unitPriceTTC: format(prices.priceTTCCents) }
            : { unitPrice: format(prices.priceHTCents) });
        }} />
      <p id={`${inputId}-summary`} className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {prices ? `HT ${format(prices.priceHTCents)} · TVA ${format(prices.vatAmountCents)} · TTC ${format(prices.priceTTCCents)}`
          : `Saisissez un prix positif ou nul, avec au maximum ${decimals} décimales.`}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Avant remise, FODEC et timbre.</p>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

export function DocumentVatSelect({ value, config, onChange, id, error }: {
  value: number; config: TaxConfiguration; onChange: (value: number) => void;
  id?: string; error?: string;
}) {
  return <select id={id} className="input" aria-label="Taux de TVA" value={value}
    aria-invalid={Boolean(error) || undefined} required
    onChange={(event) => onChange(Number(event.target.value))}>
    {getProductVatRates(config, value).map(({ code, label, rate }, index) =>
      <option key={`${code}-${index}`} value={rate}>{label}</option>)}
  </select>;
}
