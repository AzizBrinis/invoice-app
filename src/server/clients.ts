import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { ClientSource, Prisma } from "@prisma/client";
import type { ClientPickerOption } from "@/lib/client-payment-picker-types";
import { refreshTagForMutation } from "@/lib/cache-invalidation";

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
const CLIENT_LIST_CACHE_SECONDS = 45;
const isTestEnv = process.env.NODE_ENV === "test";

const clientFilterSelect = Prisma.validator<Prisma.ClientSelect>()({
  id: true,
  displayName: true,
});

const clientPickerSelect = Prisma.validator<Prisma.ClientSelect>()({
  id: true,
  displayName: true,
  companyName: true,
  email: true,
  isActive: true,
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

const clientDetailSelect = Prisma.validator<Prisma.ClientSelect>()({
  id: true,
  displayName: true,
  companyName: true,
  address: true,
  email: true,
  phone: true,
  vatNumber: true,
  notes: true,
  isActive: true,
  source: true,
  leadMetadata: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientListItem = Prisma.ClientGetPayload<{
  select: typeof clientListSelect;
}>;

export const clientListTag = (tenantId: string) => `clients:list:${tenantId}`;
export const clientDetailTag = (tenantId: string, clientId: string) =>
  `clients:detail:${tenantId}:${clientId}`;
export const clientFilterTag = (tenantId: string) =>
  `clients:filters:${tenantId}`;

function serializeClientFilters(
  filters: ClientFilters,
) {
  return JSON.stringify({
    search: filters.search?.trim() ?? "",
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
    isActive: filters.isActive ?? "all",
  });
}

type TenantAwareUser = {
  id: string;
  activeTenantId?: string | null;
  tenantId?: string | null;
};

export function getClientTenantId(user: TenantAwareUser) {
  return (user.activeTenantId ?? user.tenantId ?? user.id) as string;
}

export function revalidateClientFilters(tenantId: string) {
  if (isTestEnv) {
    return;
  }
  refreshTagForMutation(clientFilterTag(tenantId));
}

export function revalidateClientList(tenantId: string) {
  if (isTestEnv) {
    return;
  }

  refreshTagForMutation(clientListTag(tenantId));
}

export function revalidateClientDetail(tenantId: string, clientId: string) {
  if (isTestEnv) {
    return;
  }

  refreshTagForMutation(clientDetailTag(tenantId, clientId));
}

function normalizeLeadMetadata(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function resolveClientUserId(providedUserId?: string) {
  if (providedUserId) {
    return providedUserId;
  }

  const user = await requireUser();
  return getClientTenantId(user);
}

export async function listClients(
  filters: ClientFilters = {},
  userId?: string,
): Promise<{
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const resolvedUserId = await resolveClientUserId(userId);
  const {
    search,
    page: rawPage = 1,
    pageSize: rawPageSize = DEFAULT_PAGE_SIZE,
    isActive = "all",
  } = filters;
  const normalizedFilters = {
    search,
    page: rawPage,
    pageSize: rawPageSize,
    isActive,
  } as const;

  const page = normalizedFilters.page > 0 ? normalizedFilters.page : 1;
  const pageSize = Math.min(
    Math.max(normalizedFilters.pageSize, 1),
    MAX_PAGE_SIZE,
  );

  const runQuery = async () => {
    const where: Prisma.ClientWhereInput = {
      userId: resolvedUserId,
      ...(normalizedFilters.isActive === "all"
        ? {}
        : { isActive: normalizedFilters.isActive }),
      ...(normalizedFilters.search
        ? {
            OR: [
              {
                displayName: {
                  contains: normalizedFilters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                companyName: {
                  contains: normalizedFilters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                email: {
                  contains: normalizedFilters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                phone: {
                  contains: normalizedFilters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                vatNumber: {
                  contains: normalizedFilters.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
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
  };

  if (isTestEnv) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    ["clients", "list", resolvedUserId, serializeClientFilters(normalizedFilters)],
    {
      revalidate: CLIENT_LIST_CACHE_SECONDS,
      tags: [clientListTag(resolvedUserId)],
    },
  );

  return cached();
}

export async function listClientFilterOptions(userId?: string) {
  const tenantId = await resolveClientUserId(userId);

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

export async function searchClientPickerOptions(
  userId?: string,
  query?: string | null,
  limit = 10,
): Promise<ClientPickerOption[]> {
  const tenantId = await resolveClientUserId(userId);
  const normalizedQuery = query?.trim() || null;
  const take = Math.min(Math.max(Math.trunc(limit) || 10, 1), 20);
  const runQuery = () =>
    prisma.client.findMany({
      where: {
        userId: tenantId,
        ...(normalizedQuery
          ? {
              OR: [
                {
                  displayName: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
                {
                  companyName: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
                {
                  email: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { isActive: "desc" },
        { displayName: "asc" },
      ],
      take,
      select: clientPickerSelect,
    });

  if (isTestEnv) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    [
      "clients",
      "picker",
      tenantId,
      JSON.stringify({ query: normalizedQuery, limit: take }),
    ],
    {
      revalidate: CLIENT_LIST_CACHE_SECONDS,
      tags: [clientListTag(tenantId)],
    },
  );

  return cached();
}

export async function getClient(id: string, userId?: string) {
  const resolvedUserId = await resolveClientUserId(userId);
  const runQuery = () =>
    prisma.client.findFirst({
      where: { id, userId: resolvedUserId },
      select: clientDetailSelect,
    });

  if (isTestEnv) {
    return runQuery();
  }

  const cached = unstable_cache(
    runQuery,
    ["clients", "detail", resolvedUserId, id],
    {
      revalidate: CLIENT_LIST_CACHE_SECONDS,
      tags: [
        clientListTag(resolvedUserId),
        clientDetailTag(resolvedUserId, id),
      ],
    },
  );

  return cached();
}

export async function createClient(
  input: ClientInput,
  userId?: string,
) {
  const resolvedUserId = await resolveClientUserId(userId);
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
  const resolvedUserId = await resolveClientUserId(userId);
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
  const resolvedUserId = await resolveClientUserId(userId);
  const client = await prisma.client.findFirst({
    where: { id, userId: resolvedUserId },
  });
  if (!client) {
    throw new Error("Client introuvable");
  }
  const [invoiceCount, quoteCount, clientPaymentCount] =
    await prisma.$transaction([
    prisma.invoice.count({ where: { clientId: id, userId: resolvedUserId } }),
    prisma.quote.count({ where: { clientId: id, userId: resolvedUserId } }),
    prisma.clientPayment.count({
      where: { clientId: id, userId: resolvedUserId },
    }),
  ]);

  if (
    invoiceCount > 0 ||
    quoteCount > 0 ||
    clientPaymentCount > 0
  ) {
    throw new Error(
      `Impossible de supprimer ce client : ${invoiceCount} facture(s), ${quoteCount} devis et ${clientPaymentCount} paiement(s) associés.`,
    );
  }

  await prisma.client.delete({
    where: { id },
  });
}

export type ClientContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  clientId?: string | null;
};

export type ResolveClientOptions = {
  source?: ClientSource;
  notes?: string | null;
  leadMetadata?: Record<string, unknown> | null;
};

export async function resolveClientForContact(
  input: ClientContactInput,
  userId: string,
  options: ResolveClientOptions = {},
) {
  if (input.clientId) {
    const existing = await prisma.client.findFirst({
      where: { id: input.clientId, userId },
    });
    if (!existing) {
      throw new Error("Client introuvable");
    }
    return existing;
  }

  const normalizedEmail = input.email?.trim().toLowerCase() ?? null;
  if (normalizedEmail) {
    const existing = await prisma.client.findFirst({
      where: {
        userId,
        email: {
          equals: normalizedEmail,
          mode: Prisma.QueryMode.insensitive,
        },
      },
    });
    if (existing) {
      return existing;
    }
  }

  return createClient(
    {
      displayName: input.name.trim(),
      companyName: input.company ?? null,
      address: input.address ?? null,
      email: normalizedEmail,
      phone: input.phone ?? null,
      vatNumber: input.vatNumber ?? null,
      notes: options.notes ?? null,
      isActive: true,
      source: options.source ?? ClientSource.MANUAL,
      leadMetadata: options.leadMetadata ?? null,
    },
    userId,
  );
}
