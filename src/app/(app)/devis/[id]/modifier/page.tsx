import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getQuote } from "@/server/quotes";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { updateQuoteAction, sendQuoteEmailAction } from "@/app/(app)/devis/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";

type PageParams = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export default async function EditDevisPage({
  params,
  searchParams,
}: {
  params: PageParams | Promise<PageParams>;
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const resolvedParams = isPromise<PageParams>(params) ? await params : params;
  const resolvedSearchParams = isPromise<SearchParams>(searchParams)
    ? await searchParams
    : searchParams;

  const quote = await getQuote(resolvedParams.id);

  if (!quote) {
    notFound();
  }

  const successMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams?.message ?? null;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error ?? null;

  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { displayName: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      {successMessage && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Modifier le devis {quote.number}
          </h1>
          <p className="text-sm text-zinc-600">
            Ajustez les lignes, remises et conditions avant envoi.
          </p>
        </div>
        <Link href="/devis" className="text-sm font-medium text-blue-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
      <QuoteEditor
        action={updateQuoteAction.bind(null, quote.id)}
        submitLabel="Mettre à jour le devis"
        clients={clients}
        products={products}
        defaultQuote={quote}
      />
      <section className="card space-y-4 p-6">
        <h2 className="text-base font-semibold text-zinc-900">
          Envoyer le devis par e-mail
        </h2>
        <form action={sendQuoteEmailAction.bind(null, quote.id)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-zinc-600">
              Destinataire
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={quote.client.email ?? ""}
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="subject" className="text-sm text-zinc-600">
              Objet
            </label>
            <Input
              id="subject"
              name="subject"
              defaultValue={`Devis ${quote.number}`}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label htmlFor="message" className="text-sm text-zinc-600">
              Message
            </label>
            <Textarea
              id="message"
              name="message"
              rows={4}
              defaultValue={`Bonjour ${quote.client.displayName},\n\nVeuillez trouver ci-joint le devis ${quote.number} d'un montant de ${formatCurrency(fromCents(quote.totalTTCCents), quote.currency)}.\n\nCordialement.`}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Envoyer le devis</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
