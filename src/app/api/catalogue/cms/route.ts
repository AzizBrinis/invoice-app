import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppHostnames } from "@/lib/env";
import { prisma } from "@/lib/db";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { normalizeWebsiteCmsPagePath, renderWebsiteCmsPageContent } from "@/lib/website/cms";
import {
  normalizeCatalogDomainInput,
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeCatalogDomainInput(entry))
    .filter((entry): entry is string => Boolean(entry)),
);

const querySchema = z.object({
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  path: z.string().min(1),
});

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
      return NextResponse.json(
        { error: t("Invalid path.") },
        { status: 400 },
      );
    }

    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const normalizedHost = normalizeCatalogDomainInput(host);
    const isAppHost =
      APP_HOSTS.has(host) ||
      (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
    const domain = isAppHost ? null : normalizedHost;
    const slug = isAppHost ? normalizeCatalogSlugInput(query.slug) : null;

    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: query.mode === "preview",
    });
    if (!website) {
      return NextResponse.json(
        { error: t("Site unavailable.") },
        { status: 404 },
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
      return NextResponse.json(
        { error: t("Page not found.") },
        { status: 404 },
      );
    }

    const rendered = renderWebsiteCmsPageContent(page.content);

    return NextResponse.json({
      page: {
        id: page.id,
        title: page.title,
        path: page.path,
        contentHtml: rendered.html,
        excerpt: rendered.excerpt,
        headings: rendered.headings,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? t(error.message) : t("Unable to fetch page.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
