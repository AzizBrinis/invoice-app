import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  getClientFromSessionToken,
  getClientSessionTokenFromCookie,
} from "@/lib/client-auth";
import { generateId } from "@/lib/id";
import {
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

export const PRODUCT_REVIEW_STATUSES = [
  "PENDING",
  "APPROVED",
  "DECLINED",
] as const;

export type ProductReviewStatus = (typeof PRODUCT_REVIEW_STATUSES)[number];

export type ProductReviewListItem = {
  id: string;
  status: ProductReviewStatus;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorEmail: string | null;
  productId: string;
  productName: string;
  productSku: string;
  createdAt: Date;
  moderatedAt: Date | null;
};

export type ProductReviewDetail = ProductReviewListItem & {
  websiteId: string;
  websiteSlug: string;
  sourcePath: string | null;
  sourceDomain: string | null;
  sourceSlug: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  moderationReason: string | null;
  moderatedByUserId: string | null;
  updatedAt: Date;
};

const reviewStatusSchema = z.enum(PRODUCT_REVIEW_STATUSES);

const publicReviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(140).nullable().optional(),
  body: z.string().trim().min(10).max(2000),
  authorName: z.string().trim().max(120).nullable().optional(),
  authorEmail: z.string().trim().email().max(160).nullable().optional(),
  slug: z.string().nullable().optional(),
  path: z.string().max(180).nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  honeypot: z.string().optional(),
});

