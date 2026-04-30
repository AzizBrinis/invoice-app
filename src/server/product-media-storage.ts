import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { slugify } from "@/lib/slug";

const DEFAULT_PRODUCT_IMAGE_BUCKET =
  process.env.SUPABASE_PRODUCT_IMAGE_BUCKET?.trim() || "product-images";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const PRODUCT_IMAGE_PATH_PREFIX = "products";
const LOCAL_PRODUCT_IMAGE_PUBLIC_PREFIX = "/uploads";
const DEFAULT_ALLOWED_SOURCE_HOSTS = ["techno-smart.tn"] as const;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_DOWNLOAD_ATTEMPTS = 2;
const MAX_UPLOAD_ATTEMPTS = 2;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;
const REQUEST_USER_AGENT =
  "invoices-app-techno-smart-product-media/1.0 (+https://techno-smart.net)";

type ManagedProductImageType = {
  extension: "avif" | "gif" | "ico" | "jpg" | "png" | "webp";
  mimeType:
    | "image/avif"
    | "image/gif"
    | "image/x-icon"
    | "image/jpeg"
    | "image/png"
    | "image/webp";
};

export type RemoteProductImageInput = {
  sourceUrl: string;
  alt?: string | null;
};

export type ManagedProductGalleryEntry = {
  src: string;
  alt?: string | null;
  isPrimary?: boolean;
  position?: number;
};

export type ManagedProductImageAsset = {
  sourceUrl: string;
  managedUrl: string;
  storagePath: string;
  sha256: string;
  extension: ManagedProductImageType["extension"];
  mimeType: ManagedProductImageType["mimeType"];
  sizeBytes: number;
  uploaded: boolean;
};

export type ManagedProductImageDataUrlAsset = Omit<
  ManagedProductImageAsset,
  "sourceUrl"
> & {
  sourceUrl: string | null;
};

export type ManagedProductImageIngestionResult = {
  coverImageUrl: string | null;
  gallery: ManagedProductGalleryEntry[] | null;
  assets: ManagedProductImageAsset[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOptionalString(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getStorageConfig() {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    return {
      kind: "supabase" as const,
      baseUrl: SUPABASE_URL.replace(/\/+$/, ""),
      bucket: DEFAULT_PRODUCT_IMAGE_BUCKET,
      serviceKey: SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  return {
    kind: "local" as const,
    absoluteBaseDir: path.join(process.cwd(), "public", "uploads"),
    publicPrefix: LOCAL_PRODUCT_IMAGE_PUBLIC_PREFIX,
  };
}

function buildSupabasePublicUrl(
  baseUrl: string,
  bucket: string,
  path: string,
) {
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

function buildLocalPublicUrl(publicPrefix: string, storagePath: string) {
  return `${publicPrefix}/${storagePath}`.replace(/\\/g, "/");
}

function buildLocalAbsolutePath(baseDir: string, storagePath: string) {
  return path.join(baseDir, storagePath);
}

async function localFileExists(filePath: string) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildManagedProductImagePath(options: {
  userId: string;
  publicSlug: string;
  sha256: string;
  extension: ManagedProductImageType["extension"];
  pathPrefix?: string;
}) {
  const safeSlug = slugify(options.publicSlug) || "product";
  const pathPrefix = options.pathPrefix?.trim() || PRODUCT_IMAGE_PATH_PREFIX;
  return `${pathPrefix}/${options.userId}/${safeSlug}/${options.sha256}.${options.extension}`;
}

function normalizeAllowedHosts(value?: readonly string[]) {
  const normalized = (value ?? DEFAULT_ALLOWED_SOURCE_HOSTS)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return normalized.length
    ? Array.from(new Set(normalized))
    : [...DEFAULT_ALLOWED_SOURCE_HOSTS];
}

function isAllowedSourceUrl(
  value: string,
  allowedHosts: readonly string[],
) {
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    const host = url.hostname.toLowerCase();
    return (
      (protocol === "https:" || protocol === "http:") &&
      allowedHosts.includes(host)
    );
  } catch {
    return false;
  }
}

function toBuffer(value: Uint8Array) {
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number,
) {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new Error(
        `Remote image exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`,
      );
    }
  }

  if (!response.body) {
    const fallbackBuffer = Buffer.from(await response.arrayBuffer());
    if (fallbackBuffer.length > maxBytes) {
      throw new Error(
        `Remote image exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`,
      );
    }
    return fallbackBuffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value || value.byteLength === 0) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error(
        `Remote image exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`,
      );
    }
    chunks.push(toBuffer(value));
  }

  return Buffer.concat(chunks, totalBytes);
}

