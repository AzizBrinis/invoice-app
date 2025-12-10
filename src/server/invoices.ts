import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { calculateDocumentTotals, calculateLineTotals } from "@/lib/documents";
import { toCents } from "@/lib/money";
import { getSettings } from "@/server/settings";
import {
  DEFAULT_TAX_CONFIGURATION,
  normalizeTaxConfiguration,
  type TaxConfiguration,
} from "@/lib/taxes";
import {
  InvoiceAuditAction,
  InvoiceStatus,
  QuoteStatus,
  Prisma,
  type User,
} from "@prisma/client";
import { z } from "zod";
import { nextInvoiceNumber } from "@/server/sequences";

const invoiceLineSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  description: z.string().min(2, "Description requise"),
  quantity: z.number().positive(),
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
  fodecRate: z.number().min(0).max(100).nullable().optional(),
  position: z.number().int().nonnegative(),
});

export const invoiceInputSchema = z.object({
  id: z.string().optional(),
  number: z.string().optional(),
  clientId: z.string().min(1, "Client requis"),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.BROUILLON),
  reference: z.string().nullable().optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().nullable().optional(),
  currency: z.string().default("TND"),
  globalDiscountRate: z.number().min(0).max(100).nullable().optional(),
  globalDiscountAmountCents: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  lateFeeRate: z.number().min(0).max(100).nullable().optional(),
  lines: z
    .array(invoiceLineSchema)
    .min(1, "Au moins une ligne est nécessaire"),
  taxes: z
    .object({
      applyFodec: z.boolean().optional(),
      applyTimbre: z.boolean().optional(),
      documentFodecRate: z.number().min(0).max(100).nullable().optional(),
      timbreAmountCents: z.number().int().nonnegative().nullable().optional(),
    })
    .optional(),
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export type InvoiceFilters = {
  search?: string;
  status?: InvoiceStatus | "all";
  clientId?: string;
  issueDateFrom?: Date;
  issueDateTo?: Date;
  dueDateBefore?: Date;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const INVOICE_CACHE_REVALIDATE_SECONDS = 45;
const SHOULD_USE_INVOICE_CACHE = process.env.NODE_ENV !== "test";

export const invoiceListTag = (tenantId: string) =>
  `invoices:list:${tenantId}`;
export const invoiceDetailTag = (tenantId: string, invoiceId: string) =>
  `invoices:detail:${tenantId}:${invoiceId}`;
export const invoiceStatsTag = (tenantId: string) =>
  `invoices:stats:${tenantId}`;

function resolveTenantId(user: Pick<User, "id"> & { tenantId?: string | null }) {
  return user.tenantId ?? user.id;
}

const invoiceListSelect = Prisma.validator<Prisma.InvoiceSelect>()({
  id: true,
  userId: true,
  number: true,
  reference: true,
  status: true,
  issueDate: true,
  dueDate: true,
  totalTTCCents: true,
  amountPaidCents: true,
  currency: true,
  client: {
    select: {
      id: true,
      displayName: true,
    },
  },
});

type InvoiceListItem = Prisma.InvoiceGetPayload<{
  select: typeof invoiceListSelect;
}>;

const invoiceDetailSelect = Prisma.validator<Prisma.InvoiceSelect>()({
  id: true,
  userId: true,
  number: true,
  reference: true,
  status: true,
  clientId: true,
  issueDate: true,
  dueDate: true,
  currency: true,
  globalDiscountRate: true,
  globalDiscountAmountCents: true,
  subtotalHTCents: true,
  totalDiscountCents: true,
  totalTVACents: true,
  totalTTCCents: true,
  amountPaidCents: true,
  lateFeeRate: true,
  taxSummary: true,
  taxConfiguration: true,
  notes: true,
  terms: true,
  fodecAmountCents: true,
  timbreAmountCents: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
  lines: {
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
      fodecRate: true,
      position: true,
    },
  },
  payments: {
    orderBy: { date: "desc" },
    select: {
      id: true,
      amountCents: true,
      method: true,
      date: true,
      note: true,
    },
  },
});

export type InvoiceDetail = Prisma.InvoiceGetPayload<{
  select: typeof invoiceDetailSelect;
}>;

type NormalizedInvoiceFilters = {
  search: string | null;
  status: InvoiceStatus | "all";
  clientId: string | null;
  issueDateFrom: Date | null;
  issueDateTo: Date | null;
  dueDateBefore: Date | null;
  page: number;
  pageSize: number;
};

type InvoiceCountFilters = Omit<NormalizedInvoiceFilters, "page" | "pageSize">;

type InvoiceListResultBase = {
  items: InvoiceListItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type InvoiceListResultWithTotal = InvoiceListResultBase & {
  total: number;
  pageCount: number;
};

export type InvoiceListResultWithoutTotal = InvoiceListResultBase & {
  total: null;
  pageCount: null;
};

type InvoiceListResult =
  | InvoiceListResultWithTotal
  | InvoiceListResultWithoutTotal;

export type InvoiceListOptions = {
  includeTotals?: boolean;
};

function filterKeyParts(filters: InvoiceCountFilters) {
  return [
    filters.search ?? "",
    filters.status,
    filters.clientId ?? "",
    filters.issueDateFrom?.toISOString() ?? "",
    filters.issueDateTo?.toISOString() ?? "",
    filters.dueDateBefore?.toISOString() ?? "",
  ];
}

function listCacheKey(filters: NormalizedInvoiceFilters) {
  return [
    ...filterKeyParts(filters),
    `page:${filters.page}`,
    `size:${filters.pageSize}`,
  ].join("|");
}

function countCacheKey(filters: InvoiceCountFilters) {
  return filterKeyParts(filters).join("|");
}

async function assertClientOwnership(userId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
  });
  if (!client) {
    throw new Error("Client introuvable");
  }
  return client;
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

async function assertInvoiceOwnership<T extends Prisma.InvoiceInclude | undefined>(
  userId: string,
  id: string,
  include?: T,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    include,
  });
  if (!invoice) {
    throw new Error("Facture introuvable");
  }
  return invoice as Prisma.InvoiceGetPayload<{ include: T }>;
}

