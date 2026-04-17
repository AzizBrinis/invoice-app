import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateId } from "@/lib/id";
import { slugify } from "@/lib/slug";
import {
  renderWebsiteBlogContent,
  WEBSITE_BLOG_MAX_BODY_LENGTH,
  WEBSITE_BLOG_MAX_EXCERPT_LENGTH,
  type WebsiteBlogHeading,
} from "@/lib/website/blog";

export const SITE_BLOG_POST_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "SCHEDULED",
] as const;

export type SiteBlogPostStatus = (typeof SITE_BLOG_POST_STATUSES)[number];

export type SiteBlogPostListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  tags: string[];
  authorName: string;
  status: SiteBlogPostStatus;
  publishDate: string | null;
  featured: boolean;
  coverImageUrl: string | null;
  readingTimeMinutes: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  isLive: boolean;
  effectiveStatus: SiteBlogPostStatus | "LIVE";
};

export type SiteBlogPostDetail = SiteBlogPostListItem & {
  websiteId: string;
  websiteSlug: string;
  socialImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  bodyHtml: string;
  headings: WebsiteBlogHeading[];
};

export type SiteBlogPostListResult = {
  items: SiteBlogPostListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  isReady: boolean;
};

export type PublicSiteBlogPostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  socialImageUrl: string | null;
  category: string | null;
  tags: string[];
  authorName: string;
  publishDate: string | null;
  featured: boolean;
  readingTimeMinutes: number;
  wordCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
};

export type PublicSiteBlogPost = PublicSiteBlogPostSummary & {
  bodyHtml: string;
  headings: WebsiteBlogHeading[];
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;
const IMAGE_SOURCE_PATTERN = /^(?:https?:\/\/|\/|data:image\/)/i;
const MAX_IMAGE_URL_LENGTH = 1_000_000;
const nullableTextSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Utilisez une date valide (YYYY-MM-DD).");

const blogImageSourceSchema = nullableTextSchema
  .pipe(
    z
      .string()
      .max(MAX_IMAGE_URL_LENGTH, "L'image est trop volumineuse.")
      .refine(
        (value) => IMAGE_SOURCE_PATTERN.test(value),
        "L'URL doit commencer par http(s)://, / ou data:image/.",
      )
      .nullable(),
  )
  .optional();

const siteBlogPostInputSchema = z
  .object({
    title: z.string().trim().min(4).max(180),
    slug: nullableTextSchema.pipe(z.string().max(180).nullable()).optional(),
    excerpt: nullableTextSchema
      .pipe(z.string().max(WEBSITE_BLOG_MAX_EXCERPT_LENGTH).nullable())
      .optional(),
    bodyHtml: z.string().trim().min(20).max(WEBSITE_BLOG_MAX_BODY_LENGTH),
    coverImageUrl: blogImageSourceSchema,
    socialImageUrl: blogImageSourceSchema,
    category: nullableTextSchema.pipe(z.string().max(80).nullable()).optional(),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(12)
      .default([]),
    authorName: z.string().trim().min(2).max(120),
    status: z.enum(SITE_BLOG_POST_STATUSES).default("DRAFT"),
    publishDate: dateOnlySchema.nullable().optional(),
    featured: z.boolean().default(false),
    metaTitle: nullableTextSchema.pipe(z.string().max(160).nullable()).optional(),
    metaDescription: nullableTextSchema
      .pipe(z.string().max(260).nullable())
      .optional(),
  })
  .superRefine((value, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const rendered = renderWebsiteBlogContent(value.bodyHtml, value.excerpt);
    if (rendered.wordCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyHtml"],
        message: "Ajoutez du contenu lisible dans l'article.",
      });
    }
    if (value.status === "SCHEDULED" && !value.publishDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishDate"],
        message: "Choisissez une date de publication pour programmer l'article.",
      });
    }
    if (
      value.status === "PUBLISHED" &&
      value.publishDate &&
      value.publishDate > today
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishDate"],
        message:
          "Une date future doit utiliser le statut Programmé plutôt que Publié.",
      });
    }
  });

function isSiteBlogPostStatus(value: string): value is SiteBlogPostStatus {
  return (SITE_BLOG_POST_STATUSES as readonly string[]).includes(value);
}

