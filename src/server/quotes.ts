import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { QuoteStatus, Prisma, InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import {
  calculateDocumentTotals,
  calculateLineTotals,
  type LineComputationResult,
} from "@/lib/documents";
import { nextQuoteNumber, nextInvoiceNumber } from "@/server/sequences";
import { getSettings } from "@/server/settings";
import {
  DEFAULT_TAX_CONFIGURATION,
  normalizeTaxConfiguration,
  type TaxConfiguration,
} from "@/lib/taxes";

const quoteLineInputSchema = z.object({
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
  fodecRate: z.number().min(0).max(100).nullable().optional(),
  position: z.number().int().nonnegative(),
});

export const quoteInputSchema = z.object({
  id: z.string().optional(),
  number: z.string().optional(),
  clientId: z.string().min(1, "Client requis"),
  status: z.nativeEnum(QuoteStatus).default(QuoteStatus.BROUILLON),
  reference: z.string().nullable().optional(),
  issueDate: z.coerce.date(),
  validUntil: z.coerce.date().nullable().optional(),
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
  lines: z
    .array(quoteLineInputSchema)
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

export type QuoteInput = z.infer<typeof quoteInputSchema>;

export type QuoteFilters = {
  search?: string;
  status?: QuoteStatus | "all";
  clientId?: string;
  issueDateFrom?: Date;
  issueDateTo?: Date;
  page?: number;
  pageSize?: number;
  sort?: QuoteSort;
};

const DEFAULT_PAGE_SIZE = 10;
const QUOTE_LIST_REVALIDATE_SECONDS = 30;
const QUOTE_FORM_CACHE_SECONDS = 60;
const isTestEnv = process.env.NODE_ENV === "test";

const QUOTE_SORT_CONFIG = {
  "issue-desc": [
    { issueDate: "desc" },
    { id: "desc" },
  ],
  "issue-asc": [
    { issueDate: "asc" },
    { id: "asc" },
  ],
  "total-desc": [
    { totalTTCCents: "desc" },
    { id: "desc" },
  ],
  "total-asc": [
    { totalTTCCents: "asc" },
    { id: "asc" },
  ],
  "status-asc": [
    { status: "asc" },
    { issueDate: "desc" },
    { id: "desc" },
  ],
  "client-asc": [
    { client: { displayName: "asc" } },
    { issueDate: "desc" },
    { id: "desc" },
  ],
} as const satisfies Record<string, Prisma.QuoteOrderByWithRelationInput[]>;

export type QuoteSort = keyof typeof QUOTE_SORT_CONFIG;
export const DEFAULT_QUOTE_SORT: QuoteSort = "issue-desc";

type NormalizedQuoteFilters = {
  search?: string;
  status: QuoteStatus | "all";
  clientId?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  page: number;
  pageSize: number;
  sort: QuoteSort;
};

const quoteListTag = (userId: string) => `quotes:list:${userId}`;

const quoteFilterClientsSelect = Prisma.validator<Prisma.ClientSelect>()({
  id: true,
  displayName: true,
});

const quoteProductSelect = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  name: true,
  priceHTCents: true,
  vatRate: true,
  unit: true,
  defaultDiscountRate: true,
});

function normalizeQuoteFilters(filters: QuoteFilters = {}): NormalizedQuoteFilters {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const status = filters.status ?? "all";
  const search = filters.search?.trim();
  const sort = filters.sort && filters.sort in QUOTE_SORT_CONFIG ? filters.sort : DEFAULT_QUOTE_SORT;
  const issueDateFrom =
    filters.issueDateFrom instanceof Date && !Number.isNaN(filters.issueDateFrom.valueOf())
      ? filters.issueDateFrom
      : undefined;
  const issueDateTo =
    filters.issueDateTo instanceof Date && !Number.isNaN(filters.issueDateTo.valueOf())
      ? filters.issueDateTo
      : undefined;
  return {
    search: search ? search : undefined,
    status,
    clientId: filters.clientId ?? undefined,
    issueDateFrom: issueDateFrom ? issueDateFrom.toISOString() : undefined,
    issueDateTo: issueDateTo ? issueDateTo.toISOString() : undefined,
    page,
    pageSize,
    sort,
  };
}

function serializeFilters(filters: NormalizedQuoteFilters) {
  return JSON.stringify(filters);
}

function deserializeFilters(filters: NormalizedQuoteFilters): QuoteFilters {
  return {
    search: filters.search,
    status: filters.status,
    clientId: filters.clientId,
    issueDateFrom: filters.issueDateFrom ? new Date(filters.issueDateFrom) : undefined,
    issueDateTo: filters.issueDateTo ? new Date(filters.issueDateTo) : undefined,
    sort: filters.sort,
  };
}

function revalidateQuotes(userId: string) {
  if (isTestEnv) {
    return;
  }
  revalidateTag(quoteListTag(userId), "max");
}

export async function getQuoteFilterClients(userId: string) {
  const runQuery = () =>
    prisma.client.findMany({
      where: { userId },
      orderBy: { displayName: "asc" },
      select: quoteFilterClientsSelect,
    });

  if (isTestEnv) {
    return runQuery();
  }

  try {
    const cached = unstable_cache(runQuery, ["quotes", "filter-clients", userId], {
      revalidate: QUOTE_FORM_CACHE_SECONDS,
    });

    return await cached();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[getQuoteFilterClients] cache fallback:",
        (error as Error).message,
      );
    }
    return runQuery();
  }
}

