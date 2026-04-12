import { unstable_cache } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/lib/db/prisma-server";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refreshTagForMutation } from "@/lib/cache-invalidation";
import { toCents } from "@/lib/money";
import type { PaymentServicePickerOption } from "@/lib/client-payment-picker-types";
import { getClientTenantId } from "@/server/clients";
import { getSettingsWithDatabaseClient } from "@/server/settings";
import { nextReceiptNumberWithDatabaseClient } from "@/server/sequences";
import { shouldUseServerDataCache } from "@/lib/server-data-cache";

const TUNIS_TIMEZONE = "Africa/Tunis";
const RECENT_PAYMENTS_LIMIT = 5;
const DEFAULT_PAYMENT_PAGE_SIZE = 20;
const MAX_PAYMENT_PAGE_SIZE = 100;
const DEFAULT_SERVICE_PAGE_SIZE = 12;
const MAX_SERVICE_PAGE_SIZE = 50;
const CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS = 30;
const SHOULD_USE_CLIENT_PAYMENT_CACHE = shouldUseServerDataCache();

const clientServiceSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Client requis"),
  title: z.string().min(2, "Service requis"),
  details: z.string().nullable().optional(),
  priceCents: z.number().int().nonnegative().default(0),
  notes: z.string().nullable().optional(),
  privateNotes: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

const paymentServiceSchema = z.object({
  id: z.string().optional(),
  sourceClientId: z.string().min(1).nullable().optional(),
  title: z.string().min(2, "Service requis"),
  details: z.string().nullable().optional(),
  priceCents: z.number().int().nonnegative().default(0),
  notes: z.string().nullable().optional(),
  privateNotes: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

const clientPaymentServiceLinkSchema = z.object({
  clientServiceId: z.string().min(1),
  allocatedAmountCents: z.number().int().nonnegative().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
});

const clientPaymentSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string().min(1, "Client requis"),
    amount: z.number().positive().optional(),
    amountCents: z.number().int().positive().optional(),
    currency: z.string().min(1).default("TND"),
    date: z.coerce.date(),
    method: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    privateNote: z.string().nullable().optional(),
    serviceLinks: z.array(clientPaymentServiceLinkSchema).default([]),
  })
  .refine(
    (payload) =>
      typeof payload.amount === "number" ||
      typeof payload.amountCents === "number",
    {
      message: "Montant requis",
      path: ["amount"],
    },
  );

const receiptSnapshotSchema = z.object({
  receiptNumber: z.string(),
  issuedAt: z.string(),
  paymentDate: z.string(),
  currency: z.string(),
  amountCents: z.number().int().nonnegative(),
  method: z.string().nullable(),
  reference: z.string().nullable(),
  description: z.string().nullable(),
  note: z.string().nullable(),
  client: z.object({
    id: z.string(),
    displayName: z.string(),
    companyName: z.string().nullable(),
    address: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    vatNumber: z.string().nullable(),
  }),
  company: z.object({
    companyName: z.string().nullable(),
    logoUrl: z.string().nullable(),
    logoData: z.string().nullable(),
    address: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    matriculeFiscal: z.string().nullable(),
    tvaNumber: z.string().nullable(),
    iban: z.string().nullable(),
    stampImage: z.string().nullable(),
    signatureImage: z.string().nullable(),
    stampPosition: z.string().nullable(),
    signaturePosition: z.string().nullable(),
    legalFooter: z.string().nullable(),
  }),
  services: z.array(
    z.object({
      clientServiceId: z.string().nullable(),
      title: z.string(),
      details: z.string().nullable(),
      allocatedAmountCents: z.number().int().nonnegative().nullable(),
      position: z.number().int().nonnegative(),
    }),
  ),
});

const paymentServiceSelect = Prisma.validator<Prisma.PaymentServiceSelect>()({
  id: true,
  userId: true,
  sourceClientId: true,
  title: true,
  details: true,
  priceCents: true,
  notes: true,
  privateNotes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

const paymentServicePickerSelect = Prisma.validator<Prisma.PaymentServiceSelect>()({
  id: true,
  title: true,
  details: true,
  priceCents: true,
  isActive: true,
});

const clientPaymentListSelect = Prisma.validator<Prisma.ClientPaymentSelect>()({
  id: true,
  amountCents: true,
  currency: true,
  date: true,
  createdAt: true,
  method: true,
  reference: true,
  description: true,
  note: true,
  privateNote: true,
  receiptNumber: true,
  receiptIssuedAt: true,
  receiptSentAt: true,
  client: {
    select: {
      id: true,
      displayName: true,
      companyName: true,
      email: true,
    },
  },
  serviceLinks: {
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
      clientServiceId: true,
      titleSnapshot: true,
      detailsSnapshot: true,
      allocatedAmountCents: true,
      position: true,
    },
  },
});

const clientPaymentDetailInclude = Prisma.validator<Prisma.ClientPaymentInclude>()({
  client: {
    select: {
      id: true,
      displayName: true,
      companyName: true,
      address: true,
      email: true,
      phone: true,
      vatNumber: true,
    },
  },
  serviceLinks: {
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
      clientServiceId: true,
      titleSnapshot: true,
      detailsSnapshot: true,
      allocatedAmountCents: true,
      position: true,
      paymentService: {
        select: {
          id: true,
          title: true,
          isActive: true,
        },
      },
    },
  },
});

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

