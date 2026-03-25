import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateId } from "@/lib/id";
import { calculateLineTotals } from "@/lib/documents";
import {
  ClientSource,
  OrderPaymentProofStatus,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { resolveClientForContact } from "@/server/clients";
import {
  queueOrderCreatedEmailJob,
  queueOrderPaymentReceivedEmailJob,
  queueOrderTransferProofReceivedEmailJob,
} from "@/server/order-email-jobs";

const orderItemInputSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().min(2, "Description requise"),
  quantity: z.number().positive("Quantité requise"),
  unit: z.string().min(1, "Unité requise"),
  unitPriceHTCents: z.number().int().nonnegative(),
  vatRate: z.number().min(0).max(100),
  discountRate: z.number().min(0).max(100).nullable().optional(),
  discountAmountCents: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  position: z.number().int().nonnegative().optional(),
});

const orderCustomerSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("E-mail invalide"),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

const orderTransferProofSchema = z.object({
  orderId: z.string().min(1),
  proofUrl: z.string().min(1),
  proofMimeType: z.string().nullable().optional(),
  proofSizeBytes: z.number().int().nonnegative().nullable().optional(),
});

const orderPaymentProofStatusSchema = z.object({
  paymentId: z.string().min(1),
  status: z.nativeEnum(OrderPaymentProofStatus),
});

export const orderInputSchema = z.object({
  id: z.string().optional(),
  orderNumber: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional().default(OrderStatus.PENDING),
  paymentStatus: z
    .nativeEnum(OrderPaymentStatus)
    .optional()
    .default(OrderPaymentStatus.PENDING),
  paymentMethod: z
    .enum(["card", "bank_transfer", "cash_on_delivery"])
    .nullable()
    .optional(),
  currency: z.string().optional().default("TND"),
  clientId: z.string().nullable().optional(),
  customer: orderCustomerSchema,
  notes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  quoteId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  items: z
    .array(orderItemInputSchema)
    .min(1, "Au moins une ligne est nécessaire"),
});

export type OrderInput = z.input<typeof orderInputSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type OrderTransferProofInput = z.infer<typeof orderTransferProofSchema>;
export type OrderPaymentProofStatusInput = z.infer<
  typeof orderPaymentProofStatusSchema
>;

export type OrderPaymentMethod =
  | "card"
  | "bank_transfer"
  | "cash_on_delivery"
  | "manual";

export type OrderFilters = {
  search?: string;
  status?: OrderStatus | "all";
  paymentStatus?: OrderPaymentStatus | "all";
  paymentMethod?: OrderPaymentMethod | "all";
  clientId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const orderListSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  customerName: true,
  customerEmail: true,
  totalTTCCents: true,
  currency: true,
  createdAt: true,
  payments: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      method: true,
      proofStatus: true,
      proofUrl: true,
    },
  },
});

const orderDetailSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  currency: true,
  clientId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  customerCompany: true,
  customerAddress: true,
  notes: true,
  internalNotes: true,
  subtotalHTCents: true,
  totalDiscountCents: true,
  totalTVACents: true,
  totalTTCCents: true,
  amountPaidCents: true,
  createdAt: true,
  updatedAt: true,
  quoteId: true,
  invoiceId: true,
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      productId: true,
      description: true,
      quantity: true,
      unit: true,
      unitPriceHTCents: true,
      vatRate: true,
      discountRate: true,
      discountAmountCents: true,
      totalHTCents: true,
      totalTVACents: true,
      totalTTCCents: true,
      position: true,
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

export type OrderListItem = Prisma.OrderGetPayload<{
  select: typeof orderListSelect;
}>;

export type OrderDetail = Prisma.OrderGetPayload<{
  select: typeof orderDetailSelect;
}>;

export type OrderListResult = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function normalizePage(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }
  return value;
}

function normalizePageSize(value?: number) {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(MAX_PAGE_SIZE, Math.max(1, value));
}

