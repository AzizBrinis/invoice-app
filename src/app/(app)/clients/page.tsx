import { clsx } from "clsx";
import Link from "next/link";
import { listClients } from "@/server/clients";
import { deleteClientAction } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";
import { formatDate } from "@/lib/formatters";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

function parseBooleanFilter(value: string | undefined): boolean | "all" {
  if (!value || value === "all") return "all";
  if (value === "actifs") return true;
  if (value === "inactifs") return false;
  return "all";
}

type SearchParams = Record<string, string | string[] | undefined>;

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = isPromise<SearchParams>(searchParams)
    ? await searchParams
    : searchParams;

  const search = Array.isArray(resolvedSearchParams?.recherche)
    ? resolvedSearchParams.recherche[0]
    : resolvedSearchParams?.recherche ?? "";
  const statutParam = Array.isArray(resolvedSearchParams?.statut)
    ? resolvedSearchParams.statut[0]
    : (resolvedSearchParams?.statut as string | undefined);
  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams?.page;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error ?? null;

  const page = Number(pageParam ?? "1") || 1;
  const isActive = parseBooleanFilter(statutParam);

  const clients = await listClients({
    search: search || undefined,
    isActive,
    page,
  });

  return (
    <div className="space-y-6">
      {errorMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {errorMessage}
        </p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Clients</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Gérez vos clients, coordonnées et notes associées.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            variant="ghost"
            className="text-sm text-blue-600 dark:text-blue-400"
            href="/api/export/clients"
            loadingText="Export…"
          >
            Export CSV
          </ExportButton>
          <Button asChild>
            <Link href="/clients/nouveau">Nouveau client</Link>
          </Button>
        </div>
      </div>

      <form className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="recherche">
            Recherche
          </label>
          <input
            className="input"
            type="search"
            id="recherche"
            name="recherche"
            defaultValue={search}
            placeholder="Nom, e-mail, TVA..."
          />
        </div>
        <div>
          <label className="label" htmlFor="statut">
            Statut
          </label>
          <select
            id="statut"
            name="statut"
            className="input"
            defaultValue={statutParam ?? "all"}
          >
            <option value="all">Tous les clients</option>
            <option value="actifs">Actifs</option>
            <option value="inactifs">Inactifs</option>
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Nom / Raison sociale</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">TVA</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Modifié</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {clients.items.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {client.displayName}
                  </div>
                  {client.companyName && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {client.companyName}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  <div>{client.email ?? "—"}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {client.phone ?? ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {client.vatNumber ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                      client.isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                    )}
                  >
                    {client.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {formatDate(client.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="secondary" className="px-2 py-1 text-xs">
                      <Link href={`/clients/${client.id}/modifier`}>Modifier</Link>
                    </Button>
                    <form action={deleteClientAction.bind(null, client.id)}>
                      <FormSubmitButton
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Supprimer
                      </FormSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {clients.items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  Aucun client trouvé avec ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {clients.pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <PaginationLink
            page={clients.page - 1}
            disabled={clients.page <= 1}
            search={search}
            statut={statutParam ?? "all"}
          >
            Précédent
          </PaginationLink>
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            Page {clients.page} / {clients.pageCount}
          </span>
          <PaginationLink
            page={clients.page + 1}
            disabled={clients.page >= clients.pageCount}
            search={search}
            statut={statutParam ?? "all"}
          >
            Suivant
          </PaginationLink>
        </div>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  disabled,
  search,
  statut,
  children,
}: {
  page: number;
  disabled: boolean;
  search: string;
  statut: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {children}
      </span>
    );
  }

  const params = new URLSearchParams();
  if (search) params.set("recherche", search);
  if (statut) params.set("statut", statut);
  params.set("page", String(page));

  return (
    <Link
      href={`/clients?${params.toString()}`}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
