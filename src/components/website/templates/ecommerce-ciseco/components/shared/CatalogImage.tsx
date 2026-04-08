import NextImage from "next/image";
import type { ImgHTMLAttributes } from "react";

function resolveOptimizedRemoteHosts() {
  const hosts = new Set(["images.unsplash.com"]);
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
    return (
      <NextImage
        src={normalizedSrc}
        alt={alt}
        className={className}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : loading}
        fetchPriority={priority ? "high" : undefined}
        unoptimized={unoptimized}
        {...(fill ? { fill: true } : { width, height })}
      />
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : loading}
      fetchPriority={priority ? "high" : "auto"}
      decoding={decoding}
    />
  );
}