function buildOrderWhere(
  userId: string,
  filters: OrderFilters,
): Prisma.OrderWhereInput {
  const {
    search,
    status = "all",
    paymentStatus = "all",
    paymentMethod = "all",
    clientId,
    createdFrom,
    createdTo,
  } = filters;

  return {
    userId,
    ...(status === "all" ? {} : { status }),
    ...(paymentStatus === "all" ? {} : { paymentStatus }),
    ...(paymentMethod === "all"
      ? {}
      : {
          payments: {
            some: {
              method: paymentMethod,
            },
          },
        }),
    ...(clientId ? { clientId } : {}),
    ...(createdFrom || createdTo
      ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
            { customerEmail: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

async function assertProductsOwnership(
  userId: string,
  productIds: Array<string | null | undefined>,
) {
  const ids = Array.from(
    new Set(productIds.filter((value): value is string => Boolean(value))),
  );
  if (ids.length === 0) {
    return;
  }
  const count = await prisma.product.count({
    where: { id: { in: ids }, userId },
  });
  if (count !== ids.length) {
    throw new Error("Produit introuvable");
  }
}

function generateOrderNumber() {
  return generateId("cmd");
}

function computeOrderTotals(items: OrderItemInput[]) {
  const computedLines = items.map((line) =>
    calculateLineTotals({
      quantity: line.quantity,
      unitPriceHTCents: line.unitPriceHTCents,
      vatRate: line.vatRate,
      discountRate: line.discountRate ?? null,
      discountAmountCents: line.discountAmountCents ?? null,
    }),
  );

  const totals = computedLines.reduce(
    (acc, line) => ({
      subtotalHTCents: acc.subtotalHTCents + line.totalHTCents,
      totalDiscountCents: acc.totalDiscountCents + line.discountAmountCents,
      totalTVACents: acc.totalTVACents + line.totalTVACents,
      totalTTCCents: acc.totalTTCCents + line.totalTTCCents,
    }),
    {
      subtotalHTCents: 0,
      totalDiscountCents: 0,
      totalTVACents: 0,
      totalTTCCents: 0,
    },
  );

  return { computedLines, totals };
}

const paymentStatusPriority = [
  OrderPaymentStatus.REFUNDED,
  OrderPaymentStatus.SUCCEEDED,
  OrderPaymentStatus.AUTHORIZED,
  OrderPaymentStatus.PENDING,
  OrderPaymentStatus.FAILED,
  OrderPaymentStatus.CANCELLED,
] as const;

type OrderPaymentSummary = {
  paymentStatus: OrderPaymentStatus;
  amountPaidCents: number;
  orderStatus: OrderStatus;
};

function resolvePaymentStatus(statuses: OrderPaymentStatus[]) {
  if (statuses.length === 0) {
    return OrderPaymentStatus.PENDING;
  }
  for (const status of paymentStatusPriority) {
    if (statuses.includes(status)) {
      return status;
    }
  }
  return OrderPaymentStatus.PENDING;
}

function calculateAmountPaidCents(
  payments: Array<{ status: OrderPaymentStatus; amountCents: number }>,
) {
  const paidCents = payments
    .filter((payment) => payment.status === OrderPaymentStatus.SUCCEEDED)
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const refundedCents = payments
    .filter((payment) => payment.status === OrderPaymentStatus.REFUNDED)
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  return Math.max(0, paidCents - refundedCents);
}

function resolveOrderStatusAfterPayment({
  currentStatus,
  paymentStatus,
  amountPaidCents,
  totalTTCCents,
}: {
  currentStatus: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  amountPaidCents: number;
  totalTTCCents: number;
}) {
  if (paymentStatus === OrderPaymentStatus.REFUNDED) {
    return OrderStatus.REFUNDED;
  }
  if (
    paymentStatus === OrderPaymentStatus.SUCCEEDED &&
    amountPaidCents >= totalTTCCents
  ) {
    return currentStatus === OrderStatus.FULFILLED
      ? OrderStatus.FULFILLED
      : OrderStatus.PAID;
  }
  if (
    paymentStatus === OrderPaymentStatus.CANCELLED &&
    currentStatus === OrderStatus.PENDING
  ) {
    return OrderStatus.CANCELLED;
  }
  return currentStatus;
}

export async function syncOrderPaymentStatus(
  orderId: string,
  providedUserId?: string,
): Promise<OrderPaymentSummary> {
  const userId = providedUserId ?? (await requireUser()).id;
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalTTCCents: true,
        customerEmail: true,
        payments: {
          select: {
            status: true,
            amountCents: true,
          },
        },
      },
    });
    if (!order) {
      throw new Error("Commande introuvable");
    }

    const paymentStatus = resolvePaymentStatus(
      order.payments.map((payment) => payment.status),
    );
    const amountPaidCents = calculateAmountPaidCents(order.payments);
    const nextOrderStatus = resolveOrderStatusAfterPayment({
      currentStatus: order.status,
      paymentStatus,
      amountPaidCents,
      totalTTCCents: order.totalTTCCents,
    });
    const shouldNotifyPayment =
      order.paymentStatus !== OrderPaymentStatus.SUCCEEDED &&
      paymentStatus === OrderPaymentStatus.SUCCEEDED;

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        amountPaidCents,
        status: nextOrderStatus,
      },
    });

    return {
      paymentStatus,
      amountPaidCents,
      orderStatus: nextOrderStatus,
      shouldNotifyPayment,
      customerEmail: order.customerEmail,
    };
  });

  if (result.shouldNotifyPayment && result.customerEmail) {
    queueOrderPaymentReceivedEmailJob({
      userId,
      orderId,
      to: result.customerEmail,
    })
      .then((job) => {
        console.info("[orders] payment notification queued", {
          orderId,
          deduped: job.deduped,
        });
      })
      .catch((error) => {
        console.warn("[orders] payment email enqueue failed", error);
      });
  }

  return {
    paymentStatus: result.paymentStatus,
    amountPaidCents: result.amountPaidCents,
    orderStatus: result.orderStatus,
  };
}

