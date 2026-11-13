import type { Route } from "next";
import { requireAppSectionAccess } from "@/lib/authorization";
import { Button } from "@/components/ui/button";
import { FlashMessages, type FlashMessage } from "@/components/ui/flash-messages";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  getKasperskyVariant,
  isKasperskySku,
  KASPERSKY_VARIANTS,
  LICENCE_CODE_STATUS_LABELS,
  LICENCE_CODE_STATUSES,
  type LicenceCodeStatus,
} from "@/lib/digital-products/kaspersky-catalog";
import { maskLicenceCode } from "@/lib/digital-products/licence-code-format";
import { listLicenceCodes } from "@/server/digital-products/store";
import {
  CodeStatusBadge,
  EmptyState,
  firstParam,
  formatDateTime,
  KASPERSKY_BASE_PATH,
  parsePage,
  SectionHeader,
  TierDot,
} from "../../_components/ui";
import { revokeCodeAction } from "../actions";
import { ImportCodesForm } from "./import-codes-form";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type SearchParams = Record<string, string | string[] | undefined>;

export default async function LicenceCodesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const params = (await searchParams) ?? {};

  const skuParam = firstParam(params.sku);
  const sku = isKasperskySku(skuParam) ? skuParam : null;
  const statusParam = firstParam(params.statut);
  const status = (LICENCE_CODE_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as LicenceCodeStatus)
    : null;
  const hintParam = (firstParam(params.fin) ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const hint = hintParam.length === 4 ? hintParam : null;
  const page = parsePage(params.page);

  const { items, total } = await listLicenceCodes({ tenantId, productSku: sku, status, hint, page, pageSize: PAGE_SIZE });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const query = new URLSearchParams();
  if (sku) query.set("sku", sku);
  if (status) query.set("statut", status);
  if (hint) query.set("fin", hint);
  const buildHref = (target: number) => {
    const next = new URLSearchParams(query);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return `${KASPERSKY_BASE_PATH}/codes${qs ? `?${qs}` : ""}`;
  };
  const currentHref = buildHref(page);

  const flash: FlashMessage[] = [];
  const message = firstParam(params.message);
  const error = firstParam(params.error);
  if (message) flash.push({ variant: "success", title: message });
  if (error) flash.push({ variant: "error", title: error });

  return (
    <div className="space-y-6">
      <FlashMessages messages={flash} />
      <SectionHeader
        eyebrow="Kaspersky"
        title="Codes d’activation"
        description="Stock chiffré par variante. Les codes ne sont jamais affichés en clair : seuls les 4 derniers caractères sont visibles."
      />

      <ImportCodesForm defaultSku={sku ?? KASPERSKY_VARIANTS[0].sku} />

      <section className="card overflow-hidden" aria-labelledby="codes-list-title">
        <div className="space-y-4 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h2 id="codes-list-title" className="font-semibold text-zinc-900 dark:text-zinc-100">
            Inventaire <span className="font-normal text-zinc-500">({total})</span>
          </h2>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <Select name="sku" defaultValue={sku ?? ""} aria-label="Filtrer par variante">
              <option value="">Toutes les variantes</option>
              {KASPERSKY_VARIANTS.map((variant) => (
                <option key={variant.sku} value={variant.sku}>
                  {variant.label}
                </option>
              ))}
            </Select>
            <Select name="statut" defaultValue={status ?? ""} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {LICENCE_CODE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {LICENCE_CODE_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
            <Input
              name="fin"
              defaultValue={hint ?? ""}
              maxLength={4}
              placeholder="4 derniers caractères"
              aria-label="Rechercher par les 4 derniers caractères"
              className="font-mono uppercase"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" className="flex-1">Filtrer</Button>
              {sku || status || hint ? (
                <Button asChild variant="ghost">
                  <PrefetchLink href={`${KASPERSKY_BASE_PATH}/codes` as Route}>Réinitialiser</PrefetchLink>
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucun code"
              description={sku || status || hint ? "Aucun code ne correspond aux filtres." : "Ajoutez vos premiers codes ci-dessus."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Code</th>
                  <th scope="col" className="px-4 py-3 font-medium">Variante</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Lot</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Ajouté le</th>
                  <th scope="col" className="px-4 py-3 font-medium">Licence</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((code) => {
                  const variant = getKasperskyVariant(code.productSku);
                  return (
                    <tr key={code.id} className="align-middle">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-800 dark:text-zinc-200">
                        {maskLicenceCode(code.codeHint)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                          {variant ? <TierDot tier={variant.tier} /> : null}
                          {variant?.shortLabel ?? code.productSku}
                        </span>
                      </td>
                      <td className="px-4 py-3"><CodeStatusBadge status={code.status} /></td>
                      <td className="hidden max-w-[12rem] truncate px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                        {code.batchLabel ?? "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-500 lg:table-cell dark:text-zinc-400">
                        {formatDateTime(code.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {code.orderId && code.orderNumber ? (
                          <PrefetchLink
                            href={`${KASPERSKY_BASE_PATH}/licences/${code.orderId}` as Route}
                            className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {code.orderNumber}
                          </PrefetchLink>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {code.status === "AVAILABLE" ? (
                          <form action={revokeCodeAction}>
                            <input type="hidden" name="codeId" value={code.id} />
                            <input type="hidden" name="redirectTo" value={currentHref} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                              title="Retirer ce code du stock (ex. code défectueux)"
                            >
                              Retirer
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <PaginationControls
            page={page}
            pageCount={pageCount}
            buildHref={buildHref}
            summary={`${total} code(s) · page ${page} sur ${pageCount}`}
          />
        </div>
      </section>
    </div>
  );
}
