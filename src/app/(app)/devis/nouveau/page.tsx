import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { createQuoteAction } from "@/app/(app)/devis/actions";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { normalizeTaxConfiguration } from "@/lib/taxes";
import {
  getQuoteFilterClients,
  getQuoteFormProducts,
  getQuoteFormSettings,
} from "@/server/quotes";

export const dynamic = "force-dynamic";

export default async function NouveauDevisPage() {
  const user = await requireUser();
  const [clients, products, settings] = await Promise.all([
    getQuoteFilterClients(user.id),
    getQuoteFormProducts(user.id),
    getQuoteFormSettings(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Nouveau devis</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Créez un devis détaillé avec lignes, remises et TVA multiples.
          </p>
        </div>
        <Link href="/devis" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Retour à la liste
        </Link>
      </div>
      <QuoteEditor
        action={createQuoteAction}
        submitLabel="Enregistrer le devis"
        clients={clients}
        products={products}
        defaultCurrency={settings.defaultCurrency as CurrencyCode}
        currencyOptions={SUPPORTED_CURRENCIES}
        taxConfiguration={normalizeTaxConfiguration(settings.taxConfiguration)}
        redirectTo="/devis"
      />
    </div>
  );
}
