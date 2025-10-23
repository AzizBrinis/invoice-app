import Link from "next/link";
import { ProductForm } from "@/app/(app)/produits/product-form";
import { createProductAction } from "@/app/(app)/produits/actions";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

export default async function NouveauProduitPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Nouveau produit ou service
          </h1>
          <p className="text-sm text-zinc-600">
            Définissez les tarifs HT/TTC et les informations de catalogue.
          </p>
        </div>
        <Link
          href="/produits"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Retour à la liste
        </Link>
      </div>
      <ProductForm
        action={createProductAction}
        submitLabel="Créer le produit"
        currencyCode={settings.defaultCurrency as CurrencyCode}
      />
    </div>
  );
}
