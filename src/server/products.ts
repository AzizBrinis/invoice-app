import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const productSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, "SKU requis"),
  name: z.string().min(2, "Nom requis"),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unit: z.string().min(1, "Unité requise"),
  priceHTCents: z.number().int().nonnegative(),
  priceTTCCents: z.number().int().nonnegative(),
  vatRate: z.number().min(0).max(100),
  defaultDiscountRate: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export type ProductFilters = {
  search?: string;
  category?: string | "all";
  isActive?: boolean | "all";
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 10;

export async function listProducts(filters: ProductFilters = {}) {
  const {
    search,
    category = "all",
    isActive = "all",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters;

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            {
              description: {
                contains: search,
              },
            },
            {
              category: { contains: search },
            },
          ],
        }
      : {}),
    ...(category === "all" ? {} : { category }),
    ...(isActive === "all" ? {} : { isActive }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
  });
}

export async function createProduct(input: ProductInput) {
  const payload = productSchema.parse(input);
  const { id: _id, ...data } = payload;
  void _id;
  return prisma.product.create({
    data,
  });
}

export async function updateProduct(
  id: string,
  input: ProductInput,
) {
  const payload = productSchema.parse({ ...input, id });
  const { id: _id, ...data } = payload;
  void _id;
  return prisma.product.update({
    where: { id },
    data,
  });
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({
    where: { id },
  });
}
