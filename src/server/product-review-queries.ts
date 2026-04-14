import { prisma } from "@/lib/db";

export type PublicProductReview = {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
};

function serializePublicReview(row: {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date | string;
}): PublicProductReview {
  return {
    id: row.id,
    productId: row.productId,
    authorName: row.authorName,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

function isMissingProductReviewTableError(error: unknown) {
  return (
    error instanceof Error &&
    /ProductReview|relation .* does not exist|does not exist/i.test(error.message)
  );
}

export async function listApprovedProductReviewsForProducts(
  userId: string,
  productIds: string[],
) {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  if (!uniqueProductIds.length) {
    return new Map<string, PublicProductReview[]>();
  }

  let rows: Array<{
    id: string;
    productId: string;
    authorName: string;
    rating: number;
    title: string | null;
    body: string;
    createdAt: Date;
  }>;
  try {
    rows = await prisma.$queryRawUnsafe(
      `SELECT
         "id",
         "productId",
         "authorName",
         "rating",
         "title",
         "body",
         "createdAt"
       FROM public."ProductReview"
       WHERE "userId" = $1
         AND "productId" = ANY($2::text[])
         AND "status" = 'APPROVED'
       ORDER BY "createdAt" DESC, "id" DESC`,
      userId,
      uniqueProductIds,
    );
  } catch (error) {
    if (isMissingProductReviewTableError(error)) {
      console.warn("[product-reviews] ProductReview table is not installed.");
      return new Map<string, PublicProductReview[]>();
    }
    throw error;
  }

  const reviewsByProduct = new Map<string, PublicProductReview[]>();
  rows.forEach((row) => {
    const reviews = reviewsByProduct.get(row.productId) ?? [];
    reviews.push(serializePublicReview(row));
    reviewsByProduct.set(row.productId, reviews);
  });
  return reviewsByProduct;
}