type PaymentServiceRecord = Prisma.PaymentServiceGetPayload<{
  select: typeof paymentServiceSelect;
}>;

type ClientServiceRecord = Omit<PaymentServiceRecord, "sourceClientId"> & {
  clientId: string | null;
};

type ClientPaymentDetailRecord = Prisma.ClientPaymentGetPayload<{
  include: typeof clientPaymentDetailInclude;
}>;

type ClientPaymentListRecord = Prisma.ClientPaymentGetPayload<{
  select: typeof clientPaymentListSelect;
}>;

type ClientPaymentReceiptSnapshot = z.infer<typeof receiptSnapshotSchema>;

type ReportRange = {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  currency?: string | null;
  search?: string | null;
};

type ClientPaymentFilters = ReportRange & {
  clientId?: string | null;
};

type PaymentServiceFilters = {
  sourceClientId?: string | null;
  search?: string | null;
  isActive?: boolean | null;
};

type PaginationOptions = {
  page?: number;
  pageSize?: number;
};

type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ClientServiceInput = z.input<typeof clientServiceSchema>;
export type PaymentServiceInput = z.input<typeof paymentServiceSchema>;
export type ClientPaymentInput = z.input<typeof clientPaymentSchema>;

type RevenueHistoryPoint = {
  month: string;
  amountCents: number;
};

export const paymentServiceCatalogTag = (tenantId: string) =>
  `client-payments:services:${tenantId}`;
export const clientPaymentCollectionTag = (tenantId: string) =>
  `client-payments:collection:${tenantId}`;
export const clientPaymentSummaryTag = (tenantId: string) =>
  `client-payments:summary:${tenantId}`;
export const clientPaymentDashboardTag = (tenantId: string) =>
  `client-payments:dashboard:${tenantId}`;
export const clientPaymentDetailTag = (tenantId: string, paymentId: string) =>
  `client-payments:detail:${tenantId}:${paymentId}`;

export function revalidatePaymentServiceCatalog(tenantId: string) {
  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return;
  }

  refreshTagForMutation(paymentServiceCatalogTag(tenantId));
}

export function revalidateClientPaymentData(
  tenantId: string,
  options: {
    paymentId?: string | null;
    includeSummary?: boolean;
    includeDashboard?: boolean;
  } = {},
) {
  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return;
  }

  refreshTagForMutation(clientPaymentCollectionTag(tenantId));
  if (options.includeSummary !== false) {
    refreshTagForMutation(clientPaymentSummaryTag(tenantId));
  }
  if (options.includeDashboard !== false) {
    refreshTagForMutation(clientPaymentDashboardTag(tenantId));
  }
  if (options.paymentId) {
    refreshTagForMutation(clientPaymentDetailTag(tenantId, options.paymentId));
  }
}

function serializeClientService(
  service: PaymentServiceRecord,
): ClientServiceRecord {
  const { sourceClientId, ...rest } = service;
  return {
    ...rest,
    clientId: sourceClientId ?? null,
  };
}

function normalizeJsonValue(
  value: Record<string, unknown>,
): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseReceiptSnapshot(
  value: unknown,
): ClientPaymentReceiptSnapshot | null {
  const parsed = receiptSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function resolveTenantId(providedUserId?: string) {
  if (providedUserId) {
    return providedUserId;
  }

  const user = await requireUser();
  return getClientTenantId(user);
}

async function assertClientBelongsToTenant(
  clientId: string,
  userId: string,
  db: DatabaseClient,
) {
  const client = await db.client.findFirst({
    where: {
      id: clientId,
      userId,
    },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      address: true,
      email: true,
      phone: true,
      vatNumber: true,
    },
  });

  if (!client) {
    throw new Error("Client introuvable");
  }

  return client;
}

async function getServicesForPayment(
  links: ClientPaymentInput["serviceLinks"],
  userId: string,
  db: DatabaseClient,
) {
  const normalizedLinks = links ?? [];
  const serviceIds = Array.from(
    new Set(
      normalizedLinks.map((link) => link.clientServiceId).filter(Boolean),
    ),
  );

  if (!serviceIds.length) {
    return new Map<string, Pick<PaymentServiceRecord, "id" | "title" | "details">>();
  }

  const services = await db.paymentService.findMany({
    where: {
      id: { in: serviceIds },
      userId,
    },
    select: {
      id: true,
      title: true,
      details: true,
    },
  });

  if (services.length !== serviceIds.length) {
    throw new Error("Un ou plusieurs services liés sont introuvables");
  }

  return new Map(services.map((service) => [service.id, service]));
}