function calculateStatusAfterPayment(
  invoice: {
    status: InvoiceStatus;
    totalTTCCents: number;
    amountPaidCents: number;
    dueDate: Date | null;
  },
) {
  const remaining = invoice.totalTTCCents - invoice.amountPaidCents;
  if (invoice.status === InvoiceStatus.ANNULEE) {
    return InvoiceStatus.ANNULEE;
  }
  if (remaining <= 0) {
    return InvoiceStatus.PAYEE;
  }
  if (invoice.amountPaidCents > 0) {
    if (invoice.dueDate && invoice.dueDate.getTime() < Date.now()) {
      return InvoiceStatus.RETARD;
    }
    return InvoiceStatus.PARTIELLE;
  }
  if (invoice.dueDate && invoice.dueDate.getTime() < Date.now()) {
    return InvoiceStatus.RETARD;
  }
  return invoice.status === InvoiceStatus.BROUILLON
    ? InvoiceStatus.BROUILLON
    : InvoiceStatus.ENVOYEE;
}

function buildInvoiceSearchWhere(
  search: string | null | undefined,
): Prisma.InvoiceWhereInput | undefined {
  if (!search) {
    return undefined;
  }
  const normalized = search.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return undefined;
  }

  const clauses: Prisma.InvoiceWhereInput[] = [];
  const numericCandidate = normalized.replace(/\D+/g, "");

  if (numericCandidate.length >= 3) {
    clauses.push({
      number: {
        startsWith: numericCandidate,
      },
    });
  }

  clauses.push(
    {
      number: {
        startsWith: normalized,
        mode: "insensitive",
      },
    },
    {
      reference: {
        startsWith: normalized,
        mode: "insensitive",
      },
    },
    {
      client: {
        displayName: {
          startsWith: normalized,
          mode: "insensitive",
        },
      },
    },
  );

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const uniqueTokens = Array.from(new Set(tokens));
    for (const token of uniqueTokens) {
      if (token.length < 2) {
        continue;
      }
      clauses.push({
        client: {
          displayName: {
            startsWith: token,
            mode: "insensitive",
          },
        },
      });
    }
  }

  return clauses.length > 0 ? { OR: clauses } : undefined;
}

