"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { QuoteStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type { QuoteSort } from "@/server/quotes";

type QuoteRow = {
  id: string;
  number: string;
  reference: string | null;
  issueDate: string;
  validUntil: string | null;
  totalTTCCents: number;
  currency: string;
  status: QuoteStatus;
  clientName: string;
};

type QuoteTableClientProps = {
  quotes: QuoteRow[];
  redirectBase: string;
  statusLabels: Record<QuoteStatus, string>;
  duplicateAction: (id: string, formData?: FormData) => Promise<void>;
  convertAction: (id: string, formData?: FormData) => Promise<void>;
  deleteAction: (id: string, formData?: FormData) => Promise<void>;
  changeStatusAction: (
    id: string,
    status: QuoteStatus,
    formData?: FormData,
  ) => Promise<void>;
  bulkDeleteAction: (formData: FormData) => Promise<void>;
  bulkStatusAction: (formData: FormData) => Promise<void>;
  statusOptions: Array<{ value: QuoteStatus; label: string }>;
  search: string;
  statut: QuoteStatus | "all";
  client: string;
  issueFrom?: string;
  issueTo?: string;
  sort: QuoteSort;
};

function statusVariant(status: QuoteStatus) {
  switch (status) {
    case "ACCEPTE":
      return "success";
    case "REFUSE":
    case "EXPIRE":
      return "danger";
    case "ENVOYE":
      return "info";
    default:
      return "neutral";
  }
}

