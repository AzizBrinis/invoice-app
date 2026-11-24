import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireAppSectionAccess } from "@/lib/authorization";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { codeFormatForSku, getDigitalProductVariant } from "@/lib/digital-products/catalog";
import { maskLicenceCode } from "@/lib/digital-products/licence-code-format";
import { customerNameOf, digitalOrderPayloadSchema } from "@/server/digital-products/fulfilment";
import {
  AWAITING_APPROVAL_CODE,
  isAwaitingApproval,
  postgresFulfilmentStore,
} from "@/server/digital-products/fulfilment-store";
import { OrderEmailError, previewDigitalOrderEmail } from "@/server/digital-products/order-email";
import { getLicenceOrder, getOrderCodeHints } from "@/server/digital-products/store";
import { formatMinor } from "@/server/integrations/prestashop/payload";
import { defaultPrestashopInvoiceDeps } from "@/server/integrations/prestashop/service";
import { firstParam, formatDateTime, SectionHeader } from "../../_components/ui";
import { sendReviewedOrderAction } from "../actions";
import { ReviewDocuments, type ReviewDocument } from "./review-documents";
import { SendButton } from "./send-button";

export const dynamic = "force-dynamic";

type Params = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Review of a PrestaShop order sent with "Traiter la commande": what the
 * customer will receive (e-mail, invoice, licences), then "Envoyer".
 */
