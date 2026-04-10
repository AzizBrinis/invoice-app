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

const APP_HOST_DISALLOWS = [
  "/api/",
  "/preview",
  "/connexion",
  "/inscription",
  "/tableau-de-bord",
  "/assistant",
  "/clients",
  "/services",
  "/factures",
  "/devis",
  "/paiements",
  "/parametres",
  "/site-web",
  "/produits",
  "/collaborateurs",
  "/messagerie",
] as const;

const CATALOGUE_HOST_DISALLOWS = [
  "/api/",
  "/preview",
  "/login",
  "/signup",
  "/forgot-password",
  "/account",
  "/cart",
  "/checkout",
  "/order-success",
  "/search",
  "/panier",
  "/paiement",
  "/confirmation",
  "/recherche",
] as const;

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

  const resolvedHost = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return undefined;
    }
  })();

  return {
    rules: {
      userAgent: "*",
      allow: appHost ? ["/catalogue", "/catalogue/"] : "/",
      disallow: appHost
        ? [...APP_HOST_DISALLOWS]
        : [...CATALOGUE_HOST_DISALLOWS],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: resolvedHost,
  };
}
