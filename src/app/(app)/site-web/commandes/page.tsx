import { listOrders } from "@/server/orders";
import type { OrderStatus, OrderPaymentStatus } from "@/lib/db/prisma";
import { OrdersTableClient } from "@/app/(app)/site-web/commandes/orders-table-client";
import { listAdminInvoiceRequestSummariesForOrders } from "@/server/invoice-requests";

export const dynamic = "force-dynamic";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  FULFILLED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  PENDING: "En attente",
  AUTHORIZED: "Autorisée",
  SUCCEEDED: "Payée",
  FAILED: "Échouée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "FULFILLED",
  "CANCELLED",
  "REFUNDED",
];

const PAYMENT_STATUS_VALUES: readonly OrderPaymentStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

const PAYMENT_METHOD_VALUES = [
  "card",
  "bank_transfer",
  "cash_on_delivery",
  "manual",
] as const;

type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
  cash_on_delivery: "Paiement à la livraison",
  manual: "Paiement manuel",
};

type SearchParams = Record<string, string | string[] | undefined>;
type CommandesPageProps = { searchParams?: Promise<SearchParams> };

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

function isPaymentStatus(value: string): value is OrderPaymentStatus {
  return (PAYMENT_STATUS_VALUES as readonly string[]).includes(value);
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHOD_VALUES as readonly string[]).includes(value);
}

function parseStatusParam(
  value: string | string[] | undefined,
): OrderStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isOrderStatus(candidate) ? candidate : "all";
}

function parsePaymentStatusParam(
  value: string | string[] | undefined,
): OrderPaymentStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isPaymentStatus(candidate) ? candidate : "all";
}

function parsePaymentMethodParam(
  value: string | string[] | undefined,
): PaymentMethod | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isPaymentMethod(candidate) ? candidate : "all";
}

function parseDateInput(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }
  return new Date(timestamp);
}

export default async function CommandesPage({
  searchParams,
}: CommandesPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const search = Array.isArray(resolvedSearchParams?.recherche)
    ? resolvedSearchParams.recherche[0]
    : resolvedSearchParams?.recherche ?? "";
  const statutParam = parseStatusParam(resolvedSearchParams?.statut);
  const paiementParam = parsePaymentStatusParam(resolvedSearchParams?.paiement);
  const methodeParam = parsePaymentMethodParam(resolvedSearchParams?.methode);
  const createdFrom = Array.isArray(resolvedSearchParams?.du)
    ? resolvedSearchParams.du[0]
    : (resolvedSearchParams?.du as string | undefined);
  const createdTo = Array.isArray(resolvedSearchParams?.au)
    ? resolvedSearchParams.au[0]
    : (resolvedSearchParams?.au as string | undefined);
  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : (resolvedSearchParams?.page as string | undefined);

  const page = Number(pageParam ?? "1") || 1;

  const orders = await listOrders({
    search: search || undefined,
    status: statutParam,
    paymentStatus: paiementParam,
    paymentMethod: methodeParam,
    createdFrom: parseDateInput(createdFrom),
    createdTo: parseDateInput(createdTo),
    page,
  });
  const invoiceRequestSummaries = await listAdminInvoiceRequestSummariesForOrders(
    orders.items.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      invoiceId: order.invoiceId,
    })),
  );
  const invoiceRequestByOrderId = new Map(
    invoiceRequestSummaries.map((summary) => [summary.orderId, summary]),
  );

  const tableOrders = orders.items.map((order) => {
    const latestPayment = order.payments[0] ?? null;
    const latestPaymentMethod = latestPayment?.method ?? null;
    const invoiceRequestSummary = invoiceRequestByOrderId.get(order.id) ?? null;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod:
        latestPaymentMethod && isPaymentMethod(latestPaymentMethod)
          ? latestPaymentMethod
          : null,
      paymentProofStatus: latestPayment?.proofStatus ?? null,
      paymentProofUrl: latestPayment?.proofUrl ?? null,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      totalTTCCents: order.totalTTCCents,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      invoiceId:
        order.invoiceId ?? invoiceRequestSummary?.invoiceRequest?.invoiceId ?? null,
      invoiceRequestStatus: invoiceRequestSummary?.invoiceRequest?.status ?? null,
      invoiceRequestRequestedAt:
        invoiceRequestSummary?.invoiceRequest?.requestedAt ?? null,
    };
  });

  const statusOptions = ORDER_STATUS_VALUES.map((value) => ({
    value,
    label: ORDER_STATUS_LABELS[value],
  }));
  const paymentStatusOptions = PAYMENT_STATUS_VALUES.map((value) => ({
    value,
    label: PAYMENT_STATUS_LABELS[value],
  }));
  const paymentMethodOptions = PAYMENT_METHOD_VALUES.map((value) => ({
    value,
    label: PAYMENT_METHOD_LABELS[value],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Commandes
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Suivez les commandes, statuts et paiements du site web.
          </p>
        </div>
      </div>

      <OrdersTableClient
        orders={tableOrders}
        page={orders.page}
        pageCount={orders.pageCount}
        search={search}
        status={statutParam}
        paymentStatus={paiementParam}
        paymentMethod={methodeParam}
        createdFrom={createdFrom ?? ""}
        createdTo={createdTo ?? ""}
        statusOptions={statusOptions}
        paymentStatusOptions={paymentStatusOptions}
        paymentMethodOptions={paymentMethodOptions}
        statusLabels={ORDER_STATUS_LABELS}
        paymentStatusLabels={PAYMENT_STATUS_LABELS}
        paymentMethodLabels={PAYMENT_METHOD_LABELS}
      />
    </div>
  );
}
