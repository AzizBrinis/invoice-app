import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import {
  getPublicSiteBlogPostBySlug,
} from "@/server/site-blog-posts";
import {
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const PUBLIC_CATALOG_API_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";
const PUBLIC_CATALOG_NOT_FOUND_CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
const PREVIEW_CATALOG_API_CACHE_CONTROL = "private, no-store";

const querySchema = z.object({
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  post: z.string().min(1),
});

function jsonWithCache(
  body: unknown,
  options: { preview?: boolean; status?: number } = {},
) {
  const status = options.status ?? 200;
  const cacheControl = options.preview
    ? PREVIEW_CATALOG_API_CACHE_CONTROL
    : status === 404
      ? PUBLIC_CATALOG_NOT_FOUND_CACHE_CONTROL
      : status >= 400
        ? "no-store"
        : PUBLIC_CATALOG_API_CACHE_CONTROL;
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": cacheControl,
    },
  });
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
      return jsonWithCache(
        { error: "Missing blog post slug." },
        { preview: query.mode === "preview", status: 400 },
      );
    }

    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: query.mode === "preview",
    });
    if (!website) {
      return jsonWithCache(
        { error: "Catalog not found." },
        { preview: query.mode === "preview", status: 404 },
      );
    }

    const post = await getPublicSiteBlogPostBySlug({
      websiteId: website.id,
      slug: postSlug,
      preview: query.mode === "preview",
    });
    if (!post) {
      return jsonWithCache(
        { error: "Blog post not found." },
        { preview: query.mode === "preview", status: 404 },
      );
    }

    return jsonWithCache(
      { post },
      { preview: query.mode === "preview" },
    );
  } catch (error) {
    return jsonWithCache(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load blog post.",
      },
      { status: 400 },
    );
  }
}
