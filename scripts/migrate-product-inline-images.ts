import {
  Prisma,
  PrismaClient,
} from "@/lib/db/prisma-server";
import { resolveScriptDatabaseUrl } from "../src/lib/db/runtime-config";
import {
  isInlineProductImageDataUrl,
  uploadManagedProductImageDataUrl,
} from "../src/server/product-media-storage";

type ProductImageRow = {
  id: string;
  userId: string;
  publicSlug: string;
  name: string;
  sku: string;
  coverImageUrl: string | null;
  gallery: Prisma.JsonValue | null;
};

type GalleryObject = {
  src?: unknown;
  url?: unknown;
  [key: string]: unknown;
};

const WRITE_ENABLED = process.argv.includes("--write");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveScriptDatabaseUrl(),
    },
  },
});

function isRecord(value: unknown): value is GalleryObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasInlineGalleryImage(gallery: Prisma.JsonValue | null) {
  if (!Array.isArray(gallery)) {
    return false;
  }
  return gallery.some((entry) => {
    if (typeof entry === "string") {
      return isInlineProductImageDataUrl(entry);
    }
    if (!isRecord(entry)) {
      return false;
    }
    const source =
      typeof entry.src === "string"
        ? entry.src
        : typeof entry.url === "string"
          ? entry.url
          : "";
    return source ? isInlineProductImageDataUrl(source) : false;
  });
}

function countInlineProductImageSources(product: ProductImageRow) {
  const sources = new Set<string>();
  if (
    product.coverImageUrl &&
    isInlineProductImageDataUrl(product.coverImageUrl)
  ) {
    sources.add(product.coverImageUrl);
  }
  if (Array.isArray(product.gallery)) {
    product.gallery.forEach((entry) => {
      if (typeof entry === "string") {
        if (isInlineProductImageDataUrl(entry)) {
          sources.add(entry);
        }
        return;
      }
      if (!isRecord(entry)) {
        return;
      }
      const source =
        typeof entry.src === "string"
          ? entry.src
          : typeof entry.url === "string"
            ? entry.url
            : "";
      if (source && isInlineProductImageDataUrl(source)) {
        sources.add(source);
      }
    });
  }
  return sources.size;
}

async function migrateProductImages(product: ProductImageRow) {
  const uploadedSources = new Map<string, Promise<string>>();
  const resolveSource = (source: string) => {
    if (!isInlineProductImageDataUrl(source)) {
      return Promise.resolve(source);
    }

    let uploaded = uploadedSources.get(source);
    if (!uploaded) {
      uploaded = uploadManagedProductImageDataUrl({
        userId: product.userId,
        publicSlug: product.publicSlug || product.sku || product.id,
        source,
      }).then((asset) => asset.managedUrl);
      uploadedSources.set(source, uploaded);
    }
    return uploaded;
  };

  const nextCoverImageUrl = product.coverImageUrl
    ? await resolveSource(product.coverImageUrl)
    : product.coverImageUrl;
  const nextGallery = Array.isArray(product.gallery)
    ? await Promise.all(
        product.gallery.map(async (entry) => {
          if (typeof entry === "string") {
            return resolveSource(entry);
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
          if (!source) {
            return entry;
          }
          return {
            ...(entry as Record<string, unknown>),
            src: await resolveSource(source),
          };
        }),
      )
    : product.gallery;

  return {
    coverImageUrl: nextCoverImageUrl,
    gallery: nextGallery,
    uploadedCount: uploadedSources.size,
  };
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      userId: true,
      publicSlug: true,
      name: true,
      sku: true,
      coverImageUrl: true,
      gallery: true,
    },
    orderBy: [{ userId: "asc" }, { name: "asc" }, { id: "asc" }],
  });

  const affected = products.filter(
    (product) =>
      (product.coverImageUrl &&
        isInlineProductImageDataUrl(product.coverImageUrl)) ||
      hasInlineGalleryImage(product.gallery),
  );

  console.log(
    `${WRITE_ENABLED ? "Migrating" : "Dry run:"} ${affected.length} of ${products.length} products contain inline images.`,
  );

  let uploadedAssets = 0;
  for (const product of affected) {
    if (!WRITE_ENABLED) {
      const inlineCount = countInlineProductImageSources(product);
      uploadedAssets += inlineCount;
      console.log(
        `would update ${product.id} ${product.name} (${inlineCount} asset${inlineCount === 1 ? "" : "s"})`,
      );
      continue;
    }

    const migrated = await migrateProductImages(product);
    uploadedAssets += migrated.uploadedCount;
    console.log(
      `updated ${product.id} ${product.name} (${migrated.uploadedCount} asset${migrated.uploadedCount === 1 ? "" : "s"})`,
    );

    await prisma.product.update({
      where: { id: product.id },
      data: {
        coverImageUrl: migrated.coverImageUrl,
        gallery:
          migrated.gallery == null
            ? Prisma.JsonNull
            : (migrated.gallery as Prisma.InputJsonValue),
      },
    });
  }

  console.log(
    `${WRITE_ENABLED ? "Uploaded/reused" : "Would upload/reuse"} ${uploadedAssets} managed image assets.`,
  );
  if (!WRITE_ENABLED) {
    console.log("Run with --write to update Product rows.");
  }
}

main()
  .catch((error) => {
    console.error("[migrate-product-inline-images] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
