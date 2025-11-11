import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import {
  getCatalogPayloadBySlug,
  getWebsiteConfig,
} from "@/server/website";
import { CatalogPage } from "@/components/website/catalog-page";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Prévisualisation du site",
};

export default async function PreviewPage() {
  const user = await requireUser();
  const website = await getWebsiteConfig(user.id);
  const payload = await getCatalogPayloadBySlug(website.slug, {
    preview: true,
  });
  if (!payload) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Alert
          variant="warning"
          title="Impossible de charger la prévisualisation."
          description="Vérifiez que vous avez configuré votre site et ajouté au moins un produit visible."
        />
      </div>
    );
  }
  return <CatalogPage data={payload} mode="preview" />;
}
