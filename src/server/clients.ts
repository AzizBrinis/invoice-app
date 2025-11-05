import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

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
});

export type ClientInput = z.infer<typeof clientSchema>;

export type ClientFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  isActive?: boolean | "all";
};

const DEFAULT_PAGE_SIZE = 10;

export async function listClients(filters: ClientFilters = {}) {
  const { id: userId } = await requireUser();
  const {
    search,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    isActive = "all",
  } = filters;

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

export async function createClient(input: ClientInput) {
  const { id: userId } = await requireUser();
  const payload = clientSchema.parse(input);
  const { id: _id, ...data } = payload;
  void _id;
  return prisma.client.create({
    data: {
      userId,
      ...data,
    },
  });
}

export async function updateClient(id: string, input: ClientInput) {
  const { id: userId } = await requireUser();
  const existing = await prisma.client.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Client introuvable");
  }
  const payload = clientSchema.parse({ ...input, id });
  const { id: _id, ...data } = payload;
  void _id;
  return prisma.client.update({
    where: { id },
    data: {
      ...data,
      userId,
    },
  });
}

export async function deleteClient(id: string) {
  const { id: userId } = await requireUser();
  const client = await prisma.client.findFirst({
    where: { id, userId },
  });
  if (!client) {
    throw new Error("Client introuvable");
  }
  const [invoiceCount, quoteCount] = await prisma.$transaction([
    prisma.invoice.count({ where: { clientId: id, userId } }),
    prisma.quote.count({ where: { clientId: id, userId } }),
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
