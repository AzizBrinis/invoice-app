import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
} from "@/lib/db/prisma-server";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import {
  getClientFromSessionToken,
  getClientSessionTokenFromCookie,
  signOutClient,
} from "@/lib/client-auth";
import {
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 24;

type Translate = (text: string) => string;

type CatalogClientContext = {
  client: {
    id: string;
    userId: string;
    email: string | null;
    isActive: boolean;
  };
  website: {
    id: string;
    userId: string;
  };
};

type CatalogClientContextError = {
  error: string;
  status: number;
};

const catalogOrderListSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  currency: true,
  totalTTCCents: true,
  amountPaidCents: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { position: "asc" },
    take: 4,
    select: {
      id: true,
      productId: true,
      description: true,
      quantity: true,
      totalTTCCents: true,
      product: {
        select: {
          name: true,
          publicSlug: true,
          coverImageUrl: true,
        },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      method: true,
      status: true,
      proofStatus: true,
      paidAt: true,
      proofUploadedAt: true,
      createdAt: true,
    },
  },
});

const catalogOrderDetailSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  currency: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  customerCompany: true,
  customerAddress: true,
  notes: true,
  subtotalHTCents: true,
  totalDiscountCents: true,
  totalTVACents: true,
  totalTTCCents: true,
  amountPaidCents: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      productId: true,
      description: true,
      quantity: true,
      unit: true,
      unitPriceHTCents: true,
      totalHTCents: true,
      totalTVACents: true,
      totalTTCCents: true,
      product: {
        select: {
          name: true,
          publicSlug: true,
          coverImageUrl: true,
        },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      method: true,
      provider: true,
      externalReference: true,
      paidAt: true,
      proofUrl: true,
      proofStatus: true,
      proofUploadedAt: true,
      createdAt: true,
    },
  },
});

type CatalogOrderListRecord = Prisma.OrderGetPayload<{
  select: typeof catalogOrderListSelect;
}>;

type CatalogOrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof catalogOrderDetailSelect;
}>;

function normalizePage(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

function normalizePageSize(value?: number) {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function buildCatalogClientOrderWhere(input: {
  tenantUserId: string;
  clientId: string;
  customerEmail?: string | null;
  orderId?: string;
  status?: OrderStatus | "all";
}): Prisma.OrderWhereInput {
  return {
    userId: input.tenantUserId,
    ...(input.orderId ? { id: input.orderId } : {}),
    ...(input.status && input.status !== "all" ? { status: input.status } : {}),
    clientId: input.clientId,
  };
}

function mapSummaryItems(
  items: Array<{
    id: string;
    productId: string | null;
    description: string;
    quantity: number;
    totalTTCCents: number;
    product:
      | {
          name: string;
          publicSlug: string | null;
          coverImageUrl: string | null;
        }
      | null;
      }> = [],
) {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    title: item.description,
    productName: item.product?.name ?? null,
    productSlug: item.product?.publicSlug ?? null,
    image: item.product?.coverImageUrl ?? null,
    quantity: item.quantity,
    unitAmountCents:
      Number.isFinite(item.quantity) && item.quantity > 0
        ? Math.round(item.totalTTCCents / item.quantity)
        : null,
    lineTotalCents: item.totalTTCCents,
  }));
}

