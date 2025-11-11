import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/website/catalog-page";
import {
  getCatalogPayloadByDomain,
  getCatalogPayloadBySlug,
  type CatalogPayload,
} from "@/server/website";

type CataloguePageProps = {
  params: { segments?: string[] };
  searchParams?: Record<string, string | string[] | undefined>;
};

async function resolvePayload(
  params: CataloguePageProps["params"],
  searchParams: CataloguePageProps["searchParams"],
) {
  const domainParam = searchParams?.domain;
  const fixedDomain = Array.isArray(domainParam)
    ? domainParam[0]
    : domainParam;
  const pathParamRaw = searchParams?.path;
  const pathParam = Array.isArray(pathParamRaw)
    ? pathParamRaw[0]
    : pathParamRaw;

  if (fixedDomain) {
    const payload = await getCatalogPayloadByDomain(fixedDomain, pathParam);
    return { payload, path: pathParam ?? null };
  }

  const slug = params.segments?.[0];
  if (!slug) {
    return { payload: null, path: pathParam ?? null };
  }
  const payload = await getCatalogPayloadBySlug(slug, { path: pathParam });
  return { payload, path: pathParam ?? null };
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
