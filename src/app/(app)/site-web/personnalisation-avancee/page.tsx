import { notFound } from "next/navigation";
import { getWebsiteAdminPayload, getCatalogPayloadBySlug } from "@/server/website";
import { AdvancedCustomizationClient } from "@/app/(app)/site-web/personnalisation-avancee/_components/advanced-customization-client";
import { resolveCisecoPageKey } from "@/lib/website/ciseco-pages";

export const dynamic = "force-dynamic";

type AdvancedCustomizationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdvancedCustomizationPage({
  searchParams,
}: AdvancedCustomizationPageProps) {
  const admin = await getWebsiteAdminPayload();
  const previewPayload = await getCatalogPayloadBySlug(admin.website.slug, {
    preview: true,
  });
  if (!previewPayload) {
    notFound();
  }
  const resolvedSearchParams = (await searchParams) ?? {};
  const pageParam = Array.isArray(resolvedSearchParams.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams.page;
  const initialPageKey = resolveCisecoPageKey(pageParam);

  return (
    <AdvancedCustomizationClient
      builder={admin.builder}
      links={admin.links}
      website={{
        slug: admin.website.slug,
        accentColor: admin.website.accentColor,
        published: admin.website.published,
      }}
      signupSettings={admin.website.ecommerceSettings.signup}
      catalog={previewPayload}
      initialPageKey={initialPageKey}
    />
  );
}
