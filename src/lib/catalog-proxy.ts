import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isConfiguredAppHost,
  normalizeCatalogHostname,
  resolveRequestHost,
} from "@/lib/catalog-host";

const CATALOG_PUBLIC_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=3600";
const CATALOG_BLOCKED_CACHE_CONTROL =
  "public, s-maxage=600, stale-while-revalidate=3600";

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

const CATALOG_BLOCKED_PATH_PREFIXES = [
  "/admin",
  "/administrator",
  "/autodiscover",
  "/boaform",
  "/cgi-bin",
  "/debug",
  "/hudson",
  "/jenkins",
  "/phpmyadmin",
  "/pma",
  "/remote",
  "/server-status",
  "/solr",
  "/vendor",
  "/wp",
  "/wp-admin",
  "/wp-content",
  "/wp-includes",
  "/wp-json",
  "/wordpress",
] as const;

const CATALOG_BLOCKED_PATHS = [
  "/adminer",
  "/xmlrpc",
  "/wp-login",
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

function decodePathname(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function normalizePathname(pathname: string) {
  const lower = pathname.toLowerCase();
  return lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
}

function isBlockedPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isBlockedCatalogPath(pathname: string) {
  const decodedPathname = decodePathname(pathname);
  if (!decodedPathname) {
    return true;
  }
  if (
    decodedPathname.length > 512 ||
    decodedPathname.includes("\0") ||
    decodedPathname.includes("\\") ||
    /[<>]/.test(decodedPathname)
  ) {
    return true;
  }

  const normalized = normalizePathname(decodedPathname);
  const segments = normalized.split("/").filter(Boolean);
  if (
    segments.some(
      (segment) =>
        segment === "." || segment === ".." || segment.startsWith("."),
    )
  ) {
    return true;
  }

  return (
    CATALOG_BLOCKED_PATHS.includes(normalized as (typeof CATALOG_BLOCKED_PATHS)[number]) ||
    CATALOG_BLOCKED_PATH_PREFIXES.some((prefix) =>
      isBlockedPathPrefix(normalized, prefix),
    )
  );
}

function buildBlockedCatalogResponse() {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": CATALOG_BLOCKED_CACHE_CONTROL,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
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
  if (isBlockedCatalogPath(pathname)) {
    return buildBlockedCatalogResponse();
  }
  const url = request.nextUrl.clone();
  const suffix = pathname === "/" ? "" : pathname;
  url.pathname = `/catalogue${suffix}`;
  url.searchParams.set("domain", normalizedHost);
  if (pathname && pathname !== "/") {
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
