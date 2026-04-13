import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  ClientSource,
  Prisma,
  QuoteRequestStatus,
  QuoteStatus,
} from "@/lib/db/prisma-server";
import { z } from "zod";
import { resolveClientForContact } from "@/server/clients";
import { queueQuoteRequestEmailJob } from "@/server/order-email-jobs";
import { createQuoteForUser } from "@/server/quotes";
import { getSettingsDocumentDefaults } from "@/server/settings";
import { resolveProductDiscount } from "@/lib/product-pricing";

const quoteRequestAttachmentInputSchema = z.object({
  fileName: z.string().min(1, "Nom requis"),
  fileUrl: z.string().url("URL invalide"),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
});

const jsonObjectOrArraySchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const quoteRequestCustomerSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("E-mail invalide"),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export const quoteRequestInputSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  status: z
    .nativeEnum(QuoteRequestStatus)
    .optional()
    .default(QuoteRequestStatus.NEW),
  customer: quoteRequestCustomerSchema,
  message: z.string().max(2000).nullable().optional(),
  formData: jsonObjectOrArraySchema.nullable().optional(),
  sourcePath: z.string().max(180).nullable().optional(),
  quoteId: z.string().nullable().optional(),
  attachments: z.array(quoteRequestAttachmentInputSchema).optional(),
});

export type QuoteRequestInput = z.input<typeof quoteRequestInputSchema>;
export type QuoteRequestAttachmentInput = z.infer<
  typeof quoteRequestAttachmentInputSchema
>;

export type QuoteRequestFilters = {
  search?: string;
  status?: QuoteRequestStatus | "all";
  productId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const quoteRequestListSelect = Prisma.validator<Prisma.QuoteRequestSelect>()({
  id: true,
  status: true,
  customerName: true,
  customerEmail: true,
  customerCompany: true,
  productId: true,
  product: {
    select: {
      id: true,
      name: true,
    },
  },
  quoteId: true,
  createdAt: true,
});

export type QuoteRequestListItem = Prisma.QuoteRequestGetPayload<{
  select: typeof quoteRequestListSelect;
}>;

export type QuoteRequestListResult = {
  items: QuoteRequestListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const quoteRequestDetailSelect = Prisma.validator<Prisma.QuoteRequestSelect>()({
  id: true,
  status: true,
  clientId: true,
  productId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  customerCompany: true,
  customerAddress: true,
  message: true,
  formData: true,
  sourcePath: true,
  quoteId: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      unit: true,
      priceHTCents: true,
      vatRate: true,
      defaultDiscountRate: true,
    },
  },
  attachments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
  quote: {
    select: {
      id: true,
      number: true,
    },
  },
});

export type QuoteRequestDetail = Prisma.QuoteRequestGetPayload<{
  select: typeof quoteRequestDetailSelect;
}>;

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

