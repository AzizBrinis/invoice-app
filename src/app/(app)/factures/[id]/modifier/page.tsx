import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getInvoice } from "@/server/invoices";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { getSettings } from "@/server/settings";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { normalizeTaxConfiguration } from "@/lib/taxes";

export const dynamic = "force-dynamic";

type PageParams = { id: string };

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export default async function EditFacturePage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const resolvedParams = isPromise<PageParams>(params) ? await params : params;

  const invoice = await getInvoice(resolvedParams.id);

  if (!invoice) {
    notFound();
  }

  const user = await requireUser();
  const [clients, products, settings] = await Promise.all([
    prisma.client.findMany({
      where: { userId: user.id },
      orderBy: { displayName: "asc" },
    }),
    prisma.product.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    getSettings(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Modifier la facture {invoice.number}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Ajustez les montants, remises ou conditions de paiement.
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
        submitLabel="Mettre à jour la facture"
        clients={clients}
        products={products}
        defaultCurrency={settings.defaultCurrency as CurrencyCode}
        currencyOptions={SUPPORTED_CURRENCIES}
        taxConfiguration={normalizeTaxConfiguration(settings.taxConfiguration)}
        defaultInvoice={invoice}
        redirectTo="/factures/:id"
      />
    </div>
  );
}
