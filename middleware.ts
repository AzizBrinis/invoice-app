import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAppHostnames } from "@/lib/env";

const APP_HOSTS = new Set(getAppHostnames());

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
  const host = request.headers.get("host")?.toLowerCase();
  if (!host || APP_HOSTS.has(host)) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  const suffix = pathname === "/" ? "" : pathname;
  url.pathname = `/catalogue${suffix}`;
  url.searchParams.set("domain", host);
  if (pathname && pathname !== "/") {
    url.searchParams.set("path", pathname);
  }
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api|assets).*)"],
};
