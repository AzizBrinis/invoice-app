import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { ClientSource, Prisma } from "@prisma/client";

export const clientSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().min(2, "Nom requis"),
  companyName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  email: z.string().email("E-mail invalide").nullable().optional(),
  phone: z.string().nullable().optional(),
  vatNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  source: z.nativeEnum(ClientSource).default(ClientSource.MANUAL),
  leadMetadata: z.record(z.string(), z.any()).nullable().optional(),
});

export type ClientInput = z.infer<typeof clientSchema>;

export type ClientFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  isActive?: boolean | "all";
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const CLIENT_FILTER_CACHE_SECONDS = 60;
const isTestEnv = process.env.NODE_ENV === "test";

const clientFilterSelect = Prisma.validator<Prisma.ClientSelect>()({
  id: true,
  displayName: true,
});

const clientListSelect = Prisma.validator<Prisma.ClientSelect>()({
  id: true,
  displayName: true,
  companyName: true,
  email: true,
  phone: true,
  vatNumber: true,
  isActive: true,
  updatedAt: true,
});

export type ClientListItem = Prisma.ClientGetPayload<{
  select: typeof clientListSelect;
}>;

export const clientFilterTag = (tenantId: string) =>
  `clients:filters:${tenantId}`;

type TenantAwareUser = {
  id: string;
  tenantId?: string | null;
};

export function getClientTenantId(user: TenantAwareUser) {
  return (user.tenantId ?? user.id) as string;
}

export function revalidateClientFilters(tenantId: string) {
  if (isTestEnv) {
    return;
  }
  revalidateTag(clientFilterTag(tenantId), "max");
}

function normalizeLeadMetadata(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function listClients(
  filters: ClientFilters = {},
): Promise<{
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const { id: userId } = await requireUser();
  const {
    search,
    page: rawPage = 1,
    pageSize: rawPageSize = DEFAULT_PAGE_SIZE,
    isActive = "all",
  } = filters;

  const page = rawPage > 0 ? rawPage : 1;
  const pageSize = Math.min(Math.max(rawPageSize, 1), MAX_PAGE_SIZE);

  const where = {
    userId,
    ...(isActive === "all" ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { displayName: { contains: search } },
            { companyName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { vatNumber: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { displayName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: clientListSelect,
    }),
    prisma.client.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function listClientFilterOptions() {
  const user = await requireUser();
  const tenantId = getClientTenantId(user);

  const runQuery = () =>
    prisma.client.findMany({
      where: { userId: tenantId },
      orderBy: { displayName: "asc" },
      select: clientFilterSelect,
    });

  if (isTestEnv) {
    return runQuery();
  }

  const cached = unstable_cache(runQuery, ["clients", "filters", tenantId], {
    tags: [clientFilterTag(tenantId)],
    revalidate: CLIENT_FILTER_CACHE_SECONDS,
  });

  return cached();
}

export async function getClient(id: string) {
  const { id: userId } = await requireUser();
  return prisma.client.findFirst({
    where: { id, userId },
    include: {
      quotes: true,
      invoices: true,
    },
  });
}

export async function createClient(
  input: ClientInput,
  userId?: string,
) {
  const resolvedUserId = userId ?? (await requireUser()).id;
  const payload = clientSchema.parse(input);
  const { id: _id, ...data } = payload;
  void _id;
  const { leadMetadata, ...rest } = data;
  return prisma.client.create({
    data: {
      userId: resolvedUserId,
      ...rest,
      leadMetadata: normalizeLeadMetadata(leadMetadata),
    },
  });
}

export async function updateClient(
  id: string,
  input: ClientInput,
  userId?: string,
) {
  const resolvedUserId = userId ?? (await requireUser()).id;
  const existing = await prisma.client.findFirst({
    where: { id, userId: resolvedUserId },
  });
  if (!existing) {
    throw new Error("Client introuvable");
  }
  const payload = clientSchema.parse({ ...input, id });
  const { id: _id, ...data } = payload;
  void _id;
  const { leadMetadata, ...rest } = data;
  return prisma.client.update({
    where: { id },
    data: {
      ...rest,
      userId: resolvedUserId,
      leadMetadata: normalizeLeadMetadata(leadMetadata),
    },
  });
}

export async function deleteClient(id: string, userId?: string) {
  const resolvedUserId = userId ?? (await requireUser()).id;
  const client = await prisma.client.findFirst({
    where: { id, userId: resolvedUserId },
  });
  if (!client) {
    throw new Error("Client introuvable");
  }
  const [invoiceCount, quoteCount] = await prisma.$transaction([
    prisma.invoice.count({ where: { clientId: id, userId: resolvedUserId } }),
    prisma.quote.count({ where: { clientId: id, userId: resolvedUserId } }),
  ]);

  if (invoiceCount > 0 || quoteCount > 0) {
    throw new Error(
      `Impossible de supprimer ce client : ${invoiceCount} facture(s) et ${quoteCount} devis associés.`,
    );
  }

  await prisma.client.delete({
    where: { id },
  });
}
