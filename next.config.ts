import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/(app)": ["./node_modules/.prisma/client"],
    "/api": ["./node_modules/.prisma/client"],
    "/": ["./node_modules/.prisma/client"],
  },
};

export default nextConfig;