function buildInvoiceWhere(
  filters: InvoiceFilters | NormalizedInvoiceFilters | InvoiceCountFilters,
): Prisma.InvoiceWhereInput {
  const {
    search,
    status = "all",
    clientId,
    issueDateFrom,
    issueDateTo,
    dueDateBefore,
  } = filters;
  return {
    ...(status === "all"
      ? {
          status: {
            not: InvoiceStatus.ANNULEE,
          },
        }
      : { status }),
    ...(clientId ? { clientId } : {}),
    ...(issueDateFrom || issueDateTo
      ? {
          issueDate: {
            ...(issueDateFrom ? { gte: issueDateFrom } : {}),
            ...(issueDateTo ? { lte: issueDateTo } : {}),
          },
        }
      : {}),
    ...(dueDateBefore
      ? {
          dueDate: {
            lte: dueDateBefore,
          },
        }
      : {}),
    ...(buildInvoiceSearchWhere(search) ?? {}),
  } satisfies Prisma.InvoiceWhereInput;
}

function normalizeDateInput(value?: Date | null): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function normalizeInvoiceFilters(
  filters: InvoiceFilters,
): NormalizedInvoiceFilters {
  const sanitizedSearch = (filters.search ?? "").trim().replace(/\s+/g, " ");
  const clientId = filters.clientId?.trim() ?? "";
  const requestedPage =
    typeof filters.page === "number" && Number.isFinite(filters.page)
      ? Math.floor(filters.page)
      : Number.parseInt(String(filters.page ?? 1), 10) || 1;
  const requestedPageSize =
    typeof filters.pageSize === "number" && Number.isFinite(filters.pageSize)
      ? Math.floor(filters.pageSize)
      : Number.parseInt(String(filters.pageSize ?? DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE;

  return {
    search: sanitizedSearch.length > 0 ? sanitizedSearch : null,
    status:
      filters.status && filters.status !== "all" ? filters.status : "all",
    clientId: clientId.length > 0 ? clientId : null,
    issueDateFrom: normalizeDateInput(filters.issueDateFrom ?? null),
    issueDateTo: normalizeDateInput(filters.issueDateTo ?? null),
    dueDateBefore: normalizeDateInput(filters.dueDateBefore ?? null),
    page: Math.max(1, requestedPage),
    pageSize: Math.min(Math.max(1, requestedPageSize), MAX_PAGE_SIZE),
  };
}

function toCountFilters(
  filters: NormalizedInvoiceFilters,
): InvoiceCountFilters {
  const { search, status, clientId, issueDateFrom, issueDateTo, dueDateBefore } =
    filters;
  return {
    search,
    status,
    clientId,
    issueDateFrom,
    issueDateTo,
    dueDateBefore,
  };
}

async function queryInvoicePage(
  tenantId: string,
  filters: NormalizedInvoiceFilters,
) {
  const where: Prisma.InvoiceWhereInput = {
    userId: tenantId,
    ...buildInvoiceWhere(filters),
  };

  const rows = await prisma.invoice.findMany({
    where,
    select: invoiceListSelect,
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize + 1,
  });

  const hasMore = rows.length > filters.pageSize;
  const items = hasMore ? rows.slice(0, filters.pageSize) : rows;

  return { items, hasMore };
}

async function queryInvoiceCount(
  tenantId: string,
  filters: InvoiceCountFilters,
) {
  const where: Prisma.InvoiceWhereInput = {
    userId: tenantId,
    ...buildInvoiceWhere(filters),
  };
  return prisma.invoice.count({ where });
}

async function fetchInvoiceDetail(
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceDetail | null> {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, userId: tenantId },
    select: invoiceDetailSelect,
  });
}