export type PublicReviewInput = z.input<typeof publicReviewSchema> & {
  domain?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;
const RECENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function isProductReviewStatus(value: string): value is ProductReviewStatus {
  return (PRODUCT_REVIEW_STATUSES as readonly string[]).includes(value);
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function isMissingProductReviewTableError(error: unknown) {
  return (
    error instanceof Error &&
    /ProductReview|relation .* does not exist|does not exist/i.test(error.message)
  );
}

async function resolveAuthenticatedClient(tenantUserId: string) {
  const token = await getClientSessionTokenFromCookie();
  if (!token) {
    return null;
  }
  const client = await getClientFromSessionToken(token);
  if (!client || !client.isActive || client.userId !== tenantUserId) {
    return null;
  }
  return client;
}

async function countRecentDuplicateReview(options: {
  userId: string;
  productId: string;
  authorEmail: string | null;
  ip: string | null;
}) {
  if (!options.authorEmail && !options.ip) {
    return 0;
  }

  let rows: Array<{ count: string | number }>;
  try {
    rows = await prisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT COUNT(*) AS count
       FROM public."ProductReview"
       WHERE "userId" = $1
         AND "productId" = $2
         AND "createdAt" >= $3
         AND (
           ($4::text IS NOT NULL AND "authorEmail" = $4)
           OR ($5::text IS NOT NULL AND "ipAddress" = $5)
         )`,
      options.userId,
      options.productId,
      new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS),
      options.authorEmail,
      options.ip,
    );
  } catch (error) {
    if (isMissingProductReviewTableError(error)) {
      throw new Error("Reviews are not available yet.");
    }
    throw error;
  }

  return Number(rows[0]?.count ?? 0);
}

export async function createPublicProductReview(input: PublicReviewInput) {
  const parsed = publicReviewSchema.parse(input);
  if (parsed.honeypot && parsed.honeypot.trim().length > 0) {
    throw new Error("Review blocked.");
  }

  const slug = normalizeCatalogSlugInput(parsed.slug ?? null);
  const website = await resolveCatalogWebsite({
    slug,
    domain: input.domain ?? null,
    preview: parsed.mode === "preview",
  });
  if (!website) {
    throw new Error("Site unavailable.");
  }

  const product = await prisma.product.findFirst({
    where: {
      id: parsed.productId,
      userId: website.userId,
      isListedInCatalog: true,
      ...(website.showInactiveProducts ? {} : { isActive: true }),
    },
    select: {
      id: true,
      name: true,
    },
  });
  if (!product) {
    throw new Error("Product not found.");
  }

  const client = await resolveAuthenticatedClient(website.userId);
  const authorEmail =
    normalizeNullableText(parsed.authorEmail)?.toLowerCase() ??
    normalizeNullableText(client?.email)?.toLowerCase();
  const authorName =
    normalizeNullableText(parsed.authorName) ??
    normalizeNullableText(client?.displayName) ??
    authorEmail;

  if (!authorName) {
    throw new Error("Please enter your name.");
  }
  if (!authorEmail) {
    throw new Error("Please enter a valid email address.");
  }

  const title = normalizeNullableText(parsed.title);
  const body = parsed.body.trim();
  if (/\bhttps?:\/\//i.test(body) || /www\./i.test(body)) {
    throw new Error("Reviews cannot contain external links.");
  }

  if (parsed.mode === "preview") {
    return { status: "preview-only" as const };
  }

  const duplicateCount = await countRecentDuplicateReview({
    userId: website.userId,
    productId: product.id,
    authorEmail,
    ip: input.ip ?? null,
  });
  if (duplicateCount > 0) {
    throw new Error("Your review has already been received.");
  }

  const id = generateId("review");
  let rows: Array<{ id: string }>;
  try {
    rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO public."ProductReview" (
         "id",
         "userId",
         "websiteId",
         "productId",
         "clientId",
         "rating",
         "title",
         "body",
         "authorName",
         "authorEmail",
         "status",
         "sourcePath",
         "sourceDomain",
         "sourceSlug",
         "ipAddress",
         "userAgent"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11, $12, $13, $14, $15)
       RETURNING "id"`,
      id,
      website.userId,
      website.id,
      product.id,
      client?.id ?? null,
      parsed.rating,
      title,
      body,
      authorName,
      authorEmail,
      normalizeCatalogPathInput(parsed.path ?? null),
      input.domain ?? website.customDomain,
      website.slug,
      input.ip ?? null,
      input.userAgent ?? null,
    );
  } catch (error) {
    if (isMissingProductReviewTableError(error)) {
      throw new Error("Reviews are not available yet.");
    }
    throw error;
  }

  revalidatePath("/site-web/avis");
  return { status: "created" as const, id: rows[0]?.id ?? id };
}

export async function listProductReviews(filters?: {
  search?: string;
  status?: ProductReviewStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{
  items: ProductReviewListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const { id: userId } = await requireUser();
  const page = Math.max(filters?.page ?? 1, 1);
  const pageSize = Math.min(
    Math.max(filters?.pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const search = filters?.search?.trim();
  const status =
    filters?.status && filters.status !== "all" ? filters.status : null;

  const values: unknown[] = [userId];
  const clauses = [`pr."userId" = $1`];
  if (status) {
    values.push(status);
    clauses.push(`pr."status" = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    clauses.push(`(
      pr."authorName" ILIKE $${values.length}
      OR pr."authorEmail" ILIKE $${values.length}
      OR pr."title" ILIKE $${values.length}
      OR pr."body" ILIKE $${values.length}
      OR p."name" ILIKE $${values.length}
      OR p."sku" ILIKE $${values.length}
    )`);
  }
  const whereSql = clauses.join(" AND ");

  let countRows: Array<{ count: string | number }>;
  let rows: ProductReviewListItem[];
  try {
    countRows = await prisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT COUNT(*) AS count
       FROM public."ProductReview" pr
       JOIN public."Product" p ON p."id" = pr."productId"
       WHERE ${whereSql}`,
      ...values,
    );

    rows = await prisma.$queryRawUnsafe<ProductReviewListItem[]>(
      `SELECT
         pr."id",
         pr."status",
         pr."rating",
         pr."title",
         pr."body",
         pr."authorName",
         pr."authorEmail",
         pr."productId",
         p."name" AS "productName",
         p."sku" AS "productSku",
         pr."createdAt",
         pr."moderatedAt"
       FROM public."ProductReview" pr
       JOIN public."Product" p ON p."id" = pr."productId"
       WHERE ${whereSql}
       ORDER BY
         CASE pr."status" WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,
         pr."createdAt" DESC,
         pr."id" DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      ...values,
      pageSize,
      (page - 1) * pageSize,
    );
  } catch (error) {
    if (isMissingProductReviewTableError(error)) {
      console.warn("[product-reviews] ProductReview table is not installed.");
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        pageCount: 1,
      };
    }
    throw error;
  }

  const total = Number(countRows[0]?.count ?? 0);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return {
    items: rows,
    total,
    page,
    pageSize,
    pageCount,
  };
}

export async function getProductReview(id: string) {
  const { id: userId } = await requireUser();
  let rows: ProductReviewDetail[];
  try {
    rows = await prisma.$queryRawUnsafe<ProductReviewDetail[]>(
      `SELECT
         pr."id",
         pr."status",
         pr."rating",
         pr."title",
         pr."body",
         pr."authorName",
         pr."authorEmail",
         pr."productId",
         p."name" AS "productName",
         p."sku" AS "productSku",
         pr."websiteId",
         w."slug" AS "websiteSlug",
         pr."sourcePath",
         pr."sourceDomain",
         pr."sourceSlug",
         pr."ipAddress",
         pr."userAgent",
         pr."clientId",
         c."displayName" AS "clientName",
         c."email" AS "clientEmail",
         pr."moderationReason",
         pr."moderatedByUserId",
         pr."createdAt",
         pr."updatedAt",
         pr."moderatedAt"
       FROM public."ProductReview" pr
       JOIN public."Product" p ON p."id" = pr."productId"
       JOIN public."WebsiteConfig" w ON w."id" = pr."websiteId"
       LEFT JOIN public."Client" c ON c."id" = pr."clientId"
       WHERE pr."id" = $1
         AND pr."userId" = $2
       LIMIT 1`,
      id,
      userId,
    );
  } catch (error) {
    if (isMissingProductReviewTableError(error)) {
      console.warn("[product-reviews] ProductReview table is not installed.");
      return null;
    }
    throw error;
  }
  return rows[0] ?? null;
}

export async function updateProductReviewStatus(
  id: string,
  status: ProductReviewStatus,
  options?: { reason?: string | null },
) {
  const parsedStatus = reviewStatusSchema.parse(status);
  const { id: userId } = await requireUser();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; productId: string; websiteSlug: string }>
  >(
    `UPDATE public."ProductReview" pr
     SET
       "status" = $3,
       "moderationReason" = $4,
       "moderatedAt" = NOW(),
       "moderatedByUserId" = $2,
       "updatedAt" = NOW()
     FROM public."WebsiteConfig" w
     WHERE pr."websiteId" = w."id"
       AND pr."id" = $1
       AND pr."userId" = $2
     RETURNING pr."id", pr."productId", w."slug" AS "websiteSlug"`,
    id,
    userId,
    parsedStatus,
    normalizeNullableText(options?.reason ?? null),
  );
  const updated = rows[0] ?? null;
  if (!updated) {
    throw new Error("Avis introuvable.");
  }
  revalidatePath("/site-web/avis");
  revalidatePath(`/site-web/avis/${id}`);
  revalidatePath(`/catalogue/${updated.websiteSlug}`);
  return updated;
}

export function parseProductReviewStatusFilter(
  value: string | string[] | undefined,
): ProductReviewStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isProductReviewStatus(candidate) ? candidate : "all";
}
