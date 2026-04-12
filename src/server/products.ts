import { unstable_cache, revalidateTag } from "next/cache";
import { Prisma, ProductSaleMode } from "@/lib/db/prisma-server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sanitizeProductHtml } from "@/lib/product-html";
import { normalizeProductFaqItems } from "@/lib/product-seo";
import { slugify } from "@/lib/slug";
import { z } from "zod";

const productSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativeOrAbsoluteUrl = /^(?:https?:\/\/|\/|data:image\/)/i;
const MAX_COVER_URL_LENGTH = 400;
const MAX_COVER_DATA_URL_LENGTH = 1_000_000;
const SHORT_DESCRIPTION_HTML_MAX_LENGTH = 600;

const productSlugSchema = z
  .string()
  .min(1, "Slug requis")
  .max(80, "Le slug doit contenir au maximum 80 caractères.")
  .regex(
    productSlugPattern,
    "Utilisez uniquement des lettres minuscules, chiffres et tirets.",
  );

const jsonObjectOrArraySchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const productOptionValueSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  enabled: z.boolean().optional(),
  swatch: z.string().max(32).nullable().optional(),
  position: z.number().int().optional(),
  priceAdjustmentCents: z.number().int().nullable().optional(),
});

const productOptionGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  values: z.array(productOptionValueSchema).optional(),
});

const productOptionConfigSchema = z
  .object({
    colors: z.array(productOptionValueSchema).optional(),
    sizes: z.array(productOptionValueSchema).optional(),
    options: z.array(productOptionGroupSchema).optional(),
  })
  .optional();

const productVariantStockSchema = z
  .array(
    z.object({
      colorId: z.string().nullable().optional(),
      sizeId: z.string().nullable().optional(),
      stock: z.number().int().nonnegative().nullable().optional(),
    }),
  )
  .optional();

const productFaqItemSchema = z.object({
  question: z.string().min(3, "Question trop courte.").max(180),
  answer: z.string().min(8, "Réponse trop courte.").max(1200),
});

const productFaqItemsSchema = z
  .array(productFaqItemSchema)
  .max(8, "Ajoutez au maximum 8 questions fréquentes.")
  .optional();

export const productSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, "SKU requis"),
  name: z.string().min(2, "Nom requis"),
  publicSlug: productSlugSchema.optional(),
  saleMode: z.nativeEnum(ProductSaleMode).default(ProductSaleMode.INSTANT),
  description: z.string().nullable().optional(),
  descriptionHtml: z.string().max(20000).nullable().optional(),
  shortDescriptionHtml: z
    .string()
    .max(
      SHORT_DESCRIPTION_HTML_MAX_LENGTH,
      `La description courte doit contenir au maximum ${SHORT_DESCRIPTION_HTML_MAX_LENGTH} caractères.`,
    )
    .nullable()
    .optional(),
  excerpt: z.string().max(280).nullable().optional(),
  metaTitle: z.string().max(160).nullable().optional(),
  metaDescription: z.string().max(260).nullable().optional(),
  coverImageUrl: z
    .string()
    .nullable()
    .optional()
    .refine(
      (value) => !value || relativeOrAbsoluteUrl.test(value),
      "L'URL doit commencer par http(s):// ou /",
    )
    .refine(
      (value) => {
        if (!value) return true;
        const trimmed = value.trim();
        if (!trimmed) return true;
        if (trimmed.toLowerCase().startsWith("data:image/")) {
          return trimmed.length <= MAX_COVER_DATA_URL_LENGTH;
        }
        return trimmed.length <= MAX_COVER_URL_LENGTH;
      },
      "L'URL est trop longue.",
    ),
  gallery: z
    .array(
      z.union([
        z.string(),
        z.object({
          src: z.string().min(1),
          alt: z.string().nullable().optional(),
          isPrimary: z.boolean().optional(),
          position: z.number().int().optional(),
          id: z.string().optional(),
        }),
      ]),
    )
    .nullable()
    .optional(),
  faqItems: productFaqItemsSchema.nullable().optional(),
  quoteFormSchema: jsonObjectOrArraySchema.nullable().optional(),
  optionConfig: productOptionConfigSchema.nullable().optional(),
  variantStock: productVariantStockSchema.nullable().optional(),
  category: z.string().nullable().optional(),
  unit: z.string().min(1, "Unité requise"),
  stockQuantity: z.number().int().nonnegative().nullable().optional(),
  priceHTCents: z.number().int().nonnegative(),
  priceTTCCents: z.number().int().nonnegative(),
  vatRate: z.number().min(0).max(100),
  defaultDiscountRate: z.number().min(0).max(100).nullable().optional(),
  defaultDiscountAmountCents: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().default(true),
  isListedInCatalog: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (
    value.defaultDiscountRate != null &&
    value.defaultDiscountAmountCents != null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaultDiscountRate"],
      message: "Choisissez soit une remise en %, soit une remise fixe.",
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaultDiscountAmountCents"],
      message: "Choisissez soit une remise en %, soit une remise fixe.",
    });
  }
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
  defaultDiscountAmountCents: true,
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