function sniffManagedProductImageType(
  buffer: Buffer,
): ManagedProductImageType | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return {
      extension: "png",
      mimeType: "image/png",
    };
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      extension: "jpg",
      mimeType: "image/jpeg",
    };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return {
      extension: "webp",
      mimeType: "image/webp",
    };
  }

  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
      buffer.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return {
      extension: "gif",
      mimeType: "image/gif",
    };
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return {
      extension: "ico",
      mimeType: "image/x-icon",
    };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    const majorBrand = buffer.subarray(8, 12).toString("ascii");
    if (majorBrand === "avif" || majorBrand === "avis") {
      return {
        extension: "avif",
        mimeType: "image/avif",
      };
    }
  }

  return null;
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
  const isBase64 = metadata
    .split(";")
    .some((entry) => entry.trim().toLowerCase() === "base64");

  let buffer: Buffer;
  try {
    buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
  } catch {
    return null;
  }

  if (!buffer.byteLength || buffer.byteLength > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    return null;
  }

  const fileType = sniffManagedProductImageType(buffer);
  if (!fileType) {
    return null;
  }

  return {
    buffer,
    fileType,
  };
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isExistingObjectError(status: number, body: string) {
  if (status !== 400 && status !== 409) {
    return false;
  }
  return /already exists|duplicate|resource already exists/i.test(body);
}

