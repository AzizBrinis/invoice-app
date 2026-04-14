import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isConfiguredAppHost,
  normalizeCatalogHostname,
  resolveRequestHost,
} from "@/lib/catalog-host";

function isStaticPath(pathname: string) {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static")
  ) {
    return true;
  }
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return true;
  }
  return /\.[a-z0-9]+$/i.test(pathname);
}

export function handleCatalogHostRouting(
  request: NextRequest,
  requestHeaders?: Headers,
) {
  const forwardedHeaders = requestHeaders ?? request.headers;
  const requestHost = resolveRequestHost(forwardedHeaders);
  const normalizedHost = normalizeCatalogHostname(requestHost);
  if (isConfiguredAppHost(requestHost)) {
    return NextResponse.next({
      request: { headers: forwardedHeaders },
    });
  }
  if (!normalizedHost) {
    return NextResponse.next({
      request: { headers: forwardedHeaders },
    });
  }
  const pathname = request.nextUrl.pathname;
  if (isStaticPath(pathname)) {
    return NextResponse.next({
      request: { headers: forwardedHeaders },
    });
  }
  const url = request.nextUrl.clone();
  const suffix = pathname === "/" ? "" : pathname;
  url.pathname = `/catalogue${suffix}`;
  url.searchParams.set("domain", normalizedHost);
  if (pathname && pathname !== "/" && !pathname.includes("..") && !pathname.includes("\\")) {
    url.searchParams.set("path", pathname);
  }
  return NextResponse.rewrite(url, {
    request: { headers: forwardedHeaders },
  });
}
