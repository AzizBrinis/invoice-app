import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { getSettings } from "@/server/settings";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { normalizeTaxConfiguration } from "@/lib/taxes";

export default async function NouvelleFacturePage() {
  const [clients, products, settings] = await Promise.all([
    prisma.client.findMany({ orderBy: { displayName: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, where: { isActive: true } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Nouvelle facture</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Créez une facture avec numérotation automatique et conditions de paiement.
          </p>
        </div>
        <Link href="/factures" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Retour à la liste
        </Link>
      </div>
      <InvoiceEditor
        submitLabel="Enregistrer la facture"
        clients={clients}
        products={products}
        defaultCurrency={settings.defaultCurrency as CurrencyCode}
        currencyOptions={SUPPORTED_CURRENCIES}
        taxConfiguration={normalizeTaxConfiguration(settings.taxConfiguration)}
        redirectTo="/factures/:id"
      />
    </div>
  );
}
