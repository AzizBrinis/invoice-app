import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { uploadManagedProductImageDataUrl } from "@/server/product-media-storage";
import {
  normalizeCatalogSlugInput,
  resolveCatalogProductListingImageDataUrl,
  resolveCatalogProductListingImageSource,
  resolveCatalogWebsite,
} from "@/server/website";

const LISTING_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const LISTING_IMAGE_WIDTHS = [160, 240, 320, 480, 640, 768, 960, 1200];
const DEFAULT_LISTING_IMAGE_QUALITY = 72;
const MIN_LISTING_IMAGE_QUALITY = 45;
const MAX_LISTING_IMAGE_QUALITY = 85;
const MAX_SOURCE_IMAGE_CACHE_ENTRIES = 96;
const MAX_TRANSFORMED_IMAGE_CACHE_ENTRIES = 192;
const SMALL_INLINE_IMAGE_MAX_BYTES = 24 * 1024;
const SMALL_INLINE_IMAGE_MIN_WIDTH = 320;
const SMALL_INLINE_IMAGE_WIDTH_TOLERANCE = 192;

type CachedListingImageSource = {
  body: Buffer;
  contentType: string;
  width: number | null;
  height: number | null;
};

type ListingImagePayload = {
  body: Buffer;
  contentType: string;
};

type ListingImageSourceResult = {
  source: CachedListingImageSource | null;
  redirectUrl?: string | null;
};

type ProductImageRecord = {
  publicSlug: string;
  coverImageUrl: string | null;
  gallery: Prisma.JsonValue | null;
};

const sourceImageCache = new Map<string, CachedListingImageSource>();
const sourceImageRequestCache = new Map<
  string,
  Promise<ListingImageSourceResult>
>();
const transformedImageCache = new Map<string, ListingImagePayload>();
const transformedImageRequestCache = new Map<
  string,
  Promise<ListingImagePayload>
>();

function setBoundedCacheEntry<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maxEntries: number,
) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  if (cache.size <= maxEntries) {
    return;
  }
  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) {
    cache.delete(oldestKey);
  }
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function replaceInlineProductImageSource(
  product: ProductImageRecord,
  inlineSource: string,
  managedUrl: string,
) {
  const coverImageUrl =
    product.coverImageUrl === inlineSource ? managedUrl : product.coverImageUrl;
  const gallery = Array.isArray(product.gallery)
    ? product.gallery.map((entry) => {
        if (typeof entry === "string") {
          return entry === inlineSource ? managedUrl : entry;
        }
        if (!isRecord(entry)) {
          return entry;
        }
        const source =
          typeof entry.src === "string"
            ? entry.src
            : typeof entry.url === "string"
              ? entry.url
              : "";
        if (source !== inlineSource) {
          return entry;
        }
        return {
          ...entry,
          src: managedUrl,
        };
      })
    : product.gallery;
  return {
    coverImageUrl,
    gallery,
  };
}

async function promoteInlineProductImage(options: {
  userId: string;
  productId: string;
  product: ProductImageRecord;
  inlineSource: string;
}) {
  try {
    const asset = await uploadManagedProductImageDataUrl({
      userId: options.userId,
      publicSlug: options.product.publicSlug || options.productId,
      source: options.inlineSource,
    });
    const next = replaceInlineProductImageSource(
      options.product,
      options.inlineSource,
      asset.managedUrl,
    );
    await prisma.product.update({
      where: { id: options.productId },
      data: {
        coverImageUrl: next.coverImageUrl,
        gallery:
          next.gallery == null
            ? Prisma.JsonNull
            : (next.gallery as Prisma.InputJsonValue),
      },
    });
  } catch (error) {
    console.warn("[catalogue listing image] inline promotion failed", error);
  }
}