function isMissingSiteBlogPostTableError(error: unknown) {
  return (
    error instanceof Error &&
    /WebsiteBlogPost|relation .* does not exist|does not exist/i.test(
      error.message,
    )
  );
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeDateOnly(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (match?.[0]) {
    return match[0];
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

function normalizeTags(value: unknown) {
  let source: unknown[] = [];
  if (Array.isArray(value)) {
    source = value;
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      source = Array.isArray(parsed) ? parsed : [];
    } catch {
      source = [];
    }
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  source.forEach((entry) => {
    const tag = normalizeNullableText(
      typeof entry === "string" ? entry : String(entry ?? ""),
    );
    if (!tag) {
      return;
    }
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    tags.push(tag);
  });
  return tags;
}

export type SiteBlogPostInput = z.input<typeof siteBlogPostInputSchema>;

function serializeSiteBlogPostListItem(row: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  tags: unknown;
  authorName: string;
  status: string;
  publishDate: Date | string | null;
  featured: boolean;
  coverImageUrl: string | null;
  readingTimeMinutes: number;
  wordCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}): SiteBlogPostListItem {
  const publishDate = normalizeDateOnly(row.publishDate);
  const today = new Date().toISOString().slice(0, 10);
  const isLive =
    row.status === "PUBLISHED" ||
    (row.status === "SCHEDULED" &&
      publishDate !== null &&
      publishDate <= today);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    category: row.category,
    tags: normalizeTags(row.tags),
    authorName: row.authorName,
    status: isSiteBlogPostStatus(row.status) ? row.status : "DRAFT",
    publishDate,
    featured: row.featured,
    coverImageUrl: row.coverImageUrl,
    readingTimeMinutes: Math.max(1, row.readingTimeMinutes ?? 1),
    wordCount: Math.max(0, row.wordCount ?? 0),
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    isLive,
    effectiveStatus: isLive ? "LIVE" : isSiteBlogPostStatus(row.status) ? row.status : "DRAFT",
  };
}

function serializePublicSiteBlogPostSummary(row: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  socialImageUrl: string | null;
  category: string | null;
  tags: unknown;
  authorName: string;
  publishDate: Date | string | null;
  featured: boolean;
  readingTimeMinutes: number;
  wordCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
}): PublicSiteBlogPostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    socialImageUrl: row.socialImageUrl,
    category: row.category,
    tags: normalizeTags(row.tags),
    authorName: row.authorName,
    publishDate: normalizeDateOnly(row.publishDate),
    featured: row.featured,
    readingTimeMinutes: Math.max(1, row.readingTimeMinutes ?? 1),
    wordCount: Math.max(0, row.wordCount ?? 0),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
  };
}

function serializeSiteBlogPostDetail(row: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  tags: unknown;
  authorName: string;
  status: string;
  publishDate: Date | string | null;
  featured: boolean;
  coverImageUrl: string | null;
  socialImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  bodyHtml: string;
  readingTimeMinutes: number;
  wordCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  websiteId: string;
  websiteSlug: string;
}): SiteBlogPostDetail {
  const base = serializeSiteBlogPostListItem(row);
  const rendered = renderWebsiteBlogContent(row.bodyHtml, row.excerpt);
  return {
    ...base,
    websiteId: row.websiteId,
    websiteSlug: row.websiteSlug,
    socialImageUrl: row.socialImageUrl,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    bodyHtml: rendered.html,
    headings: rendered.headings,
  };
}

function serializePublicSiteBlogPost(row: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  tags: unknown;
  authorName: string;
  publishDate: Date | string | null;
  featured: boolean;
  coverImageUrl: string | null;
  socialImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  bodyHtml: string;
  readingTimeMinutes: number;
  wordCount: number;
}): PublicSiteBlogPost {
  const summary = serializePublicSiteBlogPostSummary(row);
  const rendered = renderWebsiteBlogContent(row.bodyHtml, row.excerpt);
  return {
    ...summary,
    bodyHtml: rendered.html,
    headings: rendered.headings,
  };
}

function parseStatusFilter(
  value: string | string[] | undefined,
): SiteBlogPostStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isSiteBlogPostStatus(candidate) ? candidate : "all";
}

export function parseSiteBlogPostStatusFilter(
  value: string | string[] | undefined,
) {
  return parseStatusFilter(value);
}

export function parseSiteBlogPostFeaturedFilter(
  value: string | string[] | undefined,
): "all" | "featured" | "standard" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate === "featured" ||
    candidate === "standard" ||
    candidate === "all"
  ) {
    return candidate;
  }
  return "all";
}

