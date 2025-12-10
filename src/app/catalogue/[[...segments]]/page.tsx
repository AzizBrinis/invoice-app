import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/website/catalog-page";
import {
  getCatalogPayloadByDomain,
  getCatalogPayloadBySlug,
  type CatalogPayload,
} from "@/server/website";

type CataloguePageParams = { segments?: string[] };
type CataloguePageSearchParams = Record<string, string | string[] | undefined>;
type CataloguePageProps = {
  params: Promise<CataloguePageParams>;
  searchParams?: Promise<CataloguePageSearchParams>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;
export const fetchCache = "force-no-store";

async function resolvePayload(
  rawParams: Promise<CataloguePageParams>,
  rawSearchParams?: Promise<CataloguePageSearchParams>,
) {
  const params = (await rawParams) ?? {};
  const searchParams = (await rawSearchParams) ?? {};
  const domainParam = searchParams?.domain;
  const fixedDomain = Array.isArray(domainParam)
    ? domainParam[0]
    : domainParam;
  const pathParamRaw = searchParams?.path;
  const pathParam = Array.isArray(pathParamRaw)
    ? pathParamRaw[0]
    : pathParamRaw;
  const segments = params.segments ?? [];
  const slug = segments[0];
  const derivedPath =
    segments.length > 1 ? `/${segments.slice(1).join("/")}` : null;
  const resolvedPath = pathParam ?? derivedPath ?? null;

  if (fixedDomain) {
    const payload = await getCatalogPayloadByDomain(fixedDomain, resolvedPath);
    return { payload, path: resolvedPath };
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
  const meta = resolved.payload.website.metadata;
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: meta.canonicalUrl,
    },
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
