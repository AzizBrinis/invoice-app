import { Buffer } from "node:buffer";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import {
  isInlineImageDataUrl,
  uploadManagedImageDataUrl,
} from "@/server/product-media-storage";
import {
  getPublicSiteBlogPostBySlug,
} from "@/server/site-blog-posts";
import {
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const BLOG_IMAGE_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";
const PROMOTED_BLOG_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const querySchema = z.object({
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  post: z.string().min(1),
});

function decodeInlineImageDataUrl(source: string) {
  const trimmed = source.trim();
  if (!trimmed.toLowerCase().startsWith("data:image/")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf(",");
  if (separatorIndex < 0) {
    return null;
  }

  const metadata = trimmed.slice(5, separatorIndex);
  const payload = trimmed.slice(separatorIndex + 1);
  const contentType = metadata.split(";")[0]?.trim() || "image/png";
  const isBase64 = metadata
    .split(";")
    .some((entry) => entry.trim().toLowerCase() === "base64");

  try {
    const body = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    if (!body.byteLength) {
      return null;
    }
    return { body, contentType };
  } catch {
    return null;
  }
}

async function promoteInlineBlogImage(options: {
  websiteId: string;
  userId: string;
  websiteSlug: string;
  postId: string;
  postSlug: string;
  source: string;
}) {
  try {
    const asset = await uploadManagedImageDataUrl({
      userId: options.userId,
      publicSlug: `${options.websiteSlug}-${options.postSlug}`,
      source: options.source,
      pathPrefix: "blog-images",
    });
    await prisma.$executeRaw`
      UPDATE public."WebsiteBlogPost"
      SET
        "coverImageUrl" = CASE
          WHEN "coverImageUrl" = ${options.source} THEN ${asset.managedUrl}
          ELSE "coverImageUrl"
        END,
        "socialImageUrl" = CASE
          WHEN "socialImageUrl" = ${options.source} THEN ${asset.managedUrl}
          ELSE "socialImageUrl"
        END
      WHERE "id" = ${options.postId}
        AND "websiteId" = ${options.websiteId}
    `;
    return asset.managedUrl;
  } catch (error) {
    console.warn("[catalogue blog image] inline promotion failed", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const query = querySchema.parse({
      slug: request.nextUrl.searchParams.get("slug"),
      mode: request.nextUrl.searchParams.get("mode") ?? "public",
      post: request.nextUrl.searchParams.get("post"),
    });

    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const slug = domain ? null : normalizeCatalogSlugInput(query.slug);
    const postSlug = normalizeCatalogSlugInput(query.post);

    if (!postSlug) {
      return new NextResponse("Not found", { status: 404 });
    }

    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: query.mode === "preview",
    });
    if (!website) {
      return new NextResponse("Not found", { status: 404 });
    }

    const post = await getPublicSiteBlogPostBySlug({
      websiteId: website.id,
      slug: postSlug,
      preview: query.mode === "preview",
    });
    if (!post) {
      return new NextResponse("Not found", { status: 404 });
    }

    const source = post.socialImageUrl?.trim() || post.coverImageUrl?.trim() || "";
    if (!source) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (/^https?:\/\//i.test(source)) {
      return NextResponse.redirect(source, {
        status: 307,
        headers: {
          "Cache-Control": BLOG_IMAGE_CACHE_CONTROL,
        },
      });
    }

    if (source.startsWith("/")) {
      return NextResponse.redirect(new URL(source, request.nextUrl.origin), {
        status: 307,
        headers: {
          "Cache-Control": BLOG_IMAGE_CACHE_CONTROL,
        },
      });
    }

    if (isInlineImageDataUrl(source)) {
      const promotedUrl = await promoteInlineBlogImage({
        websiteId: website.id,
        userId: website.userId,
        websiteSlug: website.slug,
        postId: post.id,
        postSlug,
        source,
      });
      if (promotedUrl) {
        return NextResponse.redirect(promotedUrl, {
          status: 307,
          headers: {
            "Cache-Control": PROMOTED_BLOG_IMAGE_CACHE_CONTROL,
          },
        });
      }
    }

    const decoded = decodeInlineImageDataUrl(source);
    if (!decoded) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(decoded.body, {
      status: 200,
      headers: {
        "Content-Type": decoded.contentType,
        "Cache-Control": BLOG_IMAGE_CACHE_CONTROL,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
