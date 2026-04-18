import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  resolveCatalogDomainFromHost,
  resolveRequestHost,
} from "@/lib/catalog-host";
import { getAppBaseUrl } from "@/lib/env";
import {
  resolveCatalogWebsite,
} from "@/server/website";

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
  "/panier",
  "/paiement",
  "/confirmation",
] as const;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const requestHost = resolveRequestHost(requestHeaders);
  const domain = resolveCatalogDomainFromHost(requestHost);
  const appHost = !domain;
  let baseUrl = getAppBaseUrl();

  if (domain) {
    const website = await resolveCatalogWebsite({ domain });
    if (website) {
      const resolvedDomain = website.customDomain ?? domain;
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
