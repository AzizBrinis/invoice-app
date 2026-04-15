import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateId } from "@/lib/id";
import { isSafeHttpOrRelativeUrl } from "@/lib/website/url-safety";

export const SITE_REVIEW_STATUSES = [
  "PENDING",
  "APPROVED",
  "DECLINED",
] as const;

export type SiteReviewStatus = (typeof SITE_REVIEW_STATUSES)[number];

export type SiteReviewListItem = {
  id: string;
  status: SiteReviewStatus;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorEmail: string | null;
  authorRole: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  moderatedAt: Date | null;
};

export type SiteReviewDetail = SiteReviewListItem & {
  websiteId: string;
  websiteSlug: string;
  sourcePath: string | null;
  sourceDomain: string | null;
  sourceSlug: string | null;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  moderationReason: string | null;
  moderatedByUserId: string | null;
  updatedAt: Date;
};

export type SiteReviewListResult = {
  items: SiteReviewListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  isReady: boolean;
};

const reviewStatusSchema = z.enum(SITE_REVIEW_STATUSES);
const nullableTextSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const siteReviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: nullableTextSchema.pipe(z.string().max(140).nullable()).optional(),
  body: z.string().trim().min(10).max(2000),
  authorName: z.string().trim().min(2).max(120),
  authorEmail: nullableTextSchema
    .pipe(z.string().email().max(160).nullable())
    .optional(),
  authorRole: nullableTextSchema.pipe(z.string().max(140).nullable()).optional(),
  avatarUrl: nullableTextSchema
    .pipe(
      z
        .string()
        .max(500)
        .refine(
          (value) => isSafeHttpOrRelativeUrl(value),
          "L'URL de photo doit commencer par http(s):// ou /",
        )
        .nullable(),
    )
    .optional(),
  status: reviewStatusSchema.default("PENDING"),
  sourcePath: nullableTextSchema.pipe(z.string().max(200).nullable()).optional(),
});

export type SiteReviewInput = z.input<typeof siteReviewInputSchema>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;

