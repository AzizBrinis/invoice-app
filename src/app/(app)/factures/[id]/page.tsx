import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "@/server/invoices";
import {
  recordPaymentAction,
  deletePaymentAction,
  changeInvoiceStatusAction,
  sendInvoiceEmailAction,
} from "@/app/(app)/factures/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatus } from "@prisma/client";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  PARTIELLE: "Partielle",
  RETARD: "En retard",
  ANNULEE: "Annulée",
};

const STATUS_VARIANTS: Record<InvoiceStatus, "info" | "success" | "danger" | "neutral"> = {
  BROUILLON: "neutral",
  ENVOYEE: "info",
  PAYEE: "success",
  PARTIELLE: "info",
  RETARD: "danger",
  ANNULEE: "neutral",
};

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

export default async function FactureDetailPage({
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

  const invoice = await getInvoice(resolvedParams.id);
  if (!invoice) {
    notFound();
  }

  const successMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams?.message ?? null;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error ?? null;

  const totalTTC = formatCurrency(fromCents(invoice.totalTTCCents), invoice.currency);
  const amountPaid = formatCurrency(fromCents(invoice.amountPaidCents), invoice.currency);
  const balance = formatCurrency(
    fromCents(invoice.totalTTCCents - invoice.amountPaidCents),
    invoice.currency,
  );
  const taxSummary: Array<{
    type?: string;
    label?: string;
    rate?: number | null;
    baseCents?: number;
    amountCents?: number;
  }> = Array.isArray(invoice.taxSummary)
    ? (invoice.taxSummary as Array<Record<string, unknown>>).map((entry) => ({
        type: typeof entry.type === "string" ? entry.type : undefined,
        label: typeof entry.label === "string" ? entry.label : undefined,
        rate: typeof entry.rate === "number" ? entry.rate : undefined,
        baseCents:
          typeof entry.baseCents === "number"
            ? entry.baseCents
            : typeof (entry as { baseHTCents?: unknown }).baseHTCents === "number"
            ? ((entry as { baseHTCents: number }).baseHTCents)
            : 0,
        amountCents:
          typeof entry.amountCents === "number"
            ? entry.amountCents
            : 0,
      }))
    : [];

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Facture {invoice.number}
          </h1>
          <p className="text-sm text-zinc-600">
            Émise le {formatDate(invoice.issueDate)} — Client : {invoice.client.displayName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={STATUS_VARIANTS[invoice.status]}>
            {STATUS_LABELS[invoice.status]}
          </Badge>
          <Button asChild variant="secondary">
            <Link href={`/factures/${invoice.id}/modifier`}>Modifier</Link>
          </Button>
          <Button asChild variant="ghost" className="text-blue-600">
            <Link href={`/api/factures/${invoice.id}/pdf`} target="_blank">
              Télécharger PDF
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500">Montant total</h2>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{totalTTC}</p>
          <p className="text-xs text-zinc-500">TTC</p>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500">Montant payé</h2>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{amountPaid}</p>
          <p className="text-xs text-zinc-500">
            Solde : <span className="font-semibold text-zinc-900">{balance}</span>
          </p>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500">Échéance & pénalités</h2>
          <p className="mt-2 text-lg font-semibold text-zinc-900">
            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
          </p>
          <p className="text-xs text-zinc-500">
            Pénalités : {invoice.lateFeeRate != null ? `${invoice.lateFeeRate}%` : "—"}
          </p>
        </div>
      </section>

      {taxSummary.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-base font-semibold text-zinc-900">Résumé fiscal</h2>
          </div>
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Taxe</th>
                <th className="px-4 py-3 text-left">Base</th>
                <th className="px-4 py-3 text-left">Taux</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {taxSummary.map((entry, index) => (
                <tr key={`${entry.type ?? "tax"}-${entry.rate ?? index}`}>
                  <td className="px-4 py-3 text-zinc-700">{entry.label ?? entry.type ?? "Taxe"}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatCurrency(fromCents(entry.baseCents ?? 0), invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {entry.rate != null ? `${entry.rate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-800">
                    {formatCurrency(fromCents(entry.amountCents ?? 0), invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-900">Lignes</h2>
        </div>
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Qté</th>
              <th className="px-4 py-3 text-right">PU HT</th>
              <th className="px-4 py-3 text-right">TVA</th>
              <th className="px-4 py-3 text-right">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-3 text-zinc-700">{line.description}</td>
                <td className="px-4 py-3 text-right text-zinc-600">{line.quantity}</td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {formatCurrency(fromCents(line.unitPriceHTCents), invoice.currency)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">{line.vatRate}%</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {formatCurrency(fromCents(line.totalTTCCents), invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-1">
          <h2 className="text-base font-semibold text-zinc-900">Notes & conditions</h2>
          <div className="mt-3 space-y-3 text-sm text-zinc-600">
            <div>
              <h3 className="font-medium text-zinc-800">Notes</h3>
              <p>{invoice.notes ?? "—"}</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-800">Conditions</h3>
              <p>{invoice.terms ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="card space-y-4 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Paiements</h2>
            <form action={changeInvoiceStatusAction.bind(null, invoice.id, InvoiceStatus.ENVOYEE)}>
              <Button type="submit" variant="ghost" className="text-xs text-blue-600">
                Marquer envoyée
              </Button>
            </form>
          </div>
          <div className="space-y-4">
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucun paiement enregistré.</p>
            ) : (
              invoice.payments
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center justify-between text-sm text-zinc-700">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {formatCurrency(fromCents(payment.amountCents), invoice.currency)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(payment.date)} — {payment.method ?? "Paiement"}
                        </p>
                      </div>
                      <form
                        action={deletePaymentAction.bind(null, payment.id, invoice.id)}
                      >
                        <Button type="submit" variant="ghost" className="text-xs text-red-600">
                          Supprimer
                        </Button>
                      </form>
                    </div>
                    {payment.note && (
                      <p className="mt-2 text-xs text-zinc-500">{payment.note}</p>
                    )}
                  </div>
                ))
            )}
          </div>
          <form action={recordPaymentAction} className="space-y-3 text-sm">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="amount" className="text-zinc-600">
                  {`Montant (${invoice.currency})`}
                </label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="date" className="text-zinc-600">
                  Date
                </label>
                <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="method" className="text-zinc-600">
                Mode de paiement
              </label>
              <Input id="method" name="method" placeholder="Virement bancaire" />
            </div>
            <div className="space-y-1">
              <label htmlFor="note" className="text-zinc-600">
                Note
              </label>
              <Textarea id="note" name="note" rows={3} placeholder="Référence, conditions, etc." />
            </div>
            <Button type="submit" className="w-full">
              Ajouter un paiement
            </Button>
          </form>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">Envoyer la facture par e-mail</h2>
        <form action={sendInvoiceEmailAction.bind(null, invoice.id)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-1">
            <label htmlFor="email" className="text-sm text-zinc-600">
              Destinataire
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={invoice.client.email ?? ""}
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <label htmlFor="subject" className="text-sm text-zinc-600">
              Objet
            </label>
            <Input
              id="subject"
              name="subject"
              defaultValue={`Facture ${invoice.number}`}
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
              defaultValue={`Bonjour ${invoice.client.displayName},

Veuillez trouver ci-joint la facture ${invoice.number} d'un montant de ${formatCurrency(fromCents(invoice.totalTTCCents), invoice.currency)}.

Cordialement.`}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Envoyer la facture</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