export async function attachOrderTransferProof(
  input: OrderTransferProofInput,
  providedUserId?: string,
) {
  const userId = providedUserId ?? (await requireUser()).id;
  const payload = orderTransferProofSchema.parse(input);
  const proofUploadedAt = new Date();

  const { orderId, paymentId, customerEmail } = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: payload.orderId, userId },
        select: {
          id: true,
          customerEmail: true,
          currency: true,
          totalTTCCents: true,
        },
      });
      if (!order) {
        throw new Error("Commande introuvable");
      }

      const existingPayment = await tx.orderPayment.findFirst({
        where: {
          orderId: order.id,
          method: "bank_transfer",
        },
        orderBy: { createdAt: "desc" },
      });

      const proofPayload = {
        proofUrl: payload.proofUrl,
        proofMimeType: payload.proofMimeType ?? null,
        proofSizeBytes: payload.proofSizeBytes ?? null,
        proofUploadedAt,
        proofStatus: OrderPaymentProofStatus.PENDING,
      };

      const payment = existingPayment
        ? await tx.orderPayment.update({
            where: { id: existingPayment.id },
            data: {
              ...proofPayload,
              status: OrderPaymentStatus.PENDING,
            },
          })
        : await tx.orderPayment.create({
            data: {
              orderId: order.id,
              userId,
              status: OrderPaymentStatus.PENDING,
              amountCents: order.totalTTCCents,
              currency: order.currency,
              method: "bank_transfer",
              provider: "bank_transfer",
              ...proofPayload,
            },
          });

      return {
        orderId: order.id,
        paymentId: payment.id,
        customerEmail: order.customerEmail,
      };
    },
  );

  await syncOrderPaymentStatus(orderId, userId);
  if (customerEmail) {
    queueOrderTransferProofReceivedEmailJob({
      userId,
      orderId,
      to: customerEmail,
    })
      .then((job) => {
        console.info("[orders] proof notification queued", {
          orderId,
          paymentId,
          deduped: job.deduped,
        });
      })
      .catch((error) => {
        console.warn("[orders] proof email enqueue failed", error);
      });
  }
  return { orderId, paymentId };
}

