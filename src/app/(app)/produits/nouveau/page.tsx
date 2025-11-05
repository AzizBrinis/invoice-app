import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ProductForm } from "@/app/(app)/produits/product-form";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function NouveauProduitPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Nouveau produit ou service
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Définissez les tarifs HT/TTC et les informations de catalogue.
          </p>
        </div>
        <Link
          href="/produits"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Retour à la liste
        </Link>
      </div>
      <ProductForm
        submitLabel="Créer le produit"
        currencyCode={settings.defaultCurrency as CurrencyCode}
        redirectTo="/produits"
      />
    </div>
  );
}
