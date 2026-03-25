import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/website/catalog-page";
import {
  getCatalogPayloadByDomain,
  getCatalogPayloadBySlug,
  normalizeCatalogDomainInput,
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveCatalogMetadata,
  resolveCatalogMetadataTarget,
  type CatalogPayload,
} from "@/server/website";

type CataloguePageParams = { segments?: string[] };
type CataloguePageSearchParams = Record<string, string | string[] | undefined>;
type CataloguePageProps = {
  params: Promise<CataloguePageParams>;
  searchParams?: Promise<CataloguePageSearchParams>;
};

export const revalidate = 30;
export const dynamicParams = true;

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
  return (
    <CatalogPage
      data={resolved.payload as CatalogPayload}
      mode="public"
      path={resolved.path}
    />
  );
}
