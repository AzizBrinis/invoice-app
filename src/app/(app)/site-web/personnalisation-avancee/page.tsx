import { notFound } from "next/navigation";
import { getWebsiteAdminPayload, getCatalogPayloadBySlug } from "@/server/website";
import { AdvancedCustomizationClient } from "@/app/(app)/site-web/personnalisation-avancee/_components/advanced-customization-client";

export const dynamic = "force-dynamic";

export default async function AdvancedCustomizationPage() {
  const admin = await getWebsiteAdminPayload();
  const previewPayload = await getCatalogPayloadBySlug(admin.website.slug, {
    preview: true,
  });
  if (!previewPayload) {
    notFound();
  }

  return (
    <AdvancedCustomizationClient
      builder={admin.builder}
      links={admin.links}
      website={{
        slug: admin.website.slug,
        accentColor: admin.website.accentColor,
        published: admin.website.published,
      }}
      catalog={previewPayload}
    />
  );
}
