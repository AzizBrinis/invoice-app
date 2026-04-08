import { Buffer } from "node:buffer";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAppHostnames } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  normalizeCatalogDomainInput,
  normalizeCatalogSlugInput,
  resolveCatalogProductListingImageDataUrl,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeCatalogDomainInput(entry))
    .filter((entry): entry is string => Boolean(entry)),
);
const LISTING_IMAGE_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

function resolveDomainAndSlug(
  request: NextRequest,
  fallbackSlug?: string | null,
) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const normalizedHost = normalizeCatalogDomainInput(host);
  const isAppHost =
    APP_HOSTS.has(host) ||
    (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
  const slug = isAppHost ? normalizeCatalogSlugInput(fallbackSlug) : null;
  const domain = isAppHost ? null : normalizedHost;
  return { slug, domain };
}

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; slug: string }> },
) {
  const params = await context.params;
  const productId = params.id?.trim();

  if (!productId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { slug, domain } = resolveDomainAndSlug(request, params.slug);
  const website = await resolveCatalogWebsite({
    slug,
    domain,
    preview: false,
  });

  if (!website) {
    return new NextResponse("Not found", { status: 404 });
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      userId: website.userId,
      isListedInCatalog: true,
      ...(website.showInactiveProducts ? {} : { isActive: true }),
    },
    select: {
      coverImageUrl: true,
      gallery: true,
    },
  });

  if (!product) {
    return new NextResponse("Not found", { status: 404 });
  }

  const inlineImage = resolveCatalogProductListingImageDataUrl(product);
  if (!inlineImage) {
    return new NextResponse("Not found", { status: 404 });
  }

  const decoded = decodeInlineImageDataUrl(inlineImage);
  if (!decoded) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(decoded.body, {
    headers: {
      "Cache-Control": LISTING_IMAGE_CACHE_CONTROL,
      "Content-Disposition": "inline",
      "Content-Length": String(decoded.body.byteLength),
      "Content-Type": decoded.contentType,
    },
  });
}