function computeInvoiceTotals(
  payload: InvoiceInput,
  taxConfig = DEFAULT_TAX_CONFIGURATION,
) {
  const applyFodec =
    taxConfig.fodec.enabled &&
    (payload.taxes?.applyFodec ?? taxConfig.fodec.autoApply);
  const applyTimbre =
    taxConfig.timbre.enabled &&
    (payload.taxes?.applyTimbre ?? taxConfig.timbre.autoApply);

  const computedLines = payload.lines.map((line) =>
    calculateLineTotals(
      {
        quantity: line.quantity,
        unitPriceHTCents: line.unitPriceHTCents,
        vatRate: line.vatRate,
        discountRate: line.discountRate ?? undefined,
        discountAmountCents: line.discountAmountCents ?? undefined,
      },
      {
        fodecRate:
          taxConfig.fodec.application === "line" && applyFodec
            ? line.fodecRate ?? taxConfig.fodec.rate
            : null,
        fodecCalculationOrder: taxConfig.fodec.calculationOrder,
        roundingMode: taxConfig.rounding.line,
      },
    ),
  );

  const documentFodecRate =
    taxConfig.fodec.application === "document" && applyFodec
      ? payload.taxes?.documentFodecRate ?? taxConfig.fodec.rate
      : null;

  const timbreAmountCents = applyTimbre
    ? payload.taxes?.timbreAmountCents ?? taxConfig.timbre.amountCents
    : 0;

  const totals = calculateDocumentTotals(
    computedLines,
    payload.globalDiscountRate ?? undefined,
    payload.globalDiscountAmountCents ?? undefined,
    {
      taxConfiguration: taxConfig,
      applyFodec,
      applyTimbre,
      documentFodecRate,
      timbreAmountCents,
    },
  );

  const taxConfigurationSnapshot: TaxConfiguration = {
    ...taxConfig,
    fodec: {
      ...taxConfig.fodec,
      enabled: applyFodec,
      autoApply: applyFodec,
      rate:
        taxConfig.fodec.application === "document" && documentFodecRate != null
          ? documentFodecRate
          : taxConfig.fodec.rate,
    },
    timbre: {
      ...taxConfig.timbre,
      enabled: applyTimbre,
      amountCents: timbreAmountCents,
    },
  };

  return {
    computedLines,
    totals,
    applyFodec,
    applyTimbre,
    documentFodecRate,
    timbreAmountCents,
    taxConfigurationSnapshot,
  };
}

function serializeVat(entries: ReturnType<typeof calculateDocumentTotals>["vatEntries"]) {
  return entries.map((entry) => ({
    rate: entry.rate,
    baseHT: entry.baseHTCents,
    totalTVA: entry.totalTVACents,
  }));
}

