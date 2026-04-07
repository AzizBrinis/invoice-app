import type { NextConfig } from "next";

const tracingIncludes = [
  "./node_modules/.prisma/client",
  "./node_modules/@sparticuz/chromium",
];

const CATALOG_CACHE_SECONDS = 30;
const CATALOG_STALE_SECONDS = 60;
const CATALOG_CACHE_HEADERS = [
  {
    key: "Cache-Control",
    value: `public, s-maxage=${CATALOG_CACHE_SECONDS}, stale-while-revalidate=${CATALOG_STALE_SECONDS}`,
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
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
