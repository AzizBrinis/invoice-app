import type { NextRequest } from "next/server";
import { handleCatalogHostRouting } from "@/lib/catalog-proxy";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function normalizeCsp(parts: string[]) {
  return parts.join("; ").replace(/\s{2,}/g, " ").trim();
}

function buildStrictCsp(nonce: string) {
  return normalizeCsp([
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `script-src 'self' 'nonce-${nonce}'${IS_PRODUCTION ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https: ws: wss:",
    "frame-src 'self' https:",
    "media-src 'self' data: blob: https:",
    ...(IS_PRODUCTION ? ["upgrade-insecure-requests"] : []),
  ]);
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  const csp = buildStrictCsp(nonce);

  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);

  const response = handleCatalogHostRouting(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known(?:/.*)?|api|assets).*)",
  ],
};