async function resolveTenantUserId(userId?: string) {
  if (userId) {
    return userId;
  }
  const user = await requireUser();
  return user.activeTenantId ?? user.tenantId ?? user.id;
}

async function requireCurrentWebsiteForUser(userId: string) {
  const website = await prisma.websiteConfig.findFirst({
    where: { userId },
    select: {
      id: true,
      slug: true,
    },
  });
  if (!website) {
    throw new Error("Configurez le site avant de gérer des articles.");
  }
  return website;
}

function normalizeStatusForStorage(
  status: SiteBlogPostStatus,
  publishDate: string | null,
) {
  if (status === "PUBLISHED") {
    return {
      status,
      publishDate: publishDate ?? new Date().toISOString().slice(0, 10),
    };
  }
  return {
    status,
    publishDate,
  };
}

function buildSlug(input: { title: string; slug?: string | null }) {
  const source = normalizeNullableText(input.slug) ?? input.title;
  const normalized = slugify(source);
  if (!normalized) {
    throw new ZodError([
      {
        code: "custom",
        path: ["slug"],
        message: "Impossible de générer un slug valide pour cet article.",
      },
    ]);
  }
  if (normalized.length > 180) {
    throw new ZodError([
      {
        code: "custom",
        path: ["slug"],
        message: "Le slug ne doit pas dépasser 180 caractères.",
      },
    ]);
  }
  return normalized;
}

function revalidateSiteBlogPaths(options: {
  websiteSlug: string;
  postId?: string | null;
  slug?: string | null;
  previousSlug?: string | null;
}) {
  revalidatePath("/site-web/blogs");
  revalidatePath("/site-web");
  revalidatePath("/preview");
  revalidatePath("/catalogue");
  revalidatePath("/catalogue/[...segments]", "page");

  if (options.postId) {
    revalidatePath(`/site-web/blogs/${options.postId}`);
  }

  revalidatePath(`/catalogue/${options.websiteSlug}`);
  revalidatePath(`/catalogue/${options.websiteSlug}/blog`);

  if (options.slug) {
    revalidatePath(`/catalogue/${options.websiteSlug}/blog/${options.slug}`);
  }

  if (options.previousSlug && options.previousSlug !== options.slug) {
    revalidatePath(
      `/catalogue/${options.websiteSlug}/blog/${options.previousSlug}`,
    );
  }
}

