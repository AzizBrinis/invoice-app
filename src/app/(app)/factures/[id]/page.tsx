import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "@/server/invoices";
import {
  recordPaymentAction,
  deletePaymentAction,
  changeInvoiceStatusAction,
  sendInvoiceEmailAction,
} from "@/app/(app)/factures/actions";
import { getMessagingSettingsSummary } from "@/server/messaging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatus } from "@prisma/client";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";

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
  const messagingSummary = await getMessagingSettingsSummary();
  const emailDisabled = !messagingSummary.smtpConfigured;

  const successMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams?.message ?? null;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error ?? null;
  const warningMessage = Array.isArray(resolvedSearchParams?.warning)
    ? resolvedSearchParams.warning[0]
    : resolvedSearchParams?.warning ?? null;

  const flashMessages: FlashMessage[] = [];
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (warningMessage) {
    flashMessages.push({ variant: "warning", title: warningMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  const totalTTC = formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency);
  const amountPaid = formatCurrency(fromCents(invoice.amountPaidCents, invoice.currency), invoice.currency);
  const balance = formatCurrency(
    fromCents(invoice.totalTTCCents - invoice.amountPaidCents, invoice.currency),
    invoice.currency,
  );
  const percentageFormatter = new Intl.NumberFormat("fr-TN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const globalDiscountRateLabel =
    invoice.globalDiscountRate != null ? `${percentageFormatter.format(invoice.globalDiscountRate)}%` : null;
  const globalDiscountAmount =
    invoice.globalDiscountAmountCents != null
      ? formatCurrency(fromCents(invoice.globalDiscountAmountCents, invoice.currency), invoice.currency)
      : null;
  const hasGlobalDiscount = globalDiscountRateLabel != null || globalDiscountAmount != null;
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

  const redirectBase = `/factures/${invoice.id}`;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      {successMessage ? <Alert variant="success" title={successMessage} /> : null}
      {warningMessage ? <Alert variant="warning" title={warningMessage} /> : null}
      {errorMessage ? <Alert variant="error" title={errorMessage} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Facture {invoice.number}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
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
          <Button asChild variant="ghost" className="text-blue-600 dark:text-blue-400">
            <Link href={`/api/factures/${invoice.id}/pdf`} target="_blank">
              Télécharger PDF
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Montant total</h2>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{totalTTC}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">TTC</p>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Montant payé</h2>
          <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {amountPaid}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Solde : <span className="font-semibold text-zinc-900 dark:text-zinc-100">{balance}</span>
          </p>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Échéance & pénalités</h2>
          <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pénalités : {invoice.lateFeeRate != null ? `${invoice.lateFeeRate}%` : "—"}
          </p>
        </div>
      </section>

      <section className="card p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Remise globale</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Appliquée sur l&apos;ensemble de la facture</p>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Taux (%)</dt>
            <dd className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {globalDiscountRateLabel ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{`Valeur (${invoice.currency})`}</dt>
            <dd className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {globalDiscountAmount ?? "—"}
            </dd>
          </div>
        </dl>
        {!hasGlobalDiscount && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Aucune remise globale n&apos;a été appliquée à cette facture.
          </p>
        )}
      </section>

      {taxSummary.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Résumé fiscal</h2>
          </div>
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs uppercase text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Taxe</th>
                <th className="px-4 py-3 text-left">Base</th>
                <th className="px-4 py-3 text-left">Taux</th>
                <th className="px-4 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {taxSummary.map((entry, index) => (
                <tr key={`${entry.type ?? "tax"}-${entry.rate ?? index}`}>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{entry.label ?? entry.type ?? "Taxe"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatCurrency(fromCents(entry.baseCents ?? 0, invoice.currency), invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {entry.rate != null ? `${entry.rate}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-800 dark:text-zinc-100">
                    {formatCurrency(fromCents(entry.amountCents ?? 0, invoice.currency), invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Lignes</h2>
        </div>
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs uppercase text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Qté</th>
              <th className="px-4 py-3 text-right">PU HT</th>
              <th className="px-4 py-3 text-right">TVA</th>
              <th className="px-4 py-3 text-right">Remise</th>
              <th className="px-4 py-3 text-right">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invoice.lines.map((line) => {
              const toNumber = (value: unknown): number => {
                if (typeof value === "number") {
                  return value;
                }
                if (
                  value &&
                  typeof value === "object" &&
                  "toNumber" in value &&
                  typeof (value as { toNumber?: unknown }).toNumber === "function"
                ) {
                  return (value as { toNumber: () => number }).toNumber();
                }
                return Number(value ?? 0);
              };

              const quantity = toNumber(line.quantity);
              const unitPriceHTCents = toNumber(line.unitPriceHTCents);
              const totalHTCents = toNumber(line.totalHTCents);
              const discountRate =
                line.discountRate != null ? toNumber(line.discountRate) : null;
              const storedDiscountCents =
                line.discountAmountCents != null
                  ? toNumber(line.discountAmountCents)
                  : null;
              const baseAmountCents = Math.max(
                0,
                Math.round(quantity * unitPriceHTCents),
              );
              const discountAmountCents =
                storedDiscountCents != null
                  ? storedDiscountCents
                  : Math.max(0, baseAmountCents - totalHTCents);
              const hasDiscount =
                (discountRate != null && discountRate > 0) ||
                discountAmountCents > 0;

              return (
                <tr key={line.id}>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    <div className="font-medium text-zinc-800 dark:text-zinc-100">{line.description}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">{line.quantity}</td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                    {formatCurrency(fromCents(line.unitPriceHTCents, invoice.currency), invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">{line.vatRate}%</td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                    {hasDiscount ? (
                      <div className="flex flex-col items-end">
                        {discountRate != null && discountRate > 0 && (
                          <span>{discountRate}%</span>
                        )}
                        {discountAmountCents > 0 && (
                          <span
                            className={
                              discountRate != null && discountRate > 0
                                ? "text-xs text-zinc-500 dark:text-zinc-400"
                                : undefined
                            }
                          >
                            -
                            {formatCurrency(
                              fromCents(discountAmountCents, invoice.currency),
                              invoice.currency,
                            )}
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(fromCents(line.totalTTCCents, invoice.currency), invoice.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-1">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Notes & conditions</h2>
          <div className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <div>
              <h3 className="font-medium text-zinc-800 dark:text-zinc-100">Notes</h3>
              <p>{invoice.notes ?? "—"}</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-800 dark:text-zinc-100">Conditions</h3>
              <p>{invoice.terms ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="card space-y-4 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Paiements</h2>
            <form action={changeInvoiceStatusAction.bind(null, invoice.id, InvoiceStatus.ENVOYEE)}>
              <FormSubmitButton
                variant="ghost"
                className="text-xs text-blue-600 dark:text-blue-400"
              >
                Marquer envoyée
              </FormSubmitButton>
              <input type="hidden" name="redirectTo" value={redirectBase} />
            </form>
          </div>
          <div className="space-y-4">
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun paiement enregistré.</p>
            ) : (
              invoice.payments
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map((payment) => (
                  <div key={payment.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                    <div className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-300">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(fromCents(payment.amountCents, invoice.currency), invoice.currency)}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDate(payment.date)} — {payment.method ?? "Paiement"}
                        </p>
                      </div>
                      <form
                        action={deletePaymentAction.bind(null, payment.id, invoice.id)}
                      >
                        <FormSubmitButton variant="ghost" className="text-xs text-red-600">
                          Supprimer
                        </FormSubmitButton>
                        <input type="hidden" name="redirectTo" value={redirectBase} />
                      </form>
                    </div>
                    {payment.note && (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{payment.note}</p>
                    )}
                  </div>
                ))
            )}
          </div>
          <form action={recordPaymentAction} className="space-y-3 text-sm">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <input type="hidden" name="redirectTo" value={redirectBase} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="amount" className="label">
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
                <label htmlFor="date" className="label">
                  Date
                </label>
                <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="method" className="label">
                Mode de paiement
              </label>
              <Input id="method" name="method" placeholder="Virement bancaire" />
            </div>
            <div className="space-y-1">
              <label htmlFor="note" className="label">
                Note
              </label>
              <Textarea id="note" name="note" rows={3} placeholder="Référence, conditions, etc." />
            </div>
            <FormSubmitButton className="w-full">
              Ajouter un paiement
            </FormSubmitButton>
          </form>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Envoyer la facture par e-mail</h2>
        {emailDisabled ? (
          <Alert
            variant="warning"
            title="Messagerie non configurée"
            description="Veuillez configurer votre messagerie (SMTP/IMAP) avant d'envoyer des emails."
          />
        ) : null}
        <form action={sendInvoiceEmailAction.bind(null, invoice.id)} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="redirectTo" value={redirectBase} />
          <div className="space-y-1 sm:col-span-1">
            <label htmlFor="email" className="label">
              Destinataire
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={invoice.client.email ?? ""}
              required
              disabled={emailDisabled}
            />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <label htmlFor="subject" className="label">
              Objet
            </label>
            <Input
              id="subject"
              name="subject"
              defaultValue={`Facture ${invoice.number}`}
              disabled={emailDisabled}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label htmlFor="message" className="label">
              Message
            </label>
            <Textarea
              id="message"
              name="message"
              rows={4}
              defaultValue={`Bonjour ${invoice.client.displayName},

Veuillez trouver ci-joint la facture ${invoice.number} d'un montant de ${formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}.

Cordialement.`}
              disabled={emailDisabled}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <FormSubmitButton disabled={emailDisabled}>
              Envoyer la facture
            </FormSubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