export function listInvoices(
  filters?: InvoiceFilters,
  options?: { includeTotals?: true },
): Promise<InvoiceListResultWithTotal>;
export function listInvoices(
  filters: InvoiceFilters,
  options: { includeTotals: false },
): Promise<InvoiceListResultWithoutTotal>;
export async function listInvoices(
  filters: InvoiceFilters = {},
  options: InvoiceListOptions = {},
): Promise<InvoiceListResult> {
  const user = await requireUser();
  const tenantId = resolveTenantId(user);
  const normalizedFilters = normalizeInvoiceFilters(filters);
  const countFilters = toCountFilters(normalizedFilters);
  const includeTotals = options.includeTotals ?? true;

  const runPageQuery = () => queryInvoicePage(tenantId, normalizedFilters);
  const runCountQuery = () => queryInvoiceCount(tenantId, countFilters);

  const pagePromise = SHOULD_USE_INVOICE_CACHE
    ? unstable_cache(
        runPageQuery,
        ["invoices", "list", tenantId, listCacheKey(normalizedFilters)],
        {
          tags: [invoiceListTag(tenantId)],
          revalidate: INVOICE_CACHE_REVALIDATE_SECONDS,
        },
      )()
    : runPageQuery();

  if (!includeTotals) {
    const pageResult = await pagePromise;
    return {
      items: pageResult.items,
      total: null,
      page: normalizedFilters.page,
      pageSize: normalizedFilters.pageSize,
      pageCount: null,
      hasMore: pageResult.hasMore,
    };
  }

  const countPromise = SHOULD_USE_INVOICE_CACHE
    ? unstable_cache(
        runCountQuery,
        ["invoices", "count", tenantId, countCacheKey(countFilters)],
        {
          tags: [invoiceStatsTag(tenantId)],
          revalidate: INVOICE_CACHE_REVALIDATE_SECONDS,
        },
      )()
    : runCountQuery();

  const [pageResult, total] = await Promise.all([pagePromise, countPromise]);

  const pageCount = Math.max(
    1,
    Math.ceil(total / Math.max(1, normalizedFilters.pageSize)),
  );

  return {
    items: pageResult.items,
    total,
    page: normalizedFilters.page,
    pageSize: normalizedFilters.pageSize,
    pageCount,
    hasMore: pageResult.hasMore,
  };
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const user = await requireUser();
  const tenantId = resolveTenantId(user);

  if (!SHOULD_USE_INVOICE_CACHE) {
    return fetchInvoiceDetail(tenantId, id);
  }

  const cached = unstable_cache(
    () => fetchInvoiceDetail(tenantId, id),
    ["invoices", "detail", tenantId, id],
    {
      tags: [invoiceDetailTag(tenantId, id)],
      revalidate: INVOICE_CACHE_REVALIDATE_SECONDS,
    },
  );

  return cached();
}

export async function createInvoice(input: InvoiceInput) {
  const { id: userId } = await requireUser();
  return createInvoiceForUser(userId, input);
}

export async function createInvoiceForUser(userId: string, input: InvoiceInput) {
  const payload = invoiceInputSchema.parse(input);
  await assertClientOwnership(userId, payload.clientId);
  await assertProductsOwnership(
    userId,
    payload.lines.map((line) => line.productId),
  );
  const settings = await getSettings(userId);
  const taxConfig = normalizeTaxConfiguration(
    (settings as { taxConfiguration?: unknown }).taxConfiguration,
  );
  const { computedLines, totals, timbreAmountCents, taxConfigurationSnapshot } =
    computeInvoiceTotals(payload, taxConfig);
  const number = payload.number ?? (await nextInvoiceNumber(userId));

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      number,
      clientId: payload.clientId,
      status: payload.status,
      reference: payload.reference,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      currency: payload.currency,
      globalDiscountRate: payload.globalDiscountRate ?? null,
      globalDiscountAmountCents: totals.globalDiscountAppliedCents,
      vatBreakdown: serializeVat(totals.vatEntries),
      taxSummary: totals.taxSummary,
      taxConfiguration: taxConfigurationSnapshot,
      notes: payload.notes,
      terms: payload.terms,
      lateFeeRate: payload.lateFeeRate ?? null,
      subtotalHTCents: totals.subtotalHTCents,
      totalDiscountCents: totals.totalDiscountCents,
      totalTVACents: totals.totalTVACents,
      totalTTCCents: totals.totalTTCCents,
      amountPaidCents: 0,
      fodecAmountCents: totals.fodecAmountCents,
      timbreAmountCents,
      lines: {
        create: payload.lines.map((line, index) => ({
          productId: line.productId ?? null,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPriceHTCents: line.unitPriceHTCents,
          vatRate: line.vatRate,
          discountRate: line.discountRate ?? null,
          discountAmountCents: computedLines[index].discountAmountCents,
          totalHTCents: computedLines[index].totalHTCents,
          totalTVACents: computedLines[index].totalTVACents,
          totalTTCCents: computedLines[index].totalTTCCents,
          fodecRate: computedLines[index].fodecRate ?? null,
          fodecAmountCents: computedLines[index].fodecAmountCents,
          position: line.position,
        })),
      },
    },
    include: {
      client: true,
      lines: true,
      payments: true,
    },
  });

  return invoice;
}

