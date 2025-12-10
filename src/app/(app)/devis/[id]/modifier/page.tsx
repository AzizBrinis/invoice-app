import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getQuote,
  getQuoteFilterClients,
  getQuoteFormSettings,
} from "@/server/quotes";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { updateQuoteAction, sendQuoteEmailAction } from "@/app/(app)/devis/actions";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { normalizeTaxConfiguration } from "@/lib/taxes";
import { Alert } from "@/components/ui/alert";
import { getMessagingSettingsSummary } from "@/server/messaging";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { DocumentEmailForm } from "@/components/documents/document-email-form";

export const dynamic = "force-dynamic";

type PageParams = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;
type EditDevisPageProps = {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
};

export default async function EditDevisPage({
  params,
  searchParams,
}: EditDevisPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const user = await requireUser();
  const quote = await getQuote(resolvedParams.id, user.id);

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

  const [clients, settings, messagingSummary] = await Promise.all([
    getQuoteFilterClients(user.id),
    getQuoteFormSettings(user.id),
    getMessagingSettingsSummary(user.id),
  ]);

  const emailDisabled = !messagingSummary.smtpConfigured;
  if (emailDisabled && !warningMessage) {
    flashMessages.push({
      variant: "warning",
      title:
        "Veuillez configurer la messagerie (SMTP/IMAP) avant d'envoyer des devis.",
    });
  }

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 sm:self-end"
        >
          Retour à la liste
        </Link>
      </div>
      <QuoteEditor
        action={updateQuoteAction.bind(null, quote.id)}
        submitLabel="Mettre à jour le devis"
        clients={clients}
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
            description="Veuillez configurer la messagerie (SMTP/IMAP) avant d'envoyer des devis."
          />
        ) : null}
        <DocumentEmailForm
          action={sendQuoteEmailAction.bind(null, quote.id)}
          defaultEmail={quote.client.email ?? ""}
          defaultSubject={`Devis ${quote.number}`}
          disabled={emailDisabled}
          submitLabel="Envoyer le devis"
        />
      </section>
    </div>
  );
}
