"use client";

import type { Route } from "next";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  OrderPaymentProofStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";

type PaymentMethod = "card" | "bank_transfer" | "cash_on_delivery" | "manual";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: PaymentMethod | null;
  paymentProofStatus: OrderPaymentProofStatus | null;
  paymentProofUrl: string | null;
  customerName: string;
  customerEmail: string;
  totalTTCCents: number;
  currency: string;
  createdAt: string;
};

type OrderFilterState = {
  search: string;
  status: OrderStatus | "all";
  paymentStatus: OrderPaymentStatus | "all";
  paymentMethod: PaymentMethod | "all";
  createdFrom: string;
  createdTo: string;
};

type OrdersTableClientProps = {
  orders: OrderRow[];
  page: number;
  pageCount: number;
  search: string;
  status: OrderStatus | "all";
  paymentStatus: OrderPaymentStatus | "all";
  paymentMethod: PaymentMethod | "all";
  createdFrom: string;
  createdTo: string;
  statusOptions: Array<{ value: OrderStatus; label: string }>;
  paymentStatusOptions: Array<{ value: OrderPaymentStatus; label: string }>;
  paymentMethodOptions: Array<{ value: PaymentMethod; label: string }>;
  statusLabels: Record<OrderStatus, string>;
  paymentStatusLabels: Record<OrderPaymentStatus, string>;
  paymentMethodLabels: Record<PaymentMethod, string>;
};

function buildQueryParams(filters: OrderFilterState, page: number) {
  const params = new URLSearchParams();
  const trimmedSearch = filters.search.trim();
  if (trimmedSearch) params.set("recherche", trimmedSearch);
  if (filters.status && filters.status !== "all") {
    params.set("statut", filters.status);
  }
  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    params.set("paiement", filters.paymentStatus);
  }
  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    params.set("methode", filters.paymentMethod);
  }
  if (filters.createdFrom) params.set("du", filters.createdFrom);
  if (filters.createdTo) params.set("au", filters.createdTo);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

