import { prisma } from "@/lib/db";

export type PublicSiteReview = {
  id: string;
  authorName: string;
  authorRole: string | null;
  avatarUrl: string | null;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
};

function serializePublicSiteReview(row: {
  id: string;
  authorName: string;
  authorRole: string | null;
  avatarUrl: string | null;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date | string;
}): PublicSiteReview {
  return {
    id: row.id,
    authorName: row.authorName,
    authorRole: row.authorRole,
    avatarUrl: row.avatarUrl,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

function isMissingSiteReviewTableError(error: unknown) {
  return (
    error instanceof Error &&
    /SiteReview|relation .* does not exist|does not exist/i.test(error.message)
  );
}

export async function listApprovedSiteReviews(options: {
  userId: string;
  websiteId: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 24);
  let rows: Array<{
    id: string;
    authorName: string;
    authorRole: string | null;
    avatarUrl: string | null;
    rating: number;
    title: string | null;
    body: string;
    createdAt: Date;
  }>;
  try {
    rows = await prisma.$queryRawUnsafe(
      `SELECT
         "id",
         "authorName",
         "authorRole",
         "avatarUrl",
         "rating",
         "title",
         "body",
         "createdAt"
       FROM public."SiteReview"
       WHERE "userId" = $1
         AND "websiteId" = $2
         AND "status" = 'APPROVED'
       ORDER BY "createdAt" DESC, "id" DESC
       LIMIT $3`,
      options.userId,
      options.websiteId,
      limit,
    );
  } catch (error) {
    if (isMissingSiteReviewTableError(error)) {
      console.warn("[site-reviews] SiteReview table is not installed.");
      return [];
    }
    throw error;
  }

  return rows.map(serializePublicSiteReview);
}