async function ensureUniqueSlug(options: {
  websiteId: string;
  slug: string;
  currentId?: string | null;
}) {
  let rows: Array<{ id: string }>;
  try {
    rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id"
       FROM public."WebsiteBlogPost"
       WHERE "websiteId" = $1
         AND "slug" = $2
       LIMIT 1`,
      options.websiteId,
      options.slug,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      throw new Error("La table des articles de blog n'est pas encore installée.");
    }
    throw error;
  }

  if (rows[0]?.id && rows[0].id !== options.currentId) {
    throw new ZodError([
      {
        code: "custom",
        path: ["slug"],
        message: "Ce slug est déjà utilisé par un autre article.",
      },
    ]);
  }
}

function buildPersistedBlogFields(input: z.infer<typeof siteBlogPostInputSchema>) {
  const rendered = renderWebsiteBlogContent(input.bodyHtml, input.excerpt);
  const tags = normalizeTags(input.tags);
  const normalized = normalizeStatusForStorage(
    input.status,
    input.publishDate ?? null,
  );

  return {
    title: input.title.trim(),
    excerpt: normalizeNullableText(rendered.excerpt),
    bodyHtml: rendered.html,
    coverImageUrl: input.coverImageUrl ?? null,
    socialImageUrl: input.socialImageUrl ?? null,
    category: input.category ?? null,
    tags,
    authorName: input.authorName.trim(),
    status: normalized.status,
    publishDate: normalized.publishDate,
    featured: input.featured,
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    wordCount: rendered.wordCount,
    readingTimeMinutes: rendered.readingTimeMinutes,
  };
}

export async function listSiteBlogPostCategories(userId?: string) {
  const tenantUserId = await resolveTenantUserId(userId);
  let rows: Array<{ category: string | null }>;
  try {
    rows = await prisma.$queryRawUnsafe<Array<{ category: string | null }>>(
      `SELECT DISTINCT "category"
       FROM public."WebsiteBlogPost"
       WHERE "userId" = $1
         AND "category" IS NOT NULL
         AND BTRIM("category") <> ''
       ORDER BY "category" ASC`,
      tenantUserId,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      return [] as string[];
    }
    throw error;
  }

  return rows
    .map((row) => normalizeNullableText(row.category))
    .filter((entry): entry is string => Boolean(entry));
}

export async function listSiteBlogPosts(filters?: {
  search?: string;
  status?: SiteBlogPostStatus | "all";
  category?: string;
  featured?: "all" | "featured" | "standard";
  page?: number;
  pageSize?: number;
}, userId?: string): Promise<SiteBlogPostListResult> {
  const tenantUserId = await resolveTenantUserId(userId);
  const page = Math.max(filters?.page ?? 1, 1);
  const pageSize = Math.min(
    Math.max(filters?.pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const search = normalizeNullableText(filters?.search);
  const status =
    filters?.status && filters.status !== "all" ? filters.status : null;
  const category = normalizeNullableText(filters?.category);
  const featured =
    filters?.featured && filters.featured !== "all" ? filters.featured : null;

  const values: unknown[] = [tenantUserId];
  const clauses = [`bp."userId" = $1`];

  if (status) {
    values.push(status);
    clauses.push(`bp."status" = $${values.length}`);
  }
  if (category) {
    values.push(category);
    clauses.push(`bp."category" = $${values.length}`);
  }
  if (featured === "featured") {
    clauses.push(`bp."featured" = TRUE`);
  } else if (featured === "standard") {
    clauses.push(`bp."featured" = FALSE`);
  }
  if (search) {
    values.push(`%${search}%`);
    const searchParamIndex = values.length;
    clauses.push(`(
      bp."title" ILIKE $${searchParamIndex}
      OR bp."slug" ILIKE $${searchParamIndex}
      OR bp."excerpt" ILIKE $${searchParamIndex}
      OR bp."authorName" ILIKE $${searchParamIndex}
      OR bp."category" ILIKE $${searchParamIndex}
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(bp."tags") AS tag(value)
        WHERE tag.value ILIKE $${searchParamIndex}
      )
    )`);
  }

  const whereSql = clauses.join(" AND ");

  let countRows: Array<{ count: string | number }>;
  let rows: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    category: string | null;
    tags: unknown;
    authorName: string;
    status: string;
    publishDate: Date | string | null;
    featured: boolean;
    coverImageUrl: string | null;
    readingTimeMinutes: number;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  try {
    countRows = await prisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT COUNT(*) AS count
       FROM public."WebsiteBlogPost" bp
       WHERE ${whereSql}`,
      ...values,
    );
    rows = await prisma.$queryRawUnsafe<typeof rows>(
      `SELECT
         bp."id",
         bp."title",
         bp."slug",
         bp."excerpt",
         bp."category",
         bp."tags",
         bp."authorName",
         bp."status",
         bp."publishDate",
         bp."featured",
         bp."coverImageUrl",
         bp."readingTimeMinutes",
         bp."wordCount",
         bp."createdAt",
         bp."updatedAt"
       FROM public."WebsiteBlogPost" bp
       WHERE ${whereSql}
       ORDER BY
         bp."featured" DESC,
         COALESCE(bp."publishDate", DATE(bp."createdAt")) DESC,
         bp."updatedAt" DESC,
         bp."id" DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      ...values,
      pageSize,
      (page - 1) * pageSize,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      console.warn("[site-blog-posts] WebsiteBlogPost table is not installed.");
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
    items: rows.map(serializeSiteBlogPostListItem),
    total,
    page,
    pageSize,
    pageCount,
    isReady: true,
  };
}

export async function getSiteBlogPost(id: string, userId?: string) {
  const tenantUserId = await resolveTenantUserId(userId);
  let rows: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    category: string | null;
    tags: unknown;
    authorName: string;
    status: string;
    publishDate: Date | string | null;
    featured: boolean;
    coverImageUrl: string | null;
    socialImageUrl: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    bodyHtml: string;
    readingTimeMinutes: number;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
    websiteId: string;
    websiteSlug: string;
  }>;
  try {
    rows = await prisma.$queryRawUnsafe<typeof rows>(
      `SELECT
         bp."id",
         bp."title",
         bp."slug",
         bp."excerpt",
         bp."category",
         bp."tags",
         bp."authorName",
         bp."status",
         bp."publishDate",
         bp."featured",
         bp."coverImageUrl",
         bp."socialImageUrl",
         bp."metaTitle",
         bp."metaDescription",
         bp."bodyHtml",
         bp."readingTimeMinutes",
         bp."wordCount",
         bp."createdAt",
         bp."updatedAt",
         bp."websiteId",
         w."slug" AS "websiteSlug"
       FROM public."WebsiteBlogPost" bp
       JOIN public."WebsiteConfig" w ON w."id" = bp."websiteId"
       WHERE bp."id" = $1
         AND bp."userId" = $2
       LIMIT 1`,
      id,
      tenantUserId,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      console.warn("[site-blog-posts] WebsiteBlogPost table is not installed.");
      return null;
    }
    throw error;
  }

  const row = rows[0];
  return row ? serializeSiteBlogPostDetail(row) : null;
}

export async function createSiteBlogPost(input: SiteBlogPostInput) {
  const user = await requireUser();
  const tenantUserId = user.activeTenantId ?? user.tenantId ?? user.id;
  const website = await requireCurrentWebsiteForUser(tenantUserId);
  const parsed = siteBlogPostInputSchema.parse(input);
  const slug = buildSlug({
    title: parsed.title,
    slug: parsed.slug,
  });
  await ensureUniqueSlug({
    websiteId: website.id,
    slug,
  });
  const payload = buildPersistedBlogFields(parsed);
  const id = generateId("blog");

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public."WebsiteBlogPost" (
         "id",
         "userId",
         "websiteId",
         "title",
         "slug",
         "excerpt",
         "bodyHtml",
         "coverImageUrl",
         "socialImageUrl",
         "category",
         "tags",
         "authorName",
         "status",
         "publishDate",
         "featured",
         "metaTitle",
         "metaDescription",
         "wordCount",
         "readingTimeMinutes"
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19
       )`,
      id,
      tenantUserId,
      website.id,
      payload.title,
      slug,
      payload.excerpt,
      payload.bodyHtml,
      payload.coverImageUrl,
      payload.socialImageUrl,
      payload.category,
      JSON.stringify(payload.tags),
      payload.authorName,
      payload.status,
      payload.publishDate,
      payload.featured,
      payload.metaTitle,
      payload.metaDescription,
      payload.wordCount,
      payload.readingTimeMinutes,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      throw new Error("La table des articles de blog n'est pas encore installée.");
    }
    throw error;
  }

  revalidateSiteBlogPaths({
    websiteSlug: website.slug,
    postId: id,
    slug,
  });
  return getSiteBlogPost(id, tenantUserId);
}

