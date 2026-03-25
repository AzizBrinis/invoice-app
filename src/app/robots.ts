import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getAppBaseUrl, getAppHostnames } from "@/lib/env";
import {
  normalizeCatalogDomainInput,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((host) => normalizeCatalogDomainInput(host))
    .filter((host): host is string => Boolean(host)),
);

function isAppHost(host: string | null, normalizedHost: string | null) {
  if (!host) return true;
  if (APP_HOSTS.has(host)) return true;
  if (normalizedHost && APP_HOSTNAMES.has(normalizedHost)) return true;
  return false;
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host")?.toLowerCase() ?? null;
  const normalizedHost = normalizeCatalogDomainInput(host);
  const appHost = isAppHost(host, normalizedHost);
  let baseUrl = getAppBaseUrl();

  if (!appHost && normalizedHost) {
    const website = await resolveCatalogWebsite({ domain: normalizedHost });
    if (website) {
      const resolvedDomain = website.customDomain ?? normalizedHost;
      baseUrl = `https://${resolvedDomain}`;
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
