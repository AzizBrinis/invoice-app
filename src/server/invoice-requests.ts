import { endOfMonth } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { generateId } from "@/lib/id";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { requireUser } from "@/lib/auth";
import {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  type User,
} from "@/lib/db/prisma-server";

const DEFAULT_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 24;

export const INVOICE_REQUEST_STATUS_VALUES = [
  "PENDING",
  "COMPLETED",
] as const;

export type InvoiceRequestStatus =
  (typeof INVOICE_REQUEST_STATUS_VALUES)[number];

export type InvoiceRequestEligibilityReason =
  | "ELIGIBLE"
  | "ALREADY_INVOICED"
  | "OUTSIDE_REQUEST_MONTH";

type InvoiceRequestRow = {
  id: string;
  userId: string;
  clientId: string;
  orderId: string;
  invoiceId: string | null;
  status: string;
  deliveryEmail: string;
  companyName: string;
  vatNumber: string;
  billingAddress: string;
  requestedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BillingOrderRecord = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  currency: string;
  totalTTCCents: number;
  amountPaidCents: number;
  createdAt: Date;
  updatedAt: Date;
  invoiceId: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
  }>;
};

export type BillingProfileSummary = {
  companyName: string;
  vatNumber: string;
  address: string;
  email: string;
};

export type InvoiceRequestSummary = {
  id: string;
  status: InvoiceRequestStatus;
  invoiceId: string | null;
  deliveryEmail: string;
  companyName: string;
  vatNumber: string;
  billingAddress: string;
  requestedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  currency: string;
  totalTTCCents: number;
  amountPaidCents: number;
  createdAt: string;
  updatedAt: string;
  invoiceId: string | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
  }>;
  eligibility: {
    eligible: boolean;
    reason: InvoiceRequestEligibilityReason;
    timezone: string;
    requestDeadlineAt: string;
  };
  invoiceRequest: InvoiceRequestSummary | null;
};

