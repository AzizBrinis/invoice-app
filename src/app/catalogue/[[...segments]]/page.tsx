import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/website/catalog-page";
import {
  resolveCisecoLocale,
} from "@/components/website/templates/ecommerce-ciseco/locale";
import {
  getCatalogPayloadByDomain,
  getCatalogPayloadBySlug,
  type CatalogPayload,
  type CatalogProduct,
  normalizeCatalogDomainInput,
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveCatalogMetadata,
  resolveCatalogMetadataTarget,
  resolveCatalogProductListingImageSource,
  resolveCatalogStructuredData,
} from "@/server/website";

type CataloguePageParams = { segments?: string[] };
type CataloguePageSearchParams = Record<string, string | string[] | undefined>;
type CataloguePageProps = {
  params: Promise<CataloguePageParams>;
  searchParams?: Promise<CataloguePageSearchParams>;
};

export const revalidate = 30;
export const dynamicParams = true;

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

function trimCatalogProductForListing(
  product: CatalogProduct,
  payload: CatalogPayload,
): CatalogProduct {
  return {
    ...product,
    description: null,
    descriptionHtml: null,
    shortDescriptionHtml: null,
    excerpt: null,
    metaTitle: null,
    metaDescription: null,
    coverImageUrl: resolveCatalogProductListingImageSource(
      product,
      payload.website,
    ),
    gallery: null,
    faqItems: null,
    quoteFormSchema: null,
    optionConfig: null,
    variantStock: null,
  };
}

function trimPayloadForInitialRoute(
  payload: CatalogPayload,
  path?: string | null,
): CatalogPayload {
  const target = resolveCatalogMetadataTarget(path);
  if (target.kind === "product") {
    return payload;
  }

  return {
    ...payload,
    website:
      payload.website.templateKey === "ecommerce-ciseco-home"
        ? {
            ...payload.website,
            contact: {
              ...payload.website.contact,
              logoData: null,
            },
          }
        : payload.website,
    products: {
      featured: payload.products.featured.map((product) =>
        trimCatalogProductForListing(product, payload),
      ),
      all: payload.products.all.map((product) =>
        trimCatalogProductForListing(product, payload),
      ),
    },
  };
}

async function resolvePayload(
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

  if (domain) {
    const payload = await getCatalogPayloadByDomain(domain, resolvedPath);
    if (!payload) {
      return { payload: null, path: resolvedPath };
    }
    const adjustedPath = stripSlugPrefix(
      resolvedPath,
      payload.website.slug,
    );
    return { payload, path: adjustedPath };
  }

  if (!slug) {
    return { payload: null, path: resolvedPath };
  }
  const payload = await getCatalogPayloadBySlug(slug, { path: resolvedPath });
  return { payload, path: resolvedPath };
}

export async function generateMetadata({
  params,
  searchParams,
}: CataloguePageProps): Promise<Metadata> {
  const resolved = await resolvePayload(params, searchParams);
  if (!resolved.payload) {
    return {};
  }
  const meta = resolveCatalogMetadata({
    payload: resolved.payload,
    path: resolved.path,
  });
  const metaTarget = resolveCatalogMetadataTarget(resolved.path);
  const shouldNoIndex =
    metaTarget.kind === "cart" ||
    metaTarget.kind === "checkout" ||
    metaTarget.kind === "confirmation";
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords ?? undefined,
    alternates: {
      canonical: meta.canonicalUrl,
    },
    robots: shouldNoIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.canonicalUrl,
      siteName: resolved.payload.website.contact.companyName,
      type: "website",
      images: meta.socialImageUrl ? [meta.socialImageUrl] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: meta.socialImageUrl ? [meta.socialImageUrl] : undefined,
    },
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
  const payload = trimPayloadForInitialRoute(resolved.payload, resolved.path);
  const structuredData = resolveCatalogStructuredData({
    payload,
    path: resolved.path,
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
        initialLocale={resolveCisecoLocale(langParam)}
      />
    </>
  );
}