export async function updateOrderPaymentProofStatus(
  input: OrderPaymentProofStatusInput,
  providedUserId?: string,
) {
  const userId = providedUserId ?? (await requireUser()).id;
  const payload = orderPaymentProofStatusSchema.parse(input);

  const payment = await prisma.orderPayment.findFirst({
    where: { id: payload.paymentId, userId },
    select: {
      id: true,
      orderId: true,
      status: true,
      paidAt: true,
      method: true,
    },
  });
  if (!payment) {
    throw new Error("Paiement introuvable");
  }
  if (payment.method !== "bank_transfer") {
    throw new Error("Ce paiement n'est pas un virement bancaire.");
  }

  const nextStatus =
    payload.status === OrderPaymentProofStatus.APPROVED
      ? OrderPaymentStatus.SUCCEEDED
      : payload.status === OrderPaymentProofStatus.REJECTED
        ? OrderPaymentStatus.FAILED
        : payment.status;

  const updated = await prisma.orderPayment.update({
    where: { id: payment.id },
    data: {
      proofStatus: payload.status,
      status: nextStatus,
      paidAt:
        nextStatus === OrderPaymentStatus.SUCCEEDED
          ? payment.paidAt ?? new Date()
          : payment.paidAt,
    },
  });

  await syncOrderPaymentStatus(payment.orderId, userId);
  return updated;
}

export async function listOrders(
  filters: OrderFilters = {},
  providedUserId?: string,
): Promise<OrderListResult> {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const where = buildOrderWhere(userId, filters);

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: orderListSelect,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getOrder(
  id: string,
  providedUserId?: string,
): Promise<OrderDetail | null> {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  return prisma.order.findFirst({
    where: { id, userId },
    select: orderDetailSelect,
  });
}

export async function updateOrderInternalNotes(
  id: string,
  internalNotes: string | null,
  providedUserId?: string,
) {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  const existing = await prisma.order.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Commande introuvable");
  }
  return prisma.order.update({
    where: { id },
    data: {
      internalNotes,
    },
  });
}

export async function cancelOrder(id: string, providedUserId?: string) {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  const existing = await prisma.order.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Commande introuvable");
  }
  return prisma.order.update({
    where: { id },
    data: {
      status: OrderStatus.CANCELLED,
    },
  });
}

export async function markOrderDelivered(id: string, providedUserId?: string) {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  const existing = await prisma.order.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Commande introuvable");
  }
  return prisma.order.update({
    where: { id },
    data: {
      status: OrderStatus.FULFILLED,
    },
  });
}

export async function markOrderPaid(id: string, providedUserId?: string) {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        amountPaidCents: true,
        totalTTCCents: true,
        currency: true,
      },
    });
    if (!order) {
      throw new Error("Commande introuvable");
    }

    const remainingCents = Math.max(
      0,
      order.totalTTCCents - order.amountPaidCents,
    );
    if (remainingCents > 0) {
      await tx.orderPayment.create({
        data: {
          orderId: order.id,
          userId,
          status: OrderPaymentStatus.SUCCEEDED,
          amountCents: remainingCents,
          currency: order.currency,
          method: "manual",
          provider: "manual",
          paidAt: new Date(),
        },
      });
    }

    const nextStatus = resolveOrderStatusAfterPayment({
      currentStatus: order.status,
      paymentStatus: OrderPaymentStatus.SUCCEEDED,
      amountPaidCents: order.totalTTCCents,
      totalTTCCents: order.totalTTCCents,
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        paymentStatus: OrderPaymentStatus.SUCCEEDED,
        amountPaidCents: order.totalTTCCents,
      },
    });
  });
}

