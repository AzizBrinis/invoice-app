import type { WebsiteDomainStatus } from "@/lib/db/prisma";

type PublicWebsiteHrefOptions = {
  slug: string;
  targetPath: string;
  mode: "public" | "preview";
  customDomain?: string | null;
  domainStatus?: WebsiteDomainStatus | null;
};

function normalizePublicPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
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

export function buildPublicWebsiteHref(options: PublicWebsiteHrefOptions) {
  const normalizedTarget = normalizePublicPath(options.targetPath);

  if (options.mode === "preview") {
    return `/preview?path=${encodeURIComponent(normalizedTarget)}`;
  }

  if (
    hasActiveCustomDomain({
      customDomain: options.customDomain,
      domainStatus: options.domainStatus,
    })
  ) {
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
