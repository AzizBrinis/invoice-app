import { prisma } from "@/lib/prisma";
import {
  QuoteStatus,
  type Prisma,
  InvoiceStatus,
} from "@prisma/client";
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
};

const DEFAULT_PAGE_SIZE = 10;

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
            { number: { contains: search } },
            { reference: { contains: search } },
            {
              client: {
                displayName: {
                  contains: search,
                },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.QuoteWhereInput;
}

export async function listQuotes(filters: QuoteFilters = {}) {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE } = filters;
  const where = buildWhere(filters);

  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        client: true,
      },
      orderBy: {
        issueDate: "desc",
      },
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

export async function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      lines: {
        orderBy: { position: "asc" },
        include: {
          product: true,
        },
      },
      invoice: true,
    },
  });
}

export async function createQuote(input: QuoteInput) {
  const payload = quoteInputSchema.parse(input);

  const settings = await getSettings();
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

  const number = payload.number ?? (await nextQuoteNumber());

  const quote = await prisma.quote.create({
    data: {
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

  return quote;
}

export async function updateQuote(id: string, input: QuoteInput) {
  const payload = quoteInputSchema.parse({ ...input, id });
  const settings = await getSettings();
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

  return quote;
}

export async function changeQuoteStatus(id: string, status: QuoteStatus) {
  return prisma.quote.update({
    where: { id },
    data: { status },
  });
}

export async function deleteQuote(id: string) {
  await prisma.quote.delete({
    where: { id },
  });
}

export async function duplicateQuote(id: string) {
  const existing = await getQuote(id);
  if (!existing) {
    throw new Error("Devis introuvable");
  }

  const number = await nextQuoteNumber();

  return prisma.quote.create({
    data: {
      number,
      clientId: existing.clientId,
      status: QuoteStatus.BROUILLON,
      reference: existing.reference,
      issueDate: new Date(),
      validUntil: existing.validUntil,
      currency: existing.currency,
      globalDiscountRate: existing.globalDiscountRate,
      globalDiscountAmountCents: existing.globalDiscountAmountCents,
      vatBreakdown: existing.vatBreakdown,
      taxSummary: existing.taxSummary ?? [],
      taxConfiguration:
        existing.taxConfiguration ?? DEFAULT_TAX_CONFIGURATION,
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
}

export async function convertQuoteToInvoice(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
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

  const invoiceNumber = await nextInvoiceNumber();

  const invoice = await prisma.$transaction(async (tx) => {
    const createdInvoice = await tx.invoice.create({
      data: {
        number: invoiceNumber,
        status: InvoiceStatus.ENVOYEE,
        reference: quote.reference,
        issueDate: new Date(),
        dueDate: quote.validUntil,
        clientId: quote.clientId,
        currency: quote.currency,
        globalDiscountRate: quote.globalDiscountRate,
        globalDiscountAmountCents: quote.globalDiscountAmountCents,
        vatBreakdown: quote.vatBreakdown,
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

  return invoice;
}
