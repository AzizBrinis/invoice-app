import type { NextConfig } from "next";

const tracingIncludes = [
  "./node_modules/@sparticuz/chromium",
];

const CATALOG_CACHE_SECONDS = 30;
const CATALOG_STALE_SECONDS = 60;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const OPTIMIZED_REMOTE_SOURCES: Array<{
  protocol: "http" | "https";
  hostname: string;
}> = [
  {
    protocol: "https" as const,
    hostname: "images.unsplash.com",
  },
  {
    protocol: "https" as const,
    hostname: "m.media-amazon.com",
  },
  {
    protocol: "https" as const,
    hostname: "images-na.ssl-images-amazon.com",
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
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https: ws: wss:",
  "frame-src 'self' https:",
  "media-src 'self' data: blob: https:",
  ...(IS_PRODUCTION ? ["upgrade-insecure-requests"] : []),
].join("; ");
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
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
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
  ...(IS_PRODUCTION
    ? ([
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000",
        },
      ] satisfies Array<{ key: string; value: string }>)
    : []),
];
const CATALOG_CACHE_HEADERS = [
  {
    key: "Cache-Control",
    value: `public, s-maxage=${CATALOG_CACHE_SECONDS}, stale-while-revalidate=${CATALOG_STALE_SECONDS}`,
  },
];
const IMMUTABLE_ASSET_HEADERS = [
  {
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["imapflow"],
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
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/catalogue",
        headers: CATALOG_CACHE_HEADERS,
      },
      {
        source: "/catalogue/:path*",
        headers: CATALOG_CACHE_HEADERS,
      },
      {
        source: "/images/placeholders/:path*",
        headers: IMMUTABLE_ASSET_HEADERS,
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
