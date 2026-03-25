import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { WebsiteDomainStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppHostnames } from "@/lib/env";
import { slugify } from "@/lib/slug";
import {
  buildCatalogUrl,
  normalizeCatalogDomainInput,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((host) => normalizeCatalogDomainInput(host))
    .filter((host): host is string => Boolean(host)),
);

type SitemapWebsite = {
  userId: string;
  slug: string;
  updatedAt: Date | null;
  customDomain: string | null;
  domainStatus: WebsiteDomainStatus;
};

function isAppHost(host: string | null, normalizedHost: string | null) {
  if (!host) return true;
  if (APP_HOSTS.has(host)) return true;
  if (normalizedHost && APP_HOSTNAMES.has(normalizedHost)) return true;
  return false;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host")?.toLowerCase() ?? null;
  const normalizedHost = normalizeCatalogDomainInput(host);
  const appHost = isAppHost(host, normalizedHost);
  let websites: SitemapWebsite[] = [];

  if (!appHost && normalizedHost) {
    const website = await resolveCatalogWebsite({ domain: normalizedHost });
    if (!website) {
      return [];
    }
    websites = [
      {
        userId: website.userId,
        slug: website.slug,
        updatedAt: website.updatedAt,
        customDomain: website.customDomain,
        domainStatus: website.domainStatus,
      },
    ];
  } else {
    websites = await prisma.websiteConfig.findMany({
      where: { published: true },
      select: {
        userId: true,
        slug: true,
        updatedAt: true,
        customDomain: true,
        domainStatus: true,
      },
    });
  }

  if (!websites.length) {
    return [];
  }

  const userIds = websites.map((website) => website.userId);
  const products = await prisma.product.findMany({
    where: {
      userId: { in: userIds },
      isActive: true,
      isListedInCatalog: true,
    },
    select: {
      userId: true,
      publicSlug: true,
      updatedAt: true,
      category: true,
    },
  });

  const productsByUser = new Map<string, typeof products>();
  const categoriesByUser = new Map<string, Set<string>>();

  products.forEach((product) => {
    const existing = productsByUser.get(product.userId) ?? [];
    existing.push(product);
    productsByUser.set(product.userId, existing);

    if (!product.category) {
      return;
    }
    const categorySlug = slugify(product.category);
    if (!categorySlug) {
      return;
    }
    const categories = categoriesByUser.get(product.userId) ?? new Set<string>();
    categories.add(categorySlug);
    categoriesByUser.set(product.userId, categories);
  });

  return websites.flatMap((website) => {
    const baseUpdatedAt = website.updatedAt ?? new Date();
    const entries: MetadataRoute.Sitemap = [
      {
        url: buildCatalogUrl({ website, path: "/" }),
        lastModified: baseUpdatedAt,
      },
    ];

    const categorySlugs = Array.from(
      categoriesByUser.get(website.userId) ?? [],
    );
    categorySlugs.forEach((categorySlug) => {
      entries.push({
        url: buildCatalogUrl({
          website,
          path: `/categories/${categorySlug}`,
        }),
        lastModified: baseUpdatedAt,
      });
    });

    const websiteProducts = productsByUser.get(website.userId) ?? [];
    websiteProducts.forEach((product) => {
      entries.push({
        url: buildCatalogUrl({
          website,
          path: `/produit/${product.publicSlug}`,
        }),
        lastModified: product.updatedAt ?? baseUpdatedAt,
      });
    });

    return entries;
  });
}
