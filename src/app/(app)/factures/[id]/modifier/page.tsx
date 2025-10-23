import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getInvoice } from "@/server/invoices";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { updateInvoiceAction } from "@/app/(app)/factures/actions";

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

  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { displayName: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Modifier la facture {invoice.number}
          </h1>
          <p className="text-sm text-zinc-600">
            Ajustez les montants, remises ou conditions de paiement.
          </p>
        </div>
        <Link href="/factures" className="text-sm font-medium text-blue-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
      <InvoiceEditor
        action={updateInvoiceAction.bind(null, invoice.id)}
        submitLabel="Mettre à jour la facture"
        clients={clients}
        products={products}
        defaultInvoice={invoice}
      />
    </div>
  );
}