export async function updateInvoice(id: string, input: InvoiceInput) {
  const { id: userId } = await requireUser();
  await assertInvoiceOwnership(userId, id);
  const payload = invoiceInputSchema.parse({ ...input, id });
  await assertClientOwnership(userId, payload.clientId);
  await assertProductsOwnership(
    userId,
    payload.lines.map((line) => line.productId),
  );
  const settings = await getSettings(userId);
  const taxConfig = normalizeTaxConfiguration(
    (settings as { taxConfiguration?: unknown }).taxConfiguration,
  );
  const { computedLines, totals, timbreAmountCents, taxConfigurationSnapshot } =
    computeInvoiceTotals(payload, taxConfig);

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

    const updated = await tx.invoice.update({
      where: { id },
      data: {
        userId,
        clientId: payload.clientId,
        status: payload.status,
        reference: payload.reference,
        issueDate: payload.issueDate,
        dueDate: payload.dueDate,
        currency: payload.currency,
        globalDiscountRate: payload.globalDiscountRate ?? null,
        globalDiscountAmountCents: totals.globalDiscountAppliedCents,
        vatBreakdown: serializeVat(totals.vatEntries),
        taxSummary: totals.taxSummary,
        taxConfiguration: taxConfigurationSnapshot,
        notes: payload.notes,
        terms: payload.terms,
        lateFeeRate: payload.lateFeeRate ?? null,
        subtotalHTCents: totals.subtotalHTCents,
        totalDiscountCents: totals.totalDiscountCents,
        totalTVACents: totals.totalTVACents,
        totalTTCCents: totals.totalTTCCents,
        fodecAmountCents: totals.fodecAmountCents,
        timbreAmountCents,
        lines: {
          create: payload.lines.map((line, index) => ({
            productId: line.productId ?? null,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPriceHTCents: line.unitPriceHTCents,
            vatRate: line.vatRate,
            discountRate: line.discountRate ?? null,
            discountAmountCents: computedLines[index].discountAmountCents,
            totalHTCents: computedLines[index].totalHTCents,
            totalTVACents: computedLines[index].totalTVACents,
            totalTTCCents: computedLines[index].totalTTCCents,
            fodecRate: computedLines[index].fodecRate ?? null,
            fodecAmountCents: computedLines[index].fodecAmountCents,
            position: line.position,
          })),
        },
      },
      include: {
        client: true,
        lines: true,
        payments: true,
      },
    });

    return updated;
  });

  return invoice;
}

export async function duplicateInvoice(id: string) {
  const { id: userId } = await requireUser();
  const existing = await prisma.invoice.findFirst({
    where: { id, userId },
    include: {
      client: true,
      lines: {
        orderBy: { position: "asc" },
      },
    },
  });
  if (!existing) {
    throw new Error("Facture introuvable");
  }
  const number = await nextInvoiceNumber(userId);
  const duplicated = await prisma.invoice.create({
    data: {
      userId,
      number,
      clientId: existing.clientId,
      status: InvoiceStatus.BROUILLON,
      reference: existing.reference,
      issueDate: new Date(),
      dueDate: existing.dueDate,
      currency: existing.currency,
      globalDiscountRate: existing.globalDiscountRate,
      globalDiscountAmountCents: existing.globalDiscountAmountCents,
      vatBreakdown: existing.vatBreakdown ?? Prisma.JsonNull,
      taxSummary: existing.taxSummary ?? Prisma.JsonNull,
      taxConfiguration: existing.taxConfiguration ?? Prisma.JsonNull,
      notes: existing.notes,
      terms: existing.terms,
      subtotalHTCents: existing.subtotalHTCents,
      totalDiscountCents: existing.totalDiscountCents,
      totalTVACents: existing.totalTVACents,
      totalTTCCents: existing.totalTTCCents,
      amountPaidCents: 0,
      fodecAmountCents: existing.fodecAmountCents ?? 0,
      timbreAmountCents: existing.timbreAmountCents ?? 0,
      lines: {
        create: existing.lines.map((line, index) => ({
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPriceHTCents: line.unitPriceHTCents,
          vatRate: line.vatRate,
          discountRate: line.discountRate,
          discountAmountCents: line.discountAmountCents,
          totalHTCents: line.totalHTCents,
          totalTVACents: line.totalTVACents,
          totalTTCCents: line.totalTTCCents,
          fodecRate: line.fodecRate,
          fodecAmountCents: line.fodecAmountCents,
          position: index,
        })),
      },
    },
    include: {
      client: true,
      lines: true,
      payments: true,
    },
  });
  return duplicated;
}