export async function getQuoteFormProducts(userId: string) {
  const runQuery = () =>
    prisma.product.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
      select: quoteProductSelect,
    });

  if (isTestEnv) {
    return runQuery();
  }

  try {
    const cached = unstable_cache(runQuery, ["quotes", "form-products", userId], {
      revalidate: QUOTE_FORM_CACHE_SECONDS,
    });

    return await cached();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[getQuoteFormProducts] cache fallback:",
        (error as Error).message,
      );
    }
    return runQuery();
  }
}

export async function searchQuoteProducts(
  userId: string,
  search?: string | null,
  take: number = 20,
) {
  const limit = Math.min(50, Math.max(1, take));
  const query = search?.trim();
  return prisma.product.findMany({
    where: {
      userId,
      isActive: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [
      { name: "asc" },
      { id: "asc" },
    ],
    take: limit,
    select: quoteProductSelect,
  });
}

export async function getQuoteFormSettings(userId: string) {
  const runQuery = () => getSettings(userId);

  if (isTestEnv) {
    return runQuery();
  }

  try {
    const cached = unstable_cache(runQuery, ["quotes", "form-settings", userId], {
      revalidate: QUOTE_FORM_CACHE_SECONDS,
    });

    return await cached();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[getQuoteFormSettings] cache fallback:",
        (error as Error).message,
      );
    }
    return runQuery();
  }
}

