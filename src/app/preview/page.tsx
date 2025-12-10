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

type PreviewSearchParams = Record<string, string | string[] | undefined>;
type PreviewPageProps = { searchParams?: Promise<PreviewSearchParams> };

export default async function PreviewPage({
  searchParams,
}: PreviewPageProps) {
  const user = await requireUser();
  const website = await getWebsiteConfig(user.id);
  const resolvedSearchParams: PreviewSearchParams = (await searchParams) ?? {};
  const pathParam = resolvedSearchParams.path;
  const path = Array.isArray(pathParam) ? pathParam[0] : pathParam;
  const payload = await getCatalogPayloadBySlug(website.slug, {
    preview: true,
    path: path ?? null,
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
  return <CatalogPage data={payload} mode="preview" path={path ?? null} />;
}
