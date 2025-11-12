import type { NextConfig } from "next";

const tracingIncludes = [
  "./node_modules/.prisma/client",
  "./node_modules/@sparticuz/chromium",
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/(app)": tracingIncludes,
    "/api": tracingIncludes,
    "/": tracingIncludes,
  },
};

export default nextConfig;
