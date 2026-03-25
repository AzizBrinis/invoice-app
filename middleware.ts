import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAppHostnames } from "@/lib/env";

const APP_HOSTS = new Set(getAppHostnames());
const DOMAIN_HOSTNAME_PATTERN = /^[a-z0-9.-]+$/i;

function normalizeHost(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    return new URL(`https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeHost(entry))
    .filter((entry): entry is string => Boolean(entry)),
);

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
  const host = request.headers.get("host")?.toLowerCase() ?? null;
  const normalizedHost = normalizeHost(host);
  const isAppHost = host
    ? APP_HOSTS.has(host) || (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false)
    : true;
  if (isAppHost) {
    return NextResponse.next();
  }
  if (!normalizedHost || !DOMAIN_HOSTNAME_PATTERN.test(normalizedHost)) {
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
