import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { createInvoiceAction } from "@/app/(app)/factures/actions";

export default async function NouvelleFacturePage() {
  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { displayName: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, where: { isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Nouvelle facture</h1>
          <p className="text-sm text-zinc-600">
            Créez une facture avec numérotation automatique et conditions de paiement.
          </p>
        </div>
        <Link href="/factures" className="text-sm font-medium text-blue-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
      <InvoiceEditor
        action={createInvoiceAction}
        submitLabel="Enregistrer la facture"
        clients={clients}
        products={products}
      />
    </div>
  );
}
