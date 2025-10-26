"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Quote, QuoteLine } from "@prisma/client";
import { calculateDocumentTotals, calculateLineTotals } from "@/lib/documents";
import { fromCents, toCents } from "@/lib/money";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@prisma/client";
import type { Product } from "@prisma/client";
import type { CurrencyInfo, CurrencyCode } from "@/lib/currency";
import { normalizeTaxConfiguration, type TaxConfiguration } from "@/lib/taxes";

type QuoteLineForm = {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  discountRate?: number | null;
  discountAmount?: number | null;
  fodecRate?: number | null;
};

type QuoteEditorProps = {
  action: (formData: FormData) => void;
  submitLabel: string;
  clients: Client[];
  products: Product[];
  defaultCurrency: CurrencyCode;
  currencyOptions: CurrencyInfo[];
  taxConfiguration: TaxConfiguration;
  defaultQuote?: Quote & { lines: QuoteLine[] };
};

const STATUS_OPTIONS = [
  { value: "BROUILLON", label: "Brouillon" },
  { value: "ENVOYE", label: "Envoyé" },
  { value: "ACCEPTE", label: "Accepté" },
  { value: "REFUSE", label: "Refusé" },
  { value: "EXPIRE", label: "Expiré" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function QuoteEditor({
  action,
  submitLabel,
  clients,
  products,
  defaultCurrency,
  currencyOptions,
  taxConfiguration,
  defaultQuote,
}: QuoteEditorProps) {
  const initialCurrency = defaultQuote?.currency ?? defaultCurrency;
  const quoteTaxConfig = defaultQuote?.taxConfiguration
    ? normalizeTaxConfiguration(defaultQuote.taxConfiguration)
    : null;
  const [clientId, setClientId] = useState(defaultQuote?.clientId ?? clients[0]?.id ?? "");
  const [status, setStatus] = useState(defaultQuote?.status ?? "BROUILLON");
  const [issueDate, setIssueDate] = useState(
    defaultQuote ? defaultQuote.issueDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [validUntil, setValidUntil] = useState(
    defaultQuote?.validUntil ? defaultQuote.validUntil.toISOString().slice(0, 10) : "",
  );
  const [reference, setReference] = useState(defaultQuote?.reference ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [globalDiscountRate, setGlobalDiscountRate] = useState<number | "">(
    defaultQuote?.globalDiscountRate ?? "",
  );
  const [globalDiscountAmountManual, setGlobalDiscountAmountManual] =
    useState<number | "">(
      defaultQuote &&
        defaultQuote.globalDiscountRate == null &&
        defaultQuote.globalDiscountAmountCents != null
        ? fromCents(defaultQuote.globalDiscountAmountCents, initialCurrency)
        : "",
    );
  const [notes, setNotes] = useState(defaultQuote?.notes ?? "");
  const [terms, setTerms] = useState(defaultQuote?.terms ?? "");
  const defaultLineFodecRate =
    taxConfiguration.fodec.enabled && taxConfiguration.fodec.application === "line"
      ? quoteTaxConfig?.fodec.rate ?? taxConfiguration.fodec.rate
      : null;
  const [applyFodec, setApplyFodec] = useState(
    quoteTaxConfig?.fodec.enabled ??
      (taxConfiguration.fodec.enabled && taxConfiguration.fodec.autoApply),
  );
  const [documentFodecRate, setDocumentFodecRate] = useState<number | "">(
    taxConfiguration.fodec.application === "document"
      ? quoteTaxConfig?.fodec.rate ?? taxConfiguration.fodec.rate
      : "",
  );
  const [applyTimbre, setApplyTimbre] = useState(
    quoteTaxConfig?.timbre.enabled ??
      (taxConfiguration.timbre.enabled && taxConfiguration.timbre.autoApply),
  );
  const [timbreAmount, setTimbreAmount] = useState<number>(
    fromCents(
      quoteTaxConfig?.timbre.amountCents ?? taxConfiguration.timbre.amountCents,
      initialCurrency,
    ),
  );

  const initialLines: QuoteLineForm[] = defaultQuote
    ? defaultQuote.lines
        .sort((a, b) => a.position - b.position)
        .map((line) => ({
          id: line.id,
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: fromCents(line.unitPriceHTCents, initialCurrency),
          vatRate: line.vatRate,
          discountRate: line.discountRate ?? undefined,
          discountAmount:
            line.discountAmountCents != null
              ? fromCents(line.discountAmountCents, initialCurrency)
              : undefined,
          fodecRate:
            taxConfiguration.fodec.application === "line" &&
            taxConfiguration.fodec.enabled
              ? line.fodecRate ?? taxConfiguration.fodec.rate
              : null,
        }))
    : [createEmptyLine(products[0], defaultLineFodecRate, initialCurrency)];

  const [lines, setLines] = useState<QuoteLineForm[]>(initialLines);
  const payloadRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const computedLines = lines.map((line) =>
      calculateLineTotals(
        {
          quantity: line.quantity,
          unitPriceHTCents: toCents(line.unitPrice, currency),
          vatRate: line.vatRate,
          discountRate: line.discountRate ?? undefined,
          discountAmountCents:
            line.discountAmount != null
              ? toCents(line.discountAmount, currency)
              : undefined,
        },
        {
          fodecRate:
            taxConfiguration.fodec.application === "line" &&
            taxConfiguration.fodec.enabled &&
            applyFodec
              ? line.fodecRate ?? taxConfiguration.fodec.rate
              : null,
          fodecCalculationOrder: taxConfiguration.fodec.calculationOrder,
          roundingMode: taxConfiguration.rounding.line,
        },
      ),
    );

    const totalsResult = calculateDocumentTotals(
      computedLines,
      typeof globalDiscountRate === "number" ? globalDiscountRate : undefined,
      typeof globalDiscountAmountManual === "number"
        ? toCents(globalDiscountAmountManual, currency)
        : undefined,
      {
        taxConfiguration,
        applyFodec,
        applyTimbre,
        documentFodecRate:
          taxConfiguration.fodec.application === "document" && applyFodec
            ? typeof documentFodecRate === "number"
              ? documentFodecRate
              : taxConfiguration.fodec.rate
            : null,
        timbreAmountCents: applyTimbre ? toCents(timbreAmount, currency) : 0,
      },
    );

    return {
      computedLines,
      totals: totalsResult,
    };
  }, [
    lines,
    globalDiscountRate,
    globalDiscountAmountManual,
    taxConfiguration,
    applyFodec,
    applyTimbre,
    documentFodecRate,
    timbreAmount,
    currency,
  ]);

  const handleLineChange = (index: number, updates: Partial<QuoteLineForm>) => {
    setLines((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], ...updates };
      return clone;
    });
  };

  const handleDiscountRateChange = (index: number, rawValue: string) => {
    if (rawValue === "") {
      handleLineChange(index, { discountRate: null });
      return;
    }
    const parsed = Number(rawValue);
    handleLineChange(index, {
      discountRate: Number.isNaN(parsed) ? null : parsed,
      discountAmount: undefined,
    });
  };

  const globalDiscountAppliedCents = totals.totals.globalDiscountAppliedCents;
  const globalDiscountAmountDisplay =
    typeof globalDiscountRate === "number"
      ? fromCents(globalDiscountAppliedCents, currency)
      : globalDiscountAmountManual;

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      handleLineChange(index, { productId: null });
      return;
    }
    handleLineChange(index, {
      productId: product.id,
      description: product.name,
      unitPrice: fromCents(product.priceHTCents, currency),
      vatRate: product.vatRate,
      unit: product.unit,
      discountRate: product.defaultDiscountRate ?? undefined,
      discountAmount: undefined,
      fodecRate:
        taxConfiguration.fodec.application === "line" &&
        taxConfiguration.fodec.enabled &&
        applyFodec
          ? taxConfiguration.fodec.rate
          : null,
    });
  };

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine(products[0], defaultLineFodecRate, currency)]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const duplicateLine = (index: number) => {
    setLines((prev) => {
      const line = prev[index];
      return [
        ...prev.slice(0, index + 1),
        { ...line, id: undefined },
        ...prev.slice(index + 1),
      ];
    });
  };

  const buildPayload = () => {
    const payload = {
      id: defaultQuote?.id,
      number: defaultQuote?.number,
      clientId,
      status,
      reference: reference || null,
      issueDate,
      validUntil: validUntil || null,
      currency,
      globalDiscountRate:
        globalDiscountRate === "" ? null : Number(globalDiscountRate),
      globalDiscountAmountCents: globalDiscountAppliedCents ?? 0,
      notes: notes || null,
      terms: terms || null,
      lines: lines.map((line, index) => ({
        productId: line.productId ?? null,
        description: (line.description ?? "").trim(),
        quantity: line.quantity,
        unit: (line.unit ?? "").trim() || "unité",
        unitPriceHTCents: toCents(line.unitPrice, currency),
        vatRate: line.vatRate,
        discountRate: line.discountRate ?? null,
        discountAmountCents:
          line.discountAmount != null
            ? toCents(line.discountAmount, currency)
            : null,
        fodecRate:
          taxConfiguration.fodec.application === "line" &&
          taxConfiguration.fodec.enabled &&
          applyFodec
            ? line.fodecRate ?? taxConfiguration.fodec.rate
            : null,
        position: index,
      })),
      taxes: {
        applyFodec,
        applyTimbre,
        documentFodecRate:
          taxConfiguration.fodec.application === "document"
            ? documentFodecRate === ""
              ? null
              : Number(documentFodecRate)
            : null,
        timbreAmountCents: applyTimbre ? toCents(timbreAmount, currency) : 0,
      },
    };
    return payload;
  };

  return (
    <form
      action={action}
      onSubmit={() => {
        if (payloadRef.current) {
          payloadRef.current.value = JSON.stringify(buildPayload());
        }
      }}
      className="space-y-6"
    >
      <input ref={payloadRef} type="hidden" name="payload" />
      <section className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="label" htmlFor="clientId">
              Client
            </label>
            <select
              id="clientId"
              name="clientId"
              className="input"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              required
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="status">
              Statut
            </label>
            <select
              id="status"
              name="status"
              className="input"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="reference">
              Référence interne
            </label>
            <Input
              id="reference"
              name="reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="DEV-2025-001"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <label className="label" htmlFor="issueDate">
              Date d&apos;émission
            </label>
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="validUntil">
              Validité jusqu&apos;au
            </label>
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="label" htmlFor="currency">
              Devise
            </label>
            <select
              id="currency"
              name="currency"
              className="input"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value as CurrencyCode)
              }
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="label">FODEC</label>
            <div className="flex items-center gap-3">
              <input
                id="applyFodec"
                name="applyFodec"
                type="checkbox"
                className="h-4 w-4"
                checked={applyFodec}
                onChange={(event) => setApplyFodec(event.target.checked)}
                disabled={!taxConfiguration.fodec.enabled}
              />
              <label htmlFor="applyFodec" className="text-sm text-zinc-700 dark:text-zinc-300">
                Appliquer la FODEC
              </label>
            </div>
          </div>
          {taxConfiguration.fodec.application === "document" ? (
            <div className="space-y-2">
              <label htmlFor="documentFodecRate" className="label">
                Taux FODEC (%)
              </label>
              <Input
                id="documentFodecRate"
                name="documentFodecRate"
                type="number"
                step="0.1"
                min="0"
                value={documentFodecRate}
                onChange={(event) =>
                  setDocumentFodecRate(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                disabled={!applyFodec}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="label">Application</label>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Appliquée sur chaque ligne</p>
            </div>
          )}
          <div className="space-y-2">
            <label className="label">Timbre fiscal</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  id="applyTimbre"
                  name="applyTimbre"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={applyTimbre}
                  onChange={(event) => setApplyTimbre(event.target.checked)}
                  disabled={!taxConfiguration.timbre.enabled}
                />
                <label htmlFor="applyTimbre" className="text-sm text-zinc-700 dark:text-zinc-300">
                  Ajouter le timbre fiscal
                </label>
              </div>
              <Input
                id="timbreAmount"
                name="timbreAmount"
                type="number"
                step="0.01"
                min="0"
                value={timbreAmount}
                onChange={(event) => setTimbreAmount(Number(event.target.value) || 0)}
                disabled={!applyTimbre}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Lignes du devis</h2>
          <Button type="button" variant="secondary" onClick={addLine}>
            Ajouter une ligne
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
                <th className="px-3 py-2 text-left">Produit</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Qté</th>
                <th className="px-3 py-2 text-left">Unité</th>
                <th className="px-3 py-2 text-left">{`Prix HT (${currency})`}</th>
                <th className="px-3 py-2 text-left">Remise (%)</th>
                {taxConfiguration.fodec.application === "line" && taxConfiguration.fodec.enabled && (
                  <th className="px-3 py-2 text-left">FODEC (%)</th>
                )}
                <th className="px-3 py-2 text-left">TVA (%)</th>
                <th className="px-3 py-2 text-right">Total TTC</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {lines.map((line, index) => {
                const computed = totals.computedLines[index];
                return (
                  <tr
                    key={index}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <td className="px-3 py-2">
                      <select
                        className="input"
                        value={line.productId ?? ""}
                        onChange={(event) => handleProductSelect(index, event.target.value)}
                      >
                        <option value="">Personnalisé</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Textarea
                        rows={2}
                        value={line.description}
                        onChange={(event) =>
                          handleLineChange(index, { description: event.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) =>
                          handleLineChange(index, { quantity: Number(event.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={line.unit}
                        onChange={(event) => handleLineChange(index, { unit: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(event) =>
                          handleLineChange(index, { unitPrice: Number(event.target.value) })
                        }
                      />
                    </td>
                    {taxConfiguration.fodec.application === "line" && taxConfiguration.fodec.enabled && (
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={line.fodecRate ?? ""}
                          onChange={(event) =>
                            handleLineChange(index, {
                              fodecRate:
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
                            })
                          }
                          disabled={!applyFodec}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={line.discountRate ?? ""}
                        onChange={(event) =>
                          handleDiscountRateChange(index, event.target.value)
                        }
                      />
                      {computed.discountAmountCents > 0 && (
                        <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
                          -
                          {formatCurrency(
                            fromCents(computed.discountAmountCents, currency),
                            currency,
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={line.vatRate}
                        onChange={(event) =>
                          handleLineChange(index, { vatRate: Number(event.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-700">
                      {formatCurrency(fromCents(computed.totalTTCCents, currency), currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => duplicateLine(index)}
                        >
                          Dupliquer
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 1}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Remise globale</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="label" htmlFor="globalDiscountRate">
                Remise (%)
              </label>
              <Input
                id="globalDiscountRate"
                name="globalDiscountRate"
                type="number"
                min="0"
                step="0.1"
                value={globalDiscountRate}
                onChange={(event) => {
                  if (event.target.value === "") {
                    setGlobalDiscountRate("");
                    setGlobalDiscountAmountManual("");
                    return;
                  }
                  const parsed = Number(event.target.value);
                  if (Number.isNaN(parsed)) {
                    setGlobalDiscountRate("");
                    setGlobalDiscountAmountManual("");
                    return;
                  }
                  setGlobalDiscountRate(parsed);
                  setGlobalDiscountAmountManual("");
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="label" htmlFor="globalDiscountAmount">
                {`Remise (${currency})`}
              </label>
              <Input
                id="globalDiscountAmount"
                name="globalDiscountAmount"
                type="number"
                min="0"
                step="0.01"
                value={globalDiscountAmountDisplay}
                onChange={(event) => {
                  if (event.target.value === "") {
                    setGlobalDiscountAmountManual("");
                    setGlobalDiscountRate("");
                    return;
                  }
                  const parsed = Number(event.target.value);
                  setGlobalDiscountAmountManual(
                    Number.isNaN(parsed) ? "" : parsed,
                  );
                  setGlobalDiscountRate("");
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="label" htmlFor="notes">
              Notes internes / externes
            </label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="label" htmlFor="terms">
              Conditions particulières
            </label>
            <Textarea
              id="terms"
              name="terms"
              rows={4}
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
            />
          </div>
        </div>

        <div className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Récapitulatif</h3>
          <dl className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <div className="flex items-center justify-between">
              <dt>Sous-total HT</dt>
              <dd>{formatCurrency(fromCents(totals.totals.subtotalHTCents, currency), currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Remises totales</dt>
              <dd>
                - {formatCurrency(fromCents(totals.totals.totalDiscountCents, currency), currency)}
              </dd>
            </div>
            {totals.totals.taxSummary.map((entry, index) => (
              <div key={`${entry.type}-${entry.rate ?? index}`} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <dt>
                    {entry.label}
                    {entry.rate != null ? ` (${entry.rate}%)` : ""}
                  </dt>
                  <dd>{formatCurrency(fromCents(entry.amountCents, currency), currency)}</dd>
                </div>
                {entry.baseCents > 0 && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Base: {formatCurrency(fromCents(entry.baseCents, currency), currency)}
                  </p>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
              <dt>Total TTC</dt>
              <dd>{formatCurrency(fromCents(totals.totals.totalTTCCents, currency), currency)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function createEmptyLine(
  product: Product | undefined,
  defaultFodecRate: number | null | undefined,
  currency: CurrencyCode,
): QuoteLineForm {
  return {
    productId: product?.id ?? null,
    description: product?.name ?? "",
    quantity: 1,
    unit: product?.unit ?? "unité",
    unitPrice: product ? fromCents(product.priceHTCents, currency) : 0,
    vatRate: product?.vatRate ?? 20,
    discountRate: product?.defaultDiscountRate ?? undefined,
    discountAmount: undefined,
    fodecRate: defaultFodecRate ?? null,
  };
}
