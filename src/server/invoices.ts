import { prisma } from "@/lib/prisma";
import { calculateDocumentTotals, calculateLineTotals } from "@/lib/documents";
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
  type Prisma,
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

function buildInvoiceWhere(
  filters: InvoiceFilters,
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
    ...(dueDateBefore
      ? {
          dueDate: {
            lte: dueDateBefore,
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
  } satisfies Prisma.InvoiceWhereInput;
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

export async function listInvoices(filters: InvoiceFilters = {}) {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE } = filters;
  const where = buildInvoiceWhere(filters);

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        client: true,
        payments: true,
      },
      orderBy: {
        issueDate: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { orderBy: { position: "asc" }, include: { product: true } },
      payments: { orderBy: { date: "desc" } },
      quote: true,
    },
  });
}

export async function createInvoice(input: InvoiceInput) {
  const payload = invoiceInputSchema.parse(input);
  const settings = await getSettings();
  const taxConfig = normalizeTaxConfiguration(
    (settings as { taxConfiguration?: unknown }).taxConfiguration,
  );
  const { computedLines, totals, timbreAmountCents, taxConfigurationSnapshot } =
    computeInvoiceTotals(payload, taxConfig);
  const number = payload.number ?? (await nextInvoiceNumber());

  const invoice = await prisma.invoice.create({
    data: {
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
  const payload = invoiceInputSchema.parse({ ...input, id });
  const settings = await getSettings();
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

export async function deleteInvoice(id: string) {
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      select: { status: true, number: true },
    });

    if (!invoice) {
      throw new Error(`Invoice ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.BROUILLON) {
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          action: InvoiceAuditAction.DELETION,
          previousStatus: invoice.status,
          note: `Suppression définitive de la facture ${invoice.number} à l'état brouillon`,
        },
      });
      await tx.invoice.delete({ where: { id } });
      return;
    }

    if (invoice.status === InvoiceStatus.ANNULEE) {
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          action: InvoiceAuditAction.CANCELLATION,
          previousStatus: invoice.status,
          newStatus: InvoiceStatus.ANNULEE,
          note: `Tentative supplémentaire de suppression ignorée pour la facture ${invoice.number} déjà annulée`,
        },
      });
      return;
    }

    await tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.ANNULEE },
    });

    await tx.invoiceAuditLog.create({
      data: {
        invoiceId: id,
        action: InvoiceAuditAction.CANCELLATION,
        previousStatus: invoice.status,
        newStatus: InvoiceStatus.ANNULEE,
        note: `Suppression convertie en annulation pour la facture ${invoice.number}`,
      },
    });
  });
}

export async function changeInvoiceStatus(id: string, status: InvoiceStatus) {
  return prisma.invoice.update({
    where: { id },
    data: { status },
  });
}

const paymentSchema = z.object({
  invoiceId: z.string(),
  amountCents: z.number().int().positive(),
  method: z.string().nullable().optional(),
  date: z.coerce.date(),
  note: z.string().nullable().optional(),
});

export async function recordPayment(input: z.infer<typeof paymentSchema>) {
  const payload = paymentSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: payload,
    });

    const sums = await tx.payment.aggregate({
      where: { invoiceId: payload.invoiceId },
      _sum: {
        amountCents: true,
      },
    });

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: payload.invoiceId },
      select: {
        status: true,
        totalTTCCents: true,
        dueDate: true,
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
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.delete({
      where: { id: paymentId },
    });

    const sums = await tx.payment.aggregate({
      where: { invoiceId: payment.invoiceId },
      _sum: {
        amountCents: true,
      },
    });

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: payment.invoiceId },
      select: {
        status: true,
        totalTTCCents: true,
        dueDate: true,
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
      where: { id: payment.invoiceId },
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
  const invoice = await prisma.invoice.findUnique({
    where: { id },
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