export type DeleteInvoiceOutcome = "deleted" | "cancelled" | "already-cancelled";

export async function deleteInvoice(id: string): Promise<DeleteInvoiceOutcome> {
  const { id: userId } = await requireUser();
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id, userId },
      select: { status: true, number: true },
    });

    if (!invoice) {
      throw new Error(`Invoice ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.BROUILLON) {
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          userId,
          action: InvoiceAuditAction.DELETION,
          previousStatus: invoice.status,
          note: `Suppression définitive de la facture ${invoice.number} à l'état brouillon`,
        },
      });
      await tx.invoice.delete({ where: { id } });
      return "deleted";
    }

    if (invoice.status === InvoiceStatus.ANNULEE) {
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          userId,
          action: InvoiceAuditAction.CANCELLATION,
          previousStatus: invoice.status,
          newStatus: InvoiceStatus.ANNULEE,
          note: `Tentative supplémentaire de suppression ignorée pour la facture ${invoice.number} déjà annulée`,
        },
      });
      return "already-cancelled";
    }

    await tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.ANNULEE },
    });

    await tx.invoiceAuditLog.create({
      data: {
        invoiceId: id,
        userId,
        action: InvoiceAuditAction.CANCELLATION,
        previousStatus: invoice.status,
        newStatus: InvoiceStatus.ANNULEE,
        note: `Suppression convertie en annulation pour la facture ${invoice.number}`,
      },
    });
    return "cancelled";
  });
}

export async function changeInvoiceStatus(id: string, status: InvoiceStatus) {
  const { id: userId } = await requireUser();
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id, userId },
      select: {
        totalTTCCents: true,
        payments: {
          select: { amountCents: true },
        },
      },
    });
    if (!invoice) {
      throw new Error("Facture introuvable");
    }

    const amountPaidCents = invoice.payments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0,
    );
    const amountToApply =
      status === InvoiceStatus.PAYEE
        ? Math.max(amountPaidCents, invoice.totalTTCCents)
        : amountPaidCents;

    return tx.invoice.update({
      where: { id },
      data: {
        status,
        amountPaidCents: amountToApply,
      },
    });
  });
}

const paymentSchema = z
  .object({
    invoiceId: z.string(),
    amount: z.number().positive().optional(),
    amountCents: z.number().int().positive().optional(),
    method: z.string().nullable().optional(),
    date: z.coerce.date(),
    note: z.string().nullable().optional(),
  })
  .refine(
    (payload) =>
      typeof payload.amount === "number" ||
      typeof payload.amountCents === "number",
    {
      message: "Montant de paiement requis",
      path: ["amount"],
    },
  );

