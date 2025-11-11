import { unstable_cache, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
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
  isListedInCatalog: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export type ProductFilters = {
  search?: string;
  category?: string | "all";
  isActive?: boolean | "all";
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const CATEGORY_CACHE_SECONDS = 60;
const productListSelect = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  sku: true,
  name: true,
  category: true,
  priceHTCents: true,
  priceTTCCents: true,
  vatRate: true,
  defaultDiscountRate: true,
  isActive: true,
});

export type ProductListItem = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}>;

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const productCategoryTag = (userId: string) =>
  `products:categories:${userId}`;

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

function buildProductWhere(
  userId: string,
  filters: ProductFilters,
) {
  const { search, category = "all", isActive = "all" } = filters;
  return {
    userId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { sku: { contains: search, mode: Prisma.QueryMode.insensitive } },
            {
              description: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              category: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),
    ...(category === "all" ? {} : { category }),
    ...(isActive === "all" ? {} : { isActive }),
  };
}

export async function listProducts(
  filters: ProductFilters = {},
  providedUserId?: string,
): Promise<ProductListResult> {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();
  const {
    search,
    category = "all",
    isActive = "all",
    page: rawPage = 1,
    pageSize: rawPageSize = DEFAULT_PAGE_SIZE,
  } = filters;
  const page = normalizePage(rawPage);
  const pageSize = normalizePageSize(rawPageSize);

  const where = buildProductWhere(userId, {
    search,
    category,
    isActive,
  });

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [
        { name: "asc" },
        { id: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: productListSelect,
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

async function fetchCategories(userId: string) {
  const categories = await prisma.product.findMany({
    where: { userId, category: { not: null } },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  return categories
    .map((item) => item.category)
    .filter((value): value is string => Boolean(value));
}

export async function listProductCategories(providedUserId?: string) {
  const { id: userId } = providedUserId
    ? { id: providedUserId }
    : await requireUser();

  if (process.env.NODE_ENV === "test") {
    return fetchCategories(userId);
  }

  const cached = unstable_cache(
    () => fetchCategories(userId),
    ["products", "categories", userId],
    {
      revalidate: CATEGORY_CACHE_SECONDS,
      tags: [productCategoryTag(userId)],
    },
  );

  return cached();
}

function invalidateProductCaches(userId: string) {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  revalidateTag(productCategoryTag(userId), "max");
}

export async function getProduct(id: string) {
  const { id: userId } = await requireUser();
  return prisma.product.findFirst({
    where: { id, userId },
  });
}

export async function createProduct(input: ProductInput) {
  const { id: userId } = await requireUser();
  const payload = productSchema.parse(input);
  const { id: _id, ...data } = payload;
  void _id;
  const created = await prisma.product.create({
    data: {
      userId,
      ...data,
    },
  });
  invalidateProductCaches(userId);
  return created;
}

export async function updateProduct(
  id: string,
  input: ProductInput,
) {
  const { id: userId } = await requireUser();
  const existing = await prisma.product.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Produit introuvable");
  }
  const payload = productSchema.parse({ ...input, id });
  const { id: _id, ...data } = payload;
  void _id;
  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      userId,
    },
  });
  invalidateProductCaches(userId);
  return updated;
}

export async function deleteProduct(id: string) {
  const { id: userId } = await requireUser();
  const existing = await prisma.product.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Produit introuvable");
  }
  await prisma.product.delete({
    where: { id },
  });
  invalidateProductCaches(userId);
}
