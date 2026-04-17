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

const querySchema = z.object({
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  post: z.string().min(1),
});

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
      return NextResponse.json(
        { error: "Missing blog post slug." },
        { status: 400 },
      );
    }

    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: query.mode === "preview",
    });
    if (!website) {
      return NextResponse.json({ error: "Catalog not found." }, { status: 404 });
    }

    const post = await getPublicSiteBlogPostBySlug({
      websiteId: website.id,
      slug: postSlug,
      preview: query.mode === "preview",
    });
    if (!post) {
      return NextResponse.json({ error: "Blog post not found." }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
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
