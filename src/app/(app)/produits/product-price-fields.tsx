"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { getCurrencyInfo } from "@/lib/currency";
import { fromCents } from "@/lib/money";
import {
  calculateProductPrices,
  getProductVatRates,
  MAX_PRODUCT_PRICE_CENTS,
  parseProductPrice,
  type ProductPriceBasis,
} from "@/lib/product-price-input";
import type { TaxConfiguration } from "@/lib/taxes";

type ProductPriceFieldsProps = {
  currencyCode: string;
  taxConfiguration: TaxConfiguration;
  defaultValues?: { priceHTCents?: number; priceTTCCents?: number; vatRate?: number };
  fieldErrors?: Partial<Record<string, string>>;
};

export function ProductPriceFields({
  currencyCode, taxConfiguration, defaultValues, fieldErrors = {},
}: ProductPriceFieldsProps) {
  const { decimals } = getCurrencyInfo(currencyCode);
  const format = (amount: number) => fromCents(amount, currencyCode).toFixed(decimals);
  const rates = getProductVatRates(taxConfiguration, defaultValues?.vatRate);
  const [vatRate, setVatRate] = useState(String(defaultValues?.vatRate ?? rates[0]?.rate ?? ""));
  const [basis, setBasis] = useState<ProductPriceBasis>("TTC");
  const [amount, setAmount] = useState(() => {
    if (defaultValues?.priceTTCCents != null) return format(defaultValues.priceTTCCents);
    if (defaultValues?.priceHTCents != null && vatRate !== "") {
      return format(calculateProductPrices(defaultValues.priceHTCents, "HT", Number(vatRate)).priceTTCCents);
    }
    return "";
  });
  let prices: ReturnType<typeof calculateProductPrices> | null = null;
  let inputError: string | undefined;
  try {
    if (amount !== "" && vatRate !== "") {
      prices = calculateProductPrices(parseProductPrice(amount, currencyCode, "price"), basis, Number(vatRate));
    }
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      inputError = (error.issues as { message: string }[])[0]?.message;
    }
  }

  function changeBasis(next: ProductPriceBasis) {
    if (prices) setAmount(format(next === "TTC" ? prices.priceTTCCents : prices.priceHTCents));
    setBasis(next);
  }

  return (
    <fieldset className="space-y-4">
      <legend className="label">Prix de vente</legend>
      <div className="min-w-0 space-y-2">
        <label htmlFor="priceBasis" className="label">Saisir le prix</label>
        <select id="priceBasis" name="priceBasis" className="input" value={basis}
          onChange={(event) => changeBasis(event.target.value as ProductPriceBasis)}>
          <option value="TTC">TTC (TVA comprise)</option>
          <option value="HT">HT (hors TVA)</option>
        </select>
        {fieldErrors.priceBasis ? <p className="text-xs text-red-600">{fieldErrors.priceBasis}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {(["TTC", "HT"] as const).map((kind) => {
          const editable = kind === basis;
          const error = fieldErrors[kind === "TTC" ? "priceTTCCents" : "priceHTCents"] || (editable ? inputError : undefined);
          const value = editable ? amount : prices ? format(kind === "TTC" ? prices.priceTTCCents : prices.priceHTCents) : "";
          return (
            <div key={kind} className="min-w-0 space-y-2">
              <label htmlFor={`price${kind}`} className="label">{`Prix ${kind} (${currencyCode})`}</label>
              <Input id={`price${kind}`} name={`price${kind}`} type="number" min="0"
                step={10 ** -decimals} max={format(MAX_PRODUCT_PRICE_CENTS)}
                value={value} readOnly={!editable} required={editable}
                onChange={(event) => setAmount(event.target.value)}
                onBlur={() => { if (editable && prices) setAmount(format(kind === "TTC" ? prices.priceTTCCents : prices.priceHTCents)); }}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? `price${kind}-error` : "product-price-help"}
                data-invalid={error ? "true" : undefined} />
              {error ? <p id={`price${kind}-error`} className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
            </div>
          );
        })}
        <div className="min-w-0 space-y-2">
          <label htmlFor="vatRate" className="label">Taux de TVA</label>
          <select id="vatRate" name="vatRate" className="input" required value={vatRate}
            onChange={(event) => setVatRate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.vatRate) || undefined}
            aria-describedby={fieldErrors.vatRate ? "vatRate-error" : undefined}>
            <option value="" disabled>Sélectionnez un taux</option>
            {rates.map(({ code, label, rate }, index) => (
              <option key={`${code}-${index}`} value={rate}>{label} ({rate}%)</option>
            ))}
          </select>
          {fieldErrors.vatRate ? <p id="vatRate-error" className="text-xs text-red-600 dark:text-red-400">{fieldErrors.vatRate}</p> : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="vatAmount" className="label">{`Montant TVA (${currencyCode})`}</label>
          <Input id="vatAmount" value={prices ? format(prices.vatAmountCents) : ""} readOnly aria-live="polite" />
        </div>
      </div>
      <p id="product-price-help" className="text-xs text-zinc-500 dark:text-zinc-400">
        Le prix saisi reste fixe lorsque la TVA change. Calcul avant remise, FODEC et timbre,
        arrondi à {decimals} décimales. Les taux de TVA se configurent dans les paramètres.
      </p>
    </fieldset>
  );
}