async function assertSourceClientBelongsToTenant(
  sourceClientId: string | null | undefined,
  userId: string,
  db: DatabaseClient,
) {
  if (!sourceClientId) {
    return null;
  }

  return assertClientBelongsToTenant(sourceClientId, userId, db);
}

function normalizeRange(options: ReportRange = {}) {
  const dateFrom =
    options.dateFrom instanceof Date &&
    !Number.isNaN(options.dateFrom.valueOf())
      ? options.dateFrom
      : null;
  const dateTo =
    options.dateTo instanceof Date &&
    !Number.isNaN(options.dateTo.valueOf())
      ? options.dateTo
      : null;

  return {
    dateFrom,
    dateTo,
    currency: options.currency?.trim() || null,
    search: options.search?.trim() || null,
  };
}

function serializeCacheKey(value: unknown) {
  return JSON.stringify(value);
}

function normalizePagination(
  options: PaginationOptions,
  config: {
    defaultPageSize: number;
    maxPageSize: number;
  },
) {
  const requestedPage = Math.trunc(options.page ?? 1);
  const requestedPageSize = Math.trunc(options.pageSize ?? config.defaultPageSize);
  return {
    page: requestedPage > 0 ? requestedPage : 1,
    pageSize: Math.min(
      Math.max(requestedPageSize, 1),
      config.maxPageSize,
    ),
  };
}

