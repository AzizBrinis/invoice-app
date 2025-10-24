import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listQuotes } from "@/server/quotes";
import {
  changeQuoteStatusAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  convertQuoteToInvoiceAction,
} from "@/app/(app)/devis/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { QuoteStatus } from "@prisma/client";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
  EXPIRE: "Expiré",
};

function statusVariant(status: QuoteStatus) {
  switch (status) {
    case "ACCEPTE":
      return "success" as const;
    case "REFUSE":
    case "EXPIRE":
      return "danger" as const;
    case "ENVOYE":
      return "info" as const;
    default:
      return "neutral" as const;
  }
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

export default async function DevisPage({
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
    : (resolvedSearchParams?.statut as QuoteStatus | "all" | undefined) ?? "all";
  const clientParam = Array.isArray(resolvedSearchParams?.client)
    ? resolvedSearchParams.client[0]
    : (resolvedSearchParams?.client as string | undefined);
  const issueFrom = Array.isArray(resolvedSearchParams?.du)
    ? resolvedSearchParams.du[0]
    : (resolvedSearchParams?.du as string | undefined);
  const issueTo = Array.isArray(resolvedSearchParams?.au)
    ? resolvedSearchParams.au[0]
    : (resolvedSearchParams?.au as string | undefined);
  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : (resolvedSearchParams?.page as string | undefined);

  const page = Number(pageParam ?? "1") || 1;

  const [quotes, clients] = await Promise.all([
    listQuotes({
      search: search || undefined,
      status: statutParam,
      clientId: clientParam,
      issueDateFrom: issueFrom ? new Date(issueFrom) : undefined,
      issueDateTo: issueTo ? new Date(issueTo) : undefined,
      page,
    }),
    prisma.client.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Devis</h1>
          <p className="text-sm text-zinc-600">
            Suivez vos devis, leurs statuts et convertissez-les en factures.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" className="text-sm text-blue-600">
            <Link href="/api/export/devis" target="_blank">
              Export CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href="/devis/nouveau">Nouveau devis</Link>
          </Button>
        </div>
      </div>

      <form className="card grid gap-4 p-4 sm:grid-cols-5 sm:items-end">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="recherche">
            Recherche
          </label>
          <input
            className="input"
            type="search"
            id="recherche"
            name="recherche"
            defaultValue={search}
            placeholder="Numéro, client, référence..."
          />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="statut">
            Statut
          </label>
          <select
            id="statut"
            name="statut"
            className="input"
            defaultValue={statutParam}
          >
            <option value="all">Tous</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="client">
            Client
          </label>
          <select id="client" name="client" className="input" defaultValue={clientParam ?? ""}>
            <option value="">Tous</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="du">
            Du
          </label>
          <input className="input" type="date" id="du" name="du" defaultValue={issueFrom ?? ""} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="au">
            Au
          </label>
          <input className="input" type="date" id="au" name="au" defaultValue={issueTo ?? ""} />
        </div>
        <Button type="submit" variant="secondary" className="sm:col-span-5 sm:w-fit">
          Filtrer
        </Button>
      </form>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Numéro</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Émission</th>
              <th className="px-4 py-3 text-left">Validité</th>
              <th className="px-4 py-3 text-right">Total TTC</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {quotes.items.map((quote) => (
              <tr key={quote.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{quote.number}</div>
                  <div className="text-xs text-zinc-500">{quote.reference ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{quote.client?.displayName}</td>
                <td className="px-4 py-3 text-zinc-600">{formatDate(quote.issueDate)}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {quote.validUntil ? formatDate(quote.validUntil) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-900">
                  {formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(quote.status)}>{STATUS_LABELS[quote.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="secondary" className="px-2 py-1 text-xs">
                      <Link href={`/devis/${quote.id}/modifier`}>Éditer</Link>
                    </Button>
                    <form action={duplicateQuoteAction.bind(null, quote.id)}>
                      <Button type="submit" variant="ghost" className="px-2 py-1 text-xs text-zinc-600">
                        Dupliquer
                      </Button>
                    </form>
                    <Button asChild variant="ghost" className="px-2 py-1 text-xs text-blue-600">
                      <Link href={`/api/devis/${quote.id}/pdf`} target="_blank">
                        PDF
                      </Link>
                    </Button>
                    <form action={convertQuoteToInvoiceAction.bind(null, quote.id)}>
                      <Button type="submit" variant="ghost" className="px-2 py-1 text-xs text-blue-600">
                        Convertir
                      </Button>
                    </form>
                    <form action={deleteQuoteAction.bind(null, quote.id)}>
                      <Button type="submit" variant="ghost" className="px-2 py-1 text-xs text-red-600">
                        Supprimer
                      </Button>
                    </form>
                    <form action={changeQuoteStatusAction.bind(null, quote.id, QuoteStatus.ACCEPTE)}>
                      <Button type="submit" variant="ghost" className="px-2 py-1 text-xs text-emerald-600">
                        Marquer accepté
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {quotes.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                  Aucun devis trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {quotes.pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <QuotePaginationLink
            label="Précédent"
            page={quotes.page - 1}
            disabled={quotes.page <= 1}
            search={search}
            statut={statutParam}
            client={clientParam ?? ""}
            issueFrom={issueFrom ?? ""}
            issueTo={issueTo ?? ""}
          />
          <span className="text-sm text-zinc-600">
            Page {quotes.page} / {quotes.pageCount}
          </span>
          <QuotePaginationLink
            label="Suivant"
            page={quotes.page + 1}
            disabled={quotes.page >= quotes.pageCount}
            search={search}
            statut={statutParam}
            client={clientParam ?? ""}
            issueFrom={issueFrom ?? ""}
            issueTo={issueTo ?? ""}
          />
        </div>
      )}
    </div>
  );
}

function QuotePaginationLink({
  label,
  page,
  disabled,
  search,
  statut,
  client,
  issueFrom,
  issueTo,
}: {
  label: string;
  page: number;
  disabled: boolean;
  search: string;
  statut: QuoteStatus | "all";
  client: string;
  issueFrom: string;
  issueTo: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400">
        {label}
      </span>
    );
  }
  const params = new URLSearchParams();
  if (search) params.set("recherche", search);
  if (statut && statut !== "all") params.set("statut", statut);
  if (client) params.set("client", client);
  if (issueFrom) params.set("du", issueFrom);
  if (issueTo) params.set("au", issueTo);
  params.set("page", String(page));

  return (
    <Link
      href={`/devis?${params.toString()}`}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
    >
      {label}
    </Link>
  );
}
