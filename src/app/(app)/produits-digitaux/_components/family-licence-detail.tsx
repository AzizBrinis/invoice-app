import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { requireAppSectionAccess } from "@/lib/authorization";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FlashMessages, type FlashMessage } from "@/components/ui/flash-messages";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import {
  getDigitalProductFamily,
  getDigitalProductVariant,
  type DigitalProductFamilyId,
} from "@/lib/digital-products/catalog";
import { maskLicenceCode } from "@/lib/digital-products/licence-code-format";
import {
  getLicenceOrder,
  getOrderCodeHints,
  listLicenceEvents,
} from "@/server/digital-products/store";
import {
  actorLabel,
  CodeStatusBadge,
  eventLabel,
  firstParam,
  formatDateTime,
  formatIsoDate,
  OrderStatusBadge,
  SectionHeader,
  SourceLabel,
} from "./ui";
import { cancelLicenceAction } from "../actions";
import { DownloadPdfButton } from "./download-pdf-button";

type Params = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;

/** Detail of one licence; redirects to the section of the licence's product. */
export async function FamilyLicenceDetailPage({
  familyId,
  params,
  searchParams,
}: {
  familyId: DigitalProductFamilyId;
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const { id } = await params;
  if (!/^dlord-[0-9a-f-]{36}$/.test(id)) notFound();
  const query = (await searchParams) ?? {};

  const order = await getLicenceOrder(tenantId, id);
  if (!order) notFound();
  const [codes, events] = await Promise.all([
    getOrderCodeHints(tenantId, id),
    listLicenceEvents({ tenantId, orderId: id, limit: 50 }),
  ]);
  const variant = getDigitalProductVariant(order.productSku);
  if (variant && variant.family !== familyId) {
    redirect(`${getDigitalProductFamily(variant.family).basePath}/licences/${order.id}` as Route);
  }
  const family = getDigitalProductFamily(variant?.family ?? familyId);
  const basePath = family.basePath;
  const pdfHref = `/api/produits-digitaux/licences/${order.id}/pdf`;
  const canDownload = order.status !== "CANCELLED";
  const canCancel = order.status === "PENDING" && order.generationCount === 0;

  const flash: FlashMessage[] = [];
  const message = firstParam(query.message);
  const error = firstParam(query.error);
  if (message) flash.push({ variant: "success", title: message });
  if (error) flash.push({ variant: "error", title: error });
  const isNew = firstParam(query.nouveau) === "1";

  const details: Array<[string, React.ReactNode]> = [
    ["Produit", variant?.label ?? order.productSku],
    ["Quantité", `${order.quantity} code(s)`],
    ["Source", <SourceLabel key="source" source={order.source} />],
    ["Client", order.customerName ?? "—"],
    ["E-mail", order.customerEmail ?? "—"],
    ["Référence de commande", order.orderReference ?? "—"],
    ["Région d’activation", order.activationRegion ?? "—"],
    ["À utiliser avant le", formatIsoDate(order.useBefore)],
    ["Créée le", formatDateTime(order.createdAt)],
    ["Créée par", order.createdByName ?? (order.apiKeyId ? `API (${order.apiKeyId})` : "—")],
    ["PDF généré le", formatDateTime(order.generatedAt)],
    ["Téléchargements", String(order.generationCount)],
  ];

  return (
    <div className="space-y-6">
      <FlashMessages messages={flash} />
      <SectionHeader
        eyebrow={`Licence ${family.name}`}
        title={order.number}
        description={variant?.label}
        actions={
          <>
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <PrefetchLink href={`${basePath}/licences` as Route}>Retour à l’historique</PrefetchLink>
            </Button>
            {canDownload ? (
              <>
                <Button asChild variant="secondary" className="w-full sm:w-auto">
                  <a href={`${pdfHref}?disposition=inline`} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4" aria-hidden="true" /> Aperçu
                  </a>
                </Button>
                <DownloadPdfButton href={pdfHref} />
              </>
            ) : null}
          </>
        }
      />

      {isNew && order.status === "PENDING" ? (
        <Alert
          variant="success"
          title={`${order.quantity} code(s) attribué(s) et réservé(s).`}
          description="Téléchargez le PDF pour finaliser : les codes passeront alors au statut « utilisé »."
        />
      ) : null}
      {order.lastErrorCode ? (
        <Alert
          variant="warning"
          title="La dernière génération du PDF a échoué."
          description="Réessayez le téléchargement : les mêmes codes seront réutilisés."
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="licence-details">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="licence-details" className="font-semibold text-zinc-900 dark:text-zinc-100">Détails</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
                <dd className="truncate text-sm text-zinc-900 dark:text-zinc-100">{value}</dd>
              </div>
            ))}
          </dl>
          {order.notes ? (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
              <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Note interne</p>
              <p className="whitespace-pre-line">{order.notes}</p>
            </div>
          ) : null}
        </section>

        <section className="card p-5" aria-labelledby="licence-codes">
          <h2 id="licence-codes" className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Codes attribués</h2>
          {codes.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {order.status === "CANCELLED" ? "Codes remis en stock." : "Aucun code."}
            </p>
          ) : (
            <ul className="space-y-2">
              {codes.map((code, index) => (
                <li key={code.id} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                    <span className="mr-2 text-xs text-zinc-400">{index + 1}.</span>
                    {maskLicenceCode(code.codeHint, family.codeFormat)}
                  </span>
                  <CodeStatusBadge status={code.status} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Les codes complets n’apparaissent que dans le PDF.
          </p>
          {canCancel ? (
            <form action={cancelLicenceAction} className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="family" value={family.id} />
              <Button type="submit" variant="danger" className="w-full">
                Annuler et remettre les codes en stock
              </Button>
            </form>
          ) : null}
        </section>
      </div>

      <section className="card p-5" aria-labelledby="licence-history">
        <h2 id="licence-history" className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Historique</h2>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun évènement.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-zinc-200 pl-5 dark:border-zinc-700">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{eventLabel(event.type)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDateTime(event.createdAt)} · {actorLabel(event.actor, event.actorName)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
