import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { getSettings } from "@/server/settings";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { normalizeTaxConfiguration } from "@/lib/taxes";

export const dynamic = "force-dynamic";

export default async function NouvelleFacturePage() {
  const user = await requireUser();
  const [clients, products, settings] = await Promise.all([
    prisma.client.findMany({
      where: { userId: user.id },
      orderBy: { displayName: "asc" },
    }),
    prisma.product.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    getSettings(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Nouvelle facture</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Créez une facture avec numérotation automatique et conditions de paiement.
          </p>
        </div>
        <Link
          href="/factures"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 md:text-right"
        >
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