function buildPaymentWhere(
  userId: string,
  options: ClientPaymentFilters = {},
): Prisma.ClientPaymentWhereInput {
  const normalized = normalizeRange(options);
  return {
    userId,
    ...(options.clientId ? { clientId: options.clientId } : {}),
    ...(normalized.currency ? { currency: normalized.currency } : {}),
    ...(normalized.dateFrom || normalized.dateTo
      ? {
          date: {
            ...(normalized.dateFrom ? { gte: normalized.dateFrom } : {}),
            ...(normalized.dateTo ? { lte: normalized.dateTo } : {}),
          },
        }
      : {}),
    ...(normalized.search
      ? {
          OR: [
            {
              receiptNumber: {
                contains: normalized.search,
                mode: "insensitive",
              },
            },
            {
              reference: {
                contains: normalized.search,
                mode: "insensitive",
              },
            },
            {
              method: {
                contains: normalized.search,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: normalized.search,
                mode: "insensitive",
              },
            },
            {
              note: {
                contains: normalized.search,
                mode: "insensitive",
              },
            },
            {
              client: {
                is: {
                  OR: [
                    {
                      displayName: {
                        contains: normalized.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      companyName: {
                        contains: normalized.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      email: {
                        contains: normalized.search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
            {
              serviceLinks: {
                some: {
                  OR: [
                    {
                      titleSnapshot: {
                        contains: normalized.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      detailsSnapshot: {
                        contains: normalized.search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}

function buildPaymentServiceWhere(
  userId: string,
  options: PaymentServiceFilters = {},
): Prisma.PaymentServiceWhereInput {
  const normalizedSearch = options.search?.trim() || null;
  return {
    userId,
    ...(options.sourceClientId
      ? { sourceClientId: options.sourceClientId }
      : {}),
    ...(typeof options.isActive === "boolean"
      ? { isActive: options.isActive }
      : {}),
    ...(normalizedSearch
      ? {
          OR: [
            {
              title: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
            },
            {
              details: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
            },
            {
              notes: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
            },
            {
              privateNotes: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
}

function buildReceiptSnapshot(
  payment: ClientPaymentDetailRecord,
  settings: Awaited<ReturnType<typeof getSettingsWithDatabaseClient>>,
  receiptNumber: string,
  issuedAt: Date,
) {
  const snapshot = {
    receiptNumber,
    issuedAt: issuedAt.toISOString(),
    paymentDate: payment.date.toISOString(),
    currency: payment.currency,
    amountCents: payment.amountCents,
    method: payment.method ?? null,
    reference: payment.reference ?? null,
    description: payment.description ?? null,
    note: payment.note ?? null,
    client: {
      id: payment.client.id,
      displayName: payment.client.displayName,
      companyName: payment.client.companyName ?? null,
      address: payment.client.address ?? null,
      email: payment.client.email ?? null,
      phone: payment.client.phone ?? null,
      vatNumber: payment.client.vatNumber ?? null,
    },
    company: {
      companyName: settings.companyName ?? null,
      logoUrl: settings.logoUrl ?? null,
      logoData: settings.logoData ?? null,
      address: settings.address ?? null,
      email: settings.email ?? null,
      phone: settings.phone ?? null,
      matriculeFiscal: settings.matriculeFiscal ?? null,
      tvaNumber: settings.tvaNumber ?? null,
      iban: settings.iban ?? null,
      stampImage: settings.stampImage ?? null,
      signatureImage: settings.signatureImage ?? null,
      stampPosition: settings.stampPosition ?? null,
      signaturePosition: settings.signaturePosition ?? null,
      legalFooter: settings.legalFooter ?? null,
    },
    services: payment.serviceLinks.map((link) => ({
      clientServiceId: link.clientServiceId ?? null,
      title: link.titleSnapshot,
      details: link.detailsSnapshot ?? null,
      allocatedAmountCents: link.allocatedAmountCents ?? null,
      position: link.position,
    })),
  } satisfies ClientPaymentReceiptSnapshot;

  return normalizeJsonValue(
    snapshot as unknown as Record<string, unknown>,
  );
}

function getCurrentZonedDate() {
  return toZonedTime(new Date(), TUNIS_TIMEZONE);
}

function getHistorySlots(months: number) {
  const now = getCurrentZonedDate();
  return Array.from({ length: months }, (_, index) => {
    const monthDate = subMonths(now, months - index - 1);
    const startZoned = startOfMonth(monthDate);
    const endZoned = endOfMonth(monthDate);
    return {
      label: formatInTimeZone(startZoned, TUNIS_TIMEZONE, "yyyy-MM"),
      startUtc: fromZonedTime(startZoned, TUNIS_TIMEZONE),
      endUtc: fromZonedTime(endZoned, TUNIS_TIMEZONE),
    };
  });
}

async function getClientPaymentById(
  paymentId: string,
  userId: string,
  db: DatabaseClient,
) {
  const payment = await db.clientPayment.findFirst({
    where: {
      id: paymentId,
      userId,
    },
    include: clientPaymentDetailInclude,
  });

  if (!payment) {
    throw new Error("Paiement client introuvable");
  }

  return payment;
}

export async function getClientPayment(paymentId: string, userId?: string) {
  const tenantId = await resolveTenantId(userId);
  const runQuery = () => getClientPaymentById(paymentId, tenantId, prisma);

  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    ["client-payments", "detail", tenantId, paymentId],
    {
      revalidate: CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS,
      tags: [
        clientPaymentCollectionTag(tenantId),
        clientPaymentDetailTag(tenantId, paymentId),
      ],
    },
  );

  return cached();
}

export async function listPaymentServices(
  options: PaymentServiceFilters = {},
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);
  await assertSourceClientBelongsToTenant(
    options.sourceClientId,
    tenantId,
    prisma,
  );
  const normalizedOptions = {
    sourceClientId: options.sourceClientId ?? null,
    search: options.search?.trim() || null,
    isActive:
      typeof options.isActive === "boolean" ? options.isActive : null,
  } satisfies PaymentServiceFilters;
  const runQuery = () =>
    prisma.paymentService.findMany({
      where: buildPaymentServiceWhere(tenantId, normalizedOptions),
      orderBy: [
        { isActive: "desc" },
        { updatedAt: "desc" },
      ],
      select: paymentServiceSelect,
    });

  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    [
      "client-payments",
      "services",
      "list",
      tenantId,
      serializeCacheKey(normalizedOptions),
    ],
    {
      revalidate: CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS,
      tags: [paymentServiceCatalogTag(tenantId)],
    },
  );

  return cached();
}

export async function searchPaymentServicePickerOptions(
  userId?: string,
  query?: string | null,
  limit = 10,
): Promise<PaymentServicePickerOption[]> {
  const tenantId = await resolveTenantId(userId);
  const normalizedQuery = query?.trim() || null;
  const take = Math.min(Math.max(Math.trunc(limit) || 10, 1), 20);
  const runQuery = () =>
    prisma.paymentService.findMany({
      where: buildPaymentServiceWhere(tenantId, {
        search: normalizedQuery,
      }),
      orderBy: [
        { isActive: "desc" },
        { updatedAt: "desc" },
      ],
      take,
      select: paymentServicePickerSelect,
    });

  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    [
      "client-payments",
      "services",
      "picker",
      tenantId,
      serializeCacheKey({ query: normalizedQuery, limit: take }),
    ],
    {
      revalidate: CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS,
      tags: [paymentServiceCatalogTag(tenantId)],
    },
  );

  return cached();
}

export async function listPaymentServicesPage(
  options: PaymentServiceFilters & PaginationOptions = {},
  userId?: string,
): Promise<
  PaginatedResult<PaymentServiceRecord> & {
    activeCount: number;
    inactiveCount: number;
  }
> {
  const tenantId = await resolveTenantId(userId);
  await assertSourceClientBelongsToTenant(
    options.sourceClientId,
    tenantId,
    prisma,
  );

  const normalizedOptions = {
    sourceClientId: options.sourceClientId ?? null,
    search: options.search?.trim() || null,
    isActive:
      typeof options.isActive === "boolean" ? options.isActive : null,
  } satisfies PaymentServiceFilters;
  const where = buildPaymentServiceWhere(tenantId, normalizedOptions);
  const { page: requestedPage, pageSize } = normalizePagination(options, {
    defaultPageSize: DEFAULT_SERVICE_PAGE_SIZE,
    maxPageSize: MAX_SERVICE_PAGE_SIZE,
  });
  const runQuery = async () => {
    const [total, activeCount] = await Promise.all([
      prisma.paymentService.count({ where }),
      prisma.paymentService.count({
        where: {
          ...where,
          isActive: true,
        },
      }),
    ]);

    const pageCount = total > 0 ? Math.ceil(total / pageSize) : 1;
    const page = total > 0 ? Math.min(requestedPage, pageCount) : 1;
    const items = await prisma.paymentService.findMany({
      where,
      orderBy: [
        { isActive: "desc" },
        { updatedAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: paymentServiceSelect,
    });

    return {
      items,
      total,
      page,
      pageSize,
      pageCount,
      activeCount,
      inactiveCount: total - activeCount,
    };
  };

  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    [
      "client-payments",
      "services",
      "page",
      tenantId,
      serializeCacheKey({
        ...normalizedOptions,
        page: requestedPage,
        pageSize,
      }),
    ],
    {
      revalidate: CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS,
      tags: [paymentServiceCatalogTag(tenantId)],
    },
  );

  return cached();
}

export async function listClientServices(
  clientId: string,
  userId?: string,
) {
  const services = await listPaymentServices(
    { sourceClientId: clientId },
    userId,
  );
  return services.map(serializeClientService);
}

export async function createPaymentService(
  input: PaymentServiceInput,
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);
  const payload = paymentServiceSchema.parse(input);

  await assertSourceClientBelongsToTenant(
    payload.sourceClientId,
    tenantId,
    prisma,
  );

  const service = await prisma.paymentService.create({
    data: {
      userId: tenantId,
      sourceClientId: payload.sourceClientId ?? null,
      title: payload.title,
      details: payload.details ?? null,
      priceCents: payload.priceCents,
      notes: payload.notes ?? null,
      privateNotes: payload.privateNotes ?? null,
      isActive: payload.isActive,
    },
    select: paymentServiceSelect,
  });

  return service;
}

export async function createClientService(
  input: ClientServiceInput,
  userId?: string,
) {
  const payload = clientServiceSchema.parse(input);

  return createPaymentService(
    {
      sourceClientId: payload.clientId,
      title: payload.title,
      details: payload.details ?? null,
      priceCents: payload.priceCents,
      notes: payload.notes ?? null,
      privateNotes: payload.privateNotes ?? null,
      isActive: payload.isActive,
    },
    userId,
  ).then(serializeClientService);
}

export async function updatePaymentService(
  serviceId: string,
  input: PaymentServiceInput,
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);
  const payload = paymentServiceSchema.parse(input);

  const existing = await prisma.paymentService.findFirst({
    where: {
      id: serviceId,
      userId: tenantId,
    },
    select: {
      id: true,
      sourceClientId: true,
    },
  });

  if (!existing) {
    throw new Error("Service client introuvable");
  }

  const nextSourceClientId =
    payload.sourceClientId === undefined
      ? existing.sourceClientId ?? null
      : payload.sourceClientId ?? null;

  if (payload.sourceClientId !== undefined) {
    await assertSourceClientBelongsToTenant(
      nextSourceClientId,
      tenantId,
      prisma,
    );
  }

  const service = await prisma.paymentService.update({
    where: { id: serviceId },
    data: {
      sourceClientId: nextSourceClientId,
      title: payload.title,
      details: payload.details ?? null,
      priceCents: payload.priceCents,
      notes: payload.notes ?? null,
      privateNotes: payload.privateNotes ?? null,
      isActive: payload.isActive,
    },
    select: paymentServiceSelect,
  });

  return service;
}

export async function updateClientService(
  serviceId: string,
  input: ClientServiceInput,
  userId?: string,
) {
  const payload = clientServiceSchema.parse(input);

  return updatePaymentService(
    serviceId,
    {
      sourceClientId: payload.clientId,
      title: payload.title,
      details: payload.details ?? null,
      priceCents: payload.priceCents,
      notes: payload.notes ?? null,
      privateNotes: payload.privateNotes ?? null,
      isActive: payload.isActive,
    },
    userId,
  ).then(serializeClientService);
}

export async function deletePaymentService(serviceId: string, userId?: string) {
  const tenantId = await resolveTenantId(userId);

  const service = await prisma.paymentService.findFirst({
    where: {
      id: serviceId,
      userId: tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!service) {
    throw new Error("Service client introuvable");
  }

  await prisma.paymentService.delete({
    where: {
      id: service.id,
    },
  });
}

export async function deleteClientService(serviceId: string, userId?: string) {
  return deletePaymentService(serviceId, userId);
}

export async function listClientPayments(
  options: ClientPaymentFilters = {},
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);

  if (options.clientId) {
    await assertClientBelongsToTenant(options.clientId, tenantId, prisma);
  }

  return prisma.clientPayment.findMany({
    where: buildPaymentWhere(tenantId, options),
    include: clientPaymentDetailInclude,
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" },
    ],
  });
}

export async function listClientPaymentsPage(
  options: ClientPaymentFilters & PaginationOptions = {},
  userId?: string,
): Promise<PaginatedResult<ClientPaymentListRecord>> {
  const tenantId = await resolveTenantId(userId);

  if (options.clientId) {
    await assertClientBelongsToTenant(options.clientId, tenantId, prisma);
  }

  const where = buildPaymentWhere(tenantId, options);
  const { page: requestedPage, pageSize } = normalizePagination(options, {
    defaultPageSize: DEFAULT_PAYMENT_PAGE_SIZE,
    maxPageSize: MAX_PAYMENT_PAGE_SIZE,
  });
  const normalizedRange = normalizeRange(options);
  const normalizedKey = {
    clientId: options.clientId ?? null,
    currency: normalizedRange.currency,
    dateFrom: normalizedRange.dateFrom?.toISOString() ?? null,
    dateTo: normalizedRange.dateTo?.toISOString() ?? null,
    search: normalizedRange.search,
    page: requestedPage,
    pageSize,
  };
  const runQuery = async () => {
    const total = await prisma.clientPayment.count({ where });
    const pageCount = total > 0 ? Math.ceil(total / pageSize) : 1;
    const page = total > 0 ? Math.min(requestedPage, pageCount) : 1;
    const items = await prisma.clientPayment.findMany({
      where,
      select: clientPaymentListSelect,
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      pageCount,
    };
  };

  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    [
      "client-payments",
      "page",
      tenantId,
      serializeCacheKey(normalizedKey),
    ],
    {
      revalidate: CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS,
      tags: [clientPaymentCollectionTag(tenantId)],
    },
  );

  return cached();
}

export async function createClientPayment(
  input: ClientPaymentInput,
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);
  const payload = clientPaymentSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const client = await assertClientBelongsToTenant(payload.clientId, tenantId, tx);
    const amountCents =
      payload.amountCents ??
      (payload.amount != null
        ? toCents(payload.amount, payload.currency)
        : null);

    if (
      typeof amountCents !== "number" ||
      Number.isNaN(amountCents) ||
      amountCents <= 0
    ) {
      throw new Error("Montant de paiement invalide");
    }

    const services = await getServicesForPayment(
      payload.serviceLinks,
      tenantId,
      tx,
    );

    const payment = await tx.clientPayment.create({
      data: {
        userId: tenantId,
        clientId: client.id,
        currency: payload.currency,
        amountCents,
        date: payload.date,
        method: payload.method ?? null,
        reference: payload.reference ?? null,
        description: payload.description ?? null,
        note: payload.note ?? null,
        privateNote: payload.privateNote ?? null,
        serviceLinks: payload.serviceLinks.length
          ? {
              create: payload.serviceLinks.map((link, index) => {
                const service = services.get(link.clientServiceId);
                if (!service) {
                  throw new Error("Service lié introuvable");
                }
                return {
                  clientServiceId: service.id,
                  titleSnapshot: service.title,
                  detailsSnapshot: service.details ?? null,
                  allocatedAmountCents:
                    link.allocatedAmountCents ??
                    (payload.serviceLinks.length === 1 ? amountCents : null),
                  position: link.position ?? index,
                };
              }),
            }
          : undefined,
      },
      include: clientPaymentDetailInclude,
    });

    return payment;
  });
}

export async function deleteClientPayment(paymentId: string, userId?: string) {
  const tenantId = await resolveTenantId(userId);

  const payment = await prisma.clientPayment.findFirst({
    where: {
      id: paymentId,
      userId: tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!payment) {
    throw new Error("Paiement client introuvable");
  }

  await prisma.clientPayment.delete({
    where: {
      id: payment.id,
    },
  });
}

export async function issueClientPaymentReceipt(
  paymentId: string,
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);

  const payment = await prisma.$transaction(async (tx) => {
    const payment = await getClientPaymentById(paymentId, tenantId, tx);

    if (
      payment.receiptNumber &&
      payment.receiptIssuedAt &&
      parseReceiptSnapshot(payment.receiptSnapshot)
    ) {
      return payment;
    }

    const settings = await getSettingsWithDatabaseClient(tenantId, tx);
    const issuedAt = payment.receiptIssuedAt ?? new Date();
    const receiptNumber =
      payment.receiptNumber ??
      (await nextReceiptNumberWithDatabaseClient(
        tenantId,
        {
          resetNumberingAnnually: settings.resetNumberingAnnually,
        },
        tx,
      ));

    const receiptSnapshot = buildReceiptSnapshot(
      payment,
      settings,
      receiptNumber,
      issuedAt,
    );

    return tx.clientPayment.update({
      where: {
        id: payment.id,
      },
      data: {
        receiptNumber,
        receiptIssuedAt: issuedAt,
        receiptSnapshot,
      },
      include: clientPaymentDetailInclude,
    });
  });

  revalidateClientPaymentData(tenantId, { paymentId });

  return payment;
}

export async function markClientPaymentReceiptSent(
  paymentId: string,
  sentAt = new Date(),
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);

  const payment = await prisma.clientPayment.findFirst({
    where: {
      id: paymentId,
      userId: tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!payment) {
    throw new Error("Paiement client introuvable");
  }

  const updatedPayment = await prisma.clientPayment.update({
    where: {
      id: payment.id,
    },
    data: {
      receiptSentAt: sentAt,
    },
  });

  revalidateClientPaymentData(tenantId, {
    paymentId,
    includeSummary: false,
    includeDashboard: false,
  });

  return updatedPayment;
}

export async function getClientPaymentReceipt(
  paymentId: string,
  userId?: string,
) {
  const payment = await issueClientPaymentReceipt(paymentId, userId);
  const snapshot = parseReceiptSnapshot(payment.receiptSnapshot);

  if (!snapshot) {
    throw new Error("Instantané du reçu introuvable");
  }

  return {
    payment,
    snapshot,
  };
}

export async function getClientPaymentPeriodReport(
  options: ClientPaymentFilters,
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);
  const [summary, items] = await Promise.all([
    getClientPaymentPeriodSummary(options, tenantId),
    listClientPayments(options, tenantId),
  ]);

  return {
    ...summary,
    items,
  };
}

export async function getClientPaymentPeriodSummary(
  options: ClientPaymentFilters & { includeByClient?: boolean } = {},
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);
  const includeByClient = options.includeByClient !== false;

  if (options.clientId) {
    await assertClientBelongsToTenant(options.clientId, tenantId, prisma);
  }

  const where = buildPaymentWhere(tenantId, options);
  const normalizedRange = normalizeRange(options);
  const cacheKey = {
    clientId: options.clientId ?? null,
    currency: normalizedRange.currency,
    dateFrom: normalizedRange.dateFrom?.toISOString() ?? null,
    dateTo: normalizedRange.dateTo?.toISOString() ?? null,
    search: normalizedRange.search,
    includeByClient,
  };
  const runQuery = async () => {
    const [
      currencyTotals,
      byClientTotals,
      byClientCurrencyTotals,
      receiptCount,
      receiptCountsByClient,
    ] =
      await Promise.all([
        prisma.clientPayment.groupBy({
          by: ["currency"],
          where,
          _count: {
            _all: true,
          },
          _sum: {
            amountCents: true,
          },
        }),
        prisma.clientPayment.groupBy({
          by: ["clientId"],
          where,
          _count: {
            _all: true,
          },
          _sum: {
            amountCents: true,
          },
          _max: {
            date: true,
          },
        }),
        includeByClient
          ? prisma.clientPayment.groupBy({
              by: ["clientId", "currency"],
              where,
              _count: {
                _all: true,
              },
              _sum: {
                amountCents: true,
              },
            })
          : Promise.resolve([]),
        prisma.clientPayment.count({
          where: {
            ...where,
            receiptIssuedAt: {
              not: null,
            },
          },
        }),
        includeByClient
          ? prisma.clientPayment.groupBy({
              by: ["clientId"],
              where: {
                ...where,
                receiptIssuedAt: {
                  not: null,
                },
              },
              _count: {
                _all: true,
              },
            })
          : Promise.resolve([]),
      ]);

    const paymentCount = currencyTotals.reduce(
      (sum, totals) => sum + totals._count._all,
      0,
    );
    const receiptCountsByClientMap = new Map(
      receiptCountsByClient.map((entry) => [entry.clientId, entry._count._all]),
    );
    const clientNames = includeByClient && byClientTotals.length
      ? await prisma.client.findMany({
          where: {
            userId: tenantId,
            id: {
              in: byClientTotals.map((entry) => entry.clientId),
            },
          },
          select: {
            id: true,
            displayName: true,
          },
        })
      : [];
    const clientNamesMap = new Map(
      clientNames.map((client) => [client.id, client.displayName]),
    );
    const byClientCurrencyTotalsMap = new Map(
      byClientTotals.map((totals) => [
        totals.clientId,
        byClientCurrencyTotals
          .filter((entry) => entry.clientId === totals.clientId)
          .map((entry) => ({
            currency: entry.currency,
            totalAmountCents: entry._sum.amountCents ?? 0,
            paymentCount: entry._count._all,
          })),
      ]),
    );

    return {
      filters: normalizedRange,
      totals: {
        paymentCount,
        receiptCount,
        clientCount: byClientTotals.length,
        totalsByCurrency: currencyTotals.map((totals) => ({
          currency: totals.currency,
          totalAmountCents: totals._sum.amountCents ?? 0,
          paymentCount: totals._count._all,
        })),
      },
      byClient: includeByClient
        ? byClientTotals
            .map((totals) => ({
              clientId: totals.clientId,
              clientName:
                clientNamesMap.get(totals.clientId) ?? "Client introuvable",
              totalAmountCents: totals._sum.amountCents ?? 0,
              paymentCount: totals._count._all,
              receiptCount: receiptCountsByClientMap.get(totals.clientId) ?? 0,
              lastPaymentDate: totals._max.date ?? new Date(0),
              totalsByCurrency:
                byClientCurrencyTotalsMap.get(totals.clientId) ?? [],
            }))
            .sort(
              (left, right) =>
                right.lastPaymentDate.getTime() - left.lastPaymentDate.getTime(),
            )
        : [],
    };
  };

  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    [
      "client-payments",
      "summary",
      tenantId,
      serializeCacheKey(cacheKey),
    ],
    {
      revalidate: CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS,
      tags: [clientPaymentSummaryTag(tenantId)],
    },
  );

  return cached();
}

export async function getClientPaymentDashboardSummary(
  options: {
    months?: number;
    currency?: string | null;
  } = {},
  userId?: string,
) {
  const tenantId = await resolveTenantId(userId);
  const months = Math.max(1, Math.min(options.months ?? 6, 24));
  const cacheKey = {
    months,
    currency: options.currency ?? null,
  };
  const runQuery = async () => {
    const historySlots = getHistorySlots(months);
    const historyRangeStart = historySlots[0]?.startUtc;
    const historyRangeEnd = historySlots[historySlots.length - 1]?.endUtc;
    const summaryFilters = {
      currency: options.currency ?? null,
      dateFrom: historyRangeStart ?? null,
      dateTo: historyRangeEnd ?? null,
      includeByClient: false,
    } satisfies ClientPaymentFilters & { includeByClient: boolean };
    const [summary, recentPaymentsPage, revenueHistoryTotals] = await Promise.all([
      getClientPaymentPeriodSummary(summaryFilters, tenantId),
      listClientPaymentsPage(
        {
          currency: options.currency ?? null,
          dateFrom: historyRangeStart ?? null,
          dateTo: historyRangeEnd ?? null,
          page: 1,
          pageSize: RECENT_PAYMENTS_LIMIT,
        },
        tenantId,
      ),
      Promise.all(
        historySlots.map((slot) =>
          prisma.clientPayment.aggregate({
            where: buildPaymentWhere(tenantId, {
              currency: options.currency ?? null,
              dateFrom: slot.startUtc,
              dateTo: slot.endUtc,
            }),
            _sum: {
              amountCents: true,
            },
          }),
        ),
      ),
    ]);
    const revenueHistory = historySlots.map((slot, index) => ({
      month: slot.label,
      amountCents: revenueHistoryTotals[index]?._sum.amountCents ?? 0,
    })) satisfies RevenueHistoryPoint[];
    const collectedThisMonthCents =
      revenueHistory[revenueHistory.length - 1]?.amountCents ?? 0;
    const totalCollectedCents = summary.totals.totalsByCurrency.reduce(
      (sum, totals) => sum + totals.totalAmountCents,
      0,
    );

    return {
      metrics: {
        totalCollectedCents,
        collectedThisMonthCents,
        paymentCount: summary.totals.paymentCount,
        receiptsIssuedCount: summary.totals.receiptCount,
        clientCount: summary.totals.clientCount,
        revenueHistory,
      },
      recentPayments: recentPaymentsPage.items,
    };
  };

  if (!SHOULD_USE_CLIENT_PAYMENT_CACHE) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    [
      "client-payments",
      "dashboard",
      tenantId,
      serializeCacheKey(cacheKey),
    ],
    {
      revalidate: CLIENT_PAYMENT_CACHE_REVALIDATE_SECONDS,
      tags: [clientPaymentDashboardTag(tenantId)],
    },
  );

  return cached();
}
