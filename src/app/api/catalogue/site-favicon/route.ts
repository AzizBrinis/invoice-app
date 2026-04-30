import { Buffer } from "node:buffer";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import {
  isInlineImageDataUrl,
  uploadManagedImageDataUrl,
} from "@/server/product-media-storage";
import {
  normalizeCatalogSlugInput,
  isInlineCatalogImageSource,
  resolveCatalogWebsite,
  resolveWebsiteFaviconUrlFromWebsite,
} from "@/server/website";

const FAVICON_CACHE_CONTROL = "public, max-age=31536000, immutable";

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

async function promoteInlineFavicon(options: {
  websiteId: string;
  userId: string;
  websiteSlug: string;
  source: string;
}) {
  try {
    const asset = await uploadManagedImageDataUrl({
      userId: options.userId,
      publicSlug: `${options.websiteSlug}-favicon`,
      source: options.source,
      pathPrefix: "favicons",
    });
    await prisma.$executeRaw`
      UPDATE "WebsiteConfig"
      SET "builderConfig" = jsonb_set(
        COALESCE("builderConfig"::jsonb, '{}'::jsonb),
        '{site,faviconUrl}',
        to_jsonb(${asset.managedUrl}::text),
        true
      )
      WHERE "id" = ${options.websiteId}
    `;
    return asset.managedUrl;
  } catch (error) {
    console.warn("[catalogue favicon] inline promotion failed", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const domain = resolveCatalogDomainFromHeaders(request.headers);
  const slug = domain
    ? null
    : normalizeCatalogSlugInput(request.nextUrl.searchParams.get("slug"));
  const website = await resolveCatalogWebsite({
    slug,
    domain,
    preview: false,
  });

  if (!website) {
    return new NextResponse(null, { status: 404 });
  }

  const faviconSource = resolveWebsiteFaviconUrlFromWebsite(website);
  if (!faviconSource) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isInlineCatalogImageSource(faviconSource)) {
    return NextResponse.redirect(faviconSource, {
      status: 307,
      headers: {
        "cache-control": FAVICON_CACHE_CONTROL,
      },
    });
  }

  if (isInlineImageDataUrl(faviconSource)) {
    const promotedUrl = await promoteInlineFavicon({
      websiteId: website.id,
      userId: website.userId,
      websiteSlug: website.slug,
      source: faviconSource,
    });
    if (promotedUrl) {
      return NextResponse.redirect(promotedUrl, {
        status: 307,
        headers: {
          "cache-control": FAVICON_CACHE_CONTROL,
        },
      });
    }
  }

  const decoded = decodeInlineImageDataUrl(faviconSource);
  if (!decoded) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(decoded.body), {
    status: 200,
    headers: {
      "cache-control": FAVICON_CACHE_CONTROL,
      "content-length": String(decoded.body.byteLength),
      "content-type": decoded.contentType,
      "x-content-type-options": "nosniff",
    },
  });
}
