import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OrderPaymentProofStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@/lib/db/prisma";
import { getOrder } from "@/server/orders";
import { getAdminInvoiceRequestSummaryForOrder } from "@/server/invoice-requests";
import {
  approveOrderPaymentProofAction,
  cancelOrderAction,
  createInvoiceFromOrderAction,
  createQuoteFromOrderAction,
  markOrderDeliveredAction,
  markOrderPaidAction,
  rejectOrderPaymentProofAction,
  updateOrderInternalNotesAction,
} from "@/app/(app)/site-web/commandes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  FULFILLED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const STATUS_VARIANTS: Record<OrderStatus, "info" | "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  PAID: "success",
  FULFILLED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};

const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  PENDING: "En attente",
  AUTHORIZED: "Autorisée",
  SUCCEEDED: "Payée",
  FAILED: "Échouée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

const PAYMENT_VARIANTS: Record<OrderPaymentStatus, "info" | "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  AUTHORIZED: "info",
  SUCCEEDED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

type PaymentMethod = "card" | "bank_transfer" | "cash_on_delivery" | "manual";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
  cash_on_delivery: "Paiement à la livraison",
  manual: "Paiement manuel",
};

const PROOF_STATUS_LABELS: Record<OrderPaymentProofStatus, string> = {
  PENDING: "Preuve en attente",
  APPROVED: "Preuve approuvée",
  REJECTED: "Preuve rejetée",
};

const PROOF_VARIANTS: Record<OrderPaymentProofStatus, "info" | "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

function resolvePaymentMethodLabel(method?: string | null) {
  if (!method) {
    return "Paiement";
  }
  if (method in PAYMENT_METHOD_LABELS) {
    return PAYMENT_METHOD_LABELS[method as PaymentMethod];
  }
  return "Paiement";
}

type PageParams = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;
type CommandeDetailPageProps = {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
};