async function downloadRemoteImage(options: {
  sourceUrl: string;
  allowedHosts: readonly string[];
}) {
  if (!isAllowedSourceUrl(options.sourceUrl, options.allowedHosts)) {
    throw new Error(
      `Remote image host is not allowed for managed import: ${options.sourceUrl}`,
    );
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const sourceUrl = new URL(options.sourceUrl);
      const response = await fetch(sourceUrl, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*",
          referer: sourceUrl.origin,
          "user-agent": REQUEST_USER_AGENT,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (
          isRetryableStatus(response.status) &&
          attempt < MAX_DOWNLOAD_ATTEMPTS
        ) {
          await sleep(300 * attempt);
          continue;
        }
        throw new Error(
          errorBody || `Source image download failed with status ${response.status}.`,
        );
      }

      const buffer = await readResponseBodyWithLimit(
        response,
        MAX_PRODUCT_IMAGE_SIZE_BYTES,
      );
      const detectedType = sniffManagedProductImageType(buffer);
      if (!detectedType) {
        throw new Error(
          `Unsupported remote image format for ${options.sourceUrl}.`,
        );
      }

      return {
        buffer,
        fileType: detectedType,
      };
    } catch (error) {
      const wrappedError =
        error instanceof Error
          ? error
          : new Error("Unknown remote image download failure.");
      lastError = wrappedError;

      const message = wrappedError.message.toLowerCase();
      const retryable =
        message.includes("timed out") ||
        message.includes("abort") ||
        message.includes("fetch failed") ||
        message.includes("network");
      if (!retryable || attempt >= MAX_DOWNLOAD_ATTEMPTS) {
        break;
      }
      await sleep(300 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Unknown remote image download failure.");
}

async function uploadManagedImage(options: {
  buffer: Buffer;
  storagePath: string;
  mimeType: ManagedProductImageType["mimeType"];
}) {
  const config = getStorageConfig();
  if (config.kind === "local") {
    const absolutePath = buildLocalAbsolutePath(
      config.absoluteBaseDir,
      options.storagePath,
    );
    const managedUrl = buildLocalPublicUrl(config.publicPrefix, options.storagePath);
    if (await localFileExists(absolutePath)) {
      return {
        managedUrl,
        uploaded: false,
      };
    }
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, options.buffer);
    return {
      managedUrl,
      uploaded: true,
    };
  }

  const uploadUrl = `${config.baseUrl}/storage/v1/object/${config.bucket}/${options.storagePath}`;
  const publicUrl = buildSupabasePublicUrl(
    config.baseUrl,
    config.bucket,
    options.storagePath,
  );

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.serviceKey}`,
          "content-type": options.mimeType,
          "x-upsert": "false",
        },
        body: new Uint8Array(options.buffer),
      });

      if (response.ok) {
        return {
          managedUrl: publicUrl,
          uploaded: true,
        };
      }

      const errorBody = await response.text();
      if (isExistingObjectError(response.status, errorBody)) {
        return {
          managedUrl: publicUrl,
          uploaded: false,
        };
      }

      if (isRetryableStatus(response.status) && attempt < MAX_UPLOAD_ATTEMPTS) {
        await sleep(300 * attempt);
        continue;
      }

      throw new Error(
        errorBody || `Managed image upload failed with status ${response.status}.`,
      );
    } catch (error) {
      const wrappedError =
        error instanceof Error
          ? error
          : new Error("Unknown managed image upload failure.");
      lastError = wrappedError;
      if (attempt >= MAX_UPLOAD_ATTEMPTS) {
        break;
      }
      await sleep(300 * attempt);
    }
  }

  throw lastError ?? new Error("Unknown managed image upload failure.");
}

function normalizeRemoteProductImage(
  value: RemoteProductImageInput | null | undefined,
) {
  if (!value) {
    return null;
  }
  const sourceUrl = normalizeOptionalString(value.sourceUrl);
  if (!sourceUrl) {
    return null;
  }
  return {
    sourceUrl,
    alt: normalizeOptionalString(value.alt),
  };
}

function normalizeRemoteProductImages(
  value: RemoteProductImageInput[] | null | undefined,
) {
  if (!value?.length) {
    return [];
  }

  return value
    .map((entry) => normalizeRemoteProductImage(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export async function ingestManagedProductImages(options: {
  userId: string;
  publicSlug: string;
  coverImage?: RemoteProductImageInput | null;
  galleryImages?: RemoteProductImageInput[] | null;
  allowedSourceHosts?: readonly string[];
}): Promise<ManagedProductImageIngestionResult> {
  const userId = normalizeOptionalString(options.userId);
  if (!userId) {
    throw new Error("A userId is required for managed product image ingestion.");
  }

  const publicSlug = normalizeOptionalString(options.publicSlug);
  if (!publicSlug) {
    throw new Error("A publicSlug is required for managed product image ingestion.");
  }

  const allowedHosts = normalizeAllowedHosts(options.allowedSourceHosts);
  const normalizedCover = normalizeRemoteProductImage(options.coverImage);
  const normalizedGallery = normalizeRemoteProductImages(options.galleryImages);
  const requestedImages = [
    ...(normalizedCover ? [normalizedCover] : []),
    ...normalizedGallery,
  ];

  if (!requestedImages.length) {
    return {
      coverImageUrl: null,
      gallery: null,
      assets: [],
    };
  }

  const assetsByHash = new Map<string, ManagedProductImageAsset>();
  const downloadsBySourceUrl = new Map<
    string,
    {
      buffer: Buffer;
      fileType: ManagedProductImageType;
      sha256: string;
    }
  >();
  const galleryEntries: ManagedProductGalleryEntry[] = [];
  const galleryHashes = new Set<string>();
  let coverHash: string | null = null;

  for (const [index, image] of requestedImages.entries()) {
    let downloaded = downloadsBySourceUrl.get(image.sourceUrl);
    if (!downloaded) {
      const { buffer, fileType } = await downloadRemoteImage({
        sourceUrl: image.sourceUrl,
        allowedHosts,
      });
      downloaded = {
        buffer,
        fileType,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      };
      downloadsBySourceUrl.set(image.sourceUrl, downloaded);
    }

    const { buffer, fileType, sha256 } = downloaded;

    let asset = assetsByHash.get(sha256);
    if (!asset) {
      const storagePath = buildManagedProductImagePath({
        userId,
        publicSlug,
        sha256,
        extension: fileType.extension,
      });
      const uploadResult = await uploadManagedImage({
        buffer,
        storagePath,
        mimeType: fileType.mimeType,
      });
      asset = {
        sourceUrl: image.sourceUrl,
        managedUrl: uploadResult.managedUrl,
        storagePath,
        sha256,
        extension: fileType.extension,
        mimeType: fileType.mimeType,
        sizeBytes: buffer.length,
        uploaded: uploadResult.uploaded,
      };
      assetsByHash.set(sha256, asset);
    }

    if (index === 0 && normalizedCover) {
      coverHash = sha256;
    }

    if (!galleryHashes.has(sha256)) {
      galleryHashes.add(sha256);
      galleryEntries.push({
        src: asset.managedUrl,
        ...(image.alt ? { alt: image.alt } : {}),
      });
      continue;
    }

    const existingEntry = galleryEntries.find((entry) => entry.src === asset.managedUrl);
    if (existingEntry && !existingEntry.alt && image.alt) {
      existingEntry.alt = image.alt;
    }
  }

  const coverImageUrl =
    (coverHash ? assetsByHash.get(coverHash)?.managedUrl : null) ??
    galleryEntries[0]?.src ??
    null;

  const gallery = galleryEntries.length
    ? galleryEntries.map((entry, index) => ({
        ...entry,
        isPrimary: coverImageUrl === entry.src ? true : undefined,
        position: index,
      }))
    : null;

  return {
    coverImageUrl,
    gallery,
    assets: Array.from(assetsByHash.values()),
  };
}

export function isInlineImageDataUrl(value: string) {
  return value.trim().toLowerCase().startsWith("data:image/");
}

export function isInlineProductImageDataUrl(value: string) {
  return isInlineImageDataUrl(value);
}

export async function uploadManagedImageDataUrl(options: {
  userId: string;
  publicSlug?: string;
  pathPrefix?: string;
  source: string;
}): Promise<ManagedProductImageDataUrlAsset> {
  const userId = normalizeOptionalString(options.userId);
  if (!userId) {
    throw new Error("A userId is required for managed product image upload.");
  }

  const publicSlug = normalizeOptionalString(options.publicSlug) ?? "image";
  if (!publicSlug) {
    throw new Error("A publicSlug is required for managed image upload.");
  }

  const decoded = decodeInlineImageDataUrl(options.source);
  if (!decoded) {
    throw new Error("Unsupported inline product image data URL.");
  }

  const sha256 = createHash("sha256").update(decoded.buffer).digest("hex");
  const storagePath = buildManagedProductImagePath({
    userId,
    publicSlug,
    sha256,
    extension: decoded.fileType.extension,
    pathPrefix: options.pathPrefix,
  });
  const uploadResult = await uploadManagedImage({
    buffer: decoded.buffer,
    storagePath,
    mimeType: decoded.fileType.mimeType,
  });

  return {
    sourceUrl: null,
    managedUrl: uploadResult.managedUrl,
    storagePath,
    sha256,
    extension: decoded.fileType.extension,
    mimeType: decoded.fileType.mimeType,
    sizeBytes: decoded.buffer.length,
    uploaded: uploadResult.uploaded,
  };
}

export async function uploadManagedProductImageDataUrl(options: {
  userId: string;
  publicSlug: string;
  source: string;
}): Promise<ManagedProductImageDataUrlAsset> {
  return uploadManagedImageDataUrl({
    userId: options.userId,
    publicSlug: options.publicSlug,
    source: options.source,
    pathPrefix: PRODUCT_IMAGE_PATH_PREFIX,
  });
}

export function isTechnoSmartManagedProductImageSource(
  value: string,
) {
  return isAllowedSourceUrl(value, DEFAULT_ALLOWED_SOURCE_HOSTS);
}
