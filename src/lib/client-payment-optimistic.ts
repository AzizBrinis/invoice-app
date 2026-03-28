import type { SerializedClientPayment } from "@/app/(app)/clients/actions";
import type { ClientPaymentFilters } from "@/lib/client-payment-filters";

export const OPTIMISTIC_CLIENT_PAYMENT_ID_PREFIX = "temp-payment-";

export type PaymentCurrencyTotal = {
  currency: string;
  totalAmountCents: number;
  paymentCount: number;
};

export type PaymentsSummaryState = {
  paymentCount: number;
  receiptCount: number;
  clientCount: number;
  totalsByCurrency: PaymentCurrencyTotal[];
};

export type SerializedPaymentsPage = {
  items: SerializedClientPayment[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type PaymentsWorkspaceState = {
  summary: PaymentsSummaryState;
  paymentsPage: SerializedPaymentsPage;
};

export type PaymentsOptimisticAction = {
  type: "create";
  payment: SerializedClientPayment;
  matchesFilters: boolean;
};

export function buildOptimisticClientPaymentId(timestamp = Date.now()) {
  return `${OPTIMISTIC_CLIENT_PAYMENT_ID_PREFIX}${timestamp}`;
}

export function isOptimisticClientPaymentId(paymentId: string) {
  return paymentId.startsWith(OPTIMISTIC_CLIENT_PAYMENT_ID_PREFIX);
}

export function isPersistedClientPayment(
  payment: Pick<SerializedClientPayment, "id">,
) {
  return !isOptimisticClientPaymentId(payment.id);
}

function matchesPaymentSearch(
  payment: SerializedClientPayment,
  search: string,
) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [
    payment.receiptNumber ?? "",
    payment.reference ?? "",
    payment.method ?? "",
    payment.description ?? "",
    payment.note ?? "",
    payment.client.displayName,
    payment.client.companyName ?? "",
    payment.client.email ?? "",
    ...payment.serviceLinks.flatMap((link) => [
      link.titleSnapshot,
      link.detailsSnapshot ?? "",
    ]),
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

export function matchesPaymentFilters(
  payment: SerializedClientPayment,
  filters: ClientPaymentFilters,
) {
  if (filters.clientId && payment.client.id !== filters.clientId) {
    return false;
  }

  const paymentDate = new Date(payment.date);
  if (filters.dateFrom && paymentDate < filters.dateFrom) {
    return false;
  }
  if (filters.dateTo && paymentDate > filters.dateTo) {
    return false;
  }

  return matchesPaymentSearch(payment, filters.search);
}

function mergeCurrencyTotals(
  totals: PaymentCurrencyTotal[],
  payment: SerializedClientPayment,
) {
  const existingEntry = totals.find(
    (entry) => entry.currency === payment.currency,
  );
  if (!existingEntry) {
    return [
      ...totals,
      {
        currency: payment.currency,
        totalAmountCents: payment.amountCents,
        paymentCount: 1,
      },
    ];
  }

  return totals.map((entry) =>
    entry.currency === payment.currency
      ? {
          ...entry,
          totalAmountCents: entry.totalAmountCents + payment.amountCents,
          paymentCount: entry.paymentCount + 1,
        }
      : entry,
  );
}

export function reduceOptimisticPaymentsState(
  state: PaymentsWorkspaceState,
  action: PaymentsOptimisticAction,
  filters: ClientPaymentFilters,
) {
  if (action.type !== "create" || !action.matchesFilters) {
    return state;
  }

  const shouldInsert = state.paymentsPage.page === 1;
  const total = state.paymentsPage.total + 1;
  const currentClientCount =
    state.summary.paymentCount === 0
      ? 1
      : filters.clientId
        ? 1
        : state.summary.clientCount;

  return {
    summary: {
      ...state.summary,
      paymentCount: state.summary.paymentCount + 1,
      clientCount: currentClientCount,
      totalsByCurrency: mergeCurrencyTotals(
        state.summary.totalsByCurrency,
        action.payment,
      ),
    },
    paymentsPage: {
      ...state.paymentsPage,
      items: shouldInsert
        ? [action.payment, ...state.paymentsPage.items].slice(
            0,
            state.paymentsPage.pageSize,
          )
        : state.paymentsPage.items,
      total,
      pageCount: Math.max(1, Math.ceil(total / state.paymentsPage.pageSize)),
    },
  };
}