export default async function DigitalOrderReviewPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const { id } = await params;
  if (!/^dlful-[0-9a-f-]{36}$/.test(id)) notFound();
  const query = (await searchParams) ?? {};

  const review = await postgresFulfilmentStore.findReview(tenantId, id);
  if (!review) notFound();
  const parsed = digitalOrderPayloadSchema.safeParse(review.reviewPayload);
  const payload = parsed.success ? parsed.data : null;

  const [invoice, licences] = await Promise.all([
    review.invoiceId ? defaultPrestashopInvoiceDeps.getInvoice(tenantId, review.invoiceId) : Promise.resolve(null),
    Promise.all(
      review.licenceOrderIds.map(async (licenceId) => {
        const [licence, hints] = await Promise.all([
          getLicenceOrder(tenantId, licenceId),
          getOrderCodeHints(tenantId, licenceId),
        ]);
        if (!licence) return null;
        const format = codeFormatForSku(licence.productSku);
        return {
          id: licence.id,
          number: licence.number,
          product: getDigitalProductVariant(licence.productSku)?.label ?? licence.productSku,
          quantity: licence.quantity,
          status: licence.status,
          codes: hints.map((hint) => maskLicenceCode(hint.codeHint, format)),
        };
      }),
    ).then((rows) => rows.filter((row) => row !== null)),
  ]);

  const completed = review.status === "COMPLETED";
  const awaiting = !completed && Boolean(payload && review.reviewKeyId) && isAwaitingApproval({ ...review, reviewed: true });
  const lastSendFailed = awaiting && review.lastErrorCode !== AWAITING_APPROVAL_CODE;

  let email: Awaited<ReturnType<typeof previewDigitalOrderEmail>> | null = null;
  let emailError: string | null = null;
  if (payload && invoice && !completed) {
    try {
      email = await previewDigitalOrderEmail({
        tenantId,
        to: payload.invoice.customer.email,
        orderReference: payload.invoice.order.reference,
        customerName: customerNameOf(payload.invoice),
        invoiceNumber: invoice.number,
        licenceNumbers: licences.map((licence) => licence.number),
      });
    } catch (error) {
      emailError = error instanceof OrderEmailError ? error.message : "L’aperçu de l’e-mail n’a pas pu être préparé.";
    }
  }

  const documents: ReviewDocument[] = [
    ...(invoice ? [{ id: "invoice", title: `Facture ${invoice.number}`, href: `/api/factures/${invoice.id}/pdf` }] : []),
    ...licences.map((licence) => ({
      id: licence.id,
      title: `Licence ${licence.number}`,
      href: `/api/produits-digitaux/licences/${licence.id}/pdf?disposition=inline`,
    })),
  ];
  const sent = firstParam(query.envoye);
  const sendError = firstParam(query.erreur);
  const totals = payload?.invoice.totals;
  const currency = payload?.invoice.order.currency ?? invoice?.currency ?? "";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Commande PrestaShop à valider"
        title={`Commande ${review.orderReference}`}
        description="Vérifiez l’e-mail et les documents que recevra le client, puis envoyez-les. Rien n’est envoyé avant votre validation."
        actions={
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <PrefetchLink href={"/produits-digitaux" as Route}>Produits digitaux</PrefetchLink>
          </Button>
        }
      />

      {sent ? (
        <Alert
          variant="success"
          title={sent === "deja" ? "Cette commande avait déjà été envoyée." : "E-mail envoyé au client avec la facture et les licences."}
          description="PrestaShop passera la commande à « Livré » au prochain affichage de la commande ou au prochain passage de la tâche planifiée."
        />
      ) : null}
      {sendError ? <Alert variant="error" title="L’envoi a échoué." description={sendError} /> : null}
      {completed && !sent ? (
        <Alert
          variant="success"
          title="Commande déjà envoyée."
          description={`E-mail « ${review.emailSubject ?? ""} » envoyé à ${review.emailTo ?? "—"} le ${formatDateTime(review.emailSentAt)}.`}
        />
      ) : null}
      {!completed && !awaiting ? (
        <Alert
          variant="warning"
          title={review.status === "PROCESSING" ? "Commande en cours de traitement." : "Cette commande n’attend pas de validation ici."}
          description={review.lastErrorCode ? `Dernier état : ${review.lastErrorCode}. Relancez-la depuis PrestaShop si nécessaire.` : undefined}
        />
      ) : null}
      {lastSendFailed && !sendError ? (
        <Alert variant="warning" title="Le dernier envoi a échoué." description={`Code : ${review.lastErrorCode}. Vous pouvez réessayer.`} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5" aria-labelledby="order-summary">
          <h2 id="order-summary" className="mb-4 font-semibold text-zinc-900 dark:text-zinc-100">Commande</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Client</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {payload ? customerNameOf(payload.invoice) : "—"}
                <span className="block text-zinc-600 dark:text-zinc-300">{payload?.invoice.customer.email}</span>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Total facture TTC</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {invoice
                  ? `${formatMinor(invoice.totalTTCCents, invoice.currency)} ${invoice.currency}`
                  : totals ? `${totals.totalTaxIncl} ${currency}` : "—"}
                {payload && !payload.invoice.order.isPaid ? <span className="ml-2 text-red-600">non payée</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Facture</dt>
              <dd>
                {invoice ? (
                  <PrefetchLink className="text-blue-600 hover:underline dark:text-blue-400" href={`/factures/${invoice.id}` as Route}>
                    {invoice.number}
                  </PrefetchLink>
                ) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Licences</dt>
              <dd>
                <ul className="space-y-1">
                  {licences.map((licence) => (
                    <li key={licence.id} className="text-zinc-900 dark:text-zinc-100">
                      <span className="font-mono text-xs">{licence.number}</span> — {licence.product} × {licence.quantity}
                      <span className="block font-mono text-xs text-zinc-500">{licence.codes.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Demandée le</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">{formatDateTime(review.reviewRequestedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5 lg:col-span-2" aria-labelledby="email-preview">
          <h2 id="email-preview" className="mb-4 font-semibold text-zinc-900 dark:text-zinc-100">E-mail au client</h2>
          {emailError ? <Alert variant="error" title="Aperçu indisponible" description={emailError} /> : null}
          {email ? (
            <>
              <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-zinc-500 dark:text-zinc-400">À</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{email.to}</dd>
                <dt className="text-zinc-500 dark:text-zinc-400">Objet</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{email.subject}</dd>
                <dt className="text-zinc-500 dark:text-zinc-400">Pièces jointes</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{documents.map((doc) => doc.title).join(" · ")}</dd>
              </dl>
              {/* Sanitized server-side. Sandboxed without allow-scripts: no script, form,
                  popup or navigation can run. allow-same-origin is only there because
                  an opaque-origin srcdoc frame cannot render under the app's CSP. */}
              <iframe
                title="Aperçu de l’e-mail"
                sandbox="allow-same-origin"
                referrerPolicy="no-referrer"
                srcDoc={email.html}
                className="h-[420px] w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-800"
              />
            </>
          ) : null}
          {completed ? <p className="text-sm text-zinc-600 dark:text-zinc-300">L’e-mail a été envoyé.</p> : null}
        </section>
      </div>

      {documents.length ? (
        <section className="card p-5" aria-labelledby="review-documents">
          <h2 id="review-documents" className="mb-4 font-semibold text-zinc-900 dark:text-zinc-100">Documents joints</h2>
          <ReviewDocuments documents={documents} />
        </section>
      ) : null}

      {awaiting ? (
        <section className="card sticky bottom-0 z-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          {email?.sendIssue ? (
            <Alert variant="error" title="Envoi impossible pour le moment" description={email.sendIssue} />
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Le client recevra cet e-mail avec les pièces jointes ci-dessus.
            </p>
          )}
          <form action={sendReviewedOrderAction}>
            <input type="hidden" name="fulfilmentId" value={review.id} />
            <SendButton recipient={email?.to ?? payload?.invoice.customer.email ?? ""} disabled={!email || Boolean(email.sendIssue)} />
          </form>
        </section>
      ) : null}
    </div>
  );
}