function toJsonInput(
  value: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

function buildWhere(filters: QuoteFilters): Prisma.QuoteWhereInput {
  const {
    search,
    status = "all",
    clientId,
    issueDateFrom,
    issueDateTo,
  } = filters;

  return {
    ...(status === "all" ? {} : { status }),
    ...(clientId ? { clientId } : {}),
    ...(issueDateFrom || issueDateTo
      ? {
          issueDate: {
            ...(issueDateFrom ? { gte: issueDateFrom } : {}),
            ...(issueDateTo ? { lte: issueDateTo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
            {
              client: {
                displayName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.QuoteWhereInput;
}

async function fetchQuotesFromDb(userId: string, filters: NormalizedQuoteFilters) {
  const whereFilters = deserializeFilters(filters);
  const where: Prisma.QuoteWhereInput = {
    userId,
    ...buildWhere(whereFilters),
  };
  const pageSize = filters.pageSize;
  const page = filters.page;
  const orderBy = QUOTE_SORT_CONFIG[filters.sort] ?? QUOTE_SORT_CONFIG[DEFAULT_QUOTE_SORT];

  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        client: {
          select: quoteFilterClientsSelect,
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quote.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function listQuotes(filters: QuoteFilters = {}, userId?: string) {
  const resolvedUserId = userId ?? (await requireUser()).id;
  const normalizedFilters = normalizeQuoteFilters(filters);

  if (isTestEnv) {
    return fetchQuotesFromDb(resolvedUserId, normalizedFilters);
  }

  try {
    const cached = unstable_cache(
      () => fetchQuotesFromDb(resolvedUserId, normalizedFilters),
      ["quotes", "list", resolvedUserId, serializeFilters(normalizedFilters)],
      {
        revalidate: QUOTE_LIST_REVALIDATE_SECONDS,
        tags: [quoteListTag(resolvedUserId)],
      },
    );

    return await cached();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[listQuotes] falling back to uncached mode:",
        (error as Error).message,
      );
    }
    return fetchQuotesFromDb(resolvedUserId, normalizedFilters);
  }
}

function computeTotalsFromLines(
  lines: QuoteInput["lines"],
  globalRate?: number | null,
  globalAmount?: number | null,
  taxConfig = DEFAULT_TAX_CONFIGURATION,
  taxes?: QuoteInput["taxes"],
) {
  const applyFodec =
    taxConfig.fodec.enabled &&
    (taxes?.applyFodec ?? taxConfig.fodec.autoApply);
  const applyTimbre =
    taxConfig.timbre.enabled &&
    (taxes?.applyTimbre ?? taxConfig.timbre.autoApply);

  const computedLines = lines.map((line) =>
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
      ? taxes?.documentFodecRate ?? taxConfig.fodec.rate
      : null;

  const timbreAmountCents = applyTimbre
    ? taxes?.timbreAmountCents ?? taxConfig.timbre.amountCents
    : 0;

  const totals = calculateDocumentTotals(
    computedLines,
    globalRate ?? undefined,
    globalAmount ?? undefined,
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

function serializeVatBreakdown(entries: ReturnType<typeof calculateDocumentTotals>["vatEntries"]) {
  return entries.map((entry) => ({
    rate: entry.rate,
    baseHT: entry.baseHTCents,
    totalTVA: entry.totalTVACents,
  }));
}

function mapLineData(
  line: QuoteInput["lines"][number],
  computed: LineComputationResult,
) {
  return {
    productId: line.productId ?? null,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceHTCents: line.unitPriceHTCents,
    vatRate: line.vatRate,
    discountRate: line.discountRate ?? null,
    discountAmountCents: computed.discountAmountCents,
    totalHTCents: computed.totalHTCents,
    totalTVACents: computed.totalTVACents,
    totalTTCCents: computed.totalTTCCents,
    fodecRate: computed.fodecRate ?? null,
    fodecAmountCents: computed.fodecAmountCents,
    position: line.position,
  };
}

export async function getQuote(id: string, providedUserId?: string) {
  const userId = providedUserId ?? (await requireUser()).id;

  const baseQuotePromise = prisma.quote.findFirst({
    where: { id, userId },
    include: {
      client: true,
      invoice: true,
    },
  });

  const linesPromise = prisma.quoteLine.findMany({
    where: { quoteId: id, quote: { userId } },
    orderBy: { position: "asc" },
  });

  const [quote, lines] = await Promise.all([baseQuotePromise, linesPromise]);

  if (!quote) {
    return null;
  }

  return {
    ...quote,
    lines,
  };
}

export async function createQuote(input: QuoteInput) {
  const { id: userId } = await requireUser();
  return createQuoteForUser(userId, input);
}

export async function createQuoteForUser(userId: string, input: QuoteInput) {
  const payload = quoteInputSchema.parse(input);

  await assertClientOwnership(userId, payload.clientId);
  await assertProductsOwnership(
    userId,
    payload.lines.map((line) => line.productId),
  );

  const settings = await getSettings(userId);
  const taxConfig = normalizeTaxConfiguration(
    (settings as { taxConfiguration?: unknown }).taxConfiguration,
  );

  const { computedLines, totals, taxConfigurationSnapshot } = computeTotalsFromLines(
    payload.lines,
    payload.globalDiscountRate,
    payload.globalDiscountAmountCents ?? undefined,
    taxConfig,
    payload.taxes,
  );

  const number = payload.number ?? (await nextQuoteNumber(userId, settings));

  const quote = await prisma.quote.create({
    data: {
      userId,
      number,
      clientId: payload.clientId,
      status: payload.status,
      reference: payload.reference,
      issueDate: payload.issueDate,
      validUntil: payload.validUntil,
      currency: payload.currency,
      globalDiscountRate: payload.globalDiscountRate ?? null,
      globalDiscountAmountCents: totals.globalDiscountAppliedCents,
      vatBreakdown: serializeVatBreakdown(totals.vatEntries),
      taxSummary: totals.taxSummary,
      taxConfiguration: taxConfigurationSnapshot,
      notes: payload.notes,
      terms: payload.terms,
      subtotalHTCents: totals.subtotalHTCents,
      totalDiscountCents: totals.totalDiscountCents,
      totalTVACents: totals.totalTVACents,
      totalTTCCents: totals.totalTTCCents,
      fodecAmountCents: totals.fodecAmountCents,
      timbreAmountCents: totals.timbreAmountCents,
      lines: {
        create: payload.lines.map((line, index) =>
          mapLineData(line, computedLines[index]),
        ),
      },
    },
    include: {
      client: true,
      lines: {
        orderBy: { position: "asc" },
      },
    },
  });

  revalidateQuotes(userId);
  return quote;
}

export async function updateQuote(id: string, input: QuoteInput) {
  const { id: userId } = await requireUser();
  const existing = await prisma.quote.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Devis introuvable");
  }
  const payload = quoteInputSchema.parse({ ...input, id });
  await assertClientOwnership(userId, payload.clientId);
  await assertProductsOwnership(
    userId,
    payload.lines.map((line) => line.productId),
  );
  const settings = await getSettings(userId);
  const taxConfig = normalizeTaxConfiguration(
    (settings as { taxConfiguration?: unknown }).taxConfiguration,
  );

  const { computedLines, totals, taxConfigurationSnapshot } = computeTotalsFromLines(
    payload.lines,
    payload.globalDiscountRate,
    payload.globalDiscountAmountCents ?? undefined,
    taxConfig,
    payload.taxes,
  );

  const quote = await prisma.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { quoteId: id } });

    const updated = await tx.quote.update({
      where: { id },
      data: {
        userId,
        clientId: payload.clientId,
        status: payload.status,
        reference: payload.reference,
        issueDate: payload.issueDate,
        validUntil: payload.validUntil,
        currency: payload.currency,
        globalDiscountRate: payload.globalDiscountRate ?? null,
        globalDiscountAmountCents: totals.globalDiscountAppliedCents,
        vatBreakdown: serializeVatBreakdown(totals.vatEntries),
        taxSummary: totals.taxSummary,
        taxConfiguration: taxConfigurationSnapshot,
        notes: payload.notes,
        terms: payload.terms,
        subtotalHTCents: totals.subtotalHTCents,
        totalDiscountCents: totals.totalDiscountCents,
        totalTVACents: totals.totalTVACents,
        totalTTCCents: totals.totalTTCCents,
        fodecAmountCents: totals.fodecAmountCents,
        timbreAmountCents: totals.timbreAmountCents,
        lines: {
          create: payload.lines.map((line, index) =>
            mapLineData(line, computedLines[index]),
          ),
        },
      },
      include: {
        client: true,
        lines: {
          orderBy: { position: "asc" },
        },
      },
    });

    return updated;
  });

  revalidateQuotes(userId);
  return quote;
}

export async function changeQuoteStatus(id: string, status: QuoteStatus) {
  const { id: userId } = await requireUser();
  const existing = await prisma.quote.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Devis introuvable");
  }
  const updated = await prisma.quote.update({
    where: { id },
    data: { status },
  });
  revalidateQuotes(userId);
  return updated;
}

export async function changeQuotesStatusBulk(
  ids: string[],
  status: QuoteStatus,
) {
  const uniqueIds = Array.from(
    new Set(ids.filter((value): value is string => Boolean(value))),
  );
  if (uniqueIds.length === 0) {
    return 0;
  }
  const { id: userId } = await requireUser();
  const result = await prisma.quote.updateMany({
    where: {
      id: { in: uniqueIds },
      userId,
    },
    data: { status },
  });
  revalidateQuotes(userId);
  return result.count;
}

export async function deleteQuote(id: string) {
  const { id: userId } = await requireUser();
  const existing = await prisma.quote.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Devis introuvable");
  }
  await prisma.quote.delete({
    where: { id },
  });
  revalidateQuotes(userId);
}

export async function deleteQuotesBulk(ids: string[]) {
  const uniqueIds = Array.from(
    new Set(ids.filter((value): value is string => Boolean(value))),
  );
  if (uniqueIds.length === 0) {
    return 0;
  }
  const { id: userId } = await requireUser();
  const result = await prisma.quote.deleteMany({
    where: {
      id: { in: uniqueIds },
      userId,
    },
  });
  revalidateQuotes(userId);
  return result.count;
}

export async function duplicateQuote(id: string) {
  const { id: userId } = await requireUser();
  const existing = await prisma.quote.findFirst({
    where: { id, userId },
    include: {
      client: true,
      lines: {
        orderBy: { position: "asc" },
      },
    },
  });
  if (!existing) {
    throw new Error("Devis introuvable");
  }

  const number = await nextQuoteNumber(userId);

  const duplicated = await prisma.quote.create({
    data: {
      userId,
      number,
      clientId: existing.clientId,
      status: QuoteStatus.BROUILLON,
      reference: existing.reference,
      issueDate: new Date(),
      validUntil: existing.validUntil,
      currency: existing.currency,
      globalDiscountRate: existing.globalDiscountRate,
      globalDiscountAmountCents: existing.globalDiscountAmountCents,
      vatBreakdown: toJsonInput(existing.vatBreakdown),
      taxSummary: existing.taxSummary
        ? JSON.parse(JSON.stringify(existing.taxSummary))
        : [],
      taxConfiguration: normalizeTaxConfiguration(existing.taxConfiguration),
      notes: existing.notes,
      terms: existing.terms,
      subtotalHTCents: existing.subtotalHTCents,
      totalDiscountCents: existing.totalDiscountCents,
      totalTVACents: existing.totalTVACents,
      totalTTCCents: existing.totalTTCCents,
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
    },
  });

  revalidateQuotes(userId);
  return duplicated;
}

export async function convertQuoteToInvoice(id: string) {
  const { id: userId } = await requireUser();
  return convertQuoteToInvoiceForUser(userId, id);
}

export async function convertQuoteToInvoiceForUser(userId: string, id: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, userId },
    include: {
      client: true,
      lines: {
        orderBy: { position: "asc" },
      },
      invoice: true,
    },
  });

  if (!quote) {
    throw new Error("Devis introuvable");
  }

  if (quote.invoice) {
    return quote.invoice;
  }

  const invoiceNumber = await nextInvoiceNumber(userId);

  const invoice = await prisma.$transaction(async (tx) => {
    const createdInvoice = await tx.invoice.create({
      data: {
        userId,
        number: invoiceNumber,
        status: InvoiceStatus.ENVOYEE,
        reference: quote.reference,
        issueDate: new Date(),
        dueDate: quote.validUntil,
        clientId: quote.clientId,
        currency: quote.currency,
        globalDiscountRate: quote.globalDiscountRate,
        globalDiscountAmountCents: quote.globalDiscountAmountCents,
        vatBreakdown: toJsonInput(quote.vatBreakdown),
        taxSummary: quote.taxSummary ?? [],
        taxConfiguration:
          quote.taxConfiguration ?? DEFAULT_TAX_CONFIGURATION,
        notes: quote.notes,
        terms: quote.terms,
        subtotalHTCents: quote.subtotalHTCents,
        totalDiscountCents: quote.totalDiscountCents,
        totalTVACents: quote.totalTVACents,
        totalTTCCents: quote.totalTTCCents,
        amountPaidCents: 0,
        fodecAmountCents: quote.fodecAmountCents ?? 0,
        timbreAmountCents: quote.timbreAmountCents ?? 0,
        lines: {
          create: quote.lines.map((line, index) => ({
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
    });

    await tx.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.ACCEPTE,
        invoice: { connect: { id: createdInvoice.id } },
      },
    });

    return createdInvoice;
  });

  revalidateQuotes(userId);
  return invoice;
}
