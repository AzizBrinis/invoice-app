import type { WebsiteDomainStatus } from "@/lib/db/prisma";
import { sanitizePublicPath } from "@/lib/website/url-safety";

type PublicWebsiteHrefOptions = {
  slug: string;
  targetPath: string;
  mode: "public" | "preview";
  customDomain?: string | null;
  domainStatus?: WebsiteDomainStatus | null;
  useCustomDomainPaths?: boolean;
};

function normalizePublicPath(value: string) {
  return sanitizePublicPath(value, "/");
}

export function hasActiveCustomDomain(options: {
  customDomain?: string | null;
  domainStatus?: WebsiteDomainStatus | null;
}) {
  return Boolean(
    options.customDomain &&
      options.domainStatus &&
      options.domainStatus === "ACTIVE",
  );
}

function normalizeCustomDomainHost(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^\/+/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "")
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(`https://${normalized}`);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.hostname !== normalized
    ) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function buildActiveCustomDomainUrl(options: {
  customDomain?: string | null;
  domainStatus?: WebsiteDomainStatus | null;
  path?: string;
}) {
  if (!hasActiveCustomDomain(options)) {
    return null;
  }

  const host = normalizeCustomDomainHost(options.customDomain);
  if (!host) {
    return null;
  }

  const normalizedPath = sanitizePublicPath(options.path, "/");
  const pathSegment = normalizedPath === "/" ? "" : normalizedPath;
  return `https://${host}${pathSegment}`;
}

export function buildPublicWebsiteHref(options: PublicWebsiteHrefOptions) {
  const normalizedTarget = normalizePublicPath(options.targetPath);
  const activeCustomDomain = hasActiveCustomDomain({
    customDomain: options.customDomain,
    domainStatus: options.domainStatus,
  });
  const useCustomDomainPaths =
    options.useCustomDomainPaths ?? activeCustomDomain;

  if (options.mode === "preview") {
    return `/preview?path=${encodeURIComponent(normalizedTarget)}`;
  }

  if (activeCustomDomain && useCustomDomainPaths) {
    return normalizedTarget;
  }

  return `/catalogue/${options.slug}${normalizedTarget}`;
}

export function isSameCustomDomain(
  currentDomain: string | null | undefined,
  nextDomain: string,
) {
  return (currentDomain ?? "").trim().toLowerCase() === nextDomain.trim().toLowerCase();
}
