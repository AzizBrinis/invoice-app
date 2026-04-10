import NextImage from "next/image";
import type { ImgHTMLAttributes } from "react";

function resolveOptimizedRemoteHosts() {
  const hosts = new Set([
    "images.unsplash.com",
    "m.media-amazon.com",
    "images-na.ssl-images-amazon.com",
  ]);
  const configuredStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredStorageUrl) {
    return hosts;
  }
  try {
    hosts.add(new URL(configuredStorageUrl).hostname);
  } catch {
    return hosts;
  }
  return hosts;
}

const OPTIMIZED_REMOTE_HOSTS = resolveOptimizedRemoteHosts();
const LISTING_IMAGE_WIDTHS = [160, 240, 320, 480, 640, 768, 960, 1200];

type CatalogImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  fill?: boolean;
  width?: number;
  height?: number;
  decoding?: ImgHTMLAttributes<HTMLImageElement>["decoding"];
};

function shouldBypassImageOptimization(src: string) {
  if (src.startsWith("data:")) {
    return true;
  }

  if (src.startsWith("/api/catalogue/products/")) {
    return true;
  }

  return /\.svg(?:$|[?#])/i.test(src);
}

function isCatalogListingImageRoute(src: string) {
  return src.startsWith("/api/catalogue/products/");
}

function buildResponsiveListingImageUrl(
  src: string,
  width: number,
  quality = 72,
) {
  const [pathname, hash = ""] = src.split("#");
  const [basePath, query = ""] = pathname.split("?");
  const params = new URLSearchParams(query);
  params.set("w", String(width));
  params.set("q", String(quality));
  const queryString = params.toString();
  return `${basePath}${queryString ? `?${queryString}` : ""}${hash ? `#${hash}` : ""}`;
}

function canUseNextImage(src: string) {
  if (src.startsWith("/") || src.startsWith("data:")) {
    return true;
  }

  try {
    const url = new URL(src);
    return OPTIMIZED_REMOTE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function CatalogImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
  loading = "lazy",
  fill = false,
  width = 640,
  height = 640,
  decoding = "async",
}: CatalogImageProps) {
  const normalizedSrc = src.trim();
  const unoptimized = shouldBypassImageOptimization(normalizedSrc);
  if (!normalizedSrc) {
    return null;
  }

  if (canUseNextImage(normalizedSrc)) {
    if (isCatalogListingImageRoute(normalizedSrc)) {
      const responsiveWidths = LISTING_IMAGE_WIDTHS.filter(
        (candidate) => fill || candidate <= Math.max(width * 2, 640),
      );
      const fallbackWidth =
        responsiveWidths.find((candidate) => candidate >= width) ??
        responsiveWidths[responsiveWidths.length - 1] ??
        width;

      return (
        <img
          src={buildResponsiveListingImageUrl(normalizedSrc, fallbackWidth)}
          srcSet={responsiveWidths
            .map(
              (candidate) =>
                `${buildResponsiveListingImageUrl(normalizedSrc, candidate)} ${candidate}w`,
            )
            .join(", ")}
          sizes={sizes}
          alt={alt}
          className={`${fill ? "absolute inset-0 h-full w-full " : ""}${className ?? ""}`.trim()}
          loading={priority ? "eager" : loading}
          fetchPriority={priority ? "high" : "auto"}
          decoding={decoding}
          {...(fill ? {} : { width, height })}
        />
      );
    }

    return (
      <NextImage
        src={normalizedSrc}
        alt={alt}
        className={className}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading}
        fetchPriority={priority ? "high" : undefined}
        decoding={decoding}
        unoptimized={unoptimized}
        {...(fill ? { fill: true } : { width, height })}
      />
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={`${fill ? "absolute inset-0 h-full w-full " : ""}${className ?? ""}`.trim()}
      loading={priority ? "eager" : loading}
      fetchPriority={priority ? "high" : "auto"}
      decoding={decoding}
      {...(fill ? {} : { width, height })}
    />
  );
}
