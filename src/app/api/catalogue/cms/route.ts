import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { normalizeWebsiteCmsPagePath, renderWebsiteCmsPageContent } from "@/lib/website/cms";
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
  path: z.string().min(1),
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
  const { t } = createCisecoRequestTranslator(request);
  try {
    const query = querySchema.parse({
      slug: request.nextUrl.searchParams.get("slug"),
      mode: request.nextUrl.searchParams.get("mode") ?? "public",
      path: request.nextUrl.searchParams.get("path"),
    });

    const normalizedPath = normalizeWebsiteCmsPagePath(query.path);
    if (!normalizedPath) {
      return jsonWithCache(
        { error: t("Invalid path.") },
        { preview: query.mode === "preview", status: 400 },
      );
    }

    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const slug = domain ? null : normalizeCatalogSlugInput(query.slug);

    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: query.mode === "preview",
    });
    if (!website) {
      return jsonWithCache(
        { error: t("Site unavailable.") },
        { preview: query.mode === "preview", status: 404 },
      );
    }

    const page = await prisma.websiteCmsPage.findFirst({
      where: {
        websiteId: website.id,
        path: normalizedPath,
      },
      select: {
        id: true,
        title: true,
        path: true,
        content: true,
      },
    });
    if (!page) {
      return jsonWithCache(
        { error: t("Page not found.") },
        { preview: query.mode === "preview", status: 404 },
      );
    }

    const rendered = renderWebsiteCmsPageContent(page.content);

    return jsonWithCache(
      {
        page: {
          id: page.id,
          title: page.title,
          path: page.path,
          contentHtml: rendered.html,
          excerpt: rendered.excerpt,
          headings: rendered.headings,
        },
      },
      { preview: query.mode === "preview" },
    );
  } catch (error) {
    const message =
      error instanceof Error ? t(error.message) : t("Unable to fetch page.");
    return jsonWithCache({ error: message }, { status: 400 });
  }
}