export async function createOrder(input: OrderInput, providedUserId?: string) {
  const userId = providedUserId ?? (await requireUser()).id;
  const payload = orderInputSchema.parse(input);
  await assertProductsOwnership(
    userId,
    payload.items.map((line) => line.productId),
  );

  const normalizedEmail = payload.customer.email.trim().toLowerCase();
  const client = await resolveClientForContact(
    {
      clientId: payload.clientId ?? null,
      name: payload.customer.name,
      email: normalizedEmail,
      phone: payload.customer.phone ?? null,
      company: payload.customer.company ?? null,
      address: payload.customer.address ?? null,
    },
    userId,
    {
      source: ClientSource.WEBSITE_LEAD,
    },
  );

  const { computedLines, totals } = computeOrderTotals(payload.items);
  const orderNumber = payload.orderNumber ?? generateOrderNumber();
  const paymentMethod = payload.paymentMethod ?? null;
  const paymentCreate = paymentMethod
    ? {
        create: {
          userId,
          status: OrderPaymentStatus.PENDING,
          amountCents: totals.totalTTCCents,
          currency: payload.currency,
          method: paymentMethod,
          provider: paymentMethod,
        },
      }
    : undefined;

  const created = await prisma.order.create({
    data: {
      userId,
      orderNumber,
      status: payload.status,
      paymentStatus: payload.paymentStatus,
      currency: payload.currency,
      clientId: client.id,
      customerName: payload.customer.name.trim(),
      customerEmail: normalizedEmail,
      customerPhone: payload.customer.phone ?? null,
      customerCompany: payload.customer.company ?? null,
      customerAddress: payload.customer.address ?? null,
      notes: payload.notes ?? null,
      internalNotes: payload.internalNotes ?? null,
      subtotalHTCents: totals.subtotalHTCents,
      totalDiscountCents: totals.totalDiscountCents,
      totalTVACents: totals.totalTVACents,
      totalTTCCents: totals.totalTTCCents,
      amountPaidCents: 0,
      quoteId: payload.quoteId ?? null,
      invoiceId: payload.invoiceId ?? null,
      items: {
        create: payload.items.map((line, index) => ({
          productId: line.productId ?? null,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPriceHTCents: line.unitPriceHTCents,
          vatRate: line.vatRate,
          discountRate: computedLines[index].discountRate ?? null,
          discountAmountCents: computedLines[index].discountAmountCents,
          totalHTCents: computedLines[index].totalHTCents,
          totalTVACents: computedLines[index].totalTVACents,
          totalTTCCents: computedLines[index].totalTTCCents,
          position: line.position ?? index,
        })),
      },
      payments: paymentCreate,
    },
  });

  queueOrderCreatedEmailJob({
    userId,
    orderId: created.id,
    to: created.customerEmail,
  }).catch((error) => {
    console.warn("[orders] order email enqueue failed", error);
  });

  return created;
}

export async function updateOrder(id: string, input: OrderInput) {
  const { id: userId } = await requireUser();
  const existing = await prisma.order.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Commande introuvable");
  }

  const payload = orderInputSchema.parse({ ...input, id });
  await assertProductsOwnership(
    userId,
    payload.items.map((line) => line.productId),
  );

  const normalizedEmail = payload.customer.email.trim().toLowerCase();
  const client = await resolveClientForContact(
    {
      clientId: payload.clientId ?? existing.clientId,
      name: payload.customer.name,
      email: normalizedEmail,
      phone: payload.customer.phone ?? null,
      company: payload.customer.company ?? null,
      address: payload.customer.address ?? null,
    },
    userId,
    {
      source: ClientSource.WEBSITE_LEAD,
    },
  );

  const { computedLines, totals } = computeOrderTotals(payload.items);
  const orderNumber = payload.orderNumber ?? existing.orderNumber;

  return prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({
      where: { orderId: id },
    });
    return tx.order.update({
      where: { id },
      data: {
        orderNumber,
        status: payload.status,
        paymentStatus: payload.paymentStatus,
        currency: payload.currency,
        clientId: client.id,
        customerName: payload.customer.name.trim(),
        customerEmail: normalizedEmail,
        customerPhone: payload.customer.phone ?? null,
        customerCompany: payload.customer.company ?? null,
        customerAddress: payload.customer.address ?? null,
        notes: payload.notes ?? null,
        internalNotes: payload.internalNotes ?? null,
        subtotalHTCents: totals.subtotalHTCents,
        totalDiscountCents: totals.totalDiscountCents,
        totalTVACents: totals.totalTVACents,
        totalTTCCents: totals.totalTTCCents,
        quoteId: payload.quoteId ?? existing.quoteId ?? null,
        invoiceId: payload.invoiceId ?? existing.invoiceId ?? null,
        items: {
          create: payload.items.map((line, index) => ({
            productId: line.productId ?? null,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPriceHTCents: line.unitPriceHTCents,
            vatRate: line.vatRate,
            discountRate: computedLines[index].discountRate ?? null,
            discountAmountCents: computedLines[index].discountAmountCents,
            totalHTCents: computedLines[index].totalHTCents,
            totalTVACents: computedLines[index].totalTVACents,
            totalTTCCents: computedLines[index].totalTTCCents,
            position: line.position ?? index,
          })),
        },
      },
    });
  });
}
