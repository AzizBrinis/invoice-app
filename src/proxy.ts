import type { NextRequest } from "next/server";
import { handleCatalogHostRouting } from "@/lib/catalog-proxy";

export function proxy(request: NextRequest) {
  return handleCatalogHostRouting(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known(?:/.*)?|api|assets).*)",
  ],
};