function buildSourceImageCacheKey(options: {
  productId: string;
  slot: string | null;
  version: string | null;
}) {
  return [
    options.productId,
    options.slot ?? "listing",
    options.version ?? "inline",
  ].join(":");
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

function buildTransformedImageCacheKey(options: {
  sourceCacheKey: string;
  contentType: string;
  requestedWidth: number | null;
  quality: number;
  preferredFormat: "avif" | "webp" | "png" | "jpeg" | null;
  bypassTransform: boolean;
}) {
  const digest = createHash("sha1")
    .update(
      JSON.stringify({
        sourceCacheKey: options.sourceCacheKey,
        contentType: options.contentType,
        requestedWidth: options.requestedWidth,
        quality: options.quality,
        preferredFormat: options.preferredFormat,
        bypassTransform: options.bypassTransform,
      }),
    )
    .digest("hex");
  return digest;
}

function shouldBypassTransform(options: {
  source: CachedListingImageSource;
  requestedWidth: number | null;
}) {
  const normalizedContentType = options.source.contentType.toLowerCase();
  if (
    !(
      normalizedContentType.startsWith("image/jpeg") ||
      normalizedContentType.startsWith("image/webp") ||
      normalizedContentType.startsWith("image/avif")
    )
  ) {
    return false;
  }
  if (options.source.body.byteLength > SMALL_INLINE_IMAGE_MAX_BYTES) {
    return false;
  }
  if (!options.requestedWidth || !options.source.width) {
    return true;
  }
  return options.requestedWidth >= Math.max(
    SMALL_INLINE_IMAGE_MIN_WIDTH,
    options.source.width - SMALL_INLINE_IMAGE_WIDTH_TOLERANCE,
  );
}

async function transformListingImage(options: {
  source: CachedListingImageSource;
  preferredFormat: "avif" | "webp" | "png" | "jpeg" | null;
  requestedWidth: number | null;
  quality: number;
}) {
  if (
    shouldBypassTransform({
      source: options.source,
      requestedWidth: options.requestedWidth,
    })
  ) {
    return {
      body: options.source.body,
      contentType: options.source.contentType,
    };
  }

  if (
    !options.requestedWidth &&
    (!options.preferredFormat ||
      options.source.contentType.toLowerCase() ===
        `image/${options.preferredFormat}`)
  ) {
    return {
      body: options.source.body,
      contentType: options.source.contentType,
    };
  }

  if (options.source.contentType.toLowerCase().startsWith("image/svg")) {
    return {
      body: options.source.body,
      contentType: options.source.contentType,
    };
  }

  const pipeline = sharp(options.source.body, {
    limitInputPixels: false,
  });

  if (
    options.requestedWidth &&
    options.source.width &&
    options.requestedWidth < options.source.width
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

async function loadListingImageSource(options: {
  request: NextRequest;
  productId: string;
  fallbackSlug: string;
  slot: string | null;
  version: string | null;
}) {
  const sourceCacheKey = buildSourceImageCacheKey({
    productId: options.productId,
    slot: options.slot,
    version: options.version,
  });
  const cachedSource = sourceImageCache.get(sourceCacheKey);
  if (cachedSource) {
    return { sourceCacheKey, source: cachedSource };
  }

  const inflight = sourceImageRequestCache.get(sourceCacheKey);
  if (inflight) {
    return { sourceCacheKey, ...(await inflight) };
  }

  const requestPromise = (async (): Promise<ListingImageSourceResult> => {
    const { slug, domain } = resolveDomainAndSlug(
      options.request,
      options.fallbackSlug,
    );
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: false,
    });

    if (!website) {
      return { source: null };
    }

    const product = await prisma.product.findFirst({
      where: {
        id: options.productId,
        userId: website.userId,
        isListedInCatalog: true,
        ...(website.showInactiveProducts ? {} : { isActive: true }),
      },
      select: {
        id: true,
        publicSlug: true,
        coverImageUrl: true,
        gallery: true,
      },
    });

    if (!product) {
      return { source: null };
    }

    const resolvedImageSource = resolveCatalogProductListingImageSource(
      product,
      website,
      options.slot,
    );
    if (resolvedImageSource && !resolvedImageSource.startsWith("/api/catalogue/products/")) {
      return {
        redirectUrl: resolvedImageSource,
        source: null,
      };
    }

    const inlineImage = resolveCatalogProductListingImageDataUrl(
      product,
      options.slot,
    );
    if (!inlineImage) {
      return { source: null };
    }

    const decoded = decodeInlineImageDataUrl(inlineImage);
    if (!decoded) {
      return { source: null };
    }

    await promoteInlineProductImage({
      userId: website.userId,
      productId: options.productId,
      product,
      inlineSource: inlineImage,
    });

    const metadata = decoded.contentType.toLowerCase().startsWith("image/svg")
      ? null
      : await sharp(decoded.body).metadata();
    const source: CachedListingImageSource = {
      body: decoded.body,
      contentType: decoded.contentType,
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
    };

    setBoundedCacheEntry(
      sourceImageCache,
      sourceCacheKey,
      source,
      MAX_SOURCE_IMAGE_CACHE_ENTRIES,
    );
    return { source };
  })().finally(() => {
    sourceImageRequestCache.delete(sourceCacheKey);
  });

  sourceImageRequestCache.set(sourceCacheKey, requestPromise);
  return {
    sourceCacheKey,
    ...(await requestPromise),
  };
}

async function resolveListingImagePayload(options: {
  sourceCacheKey: string;
  source: CachedListingImageSource;
  preferredFormat: "avif" | "webp" | "png" | "jpeg" | null;
  requestedWidth: number | null;
  quality: number;
}) {
  const bypassTransform = shouldBypassTransform({
    source: options.source,
    requestedWidth: options.requestedWidth,
  });
  const transformedCacheKey = buildTransformedImageCacheKey({
    sourceCacheKey: options.sourceCacheKey,
    contentType: options.source.contentType,
    requestedWidth: options.requestedWidth,
    quality: options.quality,
    preferredFormat: options.preferredFormat,
    bypassTransform,
  });
  const cachedPayload = transformedImageCache.get(transformedCacheKey);
  if (cachedPayload) {
    return cachedPayload;
  }

  const inflight = transformedImageRequestCache.get(transformedCacheKey);
  if (inflight) {
    return await inflight;
  }

  const requestPromise = transformListingImage({
    source: options.source,
    preferredFormat: options.preferredFormat,
    requestedWidth: options.requestedWidth,
    quality: options.quality,
  }).then((payload) => {
    setBoundedCacheEntry(
      transformedImageCache,
      transformedCacheKey,
      payload,
      MAX_TRANSFORMED_IMAGE_CACHE_ENTRIES,
    );
    return payload;
  }).finally(() => {
    transformedImageRequestCache.delete(transformedCacheKey);
  });

  transformedImageRequestCache.set(transformedCacheKey, requestPromise);
  return await requestPromise;
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

  const slot = request.nextUrl.searchParams.get("slot");
  const version = request.nextUrl.searchParams.get("v");
  const { sourceCacheKey, source, redirectUrl } = await loadListingImageSource({
    request,
    productId,
    fallbackSlug: params.slug,
    slot,
    version,
  });
  if (!source && redirectUrl) {
    return NextResponse.redirect(new URL(redirectUrl, request.nextUrl.origin), {
      status: 307,
      headers: {
        "Cache-Control": LISTING_IMAGE_CACHE_CONTROL,
      },
    });
  }
  if (!source) {
    return new NextResponse("Not found", { status: 404 });
  }

  const transformed = await resolveListingImagePayload({
    sourceCacheKey,
    source,
    preferredFormat: resolvePreferredRasterFormat(request, source.contentType),
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
