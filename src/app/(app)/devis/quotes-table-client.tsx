"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
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
  const desktopHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const mobileHeaderCheckboxRef = useRef<HTMLInputElement>(null);

  const quoteIdSet = useMemo(
    () => new Set(quotes.map((quote) => quote.id)),
    [quotes],
  );

  const visibleSelectedIds = useMemo(() => {
    const validSelections = new Set<string>();
    selectedIds.forEach((id) => {
      if (quoteIdSet.has(id)) {
        validSelections.add(id);
      }
    });
    return validSelections;
  }, [quoteIdSet, selectedIds]);

  const allSelected = useMemo(() => {
    return quotes.length > 0 && visibleSelectedIds.size === quotes.length;
  }, [quotes.length, visibleSelectedIds]);

  const indeterminate =
    visibleSelectedIds.size > 0 && visibleSelectedIds.size < quotes.length;

  useEffect(() => {
    if (desktopHeaderCheckboxRef.current) {
      desktopHeaderCheckboxRef.current.indeterminate = indeterminate;
    }
    if (mobileHeaderCheckboxRef.current) {
      mobileHeaderCheckboxRef.current.indeterminate = indeterminate;
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

  const selectedArray = Array.from(visibleSelectedIds);
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
  const hasQuotes = quotes.length > 0;

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
      {hasQuotes && (
        <div className="card flex items-center gap-3 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 lg:hidden">
          <input
            ref={mobileHeaderCheckboxRef}
            id="select-all-quotes-mobile"
            type="checkbox"
            aria-label="Sélectionner tous les devis"
            checked={allSelected}
            onChange={(event) => toggleAll(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="select-all-quotes-mobile" className="flex-1">
            Sélectionner tous les devis
          </label>
        </div>
      )}
      <div className="card hidden overflow-x-auto lg:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">
                <input
                  ref={desktopHeaderCheckboxRef}
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
            {hasQuotes ? (
              quotes.map((quote) => (
                <tr
                  key={quote.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={visibleSelectedIds.has(quote.id)}
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
                      <span className="block max-w-[160px] truncate">
                        {quote.reference ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    <span className="block max-w-[200px] truncate">
                      {quote.clientName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatDate(quote.issueDate)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {quote.validUntil ? formatDate(quote.validUntil) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-zinc-900 dark:text-zinc-100">
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
                    <QuoteActions
                      quote={quote}
                      preservedQuery={preservedQuery}
                      redirectBase={redirectBase}
                      duplicateAction={duplicateAction}
                      convertAction={convertAction}
                      deleteAction={deleteAction}
                      changeStatusAction={changeStatusAction}
                    />
                  </td>
                </tr>
              ))
            ) : (
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
      <div className="space-y-3 lg:hidden">
        {hasQuotes ? (
          quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              checked={visibleSelectedIds.has(quote.id)}
              onToggle={(checked) => toggleOne(quote.id, checked)}
              statusLabels={statusLabels}
              preservedQuery={preservedQuery}
              redirectBase={redirectBase}
              duplicateAction={duplicateAction}
              convertAction={convertAction}
              deleteAction={deleteAction}
              changeStatusAction={changeStatusAction}
            />
          ))
        ) : (
          <div className="card p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Aucun devis trouvé.
          </div>
        )}
      </div>
    </div>
  );
}

type QuoteActionsProps = {
  quote: QuoteRow;
  preservedQuery?: Record<string, string>;
  redirectBase: string;
  duplicateAction: (id: string, formData?: FormData) => Promise<void>;
  convertAction: (id: string, formData?: FormData) => Promise<void>;
  deleteAction: (id: string, formData?: FormData) => Promise<void>;
  changeStatusAction: (
    id: string,
    status: QuoteStatus,
    formData?: FormData,
  ) => Promise<void>;
  layout?: "table" | "card";
};

function QuoteActions({
  quote,
  preservedQuery,
  redirectBase,
  duplicateAction,
  convertAction,
  deleteAction,
  changeStatusAction,
  layout = "table",
}: QuoteActionsProps) {
  const containerClasses =
    layout === "card"
      ? "flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      : "flex flex-wrap justify-end gap-2";
  const sizeClasses =
    layout === "card" ? "w-full text-sm sm:flex-1" : "px-2 py-1 text-xs";
  const formClasses =
    layout === "card" ? "inline-flex w-full sm:w-auto" : "inline-flex";

  return (
    <div className={containerClasses}>
      <Button
        asChild
        variant="secondary"
        className={clsx(
          sizeClasses,
          layout === "card" ? "justify-center" : "",
        )}
      >
        <Link
          href={{
            pathname: `/devis/${quote.id}/modifier`,
            ...(preservedQuery ? { query: preservedQuery } : {}),
          }}
        >
          Éditer
        </Link>
      </Button>
      <form
        action={duplicateAction.bind(null, quote.id)}
        className={formClasses}
      >
        <FormSubmitButton
          variant="ghost"
          className={clsx(
            sizeClasses,
            "text-zinc-600 dark:text-zinc-300",
            layout === "card" ? "justify-center" : "",
          )}
        >
          Dupliquer
        </FormSubmitButton>
        <input type="hidden" name="redirectTo" value={redirectBase} />
      </form>
      <Button
        asChild
        variant="ghost"
        className={clsx(
          sizeClasses,
          "text-blue-600 dark:text-blue-400",
          layout === "card" ? "justify-center" : "",
        )}
      >
        <Link
          href={`/api/devis/${quote.id}/pdf`}
          target="_blank"
          rel="noreferrer noopener"
        >
          PDF
        </Link>
      </Button>
      <form
        action={convertAction.bind(null, quote.id)}
        className={formClasses}
      >
        <FormSubmitButton
          variant="ghost"
          className={clsx(
            sizeClasses,
            "text-blue-600 dark:text-blue-400",
            layout === "card" ? "justify-center" : "",
          )}
        >
          Convertir
        </FormSubmitButton>
        <input type="hidden" name="redirectTo" value={redirectBase} />
      </form>
      <form
        action={deleteAction.bind(null, quote.id)}
        className={formClasses}
      >
        <FormSubmitButton
          variant="ghost"
          className={clsx(
            sizeClasses,
            "text-red-600 dark:text-red-400",
            layout === "card" ? "justify-center" : "",
          )}
        >
          Supprimer
        </FormSubmitButton>
        <input type="hidden" name="redirectTo" value={redirectBase} />
      </form>
      <form
        action={changeStatusAction.bind(null, quote.id, "ACCEPTE")}
        className={formClasses}
      >
        <FormSubmitButton
          variant="ghost"
          className={clsx(
            sizeClasses,
            "text-emerald-600 dark:text-emerald-400",
            layout === "card" ? "justify-center" : "",
          )}
        >
          Marquer accepté
        </FormSubmitButton>
        <input type="hidden" name="redirectTo" value={redirectBase} />
      </form>
    </div>
  );
}

type QuoteCardProps = {
  quote: QuoteRow;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  statusLabels: Record<QuoteStatus, string>;
  preservedQuery?: Record<string, string>;
  redirectBase: string;
  duplicateAction: (id: string, formData?: FormData) => Promise<void>;
  convertAction: (id: string, formData?: FormData) => Promise<void>;
  deleteAction: (id: string, formData?: FormData) => Promise<void>;
  changeStatusAction: (
    id: string,
    status: QuoteStatus,
    formData?: FormData,
  ) => Promise<void>;
};

function QuoteCard({
  quote,
  checked,
  onToggle,
  statusLabels,
  preservedQuery,
  redirectBase,
  duplicateAction,
  convertAction,
  deleteAction,
  changeStatusAction,
}: QuoteCardProps) {
  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {quote.number}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="block max-w-[220px] truncate">
              {quote.reference ?? "—"}
            </span>
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Badge variant={statusVariant(quote.status)}>
            {statusLabels[quote.status]}
          </Badge>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onToggle(event.target.checked)}
            aria-label={`Sélectionner le devis ${quote.number}`}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <QuoteInfo label="Client" value={quote.clientName || "—"} />
        <QuoteInfo label="Émission" value={formatDate(quote.issueDate)} />
        <QuoteInfo
          label="Validité"
          value={quote.validUntil ? formatDate(quote.validUntil) : "—"}
        />
        <QuoteInfo
          label="Total TTC"
          value={formatCurrency(
            fromCents(quote.totalTTCCents, quote.currency),
            quote.currency,
          )}
        />
      </div>
      <QuoteActions
        layout="card"
        quote={quote}
        preservedQuery={preservedQuery}
        redirectBase={redirectBase}
        duplicateAction={duplicateAction}
        convertAction={convertAction}
        deleteAction={deleteAction}
        changeStatusAction={changeStatusAction}
      />
    </div>
  );
}

type QuoteInfoProps = {
  label: string;
  value: ReactNode;
};

function QuoteInfo({ label, value }: QuoteInfoProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100 break-words">
        {value}
      </span>
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
