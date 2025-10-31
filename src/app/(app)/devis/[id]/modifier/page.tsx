import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getQuote } from "@/server/quotes";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { updateQuoteAction, sendQuoteEmailAction } from "@/app/(app)/devis/actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getSettings } from "@/server/settings";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { normalizeTaxConfiguration } from "@/lib/taxes";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";
import { getMessagingSettingsSummary } from "@/server/messaging";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";

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

  const [clients, products, settings, messagingSummary] = await Promise.all([
    prisma.client.findMany({ orderBy: { displayName: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    getSettings(),
    getMessagingSettingsSummary(),
  ]);

  const redirectBase = `/devis/${quote.id}/modifier`;
  const emailDisabled = !messagingSummary.smtpConfigured;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      {successMessage ? <Alert variant="success" title={successMessage} /> : null}
      {warningMessage ? <Alert variant="warning" title={warningMessage} /> : null}
      {errorMessage ? <Alert variant="error" title={errorMessage} /> : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Modifier le devis {quote.number}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Ajustez les lignes, remises et conditions avant envoi.
          </p>
        </div>
        <Link
          href="/devis"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Retour à la liste
        </Link>
      </div>
      <QuoteEditor
        action={updateQuoteAction.bind(null, quote.id)}
        submitLabel="Mettre à jour le devis"
        clients={clients}
        products={products}
        defaultCurrency={settings.defaultCurrency as CurrencyCode}
        currencyOptions={SUPPORTED_CURRENCIES}
        taxConfiguration={normalizeTaxConfiguration(settings.taxConfiguration)}
        defaultQuote={quote}
        redirectTo="/devis"
      />
      <section className="card space-y-4 p-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Envoyer le devis par e-mail
        </h2>
        {emailDisabled ? (
          <Alert
            variant="warning"
            title="Messagerie non configurée"
            description="Veuillez configurer votre messagerie (SMTP/IMAP) avant d'envoyer des emails."
          />
        ) : null}
        <form action={sendQuoteEmailAction.bind(null, quote.id)} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="redirectTo" value={redirectBase} />
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-zinc-600 dark:text-zinc-300">
              Destinataire
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={quote.client.email ?? ""}
              required
              disabled={emailDisabled}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="subject" className="text-sm text-zinc-600 dark:text-zinc-300">
              Objet
            </label>
            <Input
              id="subject"
              name="subject"
              defaultValue={`Devis ${quote.number}`}
              disabled={emailDisabled}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label htmlFor="message" className="text-sm text-zinc-600 dark:text-zinc-300">
              Message
            </label>
            <Textarea
              id="message"
              name="message"
              rows={4}
              defaultValue={`Bonjour ${quote.client.displayName},\n\nVeuillez trouver ci-joint le devis ${quote.number} d'un montant de ${formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}.\n\nCordialement.`}
              disabled={emailDisabled}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <FormSubmitButton disabled={emailDisabled}>
              Envoyer le devis
            </FormSubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