export async function recordPayment(input: z.infer<typeof paymentSchema>) {
  const { id: userId } = await requireUser();
  const payload = paymentSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: payload.invoiceId, userId },
      select: {
        status: true,
        totalTTCCents: true,
        dueDate: true,
        currency: true,
      },
    });
    if (!invoice) {
      throw new Error("Facture introuvable");
    }

    const amountCents =
      payload.amountCents ??
      (payload.amount != null
        ? toCents(payload.amount, invoice.currency)
        : null);

    if (
      typeof amountCents !== "number" ||
      Number.isNaN(amountCents) ||
      amountCents <= 0
    ) {
      throw new Error("Montant de paiement invalide");
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId: payload.invoiceId,
        amountCents,
        method: payload.method ?? null,
        date: payload.date,
        note: payload.note ?? null,
        userId,
      },
    });

    const sums = await tx.payment.aggregate({
      where: { invoiceId: payload.invoiceId, userId },
      _sum: {
        amountCents: true,
      },
    });

    const amountPaidCents = sums._sum.amountCents ?? 0;
    const newStatus = calculateStatusAfterPayment({
      status: invoice.status,
      totalTTCCents: invoice.totalTTCCents,
      amountPaidCents,
      dueDate: invoice.dueDate,
    });

    await tx.invoice.update({
      where: { id: payload.invoiceId },
      data: {
        amountPaidCents,
        status: newStatus,
      },
    });

    return payment;
  });
}

export async function deletePayment(paymentId: string) {
  const { id: userId } = await requireUser();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!existing) {
      throw new Error("Paiement introuvable");
    }

    await tx.payment.delete({
      where: { id: paymentId },
    });

    const sums = await tx.payment.aggregate({
      where: { invoiceId: existing.invoiceId, userId },
      _sum: {
        amountCents: true,
      },
    });

    const invoice = await tx.invoice.findFirst({
      where: { id: existing.invoiceId, userId },
      select: {
        status: true,
        totalTTCCents: true,
        dueDate: true,
      },
    });
    if (!invoice) {
      throw new Error("Facture introuvable");
    }

    const amountPaidCents = sums._sum.amountCents ?? 0;
    const newStatus = calculateStatusAfterPayment({
      status: invoice.status,
      totalTTCCents: invoice.totalTTCCents,
      amountPaidCents,
      dueDate: invoice.dueDate,
    });

    await tx.invoice.update({
      where: { id: existing.invoiceId },
      data: {
        amountPaidCents,
        status: newStatus,
      },
    });
  });
}

export async function reconcileInvoiceStatus(
  id: string,
  options?: { preserveStatus?: InvoiceStatus },
) {
  const { id: userId } = await requireUser();
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    include: {
      payments: true,
    },
  });

  if (!invoice) return null;

  const amountPaidCents = invoice.payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );

  const preserveManualPaid =
    options?.preserveStatus === InvoiceStatus.PAYEE &&
    invoice.status === InvoiceStatus.PAYEE;

  const newStatus = calculateStatusAfterPayment({
    status: invoice.status,
    totalTTCCents: invoice.totalTTCCents,
    amountPaidCents,
    dueDate: invoice.dueDate,
  });

  const statusToApply = preserveManualPaid
    ? InvoiceStatus.PAYEE
    : newStatus;

  const amountToApply = preserveManualPaid
    ? Math.max(amountPaidCents, invoice.totalTTCCents)
    : amountPaidCents;

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      amountPaidCents: amountToApply,
      status: statusToApply,
    },
    include: {
      client: true,
      lines: true,
      payments: true,
      quote: true,
    },
  });

  return updated;
}

export async function linkQuoteToInvoice(
  invoiceId: string,
  quoteId: string,
) {
  const { id: userId } = await requireUser();
  await assertInvoiceOwnership(userId, invoiceId);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId },
    include: { invoice: true },
  });
  if (!quote) {
    throw new Error("Devis introuvable");
  }
  if (quote.invoice && quote.invoice.id !== invoiceId) {
    throw new Error("Ce devis est déjà lié à une autre facture");
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { quoteId },
    });

    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.ACCEPTE,
        invoice: { connect: { id: invoiceId } },
      },
    });
  });
}