export function QuoteTableClient({
  quotes,
  redirectBase,
  statusLabels,
  duplicateAction,
  convertAction,
  deleteAction,
  changeStatusAction,
  bulkDeleteAction,
  bulkStatusAction,
  statusOptions,
  search,
  statut,
  client,
  issueFrom,
  issueTo,
  sort,
}: QuoteTableClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<QuoteStatus>("ENVOYE");
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [quotes.map((quote) => quote.id).join(",")]);

  const allSelected = useMemo(() => {
    return quotes.length > 0 && selectedIds.size === quotes.length;
  }, [quotes.length, selectedIds]);

  const indeterminate =
    selectedIds.size > 0 && selectedIds.size < quotes.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(quotes.map((quote) => quote.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const clone = new Set(prev);
      if (checked) {
        clone.add(id);
      } else {
        clone.delete(id);
      }
      return clone;
    });
  };

  const selectedArray = Array.from(selectedIds);
  const exportHref =
    selectedArray.length > 0
      ? `/api/export/devis/selection?ids=${selectedArray.join(",")}`
      : undefined;

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("recherche", search);
  if (statut && statut !== "all") queryParams.set("statut", statut);
  if (client) queryParams.set("client", client);
  if (issueFrom) queryParams.set("du", issueFrom);
  if (issueTo) queryParams.set("au", issueTo);
  if (sort && sort !== "issue-desc") queryParams.set("tri", sort);
  const preservedQueryEntries = Array.from(queryParams.entries());
  const preservedQuery =
    preservedQueryEntries.length > 0
      ? Object.fromEntries(preservedQueryEntries)
      : undefined;

  return (
    <div className="space-y-3">
      <BulkToolbar
        selectedCount={selectedArray.length}
        bulkStatus={bulkStatus}
        onStatusChange={setBulkStatus}
        statusOptions={statusOptions}
        exportHref={exportHref}
        redirectBase={redirectBase}
        bulkDeleteAction={bulkDeleteAction}
        bulkStatusAction={bulkStatusAction}
        selectedIds={selectedArray}
      />
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  aria-label="Sélectionner tous les devis"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left">Numéro</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Émission</th>
              <th className="px-4 py-3 text-left">Validité</th>
              <th className="px-4 py-3 text-right">Total TTC</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {quotes.map((quote) => (
              <tr
                key={quote.id}
                className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(quote.id)}
                    onChange={(event) =>
                      toggleOne(quote.id, event.target.checked)
                    }
                    aria-label={`Sélectionner le devis ${quote.number}`}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {quote.number}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {quote.reference ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {quote.clientName}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {formatDate(quote.issueDate)}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {quote.validUntil ? formatDate(quote.validUntil) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(
                    fromCents(quote.totalTTCCents, quote.currency),
                    quote.currency,
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(quote.status)}>
                    {statusLabels[quote.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="secondary" className="px-2 py-1 text-xs">
                      <Link
                        href={{
                          pathname: `/devis/${quote.id}/modifier`,
                          ...(preservedQuery ? { query: preservedQuery } : {}),
                        }}
                      >
                        Éditer
                      </Link>
                    </Button>
                    <form action={duplicateAction.bind(null, quote.id)}>
                      <FormSubmitButton
                        variant="ghost"
                        className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300"
                      >
                        Dupliquer
                      </FormSubmitButton>
                      <input type="hidden" name="redirectTo" value={redirectBase} />
                    </form>
                    <Button
                      asChild
                      variant="ghost"
                      className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400"
                    >
                      <Link
                        href={`/api/devis/${quote.id}/pdf`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        PDF
                      </Link>
                    </Button>
                    <form action={convertAction.bind(null, quote.id)}>
                      <FormSubmitButton
                        variant="ghost"
                        className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400"
                      >
                        Convertir
                      </FormSubmitButton>
                      <input type="hidden" name="redirectTo" value={redirectBase} />
                    </form>
                    <form action={deleteAction.bind(null, quote.id)}>
                      <FormSubmitButton
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600 dark:text-red-400"
                      >
                        Supprimer
                      </FormSubmitButton>
                      <input type="hidden" name="redirectTo" value={redirectBase} />
                    </form>
                    <form
                      action={changeStatusAction.bind(
                        null,
                        quote.id,
                        "ACCEPTE",
                      )}
                    >
                      <FormSubmitButton
                        variant="ghost"
                        className="px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                      >
                        Marquer accepté
                      </FormSubmitButton>
                      <input type="hidden" name="redirectTo" value={redirectBase} />
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  Aucun devis trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type BulkToolbarProps = {
  selectedCount: number;
  bulkStatus: QuoteStatus;
  onStatusChange: (status: QuoteStatus) => void;
  statusOptions: Array<{ value: QuoteStatus; label: string }>;
  exportHref?: string;
  redirectBase: string;
  bulkDeleteAction: (formData: FormData) => Promise<void>;
  bulkStatusAction: (formData: FormData) => Promise<void>;
  selectedIds: string[];
};

function BulkToolbar({
  selectedCount,
  bulkStatus,
  onStatusChange,
  statusOptions,
  exportHref,
  redirectBase,
  bulkDeleteAction,
  bulkStatusAction,
  selectedIds,
}: BulkToolbarProps) {
  const hasSelection = selectedCount > 0;
  if (!selectedIds.length) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4 text-sm text-zinc-600 dark:text-zinc-300">
        <span>
          Sélection groupée : cochez des devis pour activer les actions.
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="h-9 px-3 text-xs"
            disabled
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            className="h-9 px-3 text-xs"
            disabled
          >
            Mettre à jour
          </Button>
          <Button variant="danger" className="h-9 px-3 text-xs" disabled>
            Supprimer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {selectedCount} devis sélectionné{selectedCount > 1 ? "s" : ""}
      </span>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <form
          action={bulkStatusAction}
          className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2"
        >
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="quoteIds" value={id} />
          ))}
          <input type="hidden" name="redirectTo" value={redirectBase} />
          <select
            className="input h-9 w-full sm:w-44"
            value={bulkStatus}
            onChange={(event) => onStatusChange(event.target.value as QuoteStatus)}
            name="status"
          >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FormSubmitButton
            className="h-9 w-full whitespace-nowrap sm:w-auto"
            disabled={!hasSelection}
          >
            Mettre à jour
          </FormSubmitButton>
        </form>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2">
          {exportHref ? (
            <Button
              variant="secondary"
              asChild
              className="h-9 px-3 text-xs whitespace-nowrap"
            >
              <a href={exportHref}>Exporter CSV</a>
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="h-9 px-3 text-xs whitespace-nowrap"
              disabled
            >
              Exporter CSV
            </Button>
          )}
          <form action={bulkDeleteAction} className="inline-flex">
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="quoteIds" value={id} />
          ))}
          <input type="hidden" name="redirectTo" value={redirectBase} />
            <FormSubmitButton variant="danger" className="whitespace-nowrap" disabled={!hasSelection}>
              Supprimer
            </FormSubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