export async function updateSiteBlogPost(
  id: string,
  input: SiteBlogPostInput,
) {
  const user = await requireUser();
  const tenantUserId = user.activeTenantId ?? user.tenantId ?? user.id;
  const existing = await getSiteBlogPost(id, tenantUserId);
  if (!existing) {
    throw new Error("Cet article est introuvable.");
  }

  const parsed = siteBlogPostInputSchema.parse(input);
  const slug = buildSlug({
    title: parsed.title,
    slug: parsed.slug,
  });
  await ensureUniqueSlug({
    websiteId: existing.websiteId,
    slug,
    currentId: id,
  });
  const payload = buildPersistedBlogFields(parsed);

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE public."WebsiteBlogPost"
       SET
         "title" = $2,
         "slug" = $3,
         "excerpt" = $4,
         "bodyHtml" = $5,
         "coverImageUrl" = $6,
         "socialImageUrl" = $7,
         "category" = $8,
         "tags" = $9::jsonb,
         "authorName" = $10,
         "status" = $11,
         "publishDate" = $12,
         "featured" = $13,
         "metaTitle" = $14,
         "metaDescription" = $15,
         "wordCount" = $16,
         "readingTimeMinutes" = $17,
         "updatedAt" = NOW()
       WHERE "id" = $1
         AND "userId" = $18`,
      id,
      payload.title,
      slug,
      payload.excerpt,
      payload.bodyHtml,
      payload.coverImageUrl,
      payload.socialImageUrl,
      payload.category,
      JSON.stringify(payload.tags),
      payload.authorName,
      payload.status,
      payload.publishDate,
      payload.featured,
      payload.metaTitle,
      payload.metaDescription,
      payload.wordCount,
      payload.readingTimeMinutes,
      tenantUserId,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      throw new Error("La table des articles de blog n'est pas encore installée.");
    }
    throw error;
  }

  revalidateSiteBlogPaths({
    websiteSlug: existing.websiteSlug,
    postId: id,
    slug,
    previousSlug: existing.slug,
  });
  return getSiteBlogPost(id, tenantUserId);
}

export async function deleteSiteBlogPost(id: string) {
  const user = await requireUser();
  const tenantUserId = user.activeTenantId ?? user.tenantId ?? user.id;
  const existing = await getSiteBlogPost(id, tenantUserId);
  if (!existing) {
    throw new Error("Cet article est introuvable.");
  }

  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public."WebsiteBlogPost"
       WHERE "id" = $1
         AND "userId" = $2`,
      id,
      tenantUserId,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      throw new Error("La table des articles de blog n'est pas encore installée.");
    }
    throw error;
  }

  revalidateSiteBlogPaths({
    websiteSlug: existing.websiteSlug,
    postId: id,
    previousSlug: existing.slug,
  });
}

