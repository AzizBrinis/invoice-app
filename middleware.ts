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

export function middleware(request: NextRequest) {
  const requestHost = resolveRequestHost(request.headers);
  const normalizedHost = normalizeCatalogHostname(requestHost);
  if (isConfiguredAppHost(requestHost)) {
    return NextResponse.next();
  }
  if (!normalizedHost) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  const suffix = pathname === "/" ? "" : pathname;
  url.pathname = `/catalogue${suffix}`;
  url.searchParams.set("domain", normalizedHost);
  if (pathname && pathname !== "/" && !pathname.includes("..") && !pathname.includes("\\")) {
    url.searchParams.set("path", pathname);
  }
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api|assets).*)"],
};
