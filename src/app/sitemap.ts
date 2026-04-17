import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { WebsiteDomainStatus } from "@/lib/db/prisma";
import { prisma } from "@/lib/db";
import {
  resolveCatalogDomainFromHost,
  resolveRequestHost,
} from "@/lib/catalog-host";
import { slugify } from "@/lib/slug";
import { builderConfigSchema } from "@/lib/website/builder";
import {
  buildCatalogUrl,
  resolveCatalogWebsite,
} from "@/server/website";
import {
  listPublicSiteBlogPostSummaries,
} from "@/server/site-blog-posts";

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

type SitemapBlogPost = {
  websiteId: string;
  slug: string;
  publishDate: string | null;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const requestHost = resolveRequestHost(requestHeaders);
  const domain = resolveCatalogDomainFromHost(requestHost);
  let websites: SitemapWebsite[] = [];

  if (domain) {
    const website = await resolveCatalogWebsite({ domain });
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
  const [products, cmsPages, blogPostsByWebsiteEntries] = await Promise.all([
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
    Promise.all(
      websites.map(async (website) => [
        website.id,
        await listPublicSiteBlogPostSummaries({
          websiteId: website.id,
          preview: false,
        }),
      ] as const),
    ),
  ]);

  const productsByUser = new Map<string, SitemapProduct[]>();
  const categoriesByUser = new Map<string, Set<string>>();
  const cmsPagesByWebsite = new Map<string, SitemapCmsPage[]>();
  const blogPostsByWebsite = new Map<string, SitemapBlogPost[]>(
    blogPostsByWebsiteEntries.map(([websiteId, posts]) => [
      websiteId,
      posts.map((post) => ({
        websiteId,
        slug: post.slug,
        publishDate: post.publishDate,
      })),
    ]),
  );

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
    const seenPaths = new Set<string>();
    const pushUniqueEntry = (path: string, lastModified: Date) => {
      if (seenPaths.has(path)) {
        return;
      }
      seenPaths.add(path);
      pushEntry(entries, website, path, lastModified);
    };

    collectTemplateStaticPaths(website).forEach((path) => {
      pushUniqueEntry(path, baseUpdatedAt);
    });

    const categorySlugs = Array.from(
      categoriesByUser.get(website.userId) ?? [],
    );
    categorySlugs.forEach((categorySlug) => {
      pushUniqueEntry(`/collections/${categorySlug}`, baseUpdatedAt);
    });

    const websiteProducts = productsByUser.get(website.userId) ?? [];
    websiteProducts.forEach((product) => {
      pushUniqueEntry(
        `/produit/${product.publicSlug}`,
        product.updatedAt ?? baseUpdatedAt,
      );
    });

    const websiteCmsPages = cmsPagesByWebsite.get(website.id) ?? [];
    websiteCmsPages.forEach((page) => {
      pushUniqueEntry(page.path, page.updatedAt);
    });

    const websiteBlogPosts = blogPostsByWebsite.get(website.id) ?? [];
    websiteBlogPosts.forEach((post) => {
      const publishDate = post.publishDate
        ? new Date(`${post.publishDate}T00:00:00.000Z`)
        : null;
      pushUniqueEntry(
        `/blog/${post.slug}`,
        publishDate && !Number.isNaN(publishDate.getTime())
          ? publishDate
          : baseUpdatedAt,
      );
    });

    return entries;
  });
}