function buildQuoteRequestWhere(
  userId: string,
  filters: QuoteRequestFilters,
): Prisma.QuoteRequestWhereInput {
  const {
    search,
    status = "all",
    productId,
    createdFrom,
    createdTo,
  } = filters;

  return {
    userId,
    ...(status === "all" ? {} : { status }),
    ...(productId ? { productId } : {}),
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
            { customerName: { contains: search, mode: "insensitive" } },
            { customerEmail: { contains: search, mode: "insensitive" } },
            { customerCompany: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

async function assertProductOwnership(userId: string, productId?: string | null) {
  if (!productId) {
    return;
  }
  const existing = await prisma.product.findFirst({
    where: { id: productId, userId },
  });
  if (!existing) {
    throw new Error("Produit introuvable");
  }
}

function toJsonInput(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function listQuoteRequests(
  filters: QuoteRequestFilters = {},
  providedUserId?: string,
): Promise<QuoteRequestListResult> {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const where = buildQuoteRequestWhere(userId, filters);

  const [items, total] = await Promise.all([
    prisma.quoteRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: quoteRequestListSelect,
    }),
    prisma.quoteRequest.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getQuoteRequest(
  id: string,
  providedUserId?: string,
): Promise<QuoteRequestDetail | null> {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  return prisma.quoteRequest.findFirst({
    where: { id, userId },
    select: quoteRequestDetailSelect,
  });
}

export async function createQuoteRequest(
  input: QuoteRequestInput,
  providedUserId?: string,
) {
  const userId = providedUserId ?? (await requireUser()).id;
  const payload = quoteRequestInputSchema.parse(input);
  await assertProductOwnership(userId, payload.productId);

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

  const created = await prisma.quoteRequest.create({
    data: {
      userId,
      clientId: client.id,
      productId: payload.productId ?? null,
      status: payload.status,
      customerName: payload.customer.name.trim(),
      customerEmail: normalizedEmail,
      customerPhone: payload.customer.phone ?? null,
      customerCompany: payload.customer.company ?? null,
      customerAddress: payload.customer.address ?? null,
      message: payload.message ?? null,
      formData: toJsonInput(payload.formData ?? null),
      sourcePath: payload.sourcePath ?? null,
      quoteId: payload.quoteId ?? null,
      attachments: payload.attachments?.length
        ? {
            create: payload.attachments.map((attachment) => ({
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
              mimeType: attachment.mimeType ?? null,
              sizeBytes: attachment.sizeBytes ?? null,
            })),
          }
        : undefined,
    },
  });

  queueQuoteRequestEmailJob({
    userId,
    quoteRequestId: created.id,
    to: created.customerEmail,
  }).catch((error) => {
    console.warn("[quote-requests] email enqueue failed", error);
  });

  return created;
}

export async function updateQuoteRequest(id: string, input: QuoteRequestInput) {
  const { id: userId } = await requireUser();
  const existing = await prisma.quoteRequest.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Demande introuvable");
  }

  const payload = quoteRequestInputSchema.parse({ ...input, id });
  await assertProductOwnership(userId, payload.productId);

  const normalizedEmail = payload.customer.email.trim().toLowerCase();
  const resolvedQuoteId = payload.quoteId ?? existing.quoteId ?? null;
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

  const data: Prisma.QuoteRequestUpdateInput = {
    client: {
      connect: { id: client.id },
    },
    product: payload.productId
      ? {
          connect: { id: payload.productId },
        }
      : {
          disconnect: true,
        },
    status: payload.status,
    customerName: payload.customer.name.trim(),
    customerEmail: normalizedEmail,
    customerPhone: payload.customer.phone ?? null,
    customerCompany: payload.customer.company ?? null,
    customerAddress: payload.customer.address ?? null,
    message: payload.message ?? null,
    formData: toJsonInput(payload.formData),
    sourcePath: payload.sourcePath ?? null,
    quote: resolvedQuoteId
      ? {
          connect: { id: resolvedQuoteId },
        }
      : {
          disconnect: true,
        },
  };

  if (payload.attachments) {
    data.attachments = {
      deleteMany: {},
      create: payload.attachments.map((attachment) => ({
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType ?? null,
        sizeBytes: attachment.sizeBytes ?? null,
      })),
    };
  }

  return prisma.quoteRequest.update({
    where: { id },
    data,
  });
}

function formatFormDataEntry(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function buildQuoteNotes(input: {
  message: string | null;
  formData: Prisma.JsonValue | null;
  sourcePath: string | null;
}) {
  const parts: string[] = [];
  if (input.message) {
    parts.push(`Demande:\n${input.message}`);
  }
  if (input.formData) {
    if (Array.isArray(input.formData)) {
      const formatted = input.formData
        .map((entry) => formatFormDataEntry(entry))
        .join("\n");
      if (formatted.trim()) {
        parts.push(`Formulaire:\n${formatted}`);
      }
    } else if (typeof input.formData === "object") {
      const entries = Object.entries(input.formData as Record<string, unknown>)
        .map(([key, value]) => `${key}: ${formatFormDataEntry(value)}`)
        .join("\n");
      if (entries.trim()) {
        parts.push(`Formulaire:\n${entries}`);
      }
    } else {
      parts.push(`Formulaire:\n${formatFormDataEntry(input.formData)}`);
    }
  }
  if (input.sourcePath) {
    parts.push(`Source: ${input.sourcePath}`);
  }
  return parts.length ? parts.join("\n\n") : null;
}

export async function convertQuoteRequestToQuote(
  id: string,
  providedUserId?: string,
) {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  const request = await prisma.quoteRequest.findFirst({
    where: { id, userId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          unit: true,
          priceHTCents: true,
          vatRate: true,
          defaultDiscountRate: true,
          defaultDiscountAmountCents: true,
        },
      },
      quote: true,
    },
  });

  if (!request) {
    throw new Error("Demande introuvable");
  }
  if (request.quote) {
    if (request.status !== QuoteRequestStatus.CONVERTED) {
      await prisma.quoteRequest.update({
        where: { id: request.id },
        data: {
          status: QuoteRequestStatus.CONVERTED,
        },
      });
    }
    return prisma.quote.findUniqueOrThrow({
      where: { id: request.quote.id },
      include: { lines: true },
    });
  }

  const settings = await getSettingsDocumentDefaults(userId);
  const product = request.product;
  const description = product?.name ?? "Prestation sur mesure";
  const unit = product?.unit ?? "unite";
  const unitPriceHTCents = product?.priceHTCents ?? 0;
  const vatRate = product?.vatRate ?? 0;
  const discount = resolveProductDiscount(product ?? {});
  const notes = buildQuoteNotes({
    message: request.message,
    formData: request.formData,
    sourcePath: request.sourcePath,
  });

  const quote = await createQuoteForUser(userId, {
    clientId: request.clientId,
    status: QuoteStatus.BROUILLON,
    reference: product?.name ? `Demande devis - ${product.name}` : "Demande devis",
    issueDate: new Date(),
    validUntil: null,
    currency: settings.defaultCurrency,
    notes,
    terms: null,
    lines: [
      {
        productId: product?.id ?? null,
        description,
        quantity: 1,
        unit,
        unitPriceHTCents,
        vatRate,
        discountRate: discount.discountRate,
        discountAmountCents: discount.discountAmountCents,
        fodecRate: null,
        position: 0,
      },
    ],
    taxes: {
      applyFodec: false,
      applyTimbre: false,
    },
  });

  await prisma.quoteRequest.update({
    where: { id: request.id },
    data: {
      quoteId: quote.id,
      status: QuoteRequestStatus.CONVERTED,
    },
  });

  return prisma.quote.findUniqueOrThrow({
    where: { id: quote.id },
    include: { lines: true },
  });
}