function buildTimeline(order: CatalogOrderDetailRecord) {
  const entries: Array<{
    id: string;
    label: string;
    description: string | null;
    tone: "neutral" | "info" | "success" | "warning" | "danger";
    occurredAt: string;
  }> = [];
  const seen = new Set<string>();

  const pushEntry = (entry: {
    id: string;
    label: string;
    description?: string | null;
    tone: "neutral" | "info" | "success" | "warning" | "danger";
    occurredAt: Date | string | null | undefined;
  }) => {
    if (!entry.occurredAt) {
      return;
    }
    const occurredAt =
      entry.occurredAt instanceof Date
        ? entry.occurredAt.toISOString()
        : entry.occurredAt;
    const fingerprint = `${entry.id}:${entry.label}:${occurredAt}`;
    if (seen.has(fingerprint)) {
      return;
    }
    seen.add(fingerprint);
    entries.push({
      id: entry.id,
      label: entry.label,
      description: entry.description ?? null,
      tone: entry.tone,
      occurredAt,
    });
  };

  pushEntry({
    id: "order-created",
    label: "Commande enregistree",
    description: `Commande ${order.orderNumber}`,
    tone: "neutral",
    occurredAt: order.createdAt,
  });

  order.payments.forEach((payment) => {
    if (payment.proofUploadedAt) {
      pushEntry({
        id: `proof-${payment.id}`,
        label: "Justificatif de virement recu",
        description: payment.proofStatus
          ? `Statut du justificatif: ${payment.proofStatus.toLowerCase()}`
          : null,
        tone: "info",
        occurredAt: payment.proofUploadedAt,
      });
    }

    switch (payment.status) {
      case OrderPaymentStatus.SUCCEEDED:
        pushEntry({
          id: `payment-paid-${payment.id}`,
          label: "Paiement confirme",
          description: payment.method ?? payment.provider ?? null,
          tone: "success",
          occurredAt: payment.paidAt ?? payment.createdAt,
        });
        break;
      case OrderPaymentStatus.AUTHORIZED:
        pushEntry({
          id: `payment-authorized-${payment.id}`,
          label: "Paiement autorise",
          description: payment.method ?? payment.provider ?? null,
          tone: "info",
          occurredAt: payment.createdAt,
        });
        break;
      case OrderPaymentStatus.FAILED:
        pushEntry({
          id: `payment-failed-${payment.id}`,
          label: "Paiement echoue",
          description: payment.method ?? payment.provider ?? null,
          tone: "danger",
          occurredAt: payment.createdAt,
        });
        break;
      case OrderPaymentStatus.CANCELLED:
        pushEntry({
          id: `payment-cancelled-${payment.id}`,
          label: "Paiement annule",
          description: payment.method ?? payment.provider ?? null,
          tone: "warning",
          occurredAt: payment.createdAt,
        });
        break;
      case OrderPaymentStatus.REFUNDED:
        pushEntry({
          id: `payment-refunded-${payment.id}`,
          label: "Paiement rembourse",
          description: payment.method ?? payment.provider ?? null,
          tone: "warning",
          occurredAt: payment.paidAt ?? payment.createdAt,
        });
        break;
      default:
        break;
    }
  });

  switch (order.status) {
    case OrderStatus.PAID:
      pushEntry({
        id: "order-paid",
        label: "Commande payee",
        tone: "success",
        occurredAt: order.updatedAt,
      });
      break;
    case OrderStatus.FULFILLED:
      pushEntry({
        id: "order-fulfilled",
        label: "Commande livree",
        tone: "success",
        occurredAt: order.updatedAt,
      });
      break;
    case OrderStatus.CANCELLED:
      pushEntry({
        id: "order-cancelled",
        label: "Commande annulee",
        tone: "danger",
        occurredAt: order.updatedAt,
      });
      break;
    case OrderStatus.REFUNDED:
      pushEntry({
        id: "order-refunded",
        label: "Commande remboursee",
        tone: "warning",
        occurredAt: order.updatedAt,
      });
      break;
    default:
      break;
  }

  return entries.sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
}

function mapListOrder(
  order: CatalogOrderListRecord,
  itemCountByOrderId: Map<string, number>,
) {
  const latestPayment = order.payments[0] ?? null;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = itemCountByOrderId.get(order.id) ?? items.length;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: latestPayment?.method ?? null,
    paymentProofStatus: latestPayment?.proofStatus ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    currency: order.currency,
    totalTTCCents: order.totalTTCCents,
    amountPaidCents: order.amountPaidCents,
    itemCount,
    hasMoreItems: itemCount > 3,
    items: mapSummaryItems(items.slice(0, 3)),
  };
}

