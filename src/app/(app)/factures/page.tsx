import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listInvoices } from "@/server/invoices";
import {
  changeInvoiceStatusAction,
  deleteInvoiceAction,
} from "@/app/(app)/factures/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { InvoiceStatus } from "@prisma/client";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  PARTIELLE: "Partielle",
  RETARD: "En retard",
  ANNULEE: "Annulée",
};

function statusVariant(status: InvoiceStatus) {
  switch (status) {
    case "PAYEE":
      return "success" as const;
    case "PARTIELLE":
      return "info" as const;
    case "RETARD":
      return "danger" as const;
    case "ANNULEE":
      return "neutral" as const;
    default:
      return "info" as const;
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

export default async function FacturesPage({
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
    : (resolvedSearchParams?.statut as InvoiceStatus | "all" | undefined) ?? "all";
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

  const [invoices, clients] = await Promise.all([
    listInvoices({
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
          <h1 className="text-xl font-semibold text-zinc-900">Factures</h1>
          <p className="text-sm text-zinc-600">
            Suivez vos factures, statut de paiement et relances.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" className="text-sm text-blue-600">
            <Link href="/api/export/factures" target="_blank">
              Export CSV
            </Link>
          </Button>
          <Button asChild variant="ghost" className="text-sm text-blue-600">
            <Link href="/api/export/paiements" target="_blank">
              Export paiements
            </Link>
          </Button>
          <Button asChild>
            <Link href="/factures/nouveau">Nouvelle facture</Link>
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
          <select id="statut" name="statut" className="input" defaultValue={statutParam}>
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
              <th className="px-4 py-3 text-left">Échéance</th>
              <th className="px-4 py-3 text-right">Total TTC</th>
              <th className="px-4 py-3 text-right">Payé</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {invoices.items.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{invoice.number}</div>
                  <div className="text-xs text-zinc-500">{invoice.reference ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{invoice.client.displayName}</td>
                <td className="px-4 py-3 text-zinc-600">{formatDate(invoice.issueDate)}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-900">
                  {formatCurrency(fromCents(invoice.totalTTCCents), invoice.currency)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {formatCurrency(fromCents(invoice.amountPaidCents), invoice.currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(invoice.status)}>{STATUS_LABELS[invoice.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="secondary" className="px-2 py-1 text-xs">
                      <Link href={`/factures/${invoice.id}`}>Détails</Link>
                    </Button>
                    <Button asChild variant="secondary" className="px-2 py-1 text-xs">
                      <Link href={`/factures/${invoice.id}/modifier`}>Éditer</Link>
                    </Button>
                    <Button asChild variant="ghost" className="px-2 py-1 text-xs text-blue-600">
                      <Link href={`/api/factures/${invoice.id}/pdf`} target="_blank">
                        PDF
                      </Link>
                    </Button>
                    <form action={changeInvoiceStatusAction.bind(null, invoice.id, InvoiceStatus.PAYEE)}>
                      <Button type="submit" variant="ghost" className="px-2 py-1 text-xs text-emerald-600">
                        Marquer payée
                      </Button>
                    </form>
                    <form action={deleteInvoiceAction.bind(null, invoice.id)}>
                      <Button type="submit" variant="ghost" className="px-2 py-1 text-xs text-red-600">
                        Supprimer
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">
                  Aucune facture trouvée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {invoices.pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <InvoicePaginationLink
            label="Précédent"
            page={invoices.page - 1}
            disabled={invoices.page <= 1}
            search={search}
            statut={statutParam}
            client={clientParam ?? ""}
            issueFrom={issueFrom ?? ""}
            issueTo={issueTo ?? ""}
          />
          <span className="text-sm text-zinc-600">
            Page {invoices.page} / {invoices.pageCount}
          </span>
          <InvoicePaginationLink
            label="Suivant"
            page={invoices.page + 1}
            disabled={invoices.page >= invoices.pageCount}
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

function InvoicePaginationLink({
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
  statut: InvoiceStatus | "all";
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
      href={`/factures?${params.toString()}`}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
    >
      {label}
    </Link>
  );
}
