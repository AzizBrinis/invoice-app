export type AccountOrderStatus =
  | "PENDING"
  | "PAID"
  | "FULFILLED"
  | "CANCELLED"
  | "REFUNDED";

export type AccountPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type AccountPaymentMethod =
  | "card"
  | "bank_transfer"
  | "cash_on_delivery"
  | "manual";

export type AccountPaymentProofStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type AccountOrderSummaryItem = {
  id: string;
  productId: string | null;
  title: string;
  productName: string | null;
  productSlug: string | null;
  image: string | null;
  quantity: number;
  unitAmountCents: number | null;
  lineTotalCents: number;
};

export type AccountOrderListItem = {
  id: string;
  orderNumber: string;
  status: AccountOrderStatus;
  paymentStatus: AccountPaymentStatus;
  paymentMethod: AccountPaymentMethod | null;
  paymentProofStatus: AccountPaymentProofStatus | null;
  createdAt: string;
  updatedAt: string;
  currency: string;
  totalTTCCents: number;
  amountPaidCents: number;
  itemCount: number;
  hasMoreItems: boolean;
  items: AccountOrderSummaryItem[];
};

export type AccountOrdersListResponse = {
  orders: AccountOrderListItem[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
  filters: {
    status: AccountOrderStatus | "all";
  };
};

export type AccountOrderDetail = {
  id: string;
  orderNumber: string;
  status: AccountOrderStatus;
  paymentStatus: AccountPaymentStatus;
  createdAt: string;
  updatedAt: string;
  currency: string;
  subtotalHTCents: number;
  totalDiscountCents: number;
  totalTVACents: number;
  totalTTCCents: number;
  amountPaidCents: number;
  notes: string | null;
  customer: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    address: string | null;
  };
  items: Array<
    Omit<AccountOrderSummaryItem, "unitAmountCents"> & {
      unitAmountCents: number;
      unit: string;
      totalHTCents: number;
      totalTVACents: number;
    }
  >;
  payments: Array<{
    id: string;
    status: AccountPaymentStatus;
    amountCents: number;
    currency: string;
    method: AccountPaymentMethod | null;
    provider: string | null;
    externalReference: string | null;
    paidAt: string | null;
    proofUrl: string | null;
    proofStatus: AccountPaymentProofStatus | null;
    proofUploadedAt: string | null;
    createdAt: string;
  }>;
  timeline: Array<{
    id: string;
    label: string;
    description: string | null;
    tone: "neutral" | "info" | "success" | "warning" | "danger";
    occurredAt: string;
  }>;
};

export type AccountOrderDetailResponse = {
  order: AccountOrderDetail;
};

export function resolveCatalogueSlugFromPathname(pathname: string | null) {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "catalogue" && segments[1]) {
    return segments[1];
  }
  return null;
}

export function resolveAccountBasePath(pathname: string | null) {
  const slug = resolveCatalogueSlugFromPathname(pathname);
  return slug ? `/catalogue/${slug}` : "";
}

export function parsePositiveInteger(
  value: string | null | undefined,
  fallback: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function resolveOrderStatusLabel(status: AccountOrderStatus) {
  switch (status) {
    case "PAID":
      return "Payee";
    case "FULFILLED":
      return "Livree";
    case "CANCELLED":
      return "Annulee";
    case "REFUNDED":
      return "Remboursee";
    default:
      return "En attente";
  }
}

export function resolvePaymentStatusLabel(status: AccountPaymentStatus) {
  switch (status) {
    case "AUTHORIZED":
      return "Autorise";
    case "SUCCEEDED":
      return "Paye";
    case "FAILED":
      return "Echoue";
    case "CANCELLED":
      return "Annule";
    case "REFUNDED":
      return "Rembourse";
    default:
      return "En attente";
  }
}

export function resolvePaymentMethodLabel(method: AccountPaymentMethod | null) {
  switch (method) {
    case "card":
      return "Carte bancaire";
    case "bank_transfer":
      return "Virement bancaire";
    case "cash_on_delivery":
      return "Paiement a la livraison";
    case "manual":
      return "Paiement manuel";
    default:
      return "Paiement";
  }
}

export function resolveProofStatusLabel(
  status: AccountPaymentProofStatus | null,
) {
  switch (status) {
    case "APPROVED":
      return "Justificatif approuve";
    case "REJECTED":
      return "Justificatif rejete";
    case "PENDING":
      return "Justificatif en attente";
    default:
      return null;
  }
}

export function resolveOrderStatusBadgeClass(status: AccountOrderStatus) {
  switch (status) {
    case "PAID":
    case "FULFILLED":
      return "border-emerald-500/30 bg-emerald-50 text-emerald-700";
    case "CANCELLED":
      return "border-rose-500/30 bg-rose-50 text-rose-700";
    case "REFUNDED":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-amber-400/40 bg-amber-50 text-amber-700";
  }
}

export function resolvePaymentStatusBadgeClass(status: AccountPaymentStatus) {
  switch (status) {
    case "SUCCEEDED":
      return "border-emerald-500/30 bg-emerald-50 text-emerald-700";
    case "AUTHORIZED":
      return "border-sky-500/30 bg-sky-50 text-sky-700";
    case "FAILED":
      return "border-rose-500/30 bg-rose-50 text-rose-700";
    case "CANCELLED":
    case "REFUNDED":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-amber-400/40 bg-amber-50 text-amber-700";
  }
}

export function resolveTimelineToneClass(
  tone: "neutral" | "info" | "success" | "warning" | "danger",
) {
  switch (tone) {
    case "success":
      return "border-emerald-500/20 bg-emerald-50 text-emerald-700";
    case "info":
      return "border-sky-500/20 bg-sky-50 text-sky-700";
    case "warning":
      return "border-amber-400/30 bg-amber-50 text-amber-700";
    case "danger":
      return "border-rose-500/20 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function resolveOrderProgressStep(input: {
  status: AccountOrderStatus;
  paymentStatus: AccountPaymentStatus;
}) {
  if (input.status === "FULFILLED") {
    return 3;
  }
  if (
    input.status === "PAID" ||
    input.paymentStatus === "SUCCEEDED" ||
    input.paymentStatus === "REFUNDED"
  ) {
    return 2;
  }
  if (input.paymentStatus === "AUTHORIZED") {
    return 1;
  }
  return 0;
}

export function buildAccountOrdersHref(options: {
  basePath: string;
  orderId?: string | null;
  page?: number;
  status?: AccountOrderStatus | "all";
}) {
  const pathname = options.orderId
    ? `${options.basePath}/account/orders/${options.orderId}`
    : `${options.basePath}/account/orders`;
  const params = new URLSearchParams();

  if (!options.orderId && options.page && options.page > 1) {
    params.set("page", String(options.page));
  }
  if (!options.orderId && options.status && options.status !== "all") {
    params.set("status", options.status);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildAccountBillingHref(options: {
  basePath: string;
  page?: number;
}) {
  const pathname = `${options.basePath}/account/billing`;
  const params = new URLSearchParams();

  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function resolveOrderDetailId(logicalPath: string | null) {
  if (!logicalPath) return null;
  const segments = logicalPath.split("/").filter(Boolean);
  if (
    segments[0] === "account" &&
    (segments[1] === "orders" || segments[1] === "orders-history") &&
    segments[2]
  ) {
    return segments[2];
  }
  return null;
}