export default async function CommandeDetailPage({
  params,
  searchParams,
}: CommandeDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const order = await getOrder(resolvedParams.id);
  if (!order) {
    notFound();
  }
  const invoiceRequestSummary = await getAdminInvoiceRequestSummaryForOrder(
    order.id,
  );

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

  const totalTTC = formatCurrency(
    fromCents(order.totalTTCCents, order.currency),
    order.currency,
  );
  const amountPaid = formatCurrency(
    fromCents(order.amountPaidCents, order.currency),
    order.currency,
  );
  const balance = formatCurrency(
    fromCents(
      Math.max(0, order.totalTTCCents - order.amountPaidCents),
      order.currency,
    ),
    order.currency,
  );
  const quantityFormatter = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const redirectBase = `/site-web/commandes/${order.id}`;
  const hasInvoice = Boolean(order.invoiceId);
  const hasQuote = Boolean(order.quoteId);
  const invoiceRequest = invoiceRequestSummary?.invoiceRequest ?? null;
  const invoiceEligibility = invoiceRequestSummary?.eligibility ?? null;
  const canGenerateInvoice = !hasInvoice && Boolean(invoiceEligibility?.eligible);
  const invoiceDeadlineLabel = invoiceEligibility
    ? formatDate(invoiceEligibility.requestDeadlineAt)
    : null;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Commande {order.orderNumber}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Créée le {formatDate(order.createdAt)} — Client : {order.customerName}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Badge variant={STATUS_VARIANTS[order.status]} className="w-full justify-center sm:w-auto">
            {STATUS_LABELS[order.status]}
          </Badge>
          <Badge variant={PAYMENT_VARIANTS[order.paymentStatus]} className="w-full justify-center sm:w-auto">
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </Badge>
          {hasInvoice ? (
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href={`/factures/${order.invoiceId}`}>Voir facture</Link>
            </Button>
          ) : (
            <form
              action={createInvoiceFromOrderAction.bind(null, order.id)}
              className="w-full sm:w-auto"
            >
              <FormSubmitButton
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={!canGenerateInvoice}
              >
                Générer facture
              </FormSubmitButton>
            </form>
          )}
          {hasQuote ? (
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href={`/devis/${order.quoteId}/modifier`}>Voir devis</Link>
            </Button>
          ) : (
            <form
              action={createQuoteFromOrderAction.bind(null, order.id)}
              className="w-full sm:w-auto"
            >
              <FormSubmitButton
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Générer devis
              </FormSubmitButton>
            </form>
          )}
          <form
            action={markOrderPaidAction.bind(null, order.id)}
            className="w-full sm:w-auto"
          >
            <FormSubmitButton
              variant="ghost"
              className="w-full text-emerald-600 dark:text-emerald-400 sm:w-auto"
              disabled={order.paymentStatus === OrderPaymentStatus.SUCCEEDED}
            >
              Marquer payée
            </FormSubmitButton>
            <input type="hidden" name="redirectTo" value={redirectBase} />
          </form>
          <form
            action={markOrderDeliveredAction.bind(null, order.id)}
            className="w-full sm:w-auto"
          >
            <FormSubmitButton
              variant="ghost"
              className="w-full text-blue-600 dark:text-blue-400 sm:w-auto"
              disabled={order.status === OrderStatus.FULFILLED}
            >
              Marquer livrée
            </FormSubmitButton>
            <input type="hidden" name="redirectTo" value={redirectBase} />
          </form>
          <form
            action={cancelOrderAction.bind(null, order.id)}
            className="w-full sm:w-auto"
          >
            <FormSubmitButton
              variant="ghost"
              className="w-full text-red-600 dark:text-red-400 sm:w-auto"
              disabled={order.status === OrderStatus.CANCELLED}
            >
              Annuler
            </FormSubmitButton>
            <input type="hidden" name="redirectTo" value={redirectBase} />
          </form>
        </div>
      </div>

      {!hasInvoice && invoiceEligibility && !invoiceEligibility.eligible ? (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          La facture ne peut être générée que pendant le même mois calendaire
          que la commande.
          {invoiceDeadlineLabel ? ` Date limite : ${invoiceDeadlineLabel}.` : ""}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Montant total
          </h2>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {totalTTC}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">TTC</p>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Montant payé
          </h2>
          <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {amountPaid}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Solde : <span className="font-semibold text-zinc-900 dark:text-zinc-100">{balance}</span>
          </p>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Client
          </h2>
          <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {order.customerName}
            </p>
            <p>{order.customerEmail}</p>
            {order.customerPhone ? <p>{order.customerPhone}</p> : null}
            {order.customerCompany ? <p>{order.customerCompany}</p> : null}
            {order.customerAddress ? <p>{order.customerAddress}</p> : null}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Demande de facture
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Suivi de la demande client et coordonnées de facturation
              confirmées.
            </p>
          </div>
          {hasInvoice ? (
            <Badge variant="success">Facture générée</Badge>
          ) : invoiceRequest ? (
            <Badge
              variant={
                invoiceRequest.status === "COMPLETED" ? "success" : "info"
              }
            >
              {invoiceRequest.status === "COMPLETED"
                ? "Demande traitée"
                : "Demande reçue"}
            </Badge>
          ) : (
            <Badge variant="neutral">Aucune demande</Badge>
          )}
        </div>

        {invoiceRequest ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Coordonnées transmises
              </h3>
              <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <p>
                  <span className="font-medium">Société :</span>{" "}
                  {invoiceRequest.companyName}
                </p>
                <p>
                  <span className="font-medium">TVA :</span>{" "}
                  {invoiceRequest.vatNumber}
                </p>
                <p className="whitespace-pre-line">
                  <span className="font-medium">Adresse :</span>{" "}
                  {invoiceRequest.billingAddress}
                </p>
                <p>
                  <span className="font-medium">E-mail d'envoi :</span>{" "}
                  {invoiceRequest.deliveryEmail}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Statut
              </h3>
              <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <p>
                  <span className="font-medium">Demandée le :</span>{" "}
                  {formatDate(invoiceRequest.requestedAt)}
                </p>
                {invoiceRequest.processedAt ? (
                  <p>
                    <span className="font-medium">Traitée le :</span>{" "}
                    {formatDate(invoiceRequest.processedAt)}
                  </p>
                ) : null}
                {invoiceDeadlineLabel ? (
                  <p>
                    <span className="font-medium">Date limite :</span>{" "}
                    {invoiceDeadlineLabel}
                  </p>
                ) : null}
                {!hasInvoice && invoiceEligibility && !invoiceEligibility.eligible ? (
                  <p className="text-amber-700 dark:text-amber-300">
                    La fenêtre de génération est fermée pour cette commande.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
            Aucun client n&apos;a encore demandé de facture pour cette commande.
          </p>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Articles
          </h2>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Qté</th>
                <th className="px-4 py-3 text-right">PU HT</th>
                <th className="px-4 py-3 text-right">TVA</th>
                <th className="px-4 py-3 text-right">Total TTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {order.items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                    {quantityFormatter.format(item.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                    {formatCurrency(
                      fromCents(item.unitPriceHTCents, order.currency),
                      order.currency,
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                    {quantityFormatter.format(item.vatRate)}%
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(
                      fromCents(item.totalTTCCents, order.currency),
                      order.currency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 p-4 lg:hidden">
          {order.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {item.description}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Quantité
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {quantityFormatter.format(item.quantity)} {item.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Prix unitaire
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(
                      fromCents(item.unitPriceHTCents, order.currency),
                      order.currency,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    TVA
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {quantityFormatter.format(item.vatRate)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Total TTC
                  </p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(
                      fromCents(item.totalTTCCents, order.currency),
                      order.currency,
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
          <div className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-300 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
            <span>
              Sous-total HT :{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(
                  fromCents(order.subtotalHTCents, order.currency),
                  order.currency,
                )}
              </span>
            </span>
            <span>
              TVA :{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatCurrency(
                  fromCents(order.totalTVACents, order.currency),
                  order.currency,
                )}
              </span>
            </span>
            <span>
              Total TTC :{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {totalTTC}
              </span>
            </span>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Paiements
        </h2>
        <div className="mt-4 space-y-3">
          {order.payments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Aucun paiement enregistré.
            </p>
          ) : (
            order.payments.map((payment) => {
              const proofStatus =
                payment.proofStatus ??
                (payment.proofUrl ? OrderPaymentProofStatus.PENDING : null);
              const canReviewProof =
                payment.method === "bank_transfer" &&
                proofStatus === OrderPaymentProofStatus.PENDING;

              return (
                <div
                  key={payment.id}
                  className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(
                        fromCents(payment.amountCents, payment.currency),
                        payment.currency,
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {resolvePaymentMethodLabel(payment.method)} •{" "}
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </p>
                  </div>
                    <Badge variant={PAYMENT_VARIANTS[payment.status]}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </Badge>
                  </div>
                  {payment.externalReference ? (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Référence : {payment.externalReference}
                    </p>
                  ) : null}
                  {payment.proofUrl ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <a
                        href={payment.proofUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Voir le justificatif
                      </a>
                      {proofStatus ? (
                        <Badge variant={PROOF_VARIANTS[proofStatus]}>
                          {PROOF_STATUS_LABELS[proofStatus]}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {canReviewProof ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form
                        action={approveOrderPaymentProofAction.bind(
                          null,
                          order.id,
                          payment.id,
                        )}
                      >
                        <FormSubmitButton variant="secondary">
                          Approuver la preuve
                        </FormSubmitButton>
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={redirectBase}
                        />
                      </form>
                      <form
                        action={rejectOrderPaymentProofAction.bind(
                          null,
                          order.id,
                          payment.id,
                        )}
                      >
                        <FormSubmitButton
                          variant="ghost"
                          className="text-red-600 dark:text-red-400"
                        >
                          Rejeter la preuve
                        </FormSubmitButton>
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={redirectBase}
                        />
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Note client
          </h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {order.notes || "—"}
          </p>
        </div>
        <form
          action={updateOrderInternalNotesAction.bind(null, order.id)}
          className="card p-4"
        >
          <label htmlFor="internalNotes" className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Notes internes
          </label>
          <Textarea
            id="internalNotes"
            name="internalNotes"
            className="mt-3"
            defaultValue={order.internalNotes ?? ""}
            placeholder="Ajoutez un contexte pour l'équipe..."
          />
          <div className="mt-3">
            <FormSubmitButton variant="secondary">
              Enregistrer les notes
            </FormSubmitButton>
          </div>
          <input type="hidden" name="redirectTo" value={redirectBase} />
        </form>
      </section>
    </div>
  );
}
