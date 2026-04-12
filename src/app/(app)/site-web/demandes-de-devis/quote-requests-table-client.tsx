"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { QuoteRequestStatus } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";

type QuoteRequestRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string | null;
  productName: string;
  status: QuoteRequestStatus;
  quoteId: string | null;
  createdAt: string;
};

type QuoteRequestFilterState = {
  search: string;
  status: QuoteRequestStatus | "all";
  createdFrom: string;
  createdTo: string;
};

type QuoteRequestsTableClientProps = {
  requests: QuoteRequestRow[];
  page: number;
  pageCount: number;
  search: string;
  status: QuoteRequestStatus | "all";
  createdFrom: string;
  createdTo: string;
  statusOptions: Array<{ value: QuoteRequestStatus; label: string }>;
  statusLabels: Record<QuoteRequestStatus, string>;
};

function buildQueryParams(filters: QuoteRequestFilterState, page: number) {
  const params = new URLSearchParams();
  const trimmedSearch = filters.search.trim();
  if (trimmedSearch) params.set("recherche", trimmedSearch);
  if (filters.status && filters.status !== "all") {
    params.set("statut", filters.status);
  }
  if (filters.createdFrom) params.set("du", filters.createdFrom);
  if (filters.createdTo) params.set("au", filters.createdTo);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

function buildHref(
  pathname: string,
  filters: QuoteRequestFilterState,
  page: number,
): Route {
  const query = buildQueryParams(filters, page);
  return (query ? `${pathname}?${query}` : pathname) as Route;
}

function statusVariant(status: QuoteRequestStatus) {
  switch (status) {
    case "CONVERTED":
      return "success";
    case "IN_PROGRESS":
      return "info";
    case "CLOSED":
      return "neutral";
    default:
      return "warning";
  }
}

export function QuoteRequestsTableClient({
  requests,
  page,
  pageCount,
  search,
  status,
  createdFrom,
  createdTo,
  statusOptions,
  statusLabels,
}: QuoteRequestsTableClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/site-web/demandes-de-devis";
  const [searchInput, setSearchInput] = useState(search);
  const [statusFilter, setStatusFilter] = useState<
    QuoteRequestStatus | "all"
  >(status);
  const [dateFrom, setDateFrom] = useState(createdFrom);
  const [dateTo, setDateTo] = useState(createdTo);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setStatusFilter(status);
  }, [status]);

  useEffect(() => {
    setDateFrom(createdFrom);
  }, [createdFrom]);

  useEffect(() => {
    setDateTo(createdTo);
  }, [createdTo]);

  const appliedFilters = useMemo<QuoteRequestFilterState>(
    () => ({
      search,
      status,
      createdFrom,
      createdTo,
    }),
    [search, status, createdFrom, createdTo],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters: QuoteRequestFilterState = {
      search: searchInput,
      status: statusFilter,
      createdFrom: dateFrom,
      createdTo: dateTo,
    };
    router.push(buildHref(pathname, nextFilters, 1));
  };

  const hasRequests = requests.length > 0;
  const hasPagination = pageCount > 1;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-6 sm:items-end"
      >
        <div className="min-w-0 sm:col-span-2">
          <label className="label" htmlFor="recherche">
            Recherche
          </label>
          <input
            className="input"
            type="search"
            id="recherche"
            name="recherche"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Nom, e-mail, societe..."
          />
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label className="label" htmlFor="statut">
            Statut
          </label>
          <select
            id="statut"
            name="statut"
            className="input"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as QuoteRequestStatus | "all")
            }
          >
            <option value="all">Tous</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:col-span-3">
          <label className="label" htmlFor="du">
            Du
          </label>
          <input
            className="input"
            type="date"
            id="du"
            name="du"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>
        <div className="min-w-0 sm:col-span-3">
          <label className="label" htmlFor="au">
            Au
          </label>
          <input
            className="input"
            type="date"
            id="au"
            name="au"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" className="sm:col-span-6 sm:w-fit">
          Filtrer
        </Button>
      </form>

      <div className="card hidden overflow-hidden lg:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Demande</th>
              <th className="px-4 py-3 text-left">Produit</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Devis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {hasRequests ? (
              requests.map((request) => (
                <tr
                  key={request.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/site-web/demandes-de-devis/${request.id}`}
                      className="font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      {request.customerName}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {request.customerEmail}
                    </div>
                    {request.customerCompany ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {request.customerCompany}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {request.productName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(request.status)}>
                      {statusLabels[request.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {request.quoteId ? (
                      <Link
                        href={`/devis/${request.quoteId}/modifier`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Voir devis
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  Aucune demande trouvee.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {hasRequests ? (
          requests.map((request) => (
            <article key={request.id} className="card space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/site-web/demandes-de-devis/${request.id}`}
                    className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    {request.customerName}
                  </Link>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {request.customerEmail}
                  </p>
                  {request.customerCompany ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {request.customerCompany}
                    </p>
                  ) : null}
                </div>
                <Badge variant={statusVariant(request.status)}>
                  {statusLabels[request.status]}
                </Badge>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Produit
                  </dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">
                    {request.productName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Date
                  </dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">
                    {formatDate(request.createdAt)}
                  </dd>
                </div>
              </dl>
              <div>
                {request.quoteId ? (
                  <Link
                    href={`/devis/${request.quoteId}/modifier`}
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Voir devis
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Aucun devis associe
                  </span>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="card p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Aucune demande trouvee.
          </div>
        )}
      </div>

      {hasPagination ? (
        <div className="flex items-center justify-center gap-2">
          <PaginationButton
            label="Precedent"
            disabled={page <= 1}
            onClick={() =>
              router.push(buildHref(pathname, appliedFilters, page - 1))
            }
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            Page {page} / {pageCount}
          </span>
          <PaginationButton
            label="Suivant"
            disabled={page >= pageCount}
            onClick={() =>
              router.push(buildHref(pathname, appliedFilters, page + 1))
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}
