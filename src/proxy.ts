import type { NextRequest } from "next/server";
import { isConfiguredAppHost, resolveRequestHost } from "@/lib/catalog-host";
import { handleCatalogHostRouting } from "@/lib/catalog-proxy";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const APP_PATH_PREFIXES = [
  "/assistant",
  "/clients",
  "/collaborateurs",
  "/devis",
  "/factures",
  "/messagerie",
  "/paiements",
  "/parametres",
  "/produits",
  "/services",
  "/site-web",
  "/tableau-de-bord",
] as const;

function normalizeCsp(parts: string[]) {
  return parts.join("; ").replace(/\s{2,}/g, " ").trim();
}

function buildRelaxedCsp() {
  return normalizeCsp([
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `script-src 'self' 'unsafe-inline'${IS_PRODUCTION ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https: ws: wss:",
    "frame-src 'self' https:",
    "media-src 'self' data: blob: https:",
    ...(IS_PRODUCTION ? ["upgrade-insecure-requests"] : []),
  ]);
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

function isStrictAppPath(pathname: string) {
  return APP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const strictCsp =
    isConfiguredAppHost(resolveRequestHost(request.headers)) &&
    isStrictAppPath(request.nextUrl.pathname);
  const nonce = strictCsp ? btoa(crypto.randomUUID()) : null;
  const requestHeaders = new Headers(request.headers);
  const csp = strictCsp && nonce ? buildStrictCsp(nonce) : buildRelaxedCsp();

  requestHeaders.set("Content-Security-Policy", csp);
  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
  } else {
    requestHeaders.delete("x-nonce");
  }

  const response = handleCatalogHostRouting(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known(?:/.*)?|api|assets).*)",
  ],
};