function orderStatusVariant(status: OrderStatus) {
  switch (status) {
    case "PAID":
    case "FULFILLED":
      return "success";
    case "PENDING":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

function paymentStatusVariant(status: OrderPaymentStatus) {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "AUTHORIZED":
      return "info";
    case "FAILED":
      return "danger";
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

function proofStatusVariant(status: OrderPaymentProofStatus) {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "PENDING":
    default:
      return "warning";
  }
}

const PROOF_STATUS_LABELS: Record<OrderPaymentProofStatus, string> = {
  PENDING: "Preuve en attente",
  APPROVED: "Preuve approuvée",
  REJECTED: "Preuve rejetée",
};

function buildHref(
  pathname: string,
  filters: OrderFilterState,
  page: number,
): Route {
  const query = buildQueryParams(filters, page);
  return (query ? `${pathname}?${query}` : pathname) as Route;
}

export function OrdersTableClient({
  orders,
  page,
  pageCount,
  search,
  status,
  paymentStatus,
  paymentMethod,
  createdFrom,
  createdTo,
  statusOptions,
  paymentStatusOptions,
  paymentMethodOptions,
  statusLabels,
  paymentStatusLabels,
  paymentMethodLabels,
}: OrdersTableClientProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/site-web/commandes";
  const [searchInput, setSearchInput] = useState(search);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">(
    status,
  );
  const [paymentFilter, setPaymentFilter] = useState<
    OrderPaymentStatus | "all"
  >(paymentStatus);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<
    PaymentMethod | "all"
  >(paymentMethod);
  const [dateFrom, setDateFrom] = useState(createdFrom);
  const [dateTo, setDateTo] = useState(createdTo);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setStatusFilter(status);
  }, [status]);

  useEffect(() => {
    setPaymentFilter(paymentStatus);
  }, [paymentStatus]);

  useEffect(() => {
    setPaymentMethodFilter(paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    setDateFrom(createdFrom);
  }, [createdFrom]);

  useEffect(() => {
    setDateTo(createdTo);
  }, [createdTo]);

  const appliedFilters = useMemo<OrderFilterState>(
    () => ({
      search,
      status,
      paymentStatus,
      paymentMethod,
      createdFrom,
      createdTo,
    }),
    [search, status, paymentStatus, paymentMethod, createdFrom, createdTo],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters: OrderFilterState = {
      search: searchInput,
      status: statusFilter,
      paymentStatus: paymentFilter,
      paymentMethod: paymentMethodFilter,
      createdFrom: dateFrom,
      createdTo: dateTo,
    };
    router.push(buildHref(pathname, nextFilters, 1));
  };

  const hasOrders = orders.length > 0;
  const hasPagination = pageCount > 1;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-8 sm:items-end"
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
            placeholder="Numéro, client, e-mail..."
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
              setStatusFilter(event.target.value as OrderStatus | "all")
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
        <div className="min-w-0 sm:col-span-2">
          <label className="label" htmlFor="paiement">
            Paiement
          </label>
          <select
            id="paiement"
            name="paiement"
            className="input"
            value={paymentFilter}
            onChange={(event) =>
              setPaymentFilter(
                event.target.value as OrderPaymentStatus | "all",
              )
            }
          >
            <option value="all">Tous</option>
            {paymentStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label className="label" htmlFor="methode">
            Mode de paiement
          </label>
          <select
            id="methode"
            name="methode"
            className="input"
            value={paymentMethodFilter}
            onChange={(event) =>
              setPaymentMethodFilter(
                event.target.value as PaymentMethod | "all",
              )
            }
          >
            <option value="all">Tous</option>
            {paymentMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:col-span-4">
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
        <div className="min-w-0 sm:col-span-4">
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
        <Button type="submit" variant="secondary" className="sm:col-span-8 sm:w-fit">
          Filtrer
        </Button>
      </form>

      <div className="card hidden overflow-hidden lg:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Commande</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Total TTC</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Paiement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {hasOrders ? (
              orders.map((order) => {
                const methodLabel = order.paymentMethod
                  ? paymentMethodLabels[order.paymentMethod]
                  : "Non défini";
                const proofStatus =
                  order.paymentProofStatus ??
                  (order.paymentProofUrl ? "PENDING" : null);

                return (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {order.orderNumber}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {order.customerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      <span className="block max-w-[220px] truncate">
                        {order.customerName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(
                        fromCents(order.totalTTCCents, order.currency),
                        order.currency,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={orderStatusVariant(order.status)}>
                        {statusLabels[order.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          variant={paymentStatusVariant(order.paymentStatus)}
                        >
                          {paymentStatusLabels[order.paymentStatus]}
                        </Badge>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {methodLabel}
                        </span>
                        {proofStatus ? (
                          <Badge variant={proofStatusVariant(proofStatus)}>
                            {PROOF_STATUS_LABELS[proofStatus]}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  Aucune commande trouvée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {hasOrders ? (
          orders.map((order) => {
            const methodLabel = order.paymentMethod
              ? paymentMethodLabels[order.paymentMethod]
              : "Non défini";
            const proofStatus =
              order.paymentProofStatus ??
              (order.paymentProofUrl ? "PENDING" : null);

            return (
              <article key={order.id} className="card space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {order.customerName}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {order.customerEmail}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={orderStatusVariant(order.status)}>
                      {statusLabels[order.status]}
                    </Badge>
                    <Badge variant={paymentStatusVariant(order.paymentStatus)}>
                      {paymentStatusLabels[order.paymentStatus]}
                    </Badge>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {methodLabel}
                    </span>
                    {proofStatus ? (
                      <Badge variant={proofStatusVariant(proofStatus)}>
                        {PROOF_STATUS_LABELS[proofStatus]}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Date
                    </dt>
                    <dd className="text-zinc-700 dark:text-zinc-300">
                      {formatDate(order.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Total TTC
                    </dt>
                    <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(
                        fromCents(order.totalTTCCents, order.currency),
                        order.currency,
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })
        ) : (
          <div className="card p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Aucune commande trouvée.
          </div>
        )}
      </div>

      {hasPagination ? (
        <div className="flex items-center justify-center gap-2">
          <PaginationButton
            label="Précédent"
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