export type CatalogBillingOverview = {
  billingProfile: BillingProfileSummary;
  orders: BillingOrderSummary[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
};

export type AdminInvoiceRequestOrderSummary = {
  orderId: string;
  eligibility: {
    eligible: boolean;
    reason: InvoiceRequestEligibilityReason;
    timezone: string;
    requestDeadlineAt: string;
  };
  invoiceRequest: InvoiceRequestSummary | null;
};

function resolveTenantId(
  user: Pick<User, "id"> & {
    activeTenantId?: string | null;
    tenantId?: string | null;
  },
) {
  return user.activeTenantId ?? user.tenantId ?? user.id;
}

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

function normalizeInvoiceRequestStatus(
  status: string | null | undefined,
): InvoiceRequestStatus {
  return status === "COMPLETED" ? "COMPLETED" : "PENDING";
}

function resolveRequestDeadline(orderDate: Date, timezone = DEFAULT_TIMEZONE) {
  const zonedOrderDate = toZonedTime(orderDate, timezone);
  return fromZonedTime(endOfMonth(zonedOrderDate), timezone);
}

function resolveEffectiveInvoiceId(
  requestInvoiceId: string | null | undefined,
  orderInvoiceId: string | null | undefined,
) {
  return orderInvoiceId ?? requestInvoiceId ?? null;
}

export function resolveOrderInvoiceRequestEligibility(input: {
  orderDate: Date;
  invoiceId?: string | null;
  now?: Date;
  timezone?: string;
}) {
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const requestDeadlineAt = resolveRequestDeadline(input.orderDate, timezone);

  if (input.invoiceId) {
    return {
      eligible: false,
      reason: "ALREADY_INVOICED" as const,
      timezone,
      requestDeadlineAt,
    };
  }

  const orderMonth = formatInTimeZone(input.orderDate, timezone, "yyyy-MM");
  const currentMonth = formatInTimeZone(
    input.now ?? new Date(),
    timezone,
    "yyyy-MM",
  );

  if (orderMonth !== currentMonth) {
    return {
      eligible: false,
      reason: "OUTSIDE_REQUEST_MONTH" as const,
      timezone,
      requestDeadlineAt,
    };
  }

  return {
    eligible: true,
    reason: "ELIGIBLE" as const,
    timezone,
    requestDeadlineAt,
  };
}

function buildInvoiceRequestSummary(
  row: InvoiceRequestRow,
  orderInvoiceId?: string | null,
): InvoiceRequestSummary {
  const invoiceId = resolveEffectiveInvoiceId(row.invoiceId, orderInvoiceId);
  const status = invoiceId
    ? "COMPLETED"
    : normalizeInvoiceRequestStatus(row.status);
  const processedAt =
    status === "COMPLETED"
      ? (row.processedAt ?? row.updatedAt).toISOString()
      : null;

  return {
    id: row.id,
    status,
    invoiceId,
    deliveryEmail: row.deliveryEmail,
    companyName: row.companyName,
    vatNumber: row.vatNumber,
    billingAddress: row.billingAddress,
    requestedAt: row.requestedAt.toISOString(),
    processedAt,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBillingProfile(input: {
  companyName: string | null;
  vatNumber: string | null;
  address: string | null;
  email: string | null;
}): BillingProfileSummary {
  return {
    companyName: input.companyName?.trim() ?? "",
    vatNumber: input.vatNumber?.trim() ?? "",
    address: input.address?.trim() ?? "",
    email: input.email?.trim() ?? "",
  };
}

function mapBillingOrder(
  order: BillingOrderRecord,
  request: InvoiceRequestRow | null,
): BillingOrderSummary {
  const eligibility = resolveOrderInvoiceRequestEligibility({
    orderDate: order.createdAt,
    invoiceId: order.invoiceId,
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    totalTTCCents: order.totalTTCCents,
    amountPaidCents: order.amountPaidCents,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    invoiceId: order.invoiceId,
    items: order.items.map((item) => ({
      id: item.id,
      title: item.description,
      quantity: item.quantity,
    })),
    eligibility: {
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      timezone: eligibility.timezone,
      requestDeadlineAt: eligibility.requestDeadlineAt.toISOString(),
    },
    invoiceRequest: request
      ? buildInvoiceRequestSummary(request, order.invoiceId)
      : null,
  };
}

function buildOrderIdSqlList(orderIds: string[]) {
  return Prisma.join(orderIds.map((orderId) => Prisma.sql`${orderId}`));
}

async function listInvoiceRequestRowsForOrders(input: {
  tenantUserId: string;
  clientId?: string | null;
  orderIds: string[];
}) {
  if (input.orderIds.length === 0) {
    return [];
  }

  const clientFilter = input.clientId
    ? Prisma.sql`AND "clientId" = ${input.clientId}`
    : Prisma.sql``;

  return prisma.$queryRaw<InvoiceRequestRow[]>(Prisma.sql`
    SELECT
      "id",
      "userId",
      "clientId",
      "orderId",
      "invoiceId",
      "status",
      "deliveryEmail",
      "companyName",
      "vatNumber",
      "billingAddress",
      "requestedAt",
      "processedAt",
      "createdAt",
      "updatedAt"
    FROM "InvoiceRequest"
    WHERE "userId" = ${input.tenantUserId}
      ${clientFilter}
      AND "orderId" IN (${buildOrderIdSqlList(input.orderIds)})
    ORDER BY "requestedAt" DESC
  `);
}

function mapRequestRowsByOrderId(rows: InvoiceRequestRow[]) {
  const mapped = new Map<string, InvoiceRequestRow>();
  rows.forEach((row) => {
    if (!mapped.has(row.orderId)) {
      mapped.set(row.orderId, row);
    }
  });
  return mapped;
}

export async function getCatalogBillingOverview(input: {
  tenantUserId: string;
  clientId: string;
  page?: number;
  pageSize?: number;
}) {
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const orderWhere = {
    userId: input.tenantUserId,
    clientId: input.clientId,
  } satisfies Prisma.OrderWhereInput;

  const [client, total] = await Promise.all([
    prisma.client.findFirst({
      where: {
        id: input.clientId,
        userId: input.tenantUserId,
      },
      select: {
        companyName: true,
        vatNumber: true,
        address: true,
        email: true,
      },
    }),
    prisma.order.count({ where: orderWhere }),
  ]);

  if (!client) {
    throw new Error("Client introuvable.");
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const orders =
    total === 0
      ? []
      : await prisma.order.findMany({
          where: orderWhere,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (safePage - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            currency: true,
            totalTTCCents: true,
            amountPaidCents: true,
            createdAt: true,
            updatedAt: true,
            invoiceId: true,
            items: {
              orderBy: { position: "asc" },
              take: 3,
              select: {
                id: true,
                description: true,
                quantity: true,
              },
            },
          },
        });

  const requestRows = await listInvoiceRequestRowsForOrders({
    tenantUserId: input.tenantUserId,
    clientId: input.clientId,
    orderIds: orders.map((order) => order.id),
  });
  const requestByOrderId = mapRequestRowsByOrderId(requestRows);

  return {
    billingProfile: mapBillingProfile(client),
    orders: orders.map((order) =>
      mapBillingOrder(order, requestByOrderId.get(order.id) ?? null),
    ),
    pagination: {
      page: safePage,
      pageSize,
      pageCount,
      total,
    },
  } satisfies CatalogBillingOverview;
}

export async function submitCatalogInvoiceRequest(input: {
  tenantUserId: string;
  clientId: string;
  orderId: string;
  companyName: string;
  vatNumber: string;
  billingAddress: string;
  deliveryEmail?: string | null;
}) {
  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      userId: input.tenantUserId,
    },
    select: {
      id: true,
      email: true,
      companyName: true,
      vatNumber: true,
      address: true,
    },
  });
  if (!client) {
    throw new Error("Client introuvable.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      userId: input.tenantUserId,
      clientId: input.clientId,
    },
    select: {
      id: true,
      invoiceId: true,
      customerEmail: true,
      createdAt: true,
    },
  });
  if (!order) {
    throw new Error("Commande introuvable.");
  }

  const eligibility = resolveOrderInvoiceRequestEligibility({
    orderDate: order.createdAt,
    invoiceId: order.invoiceId,
  });
  if (!eligibility.eligible) {
    if (eligibility.reason === "ALREADY_INVOICED") {
      throw new Error("Une facture existe déjà pour cette commande.");
    }
    throw new Error(
      "Les factures ne peuvent être demandées que pendant le même mois calendaire que la commande.",
    );
  }

  const deliveryEmail =
    input.deliveryEmail?.trim() ||
    client.email?.trim() ||
    order.customerEmail.trim();
  if (!deliveryEmail) {
    throw new Error("Adresse e-mail client introuvable.");
  }

  const companyName = input.companyName.trim();
  const vatNumber = input.vatNumber.trim();
  const billingAddress = input.billingAddress.trim();

  await prisma.client.update({
    where: { id: client.id },
    data: {
      companyName,
      vatNumber,
      address: billingAddress,
    },
  });

  const requestId = generateId("invreq");
  const [request] = await prisma.$queryRaw<InvoiceRequestRow[]>(Prisma.sql`
    INSERT INTO "InvoiceRequest" (
      "id",
      "userId",
      "clientId",
      "orderId",
      "invoiceId",
      "status",
      "deliveryEmail",
      "companyName",
      "vatNumber",
      "billingAddress",
      "requestedAt",
      "processedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${requestId},
      ${input.tenantUserId},
      ${input.clientId},
      ${input.orderId},
      ${null},
      ${"PENDING"},
      ${deliveryEmail},
      ${companyName},
      ${vatNumber},
      ${billingAddress},
      NOW(),
      ${null},
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId", "orderId")
    DO UPDATE SET
      "clientId" = EXCLUDED."clientId",
      "deliveryEmail" = EXCLUDED."deliveryEmail",
      "companyName" = EXCLUDED."companyName",
      "vatNumber" = EXCLUDED."vatNumber",
      "billingAddress" = EXCLUDED."billingAddress",
      "invoiceId" = NULL,
      "status" = ${"PENDING"},
      "requestedAt" = NOW(),
      "processedAt" = NULL,
      "updatedAt" = NOW()
    RETURNING
      "id",
      "userId",
      "clientId",
      "orderId",
      "invoiceId",
      "status",
      "deliveryEmail",
      "companyName",
      "vatNumber",
      "billingAddress",
      "requestedAt",
      "processedAt",
      "createdAt",
      "updatedAt"
  `);

  if (!request) {
    throw new Error("Impossible d'enregistrer la demande de facture.");
  }

  return {
    request: buildInvoiceRequestSummary(request, order.invoiceId),
    billingProfile: {
      companyName,
      vatNumber,
      address: billingAddress,
      email: deliveryEmail,
    } satisfies BillingProfileSummary,
    deliveryEmail,
  };
}

export async function listAdminInvoiceRequestSummariesForOrders(
  orders: Array<{
    id: string;
    createdAt: Date;
    invoiceId?: string | null;
  }>,
  providedTenantUserId?: string,
) {
  if (orders.length === 0) {
    return [] satisfies AdminInvoiceRequestOrderSummary[];
  }

  const tenantUserId = providedTenantUserId
    ? providedTenantUserId
    : resolveTenantId(await requireUser());
  const requestRows = await listInvoiceRequestRowsForOrders({
    tenantUserId,
    orderIds: orders.map((order) => order.id),
  });
  const requestByOrderId = mapRequestRowsByOrderId(requestRows);

  return orders.map((order) => {
    const request = requestByOrderId.get(order.id) ?? null;
    const eligibility = resolveOrderInvoiceRequestEligibility({
      orderDate: order.createdAt,
      invoiceId: order.invoiceId ?? null,
    });

    return {
      orderId: order.id,
      eligibility: {
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        timezone: eligibility.timezone,
        requestDeadlineAt: eligibility.requestDeadlineAt.toISOString(),
      },
      invoiceRequest: request
        ? buildInvoiceRequestSummary(request, order.invoiceId ?? null)
        : null,
    };
  });
}

export async function getAdminInvoiceRequestSummaryForOrder(
  orderId: string,
  providedTenantUserId?: string,
) {
  const tenantUserId = providedTenantUserId
    ? providedTenantUserId
    : resolveTenantId(await requireUser());

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: tenantUserId,
    },
    select: {
      id: true,
      createdAt: true,
      invoiceId: true,
    },
  });
  if (!order) {
    throw new Error("Commande introuvable.");
  }

  const [summary] = await listAdminInvoiceRequestSummariesForOrders(
    [order],
    tenantUserId,
  );
  return summary ?? null;
}

export async function markInvoiceRequestCompletedForOrder(input: {
  tenantUserId: string;
  orderId: string;
  invoiceId: string;
}) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "InvoiceRequest"
      SET
        "invoiceId" = ${input.invoiceId},
        "status" = ${"COMPLETED"},
        "processedAt" = COALESCE("processedAt", NOW()),
        "updatedAt" = NOW()
      WHERE "userId" = ${input.tenantUserId}
        AND "orderId" = ${input.orderId}
    `,
  );
}
