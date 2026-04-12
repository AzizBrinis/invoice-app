import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { WebsiteDomainStatus } from "@/lib/db/prisma";
import { prisma } from "@/lib/db";
import { getAppHostnames } from "@/lib/env";
import { slugify } from "@/lib/slug";
import { builderConfigSchema } from "@/lib/website/builder";
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
  id: string;
  userId: string;
  slug: string;
  templateKey: string;
  builderConfig: unknown;
  updatedAt: Date | null;
  customDomain: string | null;
  domainStatus: WebsiteDomainStatus;
};

type SitemapProduct = {
  userId: string;
  publicSlug: string;
  updatedAt: Date | null;
  category: string | null;
};

type SitemapCmsPage = {
  websiteId: string;
  path: string;
  updatedAt: Date;
};

function buildCatalogLocalizedUrl(options: {
  website: Pick<SitemapWebsite, "slug" | "customDomain" | "domainStatus">;
  path: string;
  locale?: "fr" | "en";
}) {
  const url = new URL(
    buildCatalogUrl({
      website: options.website,
      path: options.path,
    }),
  );
  if (options.locale) {
    url.searchParams.set("lang", options.locale);
  }
  return url.toString();
}

function buildSitemapLanguageAlternates(
  website: SitemapWebsite,
  path: string,
) {
  if (website.templateKey !== "ecommerce-ciseco-home") {
    return undefined;
  }

  return {
    languages: {
      fr: buildCatalogLocalizedUrl({ website, path, locale: "fr" }),
      en: buildCatalogLocalizedUrl({ website, path, locale: "en" }),
      "x-default": buildCatalogLocalizedUrl({ website, path, locale: "fr" }),
    },
  } satisfies NonNullable<MetadataRoute.Sitemap[number]["alternates"]>;
}

function normalizeBlogPath(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/^\/+/, "")
    .replace(/^blog\//i, "")
    .replace(/^journal\//i, "")
    .replace(/\/+$/, "");
  if (!normalized) {
    return null;
  }

  const slug = slugify(normalized);
  return slug ? `/blog/${slug}` : null;
}

function collectTemplateStaticPaths(website: SitemapWebsite) {
  const paths = new Set<string>(["/"]);

  if (website.templateKey !== "ecommerce-ciseco-home") {
    return paths;
  }

  ["/collections", "/about", "/blog", "/contact"].forEach((path) => {
    paths.add(path);
  });

  const rawBuilderConfig =
    typeof website.builderConfig === "string"
      ? (() => {
          try {
            return JSON.parse(website.builderConfig);
          } catch {
            return {};
          }
        })()
      : website.builderConfig ?? {};
  const parsed = builderConfigSchema.safeParse(rawBuilderConfig);
  const blogSections = parsed.success ? parsed.data.pages.blog?.sections ?? [] : [];
  blogSections.forEach((section) => {
    section.items.forEach((item) => {
      const blogPath = normalizeBlogPath(item.href);
      if (blogPath) {
        paths.add(blogPath);
      }
    });
  });

  return paths;
}

function pushEntry(
  entries: MetadataRoute.Sitemap,
  website: SitemapWebsite,
  path: string,
  lastModified: Date,
) {
  entries.push({
    url: buildCatalogLocalizedUrl({ website, path, locale: website.templateKey === "ecommerce-ciseco-home" ? "fr" : undefined }),
    lastModified,
    alternates: buildSitemapLanguageAlternates(website, path),
  });
}

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
        id: website.id,
        userId: website.userId,
        slug: website.slug,
        templateKey: website.templateKey,
        builderConfig: website.builderConfig,
        updatedAt: website.updatedAt,
        customDomain: website.customDomain,
        domainStatus: website.domainStatus,
      },
    ];
  } else {
    websites = await prisma.websiteConfig.findMany({
      where: { published: true },
      select: {
        id: true,
        userId: true,
        slug: true,
        templateKey: true,
        builderConfig: true,
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
  const [products, cmsPages] = await Promise.all([
    prisma.product.findMany({
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
    }),
    prisma.websiteCmsPage.findMany({
      where: {
        websiteId: { in: websites.map((website) => website.id) },
      },
      select: {
        websiteId: true,
        path: true,
        updatedAt: true,
      },
    }),
  ]);

  const productsByUser = new Map<string, SitemapProduct[]>();
  const categoriesByUser = new Map<string, Set<string>>();
  const cmsPagesByWebsite = new Map<string, SitemapCmsPage[]>();

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

  cmsPages.forEach((page) => {
    const existing = cmsPagesByWebsite.get(page.websiteId) ?? [];
    existing.push(page);
    cmsPagesByWebsite.set(page.websiteId, existing);
  });

  return websites.flatMap((website) => {
    const baseUpdatedAt = website.updatedAt ?? new Date();
    const entries: MetadataRoute.Sitemap = [];

    collectTemplateStaticPaths(website).forEach((path) => {
      pushEntry(entries, website, path, baseUpdatedAt);
    });

    const categorySlugs = Array.from(
      categoriesByUser.get(website.userId) ?? [],
    );
    categorySlugs.forEach((categorySlug) => {
      pushEntry(entries, website, `/collections/${categorySlug}`, baseUpdatedAt);
    });

    const websiteProducts = productsByUser.get(website.userId) ?? [];
    websiteProducts.forEach((product) => {
      pushEntry(
        entries,
        website,
        `/produit/${product.publicSlug}`,
        product.updatedAt ?? baseUpdatedAt,
      );
    });

    const websiteCmsPages = cmsPagesByWebsite.get(website.id) ?? [];
    websiteCmsPages.forEach((page) => {
      pushEntry(entries, website, page.path, page.updatedAt);
    });

    return entries;
  });
}
