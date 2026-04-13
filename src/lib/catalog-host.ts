import { getAppHostnames, getCatalogEdgeDomain } from "@/lib/env";

const DOMAIN_HOSTNAME_PATTERN = /^[a-z0-9.-]+$/i;

type HeadersLike = {
  get(name: string): string | null;
};

function firstHeaderValue(value: string | null | undefined) {
  return value?.split(",")[0]?.trim().toLowerCase() || null;
}

function sanitizeHost(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/.*$/, "");
}

export function normalizeCatalogHostname(value?: string | null) {
  if (!value) return null;
  const sanitized = sanitizeHost(value);
  if (!sanitized) return null;
  const candidate = /^[a-z]+:\/\//i.test(sanitized)
    ? sanitized
    : `https://${sanitized}`;
  try {
    const hostname = new URL(candidate).hostname.toLowerCase();
    if (!hostname || !DOMAIN_HOSTNAME_PATTERN.test(hostname)) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

function normalizeHostEntry(value: string) {
  return firstHeaderValue(value);
}

export function getConfiguredAppHostEntries() {
  return getAppHostnames()
    .map((host) => normalizeHostEntry(host))
    .filter((host): host is string => Boolean(host));
}

export function getConfiguredAppHostnames() {
  return getConfiguredAppHostEntries()
    .map((host) => normalizeCatalogHostname(host))
    .filter((host): host is string => Boolean(host));
}

export function isConfiguredAppHost(value?: string | null) {
  const host = firstHeaderValue(value);
  if (!host) {
    return true;
  }
  const appHosts = new Set(getConfiguredAppHostEntries());
  if (appHosts.has(host)) {
    return true;
  }
  const hostname = normalizeCatalogHostname(host);
  if (!hostname) {
    return false;
  }
  return new Set(getConfiguredAppHostnames()).has(hostname);
}

export function isReservedPublicHostname(value?: string | null) {
  const hostname = normalizeCatalogHostname(value);
  if (!hostname) {
    return false;
  }
  if (isConfiguredAppHost(hostname)) {
    return true;
  }
  const edgeHostname = normalizeCatalogHostname(getCatalogEdgeDomain());
  return Boolean(edgeHostname && hostname === edgeHostname);
}

export function resolveRequestHost(headers: HeadersLike) {
  return (
    firstHeaderValue(headers.get("x-forwarded-host")) ??
    firstHeaderValue(headers.get("host"))
  );
}

export function resolveCatalogDomainFromHost(value?: string | null) {
  if (isConfiguredAppHost(value)) {
    return null;
  }
  return normalizeCatalogHostname(value);
}

export function resolveCatalogDomainFromHeaders(headers: HeadersLike) {
  return resolveCatalogDomainFromHost(resolveRequestHost(headers));
}