function publicVisibilitySql(preview: boolean) {
  if (preview) {
    return "TRUE";
  }
  return `(
    bp."status" = 'PUBLISHED'
    OR (
      bp."status" = 'SCHEDULED'
      AND bp."publishDate" IS NOT NULL
      AND bp."publishDate" <= CURRENT_DATE
    )
  )`;
}

export async function listPublicSiteBlogPostSummaries(options: {
  websiteId: string;
  preview?: boolean;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options.limit ?? 120, 1), 240);
  let rows: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    socialImageUrl: string | null;
    category: string | null;
    tags: unknown;
    authorName: string;
    publishDate: Date | string | null;
    featured: boolean;
    readingTimeMinutes: number;
    wordCount: number;
    metaTitle: string | null;
    metaDescription: string | null;
  }>;
  try {
    rows = await prisma.$queryRawUnsafe<typeof rows>(
      `SELECT
         bp."id",
         bp."title",
         bp."slug",
         bp."excerpt",
         bp."coverImageUrl",
         bp."socialImageUrl",
         bp."category",
         bp."tags",
         bp."authorName",
         bp."publishDate",
         bp."featured",
         bp."readingTimeMinutes",
         bp."wordCount",
         bp."metaTitle",
         bp."metaDescription"
       FROM public."WebsiteBlogPost" bp
       WHERE bp."websiteId" = $1
         AND ${publicVisibilitySql(options.preview === true)}
       ORDER BY
         bp."featured" DESC,
         COALESCE(bp."publishDate", DATE(bp."createdAt")) DESC,
         bp."createdAt" DESC,
         bp."id" DESC
       LIMIT $2`,
      options.websiteId,
      limit,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      console.warn("[site-blog-posts] WebsiteBlogPost table is not installed.");
      return [] as PublicSiteBlogPostSummary[];
    }
    throw error;
  }

  return rows.map(serializePublicSiteBlogPostSummary);
}

export async function getPublicSiteBlogPostBySlug(options: {
  websiteId: string;
  slug: string;
  preview?: boolean;
}) {
  let rows: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    socialImageUrl: string | null;
    category: string | null;
    tags: unknown;
    authorName: string;
    publishDate: Date | string | null;
    featured: boolean;
    readingTimeMinutes: number;
    wordCount: number;
    metaTitle: string | null;
    metaDescription: string | null;
    bodyHtml: string;
  }>;
  try {
    rows = await prisma.$queryRawUnsafe<typeof rows>(
      `SELECT
         bp."id",
         bp."title",
         bp."slug",
         bp."excerpt",
         bp."coverImageUrl",
         bp."socialImageUrl",
         bp."category",
         bp."tags",
         bp."authorName",
         bp."publishDate",
         bp."featured",
         bp."readingTimeMinutes",
         bp."wordCount",
         bp."metaTitle",
         bp."metaDescription",
         bp."bodyHtml"
       FROM public."WebsiteBlogPost" bp
       WHERE bp."websiteId" = $1
         AND bp."slug" = $2
         AND ${publicVisibilitySql(options.preview === true)}
       LIMIT 1`,
      options.websiteId,
      options.slug,
    );
  } catch (error) {
    if (isMissingSiteBlogPostTableError(error)) {
      console.warn("[site-blog-posts] WebsiteBlogPost table is not installed.");
      return null;
    }
    throw error;
  }

  const row = rows[0];
  return row ? serializePublicSiteBlogPost(row) : null;
}
