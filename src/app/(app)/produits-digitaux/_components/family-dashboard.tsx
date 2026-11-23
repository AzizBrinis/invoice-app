import type { Route } from "next";
import Link from "next/link";
import { FilePlus2, Upload } from "lucide-react";
import { clsx } from "clsx";
import { requireAppSectionAccess } from "@/lib/authorization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getDigitalProductFamily,
  getDigitalProductVariant,
  variantGroupKey,
  type DigitalProductFamilyId,
} from "@/lib/digital-products/catalog";
import { getDigitalProductInventory } from "@/server/digital-products/licences";
import { listLicenceEvents, listLicenceOrders } from "@/server/digital-products/store";
import {
  actorLabel,
  eventLabel,
  formatDateTime,
  GroupDot,
  LOW_STOCK_THRESHOLD,
  OrderStatusBadge,
  SectionHeader,
  StatTile,
} from "./ui";

/** Stock dashboard of one product family (Kaspersky, Windows…). */
export async function FamilyDashboardPage({ familyId }: { familyId: DigitalProductFamilyId }) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const family = getDigitalProductFamily(familyId);
  const basePath = family.basePath;
  const productSkus = family.variants.map((variant) => variant.sku);

  const [inventory, recentOrders, events] = await Promise.all([
    getDigitalProductInventory(tenantId, familyId),
    listLicenceOrders({ tenantId, productSkus, page: 1, pageSize: 6 }),
    listLicenceEvents({ tenantId, productSkus, limit: 8 }),
  ]);

  const totals = inventory.reduce(
    (acc, row) => ({
      available: acc.available + row.counts.AVAILABLE,
      reserved: acc.reserved + row.counts.RESERVED,
      used: acc.used + row.counts.USED,
      revoked: acc.revoked + row.counts.REVOKED,
    }),
    { available: 0, reserved: 0, used: 0, revoked: 0 },
  );
  const lowStock = inventory.filter((row) => row.counts.AVAILABLE < LOW_STOCK_THRESHOLD).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Produits Digitaux"
        title={`Licences ${family.name}`}
        description={`Stock de codes d’activation par variante (${family.durationLabel.toLowerCase()}) et historique des licences générées.`}
        actions={
          <>
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href={`${basePath}/codes` as Route}>
                <Upload className="h-4 w-4" aria-hidden="true" /> Ajouter des codes
              </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href={`${basePath}/generer` as Route}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Générer une licence
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Codes disponibles" value={totals.available} tone="success" />
        <StatTile label="Codes réservés" value={totals.reserved} tone="warning" hint="Licence créée, PDF non généré" />
        <StatTile label="Codes utilisés" value={totals.used} />
        <StatTile
          label="Variantes en stock faible"
          value={lowStock}
          tone={lowStock > 0 ? "warning" : "muted"}
          hint={`Moins de ${LOW_STOCK_THRESHOLD} codes disponibles`}
        />
      </div>

      <section aria-labelledby="inventory-title" className="space-y-4">
        <h2 id="inventory-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Stock par variante
        </h2>
        {family.groups.map((group) => {
          const rows = inventory.filter((row) => variantGroupKey(row.variant) === group.key);
          return (
            <div key={group.key} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                <GroupDot accent={group.accent} /> {group.label}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {rows.map(({ variant, counts }) => {
                  const low = counts.AVAILABLE < LOW_STOCK_THRESHOLD;
                  return (
                    <article key={variant.sku} className="card flex flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {variant.devices} poste{variant.devices > 1 ? "s" : ""}
                          </p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{variant.label}</p>
                        </div>
                        {counts.AVAILABLE === 0 ? (
                          <Badge variant="danger">Rupture</Badge>
                        ) : low ? (
                          <Badge variant="warning">Faible</Badge>
                        ) : null}
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Dispo.</dt>
                          <dd
                            className={clsx(
                              "text-lg font-semibold tabular-nums",
                              low ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {counts.AVAILABLE}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Réservés</dt>
                          <dd className="text-lg font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                            {counts.RESERVED}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Utilisés</dt>
                          <dd className="text-lg font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                            {counts.USED}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex gap-3 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
                        <Link
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                          href={`${basePath}/generer?sku=${variant.sku}` as Route}
                        >
                          Générer
                        </Link>
                        <Link
                          className="text-zinc-600 hover:underline dark:text-zinc-300"
                          href={`${basePath}/codes?sku=${variant.sku}` as Route}
                        >
                          Voir les codes
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="card overflow-hidden xl:col-span-3" aria-labelledby="recent-licences">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 id="recent-licences" className="font-semibold text-zinc-900 dark:text-zinc-100">
              Dernières licences
            </h2>
            <Link
              href={`${basePath}/licences` as Route}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Tout l’historique
            </Link>
          </div>
          {recentOrders.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Aucune licence générée pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentOrders.items.map((order) => {
                const variant = getDigitalProductVariant(order.productSku);
                return (
                  <li key={order.id}>
                    <Link
                      href={`${basePath}/licences/${order.id}` as Route}
                      className="flex flex-col gap-1 px-4 py-3 transition hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800/50"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {order.number}
                        </p>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {variant?.shortLabel ?? order.productSku} × {order.quantity}
                          {order.customerName ? ` · ${order.customerName}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{formatDateTime(order.createdAt)}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden xl:col-span-2" aria-labelledby="recent-activity">
          <h2
            id="recent-activity"
            className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
          >
            Activité récente
          </h2>
          {events.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Aucune activité.</p>
          ) : (
            <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {events.map((event) => (
                <li key={event.id} className="px-4 py-3 text-sm">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                    {eventLabel(event.type)}
                    {event.type === "CODES_IMPORTED" && event.details?.count
                      ? ` · ${String(event.details.count)} code(s)`
                      : ""}
                    {event.orderNumber ? ` · ${event.orderNumber}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(event.createdAt)} · {actorLabel(event.actor, event.actorName)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
