import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isConfiguredAppHost,
  normalizeCatalogHostname,
  resolveRequestHost,
} from "@/lib/catalog-host";

const CATALOG_PUBLIC_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=60";

const CATALOG_UNCACHEABLE_PATH_PREFIXES = [
  "/account",
  "/cart",
  "/checkout",
  "/order-success",
  "/login",
  "/signup",
  "/forgot-password",
  "/panier",
  "/paiement",
  "/confirmation",
] as const;

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

function isCacheableCatalogPage(pathname: string) {
  const normalized = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  return !CATALOG_UNCACHEABLE_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
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
  const response = NextResponse.rewrite(url, {
    request: { headers: forwardedHeaders },
  });
  if (isCacheableCatalogPage(pathname)) {
    response.headers.set("Cache-Control", CATALOG_PUBLIC_CACHE_CONTROL);
  }
  return response;
}