function mapDetailOrder(order: CatalogOrderDetailRecord) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    currency: order.currency,
    subtotalHTCents: order.subtotalHTCents,
    totalDiscountCents: order.totalDiscountCents,
    totalTVACents: order.totalTVACents,
    totalTTCCents: order.totalTTCCents,
    amountPaidCents: order.amountPaidCents,
    notes: order.notes,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      company: order.customerCompany,
      address: order.customerAddress,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      title: item.description,
      productName: item.product?.name ?? null,
      productSlug: item.product?.publicSlug ?? null,
      image: item.product?.coverImageUrl ?? null,
      quantity: item.quantity,
      unit: item.unit,
      unitAmountCents: item.unitPriceHTCents,
      totalHTCents: item.totalHTCents,
      totalTVACents: item.totalTVACents,
      lineTotalCents: item.totalTTCCents,
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amountCents: payment.amountCents,
      currency: payment.currency,
      method: payment.method,
      provider: payment.provider,
      externalReference: payment.externalReference,
      paidAt: payment.paidAt?.toISOString() ?? null,
      proofUrl: payment.proofUrl,
      proofStatus: payment.proofStatus,
      proofUploadedAt: payment.proofUploadedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
    timeline: buildTimeline(order),
  };
}

export async function requireCatalogClientContext(
  request: NextRequest,
  t: Translate,
): Promise<CatalogClientContext | CatalogClientContextError> {
  const token = await getClientSessionTokenFromCookie();
  if (!token) {
    return { error: t("Please sign in."), status: 401 };
  }

  const client = await getClientFromSessionToken(token);
  if (!client) {
    await signOutClient();
    return { error: t("Please sign in."), status: 401 };
  }
  if (!client.isActive) {
    return { error: t("Account inactive."), status: 403 };
  }

  const domain = resolveCatalogDomainFromHeaders(request.headers);
  const slug = domain
    ? null
    : normalizeCatalogSlugInput(request.nextUrl.searchParams.get("slug"));
  const website = await resolveCatalogWebsite({
    slug,
    domain,
    preview: false,
  });
  if (!website) {
    return { error: t("Site unavailable."), status: 404 };
  }
  if (client.userId !== website.userId) {
    return { error: t("Access denied."), status: 403 };
  }

  return {
    client: {
      id: client.id,
      userId: client.userId,
      email: client.email,
      isActive: client.isActive,
    },
    website: {
      id: website.id,
      userId: website.userId,
    },
  };
}

export async function listCatalogClientOrders(input: {
  tenantUserId: string;
  clientId: string;
  customerEmail?: string | null;
  page?: number;
  pageSize?: number;
  status?: OrderStatus | "all";
}) {
  const requestedPage = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const where = buildCatalogClientOrderWhere({
    tenantUserId: input.tenantUserId,
    clientId: input.clientId,
    customerEmail: input.customerEmail,
    status: input.status ?? "all",
  });

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const items =
    total === 0
      ? []
      : await prisma.order.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: catalogOrderListSelect,
        });
  const itemCounts =
    items.length === 0
      ? []
      : await prisma.orderItem.groupBy({
          by: ["orderId"],
          where: {
            orderId: {
              in: items.map((order) => order.id),
            },
          },
          _count: {
            _all: true,
          },
        });
  const itemCountByOrderId = new Map(
    itemCounts.map((entry) => [entry.orderId, entry._count._all]),
  );

  return {
    orders: items.map((order) => mapListOrder(order, itemCountByOrderId)),
    pagination: {
      page,
      pageSize,
      pageCount,
      total,
    },
    filters: {
      status: input.status ?? "all",
    },
  };
}

export async function getCatalogClientOrderDetail(input: {
  tenantUserId: string;
  clientId: string;
  customerEmail?: string | null;
  orderId: string;
}) {
  const order = await prisma.order.findFirst({
    where: buildCatalogClientOrderWhere({
      tenantUserId: input.tenantUserId,
      clientId: input.clientId,
      customerEmail: input.customerEmail,
      orderId: input.orderId,
    }),
    select: catalogOrderDetailSelect,
  });

  if (!order) {
    return null;
  }

  return mapDetailOrder(order);
}
