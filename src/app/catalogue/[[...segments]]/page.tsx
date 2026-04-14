import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/website/catalog-page";
import { trimCatalogProductForListing } from "@/lib/catalogue-public";
import { slugify } from "@/lib/slug";
import {
  resolveCisecoLocale,
} from "@/components/website/templates/ecommerce-ciseco/locale";
import {
  externalizeCatalogProductInlineImages,
  getCatalogPayloadByDomain,
  getCatalogPayloadBySlug,
  type CatalogPayload,
  type CatalogProduct,
  normalizeCatalogDomainInput,
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveCatalogMetadataTarget,
  resolveCatalogFaviconUrl,
  resolveCatalogSeo,
  resolveCatalogStructuredData,
} from "@/server/website";

type CataloguePageParams = { segments?: string[] };
type CataloguePageSearchParams = Record<string, string | string[] | undefined>;
type CataloguePageProps = {
  params: Promise<CataloguePageParams>;
  searchParams?: Promise<CataloguePageSearchParams>;
};
type ResolvedCataloguePayload = {
  payload: CatalogPayload | null;
  path: string | null;
  resolvedByDomain: boolean;
};
type ResolvedCataloguePayloadCacheEntry = {
  expiresAt: number;
  promise: Promise<ResolvedCataloguePayload>;
};

export const revalidate = 30;
export const dynamicParams = true;

const RESOLVED_PAYLOAD_CACHE_TTL_MS = 2_000;
const resolvedPayloadCache = new Map<
  string,
  ResolvedCataloguePayloadCacheEntry
>();

function serializeStructuredData(value: Record<string, unknown>) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function stripSlugPrefix(path: string | null, slug: string) {
  if (!path) return null;
  const prefix = `/catalogue/${slug}`;
  if (path === prefix || path === `${prefix}/`) {
    return "/";
  }
  if (path.startsWith(`${prefix}/`)) {
    const next = path.slice(prefix.length);
    return next || "/";
  }
  return path;
}

function trimWebsiteForInitialRoute(
  payload: CatalogPayload,
): CatalogPayload["website"] {
  if (payload.website.templateKey !== "ecommerce-ciseco-home") {
    return payload.website;
  }
  return {
    ...payload.website,
    contact: {
      ...payload.website.contact,
      logoData: null,
    },
  };
}

function resolveCatalogProductRouteSlug(
  product: Pick<CatalogProduct, "id" | "name" | "publicSlug" | "sku">,
) {
  if (product.publicSlug && product.publicSlug.trim().length > 0) {
    return product.publicSlug;
  }
  const base = product.sku || product.name || product.id;
  return slugify(base) || product.id.slice(0, 8);
}

function trimPayloadForInitialRoute(
  payload: CatalogPayload,
  path?: string | null,
): CatalogPayload {
  const target = resolveCatalogMetadataTarget(path);
  const website = trimWebsiteForInitialRoute(payload);
  if (target.kind === "product") {
    return {
      ...payload,
      website,
      products: {
        featured: payload.products.featured.map((product) =>
          trimCatalogProductForListing(product, website),
        ),
        all: payload.products.all.map((product) =>
          resolveCatalogProductRouteSlug(product) === target.slug
            ? externalizeCatalogProductInlineImages(product, website)
            : trimCatalogProductForListing(product, website),
        ),
      },
    };
  }

  return {
    ...payload,
    website,
    products: {
      featured: payload.products.featured.map((product) =>
        trimCatalogProductForListing(product, website),
      ),
      all: payload.products.all.map((product) =>
        trimCatalogProductForListing(product, website),
      ),
    },
  };
}

async function resolvePayload(
  rawParams: Promise<CataloguePageParams>,
  rawSearchParams?: Promise<CataloguePageSearchParams>,
) {
  const inputs = await resolvePayloadInputs(rawParams, rawSearchParams);
  return readResolvedPayloadFromCache(
    inputs.domain,
    inputs.slug,
    inputs.path,
  );
}

async function resolvePayloadInputs(
  rawParams: Promise<CataloguePageParams>,
  rawSearchParams?: Promise<CataloguePageSearchParams>,
) {
  const params = (await rawParams) ?? {};
  const searchParams = (await rawSearchParams) ?? {};
  const pathParamRaw = searchParams?.path;
  const pathParam = Array.isArray(pathParamRaw)
    ? pathParamRaw[0]
    : pathParamRaw;
  const domainParamRaw = searchParams?.domain;
  const domainParam = Array.isArray(domainParamRaw)
    ? domainParamRaw[0]
    : domainParamRaw;
  const segments = params.segments ?? [];
  const domain = normalizeCatalogDomainInput(domainParam);
  const slug = domain ? null : normalizeCatalogSlugInput(segments[0]);
  const derivedPath =
    domain
      ? segments.length
        ? `/${segments.join("/")}`
        : null
      : segments.length > 1
        ? `/${segments.slice(1).join("/")}`
        : null;
  const resolvedPath =
    normalizeCatalogPathInput(pathParam) ??
    normalizeCatalogPathInput(derivedPath) ??
    null;

  return {
    domain,
    slug,
    path: resolvedPath,
  };
}

