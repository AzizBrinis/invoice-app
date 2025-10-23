import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { createQuoteAction } from "@/app/(app)/devis/actions";

export default async function NouveauDevisPage() {
  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { displayName: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, where: { isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Nouveau devis</h1>
          <p className="text-sm text-zinc-600">
            Créez un devis détaillé avec lignes, remises et TVA multiples.
          </p>
        </div>
        <Link href="/devis" className="text-sm font-medium text-blue-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
      <QuoteEditor
        action={createQuoteAction}
        submitLabel="Enregistrer le devis"
        clients={clients}
        products={products}
      />
    </div>
  );
}
