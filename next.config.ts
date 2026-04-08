import type { NextConfig } from "next";

const tracingIncludes = [
  "./node_modules/.prisma/client",
  "./node_modules/@sparticuz/chromium",
];

const CATALOG_CACHE_SECONDS = 30;
const CATALOG_STALE_SECONDS = 60;
const OPTIMIZED_REMOTE_SOURCES: Array<{
  protocol: "http" | "https";
  hostname: string;
}> = [
  {
    protocol: "https" as const,
    hostname: "images.unsplash.com",
  },
];
const configuredStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
if (configuredStorageUrl) {
  try {
    const parsedStorageUrl = new URL(configuredStorageUrl);
    const protocol = parsedStorageUrl.protocol.replace(":", "");
    if (
      (protocol === "http" || protocol === "https") &&
      !OPTIMIZED_REMOTE_SOURCES.some(
        (entry) =>
          entry.protocol === protocol &&
          entry.hostname === parsedStorageUrl.hostname,
      )
    ) {
      OPTIMIZED_REMOTE_SOURCES.push({
        protocol,
        hostname: parsedStorageUrl.hostname,
      });
    }
  } catch {
    // Ignore invalid public storage URLs in local envs.
  }
}
const CATALOG_CACHE_HEADERS = [
  {
    key: "Cache-Control",
    value: `public, s-maxage=${CATALOG_CACHE_SECONDS}, stale-while-revalidate=${CATALOG_STALE_SECONDS}`,
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: OPTIMIZED_REMOTE_SOURCES,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  async headers() {
    return [
      {
        source: "/catalogue",
        headers: CATALOG_CACHE_HEADERS,
      },
      {
        source: "/catalogue/:path*",
        headers: CATALOG_CACHE_HEADERS,
      },
    ];
  },
  outputFileTracingIncludes: {
    "/(app)": tracingIncludes,
    "/api": tracingIncludes,
    "/": tracingIncludes,
  },
};

export default nextConfig;