function isSiteReviewStatus(value: string): value is SiteReviewStatus {
  return (SITE_REVIEW_STATUSES as readonly string[]).includes(value);
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function isMissingSiteReviewTableError(error: unknown) {
  return (
    error instanceof Error &&
    /SiteReview|relation .* does not exist|does not exist/i.test(error.message)
  );
}

async function requireCurrentWebsiteForUser(userId: string) {
  const website = await prisma.websiteConfig.findFirst({
    where: { userId },
    select: {
      id: true,
      slug: true,
      customDomain: true,
    },
  });
  if (!website) {
    throw new Error("Configurez le site avant d'ajouter des avis.");
  }
  return website;
}

function revalidateSiteReviewPaths(options: {
  websiteSlug: string;
  reviewId?: string | null;
}) {
  revalidatePath("/site-web/avis");
  if (options.reviewId) {
    revalidatePath(`/site-web/avis/${options.reviewId}`);
  }
  revalidatePath(`/catalogue/${options.websiteSlug}`);
}

export async function createSiteReview(input: SiteReviewInput) {
  const parsed = siteReviewInputSchema.parse(input);
  const { id: userId } = await requireUser();
  const website = await requireCurrentWebsiteForUser(userId);
  const id = generateId("site-review");
  const moderatedAt = parsed.status === "PENDING" ? null : new Date();

  let rows: Array<{ id: string }>;
  try {
    rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO public."SiteReview" (
         "id",
         "userId",
         "websiteId",
         "rating",
         "title",
         "body",
         "authorName",
         "authorEmail",
         "authorRole",
         "avatarUrl",
         "status",
         "moderatedAt",
         "moderatedByUserId",
         "sourcePath",
         "sourceDomain",
         "sourceSlug"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING "id"`,
      id,
      userId,
      website.id,
      parsed.rating,
      parsed.title ?? null,
      parsed.body,
      parsed.authorName,
      normalizeNullableText(parsed.authorEmail ?? null)?.toLowerCase() ?? null,
      parsed.authorRole ?? null,
      parsed.avatarUrl ?? null,
      parsed.status,
      moderatedAt,
      moderatedAt ? userId : null,
      parsed.sourcePath ?? null,
      website.customDomain,
      website.slug,
    );
  } catch (error) {
    if (isMissingSiteReviewTableError(error)) {
      throw new Error("La table des avis site n'est pas encore installée.");
    }
    throw error;
  }

  revalidateSiteReviewPaths({ websiteSlug: website.slug, reviewId: id });
  return { id: rows[0]?.id ?? id };
}

export async function listSiteReviews(filters?: {
  search?: string;
  status?: SiteReviewStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<SiteReviewListResult> {
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
  const clauses = [`sr."userId" = $1`];
  if (status) {
    values.push(status);
    clauses.push(`sr."status" = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    clauses.push(`(
      sr."authorName" ILIKE $${values.length}
      OR sr."authorEmail" ILIKE $${values.length}
      OR sr."authorRole" ILIKE $${values.length}
      OR sr."title" ILIKE $${values.length}
      OR sr."body" ILIKE $${values.length}
    )`);
  }
  const whereSql = clauses.join(" AND ");

  let countRows: Array<{ count: string | number }>;
  let rows: SiteReviewListItem[];
  try {
    countRows = await prisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT COUNT(*) AS count
       FROM public."SiteReview" sr
       WHERE ${whereSql}`,
      ...values,
    );

    rows = await prisma.$queryRawUnsafe<SiteReviewListItem[]>(
      `SELECT
         sr."id",
         sr."status",
         sr."rating",
         sr."title",
         sr."body",
         sr."authorName",
         sr."authorEmail",
         sr."authorRole",
         sr."avatarUrl",
         sr."createdAt",
         sr."moderatedAt"
       FROM public."SiteReview" sr
       WHERE ${whereSql}
       ORDER BY
         CASE sr."status" WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,
         sr."createdAt" DESC,
         sr."id" DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      ...values,
      pageSize,
      (page - 1) * pageSize,
    );
  } catch (error) {
    if (isMissingSiteReviewTableError(error)) {
      console.warn("[site-reviews] SiteReview table is not installed.");
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        pageCount: 1,
        isReady: false,
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
    isReady: true,
  };
}

export async function getSiteReview(id: string) {
  const { id: userId } = await requireUser();
  let rows: SiteReviewDetail[];
  try {
    rows = await prisma.$queryRawUnsafe<SiteReviewDetail[]>(
      `SELECT
         sr."id",
         sr."status",
         sr."rating",
         sr."title",
         sr."body",
         sr."authorName",
         sr."authorEmail",
         sr."authorRole",
         sr."avatarUrl",
         sr."websiteId",
         w."slug" AS "websiteSlug",
         sr."sourcePath",
         sr."sourceDomain",
         sr."sourceSlug",
         sr."clientId",
         c."displayName" AS "clientName",
         c."email" AS "clientEmail",
         sr."moderationReason",
         sr."moderatedByUserId",
         sr."createdAt",
         sr."updatedAt",
         sr."moderatedAt"
       FROM public."SiteReview" sr
       JOIN public."WebsiteConfig" w ON w."id" = sr."websiteId"
       LEFT JOIN public."Client" c ON c."id" = sr."clientId"
       WHERE sr."id" = $1
         AND sr."userId" = $2
       LIMIT 1`,
      id,
      userId,
    );
  } catch (error) {
    if (isMissingSiteReviewTableError(error)) {
      console.warn("[site-reviews] SiteReview table is not installed.");
      return null;
    }
    throw error;
  }
  return rows[0] ?? null;
}

export async function updateSiteReview(
  id: string,
  input: SiteReviewInput,
  options?: { reason?: string | null },
) {
  const parsed = siteReviewInputSchema.parse(input);
  const { id: userId } = await requireUser();
  const moderatedAt = parsed.status === "PENDING" ? null : new Date();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; websiteSlug: string }>
  >(
    `UPDATE public."SiteReview" sr
     SET
       "rating" = $3,
       "title" = $4,
       "body" = $5,
       "authorName" = $6,
       "authorEmail" = $7,
       "authorRole" = $8,
       "avatarUrl" = $9,
       "status" = $10,
       "moderationReason" = $11,
       "moderatedAt" = $12,
       "moderatedByUserId" = $13,
       "sourcePath" = $14,
       "updatedAt" = NOW()
     FROM public."WebsiteConfig" w
     WHERE sr."websiteId" = w."id"
       AND sr."id" = $1
       AND sr."userId" = $2
     RETURNING sr."id", w."slug" AS "websiteSlug"`,
    id,
    userId,
    parsed.rating,
    parsed.title ?? null,
    parsed.body,
    parsed.authorName,
    normalizeNullableText(parsed.authorEmail ?? null)?.toLowerCase() ?? null,
    parsed.authorRole ?? null,
    parsed.avatarUrl ?? null,
    parsed.status,
    normalizeNullableText(options?.reason ?? null),
    moderatedAt,
    moderatedAt ? userId : null,
    parsed.sourcePath ?? null,
  );
  const updated = rows[0] ?? null;
  if (!updated) {
    throw new Error("Avis introuvable.");
  }
  revalidateSiteReviewPaths({ websiteSlug: updated.websiteSlug, reviewId: id });
  return updated;
}

export async function updateSiteReviewStatus(
  id: string,
  status: SiteReviewStatus,
  options?: { reason?: string | null },
) {
  const parsedStatus = reviewStatusSchema.parse(status);
  const { id: userId } = await requireUser();
  const moderatedAt = parsedStatus === "PENDING" ? null : new Date();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; websiteSlug: string }>
  >(
    `UPDATE public."SiteReview" sr
     SET
       "status" = $3,
       "moderationReason" = $4,
       "moderatedAt" = $5,
       "moderatedByUserId" = $6,
       "updatedAt" = NOW()
     FROM public."WebsiteConfig" w
     WHERE sr."websiteId" = w."id"
       AND sr."id" = $1
       AND sr."userId" = $2
     RETURNING sr."id", w."slug" AS "websiteSlug"`,
    id,
    userId,
    parsedStatus,
    normalizeNullableText(options?.reason ?? null),
    moderatedAt,
    moderatedAt ? userId : null,
  );
  const updated = rows[0] ?? null;
  if (!updated) {
    throw new Error("Avis introuvable.");
  }
  revalidateSiteReviewPaths({ websiteSlug: updated.websiteSlug, reviewId: id });
  return updated;
}

export function parseSiteReviewStatusFilter(
  value: string | string[] | undefined,
): SiteReviewStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isSiteReviewStatus(candidate) ? candidate : "all";
}