function normalizeOptionalString(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeRequestedSlug(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  const slug = slugify(normalized);
  return slug || normalized.toLowerCase();
}

function normalizeProductPayload(input: ProductInput) {
  const normalizedDescription = normalizeOptionalString(input.description);
  const sanitizedHtml = normalizeOptionalString(
    input.descriptionHtml ? sanitizeProductHtml(input.descriptionHtml) : "",
  );
  const sanitizedShortDescriptionHtml = normalizeOptionalString(
    input.shortDescriptionHtml
      ? sanitizeProductHtml(input.shortDescriptionHtml)
      : "",
  );
  const normalizedMetaTitle = normalizeOptionalString(input.metaTitle);
  const normalizedMetaDescription = normalizeOptionalString(
    input.metaDescription,
  );
  const normalizedFaqItems = normalizeProductFaqItems(input.faqItems);
  return {
    ...input,
    publicSlug: normalizeRequestedSlug(input.publicSlug),
    description: normalizedDescription,
    descriptionHtml: sanitizedHtml,
    shortDescriptionHtml: sanitizedShortDescriptionHtml,
    metaTitle: normalizedMetaTitle,
    metaDescription: normalizedMetaDescription,
    faqItems: normalizedFaqItems.length ? normalizedFaqItems : null,
  };
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

function buildProductWriteData(
  data: Omit<ProductInput, "id" | "publicSlug">,
) {
  return {
    sku: data.sku,
    name: data.name,
    saleMode: data.saleMode,
    description: data.description ?? null,
    descriptionHtml: data.descriptionHtml ?? null,
    shortDescriptionHtml: data.shortDescriptionHtml ?? null,
    excerpt: data.excerpt ?? null,
    metaTitle: data.metaTitle ?? null,
    metaDescription: data.metaDescription ?? null,
    coverImageUrl: data.coverImageUrl ?? null,
    gallery: toJsonInput(data.gallery),
    faqItems: toJsonInput(data.faqItems),
    quoteFormSchema: toJsonInput(data.quoteFormSchema),
    optionConfig: toJsonInput(data.optionConfig),
    variantStock: toJsonInput(data.variantStock),
    category: data.category ?? null,
    unit: data.unit,
    stockQuantity: data.stockQuantity ?? null,
    priceHTCents: data.priceHTCents,
    priceTTCCents: data.priceTTCCents,
    vatRate: data.vatRate,
    defaultDiscountRate: data.defaultDiscountRate ?? null,
    defaultDiscountAmountCents: data.defaultDiscountAmountCents ?? null,
    isActive: data.isActive,
    isListedInCatalog: data.isListedInCatalog,
  };
}

async function findAvailableProductSlug(userId: string, base: string) {
  const cleaned = base.length ? base : "produit";
  let candidate = cleaned;
  let attempt = 1;
  while (true) {
    const existing = await prisma.product.findFirst({
      where: {
        userId,
        publicSlug: candidate,
      },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    attempt += 1;
    candidate = `${cleaned}-${attempt}`;
  }
}

async function resolveProductSlug(options: {
  userId: string;
  sku: string;
  name: string;
  requestedSlug?: string | null;
  existingSlug?: string | null;
}) {
  const requested = options.requestedSlug?.trim();
  if (!requested && options.existingSlug) {
    return options.existingSlug;
  }
  if (requested) {
    return requested;
  }
  const base = slugify(options.name || options.sku || "produit");
  return findAvailableProductSlug(options.userId, base || "produit");
}

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
  const payload = productSchema.parse(normalizeProductPayload(input));
  const { id: _id, publicSlug, ...data } = payload;
  void _id;
  const resolvedSlug = await resolveProductSlug({
    userId,
    sku: data.sku,
    name: data.name,
    requestedSlug: publicSlug,
  });
  const writeData: Prisma.ProductUncheckedCreateInput = {
    userId,
    publicSlug: resolvedSlug,
    ...buildProductWriteData(data),
  };
  const created = await prisma.product.create({
    data: writeData,
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
  const payload = productSchema.parse(normalizeProductPayload({ ...input, id }));
  const { id: _id, publicSlug, ...data } = payload;
  void _id;
  const resolvedSlug = await resolveProductSlug({
    userId,
    sku: data.sku,
    name: data.name,
    requestedSlug: publicSlug,
    existingSlug: existing.publicSlug,
  });
  const writeData: Prisma.ProductUncheckedUpdateInput = {
    userId,
    publicSlug: resolvedSlug,
    ...buildProductWriteData(data),
  };
  const updated = await prisma.product.update({
    where: { id },
    data: writeData,
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
