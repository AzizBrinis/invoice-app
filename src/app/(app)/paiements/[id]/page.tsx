import nextDynamic from "next/dynamic";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AccountPermission } from "@/lib/db/prisma";
import {
  hasAccountPermission,
  requireAppSectionAccess,
} from "@/lib/authorization";
import { getClientPayment } from "@/server/client-payments";
import {
  buildClientPaymentHrefFromSearchParams,
  readClientPaymentSearchParam,
} from "@/lib/client-payment-filters";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { DocumentEmailFormSkeleton } from "@/components/skeletons";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import {
  deleteClientPaymentAction,
  sendClientPaymentReceiptEmailAction,
} from "@/app/(app)/paiements/actions";
import { ReceiptPdfButton } from "@/app/(app)/paiements/_components/receipt-pdf-button";

const DocumentEmailForm = nextDynamic(
  () =>
    import("@/components/documents/document-email-form").then((mod) => ({
      default: mod.DocumentEmailForm,
    })),
  {
    loading: () => <DocumentEmailFormSkeleton />,
  },
);

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireAppSectionAccess("payments", {
    redirectOnFailure: true,
  });
  const { id } = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const payment = await getClientPayment(
    id,
    user.activeTenantId ?? user.tenantId ?? user.id,
  ).catch(() => null);

  if (!payment) {
    notFound();
  }

  const successMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "message") ?? null;
  const warningMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "warning") ?? null;
  const errorMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "error") ?? null;

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

  const canManagePayments = hasAccountPermission(
    user,
    AccountPermission.PAYMENTS_MANAGE,
  );
  const canManageReceipts = hasAccountPermission(
    user,
    AccountPermission.RECEIPTS_MANAGE,
  );
  const listHref = buildClientPaymentHrefFromSearchParams(
    resolvedSearchParams,
    {
      fallbackClientId: payment.client.id,
    },
  ) as Route;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />

      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <PrefetchLink
            href={listHref}
            prefetch={false}
            className="inline-flex text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Retour aux paiements
          </PrefetchLink>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(
                fromCents(payment.amountCents, payment.currency),
                payment.currency,
              )}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {payment.client.displayName}
              {payment.client.companyName ? ` · ${payment.client.companyName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{formatDate(payment.date)}</Badge>
            {payment.receiptNumber ? (
              <Badge variant="success">{payment.receiptNumber}</Badge>
            ) : (
              <Badge variant="info">Reçu à générer</Badge>
            )}
            {payment.receiptSentAt ? (
              <Badge variant="info">
                Envoyé le {formatDate(payment.receiptSentAt)}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <Button asChild variant="secondary">
            <PrefetchLink
              href={`/clients/${payment.client.id}` as Route}
              prefetch={false}
            >
              Dossier client
            </PrefetchLink>
          </Button>
          {canManageReceipts ? (
            <ReceiptPdfButton
              paymentId={payment.id}
              label="Télécharger le reçu"
              variant="ghost"
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Montant</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {formatCurrency(
              fromCents(payment.amountCents, payment.currency),
              payment.currency,
            )}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Services liés</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {payment.serviceLinks.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Reçu</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {payment.receiptIssuedAt ? "Généré" : "En attente"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Détails du paiement
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Informations opérationnelles et contexte du paiement.
            </p>
          </div>

          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Description</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {payment.description ?? payment.method ?? "Paiement client"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Référence</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {payment.reference ?? "Non renseignée"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Mode de paiement</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {payment.method ?? "Non renseigné"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Date</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {formatDate(payment.date)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Créé le</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {formatDate(payment.createdAt)}
              </dd>
            </div>
          </dl>

          {payment.note ? (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Note
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                {payment.note}
              </p>
            </div>
          ) : null}

          {canManagePayments && payment.privateNote ? (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Note privée
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-500 dark:text-zinc-400">
                {payment.privateNote}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Client
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Dossier auquel ce paiement est rattaché.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {payment.client.displayName}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {payment.client.companyName ?? "Sans société"} ·{" "}
                {payment.client.email ?? "Sans e-mail"}
              </p>
              <div className="mt-4">
                <Button asChild variant="secondary">
                  <PrefetchLink
                    href={`/clients/${payment.client.id}` as Route}
                    prefetch={false}
                  >
                    Ouvrir le client
                  </PrefetchLink>
                </Button>
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Services liés
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Instantanés des services associés à ce paiement.
              </p>
            </div>

            {payment.serviceLinks.length ? (
              <div className="space-y-3">
                {payment.serviceLinks.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {link.titleSnapshot}
                      </p>
                      {typeof link.allocatedAmountCents === "number" ? (
                        <Badge variant="info">
                          {formatCurrency(
                            fromCents(link.allocatedAmountCents, payment.currency),
                            payment.currency,
                          )}
                        </Badge>
                      ) : null}
                    </div>
                    {link.detailsSnapshot ? (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                        {link.detailsSnapshot}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Alert
                variant="warning"
                title="Aucun service lié"
                description="Ce paiement a été enregistré sans liaison explicite à un service."
              />
            )}
          </section>

          {canManageReceipts ? (
            <section className="card space-y-4 p-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Reçu
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Téléchargement et envoi du reçu de paiement.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ReceiptPdfButton
                  paymentId={payment.id}
                  label="Télécharger le reçu"
                  variant="secondary"
                />
              </div>

              <DocumentEmailForm
                action={sendClientPaymentReceiptEmailAction.bind(null, payment.id)}
                defaultEmail={payment.client.email}
                defaultSubject={
                  payment.receiptNumber
                    ? `Votre reçu ${payment.receiptNumber}`
                    : `Votre reçu de paiement ${payment.client.displayName}`
                }
                submitLabel="Envoyer le reçu"
                helperText="Le reçu est généré automatiquement s’il n’existe pas encore."
              />
            </section>
          ) : null}

          {canManagePayments ? (
            <section className="card space-y-4 p-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Supprimer le paiement
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Cette action supprime le paiement et ses liaisons de services.
                </p>
              </div>
              <form
                action={deleteClientPaymentAction.bind(
                  null,
                  payment.id,
                  payment.client.id,
                )}
              >
                <input type="hidden" name="redirectTo" value={listHref} />
                <FormSubmitButton variant="ghost" className="text-red-600 dark:text-red-400">
                  Supprimer ce paiement
                </FormSubmitButton>
              </form>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
