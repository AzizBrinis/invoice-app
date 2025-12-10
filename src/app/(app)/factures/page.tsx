import { Suspense } from "react";
import Link from "next/link";
import { listInvoices } from "@/server/invoices";
import { listClientFilterOptions } from "@/server/clients";
import {
  changeInvoiceStatusAction,
  deleteInvoiceAction,
} from "@/app/(app)/factures/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { InvoiceStatus } from "@prisma/client";
import { InvoicesPageSkeleton } from "@/components/skeletons";
import { ExportButton } from "@/components/export-button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  PAYEE: "Payée",
  PARTIELLE: "Partielle",
  RETARD: "En retard",
  ANNULEE: "Annulée",
};

const INVOICE_STATUS_VALUES: readonly InvoiceStatus[] = [
  "BROUILLON",
  "ENVOYEE",
  "PAYEE",
  "PARTIELLE",
  "RETARD",
  "ANNULEE",
];

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
type FacturesPageProps = { searchParams?: Promise<SearchParams> };

function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUS_VALUES as readonly string[]).includes(value);
}

function parseStatusParam(
  value: string | string[] | undefined,
): InvoiceStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isInvoiceStatus(candidate) ? candidate : "all";
}

export default function FacturesPage({
  searchParams,
}: FacturesPageProps) {
  return (
    <Suspense fallback={<InvoicesPageSkeleton />}>
      <FacturesPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function FacturesPageContent({
  searchParams,
}: FacturesPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const search = Array.isArray(resolvedSearchParams?.recherche)
    ? resolvedSearchParams.recherche[0]
    : resolvedSearchParams?.recherche ?? "";
  const statutParam = parseStatusParam(resolvedSearchParams?.statut);
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
    flashMessages.push({
      variant: "success",
      title: successMessage,
    });
  }
  if (warningMessage) {
    flashMessages.push({
      variant: "warning",
      title: warningMessage,
    });
  }
  if (errorMessage) {
    flashMessages.push({
      variant: "error",
      title: errorMessage,
    });
  }

  const [loadResult, clientOptions] = await Promise.all([
    loadInvoices({
      search,
      statutParam,
      clientParam,
      issueFrom,
      issueTo,
      page,
    }),
    loadClientOptions(),
  ]);
  const invoices = loadResult.invoices;
  const loadError = loadResult.error;

  const searchQuery = new URLSearchParams();
  if (search) searchQuery.set("recherche", search);
  if (statutParam && statutParam !== "all") {
    searchQuery.set("statut", statutParam);
  }
  if (clientParam) searchQuery.set("client", clientParam);
  if (issueFrom) searchQuery.set("du", issueFrom);
  if (issueTo) searchQuery.set("au", issueTo);
  if (page > 1) searchQuery.set("page", String(page));
  const redirectBase = searchQuery.toString()
    ? `/factures?${searchQuery.toString()}`
    : "/factures";

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      {successMessage ? (
        <Alert variant="success" title={successMessage} />
      ) : null}
      {warningMessage ? (
        <Alert variant="warning" title={warningMessage} />
      ) : null}
      {errorMessage ? (
        <Alert variant="error" title={errorMessage} />
      ) : null}
      {loadError ? (
        <Alert
          variant="error"
          title={loadError}
          description="Actualisez la page ou contactez le support si le problème persiste."
        />
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Factures
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Suivez vos factures, statut de paiement et relances.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            variant="ghost"
            className="text-sm text-blue-600 dark:text-blue-400"
            href="/api/export/factures"
            loadingText="Export…"
          >
            Export CSV
          </ExportButton>
          <ExportButton
            variant="ghost"
            className="text-sm text-blue-600 dark:text-blue-400"
            href="/api/export/paiements"
            loadingText="Export…"
          >
            Export paiements
          </ExportButton>
          <Button asChild>
            <Link href="/factures/nouveau">Nouvelle facture</Link>
          </Button>
        </div>
      </div>

      <form className="card grid gap-4 p-4 sm:grid-cols-5 sm:items-end">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="recherche">
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
          <label className="label" htmlFor="statut">
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
          <label className="label" htmlFor="client">
            Client
          </label>
          <ClientFilterSelect
            defaultValue={clientParam ?? ""}
            clients={clientOptions}
          />
        </div>
        <div className="space-y-2">
          <label className="label" htmlFor="du">
            Du
          </label>
          <input className="input" type="date" id="du" name="du" defaultValue={issueFrom ?? ""} />
        </div>
        <div className="space-y-2">
          <label className="label" htmlFor="au">
            Au
          </label>
          <input className="input" type="date" id="au" name="au" defaultValue={issueTo ?? ""} />
        </div>
        <Button type="submit" variant="secondary" className="w-full sm:col-span-5 sm:w-fit">
          Filtrer
        </Button>
      </form>

      <div className="card hidden overflow-hidden lg:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
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
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invoices.items.map((invoice) => (
              <tr
                key={invoice.id}
                className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {invoice.number}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {invoice.reference ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {invoice.client.displayName}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                  {formatCurrency(fromCents(invoice.amountPaidCents, invoice.currency), invoice.currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(invoice.status)}>{STATUS_LABELS[invoice.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      asChild
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                    >
                      <Link href={`/factures/${invoice.id}`}>Détails</Link>
                    </Button>
                    <Button
                      asChild
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                    >
                      <Link href={`/factures/${invoice.id}/modifier`}>Éditer</Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400"
                    >
                      <Link href={`/api/factures/${invoice.id}/pdf`} target="_blank">
                        PDF
                      </Link>
                    </Button>
                    <form action={changeInvoiceStatusAction.bind(null, invoice.id, InvoiceStatus.PAYEE)}>
                    <FormSubmitButton
                      variant="ghost"
                      className="px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      Marquer payée
                    </FormSubmitButton>
                    <input type="hidden" name="redirectTo" value={redirectBase} />
                  </form>
                  <form action={deleteInvoiceAction.bind(null, invoice.id)}>
                    <FormSubmitButton
                      variant="ghost"
                      className="px-2 py-1 text-xs text-red-600 dark:text-red-400"
                    >
                      Supprimer
                    </FormSubmitButton>
                    <input type="hidden" name="redirectTo" value={redirectBase} />
                  </form>
                </div>
              </td>
            </tr>
          ))}
            {invoices.items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  Aucune facture trouvée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 lg:hidden">
        {invoices.items.map((invoice) => (
          <article key={invoice.id} className="card space-y-4 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {invoice.number}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {invoice.reference ?? "—"}
                </p>
              </div>
              <Badge variant={statusVariant(invoice.status)}>{STATUS_LABELS[invoice.status]}</Badge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Client</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{invoice.client.displayName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total TTC</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Émission</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">{formatDate(invoice.issueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Échéance</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Payé</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">
                  {formatCurrency(fromCents(invoice.amountPaidCents, invoice.currency), invoice.currency)}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2 pt-2 min-[520px]:flex-row">
              <Button
                asChild
                variant="secondary"
                className="w-full min-[520px]:w-auto justify-center text-sm"
              >
                <Link href={`/factures/${invoice.id}`}>Détails</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="w-full min-[520px]:w-auto justify-center text-sm"
              >
                <Link href={`/factures/${invoice.id}/modifier`}>Éditer</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full min-[520px]:w-auto justify-center text-sm text-blue-600 dark:text-blue-400"
              >
                <Link href={`/api/factures/${invoice.id}/pdf`} target="_blank">
                  PDF
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2 min-[520px]:flex-row">
              <div className="w-full min-[520px]:w-auto">
                <form
                  action={changeInvoiceStatusAction.bind(null, invoice.id, InvoiceStatus.PAYEE)}
                  className="w-full"
                >
                  <FormSubmitButton
                    variant="ghost"
                    className="w-full justify-center text-sm text-emerald-600 dark:text-emerald-400"
                  >
                    Marquer payée
                  </FormSubmitButton>
                  <input type="hidden" name="redirectTo" value={redirectBase} />
                </form>
              </div>
              <div className="w-full min-[520px]:w-auto">
                <form action={deleteInvoiceAction.bind(null, invoice.id)} className="w-full">
                  <FormSubmitButton
                    variant="ghost"
                    className="w-full justify-center text-sm text-red-600 dark:text-red-400"
                  >
                    Supprimer
                  </FormSubmitButton>
                  <input type="hidden" name="redirectTo" value={redirectBase} />
                </form>
              </div>
            </div>
          </article>
        ))}
        {invoices.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Aucune facture trouvée.
          </div>
        )}
      </div>

      {(invoices.hasMore || invoices.page > 1) && (
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
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            Page {invoices.page}
            {typeof invoices.pageCount === "number"
              ? ` / ${invoices.pageCount}`
              : invoices.hasMore
                ? " +"
                : ""}
          </span>
          <InvoicePaginationLink
            label="Suivant"
            page={invoices.page + 1}
            disabled={!invoices.hasMore}
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

async function loadInvoices({
  search,
  statutParam,
  clientParam,
  issueFrom,
  issueTo,
  page,
}: {
  search: string;
  statutParam: InvoiceStatus | "all";
  clientParam: string | undefined;
  issueFrom: string | undefined;
  issueTo: string | undefined;
  page: number;
}) {
  try {
    const [invoices] = await Promise.all([
      listInvoices(
        {
          search: search || undefined,
          status: statutParam,
          clientId: clientParam,
          issueDateFrom: issueFrom ? new Date(issueFrom) : undefined,
          issueDateTo: issueTo ? new Date(issueTo) : undefined,
          page,
        },
        { includeTotals: false },
      ),
    ]);
    return {
      invoices,
      error: null as string | null,
    };
  } catch (error) {
    console.error("[FacturesPage] Unable to load invoices", error);
    return {
      invoices: {
        items: [],
        total: null,
        page,
        pageSize: 0,
        pageCount: null,
        hasMore: false,
      },
      error:
        "Impossible de charger vos factures pour le moment. Merci de réessayer.",
    };
  }
}

async function loadClientOptions() {
  try {
    const clients = await listClientFilterOptions();
    return clients;
  } catch (error) {
    console.error("[FacturesPage] Unable to load client filters", error);
    return null;
  }
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
      <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
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
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {label}
    </Link>
  );
}

function ClientFilterSelect({
  defaultValue,
  clients,
}: {
  defaultValue?: string;
  clients: Awaited<ReturnType<typeof listClientFilterOptions>> | null;
}) {
  if (!clients) {
    return (
      <ClientFilterFallback
        defaultValue={defaultValue}
        label="Clients indisponibles"
      />
    );
  }
  return (
    <select
      id="client"
      name="client"
      className="input"
      defaultValue={defaultValue ?? ""}
    >
      <option value="">Tous</option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.displayName}
        </option>
      ))}
    </select>
  );
}

function ClientFilterFallback({
  defaultValue,
  label = "Chargement…",
}: {
  defaultValue?: string;
  label?: string;
}) {
  return (
    <select
      id="client"
      name="client"
      className="input"
      defaultValue={defaultValue ?? ""}
      disabled
    >
      <option value="">{label}</option>
    </select>
  );
}