function buildResolvedPayloadCacheKey(
  domain: string | null,
  slug: string | null,
  resolvedPath: string | null,
) {
  return `${domain ?? ""}::${slug ?? ""}::${resolvedPath ?? ""}`;
}

function pruneResolvedPayloadCache(now: number) {
  for (const [key, entry] of resolvedPayloadCache.entries()) {
    if (entry.expiresAt <= now) {
      resolvedPayloadCache.delete(key);
    }
  }
}

function readResolvedPayloadFromCache(
  domain: string | null,
  slug: string | null,
  resolvedPath: string | null,
) {
  const now = Date.now();
  pruneResolvedPayloadCache(now);

  const cacheKey = buildResolvedPayloadCacheKey(
    domain,
    slug,
    resolvedPath,
  );
  const cached = resolvedPayloadCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = loadResolvedPayload(domain, slug, resolvedPath);
  resolvedPayloadCache.set(cacheKey, {
    expiresAt: now + RESOLVED_PAYLOAD_CACHE_TTL_MS,
    promise,
  });

  promise.catch(() => {
    const current = resolvedPayloadCache.get(cacheKey);
    if (current?.promise === promise) {
      resolvedPayloadCache.delete(cacheKey);
    }
  });

  return promise;
}

async function loadResolvedPayload(
  domain: string | null,
  slug: string | null,
  resolvedPath: string | null,
): Promise<ResolvedCataloguePayload> {
  if (domain) {
    const payload = await getCatalogPayloadByDomain(domain, resolvedPath);
    if (!payload) {
      return { payload: null, path: resolvedPath, resolvedByDomain: true };
    }
    const adjustedPath = stripSlugPrefix(
      resolvedPath,
      payload.website.slug,
    );
    return { payload, path: adjustedPath, resolvedByDomain: true };
  }

  if (!slug) {
    return { payload: null, path: resolvedPath, resolvedByDomain: false };
  }

  const payload = await getCatalogPayloadBySlug(slug, { path: resolvedPath });
  return { payload, path: resolvedPath, resolvedByDomain: false };
}

export async function generateMetadata({
  params,
  searchParams,
}: CataloguePageProps): Promise<Metadata> {
  const resolvedSearchParams = (await searchParams) ?? {};
  const langParamRaw = resolvedSearchParams.lang;
  const langParam = Array.isArray(langParamRaw) ? langParamRaw[0] : langParamRaw;
  const resolved = await resolvePayload(params, searchParams);
  if (!resolved.payload) {
    return {};
  }
  const payload = trimPayloadForInitialRoute(resolved.payload, resolved.path);
  const seo = resolveCatalogSeo({
    payload,
    path: resolved.path,
    locale: resolveCisecoLocale(langParam),
    searchParams: resolvedSearchParams,
  });
  const meta = seo.metadata;
  const faviconUrl = resolveCatalogFaviconUrl(payload.website);
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords ?? undefined,
    alternates: {
      canonical: meta.canonicalUrl,
      languages: seo.alternatesLanguages ?? undefined,
    },
    robots: seo.robots ?? undefined,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.canonicalUrl,
      siteName: payload.website.contact.companyName,
      type: seo.openGraphType,
      locale: seo.openGraphLocale ?? undefined,
      alternateLocale:
        seo.openGraphAlternateLocales.length > 0
          ? seo.openGraphAlternateLocales
          : undefined,
      images: meta.socialImageUrl ? [meta.socialImageUrl] : undefined,
    },
    twitter: {
      card: meta.socialImageUrl ? "summary_large_image" : "summary",
      title: meta.title,
      description: meta.description,
      images: meta.socialImageUrl ? [meta.socialImageUrl] : undefined,
    },
    icons: faviconUrl
      ? {
          icon: [{ url: faviconUrl }],
          shortcut: [{ url: faviconUrl }],
        }
      : undefined,
    other: seo.contentLanguage
      ? {
          "content-language": seo.contentLanguage,
        }
      : undefined,
  };
}

export default async function CatalogueCatchAllPage({
  params,
  searchParams,
}: CataloguePageProps) {
  const resolved = await resolvePayload(params, searchParams);
  if (!resolved.payload) {
    notFound();
  }
  const resolvedSearchParams = (await searchParams) ?? {};
  const langParamRaw = resolvedSearchParams.lang;
  const langParam = Array.isArray(langParamRaw) ? langParamRaw[0] : langParamRaw;
  const locale = resolveCisecoLocale(langParam);
  const payload = trimPayloadForInitialRoute(resolved.payload, resolved.path);
  const structuredData = resolveCatalogStructuredData({
    payload,
    path: resolved.path,
    locale,
    searchParams: resolvedSearchParams,
  });
  return (
    <>
      {structuredData.map((entry, index) => (
        <script
          key={`catalog-jsonld-${index + 1}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(entry),
          }}
        />
      ))}
      <CatalogPage
        data={payload}
        mode="public"
        path={resolved.path}
        initialLocale={locale}
        resolvedByDomain={resolved.resolvedByDomain}
      />
    </>
  );
}
