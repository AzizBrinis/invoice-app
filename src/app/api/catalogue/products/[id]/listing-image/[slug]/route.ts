import { Buffer } from "node:buffer";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import {
  normalizeCatalogSlugInput,
  resolveCatalogProductListingImageDataUrl,
  resolveCatalogWebsite,
} from "@/server/website";

const LISTING_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const LISTING_IMAGE_WIDTHS = [160, 240, 320, 480, 640, 768, 960, 1200];
const DEFAULT_LISTING_IMAGE_QUALITY = 72;
const MIN_LISTING_IMAGE_QUALITY = 45;
const MAX_LISTING_IMAGE_QUALITY = 85;

function resolveDomainAndSlug(
  request: NextRequest,
  fallbackSlug?: string | null,
) {
  const domain = resolveCatalogDomainFromHeaders(request.headers);
  const slug = domain ? null : normalizeCatalogSlugInput(fallbackSlug);
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

function resolveRequestedWidth(request: NextRequest) {
  const widthParam = request.nextUrl.searchParams.get("w");
  if (!widthParam) {
    return null;
  }
  const parsed = Number.parseInt(widthParam, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return LISTING_IMAGE_WIDTHS.includes(parsed) ? parsed : null;
}

function resolveRequestedQuality(request: NextRequest) {
  const qualityParam = request.nextUrl.searchParams.get("q");
  if (!qualityParam) {
    return DEFAULT_LISTING_IMAGE_QUALITY;
  }
  const parsed = Number.parseInt(qualityParam, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LISTING_IMAGE_QUALITY;
  }
  return Math.max(
    MIN_LISTING_IMAGE_QUALITY,
    Math.min(MAX_LISTING_IMAGE_QUALITY, parsed),
  );
}

function resolvePreferredRasterFormat(
  request: NextRequest,
  contentType: string,
) {
  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType.startsWith("image/svg")) {
    return null;
  }

  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  if (accept.includes("image/avif")) {
    return "avif" as const;
  }
  if (accept.includes("image/webp")) {
    return "webp" as const;
  }
  if (normalizedContentType.startsWith("image/png")) {
    return "png" as const;
  }
  if (normalizedContentType.startsWith("image/jpeg")) {
    return "jpeg" as const;
  }
  return "webp" as const;
}

async function transformListingImage(options: {
  body: Buffer;
  contentType: string;
  preferredFormat: "avif" | "webp" | "png" | "jpeg" | null;
  requestedWidth: number | null;
  quality: number;
}) {
  if (
    !options.requestedWidth &&
    (!options.preferredFormat ||
      options.contentType.toLowerCase() === `image/${options.preferredFormat}`)
  ) {
    return {
      body: options.body,
      contentType: options.contentType,
    };
  }

  if (options.contentType.toLowerCase().startsWith("image/svg")) {
    return {
      body: options.body,
      contentType: options.contentType,
    };
  }

  const metadata = await sharp(options.body).metadata();
  const pipeline = sharp(options.body, {
    limitInputPixels: false,
  });

  if (
    options.requestedWidth &&
    metadata.width &&
    options.requestedWidth < metadata.width
  ) {
    pipeline.resize({
      width: options.requestedWidth,
      withoutEnlargement: true,
    });
  }

  if (options.preferredFormat === "avif") {
    return {
      body: await pipeline.avif({ quality: options.quality }).toBuffer(),
      contentType: "image/avif",
    };
  }
  if (options.preferredFormat === "png") {
    return {
      body: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
      contentType: "image/png",
    };
  }
  if (options.preferredFormat === "jpeg") {
    return {
      body: await pipeline.jpeg({ quality: options.quality }).toBuffer(),
      contentType: "image/jpeg",
    };
  }

  return {
    body: await pipeline.webp({ quality: options.quality }).toBuffer(),
    contentType: "image/webp",
  };
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

  const inlineImage = resolveCatalogProductListingImageDataUrl(
    product,
    request.nextUrl.searchParams.get("slot"),
  );
  if (!inlineImage) {
    return new NextResponse("Not found", { status: 404 });
  }

  const decoded = decodeInlineImageDataUrl(inlineImage);
  if (!decoded) {
    return new NextResponse("Not found", { status: 404 });
  }

  const transformed = await transformListingImage({
    body: decoded.body,
    contentType: decoded.contentType,
    preferredFormat: resolvePreferredRasterFormat(request, decoded.contentType),
    requestedWidth: resolveRequestedWidth(request),
    quality: resolveRequestedQuality(request),
  });

  return new NextResponse(new Uint8Array(transformed.body), {
    headers: {
      "Cache-Control": LISTING_IMAGE_CACHE_CONTROL,
      "Content-Disposition": "inline",
      "Content-Length": String(transformed.body.byteLength),
      "Content-Type": transformed.contentType,
      Vary: "Accept",
    },
  });
}
