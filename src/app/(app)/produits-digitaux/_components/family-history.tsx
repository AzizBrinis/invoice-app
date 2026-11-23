import type { Route } from "next";
import { requireAppSectionAccess } from "@/lib/authorization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { Select } from "@/components/ui/select";
import {
  LICENCE_ORDER_STATUS_LABELS,
  LICENCE_ORDER_STATUSES,
  type LicenceOrderStatus,
} from "@/lib/digital-products/kaspersky-catalog";
import {
  getDigitalProductFamily,
  isFamilySku,
  type DigitalProductFamilyId,
} from "@/lib/digital-products/catalog";
import { listLicenceOrders } from "@/server/digital-products/store";
import {
  EmptyState,
  firstParam,
  formatDateTime,
  OrderStatusBadge,
  parsePage,
  SectionHeader,
  SourceLabel,
  VariantLabel,
} from "./ui";

const PAGE_SIZE = 20;
type SearchParams = Record<string, string | string[] | undefined>;

/** Licence history of one product family. */
export async function FamilyHistoryPage({
  familyId,
  searchParams,
}: {
  familyId: DigitalProductFamilyId;
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const params = (await searchParams) ?? {};
  const family = getDigitalProductFamily(familyId);
  const basePath = family.basePath;
  const productSkus = family.variants.map((variant) => variant.sku);

  const skuParam = firstParam(params.sku);
  const sku = isFamilySku(family, skuParam) ? skuParam : null;
  const statusParam = firstParam(params.statut);
  const status = (LICENCE_ORDER_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as LicenceOrderStatus)
    : null;
  const search = (firstParam(params.recherche) ?? "").trim().slice(0, 80) || null;
  const page = parsePage(params.page);

  const { items, total } = await listLicenceOrders({ tenantId, productSku: sku, productSkus, status, search, page, pageSize: PAGE_SIZE });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = new URLSearchParams();
  if (sku) query.set("sku", sku);
  if (status) query.set("statut", status);
  if (search) query.set("recherche", search);
  const buildHref = (target: number) => {
    const next = new URLSearchParams(query);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `${basePath}/licences${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={family.name}
        title="Historique des licences"
        description="Toutes les licences générées manuellement ou via l’API, avec leurs codes attribués (masqués)."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <PrefetchLink href={`${basePath}/generer` as Route}>Générer une licence</PrefetchLink>
          </Button>
        }
      />

      <section className="card overflow-hidden">
        <form method="get" className="grid gap-3 border-b border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_auto] dark:border-zinc-800">
          <Input name="recherche" defaultValue={search ?? ""} placeholder="N° de licence, client, e-mail, commande…" aria-label="Rechercher" />
          <Select name="sku" defaultValue={sku ?? ""} aria-label="Filtrer par variante">
            <option value="">Toutes les variantes</option>
            {family.variants.map((variant) => (
              <option key={variant.sku} value={variant.sku}>{variant.label}</option>
            ))}
          </Select>
          <Select name="statut" defaultValue={status ?? ""} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            {LICENCE_ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>{LICENCE_ORDER_STATUS_LABELS[value]}</option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">Filtrer</Button>
        </form>

        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Aucune licence" description="Les licences générées apparaîtront ici." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Licence</th>
                  <th scope="col" className="px-4 py-3 font-medium">Produit</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Qté</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Client / commande</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Source</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Créée le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <PrefetchLink
                          href={`${basePath}/licences/${order.id}` as Route}
                          className="font-mono font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {order.number}
                        </PrefetchLink>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <VariantLabel sku={order.productSku} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{order.quantity}</td>
                      <td className="hidden max-w-[16rem] px-4 py-3 md:table-cell">
                        <p className="truncate text-zinc-800 dark:text-zinc-200">{order.customerName ?? "—"}</p>
                        {order.orderReference ? (
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{order.orderReference}</p>
                        ) : null}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell dark:text-zinc-300">
                        <SourceLabel source={order.source} />
                      </td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-500 sm:table-cell dark:text-zinc-400">
                        {formatDateTime(order.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <PaginationControls page={page} pageCount={pageCount} buildHref={buildHref} summary={`${total} licence(s) · page ${page} sur ${pageCount}`} />
        </div>
      </section>
    </div>
  );
}
