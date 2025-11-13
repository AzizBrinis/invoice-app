import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listQuotes, getQuoteFilterClients, DEFAULT_QUOTE_SORT } from "@/server/quotes";
import type { QuoteSort } from "@/server/quotes";
import {
  changeQuoteStatusAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  convertQuoteToInvoiceAction,
  bulkDeleteQuotesAction,
  bulkChangeQuotesStatusAction,
} from "@/app/(app)/devis/actions";
import { Button } from "@/components/ui/button";
import { QuoteStatus } from "@prisma/client";
import { QuotesPageSkeleton } from "@/components/skeletons";
import { ExportButton } from "@/components/export-button";
import { Alert } from "@/components/ui/alert";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { QuoteTableClient } from "@/app/(app)/devis/quotes-table-client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
  EXPIRE: "Expiré",
};

const QUOTE_STATUS_VALUES: readonly QuoteStatus[] = [
  "BROUILLON",
  "ENVOYE",
  "ACCEPTE",
  "REFUSE",
  "EXPIRE",
];

const SORT_OPTIONS: Array<{ value: QuoteSort; label: string }> = [
  { value: "issue-desc", label: "Date d'émission ↓" },
  { value: "issue-asc", label: "Date d'émission ↑" },
  { value: "total-desc", label: "Montant TTC ↓" },
  { value: "total-asc", label: "Montant TTC ↑" },
  { value: "status-asc", label: "Statut A→Z" },
  { value: "client-asc", label: "Client A→Z" },
];

const SORT_VALUES = SORT_OPTIONS.map((option) => option.value);

type SearchParams = Record<string, string | string[] | undefined>;

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUS_VALUES as readonly string[]).includes(value);
}

function parseStatusParam(
  value: string | string[] | undefined,
): QuoteStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isQuoteStatus(candidate) ? candidate : "all";
}

function isQuoteSort(value: string): value is QuoteSort {
  return SORT_VALUES.includes(value as QuoteSort);
}

function parseSortParam(value: string | string[] | undefined): QuoteSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return DEFAULT_QUOTE_SORT;
  }
  return isQuoteSort(candidate) ? candidate : DEFAULT_QUOTE_SORT;
}

function parseDateInput(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }
  return new Date(timestamp);
}

export default function DevisPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<QuotesPageSkeleton />}>
      <DevisPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DevisPageContent({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = isPromise<SearchParams>(searchParams)
    ? await searchParams
    : searchParams;

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
  const sortParam = parseSortParam(resolvedSearchParams?.tri);

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

  const issueFromDate = parseDateInput(issueFrom);
  const issueToDate = parseDateInput(issueTo);

  const [quotes, clients] = await Promise.all([
    listQuotes({
      search: search || undefined,
      status: statutParam,
      clientId: clientParam,
      issueDateFrom: issueFromDate,
      issueDateTo: issueToDate,
      page,
      sort: sortParam,
    }, user.id),
    getQuoteFilterClients(user.id),
  ]);

  const searchQuery = new URLSearchParams();
  if (search) searchQuery.set("recherche", search);
  if (statutParam && statutParam !== "all") {
    searchQuery.set("statut", statutParam);
  }
  if (clientParam) searchQuery.set("client", clientParam);
  if (issueFrom) searchQuery.set("du", issueFrom);
  if (issueTo) searchQuery.set("au", issueTo);
  if (sortParam && sortParam !== DEFAULT_QUOTE_SORT) {
    searchQuery.set("tri", sortParam);
  }
  if (page > 1) searchQuery.set("page", String(page));

  const redirectBase = searchQuery.toString()
    ? `/devis?${searchQuery.toString()}`
    : "/devis";

  const normalizeDate = (value: Date | string | null | undefined) => {
    if (!value) return null;
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
  };

  const tableQuotes = quotes.items.map((quote) => ({
    id: quote.id,
    number: quote.number,
    reference: quote.reference,
    issueDate: normalizeDate(quote.issueDate) ?? new Date().toISOString(),
    validUntil: normalizeDate(quote.validUntil),
    totalTTCCents: quote.totalTTCCents,
    currency: quote.currency,
    status: quote.status,
    clientName: quote.client?.displayName ?? "—",
  }));

  const bulkStatusOptions = Object.entries(STATUS_LABELS).map(
    ([value, label]) => ({
      value: value as QuoteStatus,
      label,
    }),
  );

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Devis</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Suivez vos devis, leurs statuts et convertissez-les en factures.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            variant="ghost"
            className="text-sm text-blue-600 dark:text-blue-400"
            href="/api/export/devis"
            loadingText="Export…"
          >
            Export CSV
          </ExportButton>
          <Button asChild>
            <Link href="/devis/nouveau">Nouveau devis</Link>
          </Button>
        </div>
      </div>

      <form className="card grid gap-4 p-4 sm:grid-cols-6 sm:items-end">
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
        <div className="sm:col-span-2">
          <label className="label" htmlFor="client">
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
        <div>
          <label className="label" htmlFor="statut">
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
          <label className="label" htmlFor="tri">
            Tri
          </label>
          <select id="tri" name="tri" className="input" defaultValue={sortParam}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
        <Button type="submit" variant="secondary" className="sm:col-span-6 sm:w-fit">
          Filtrer
        </Button>
      </form>

      <QuoteTableClient
        quotes={tableQuotes}
        redirectBase={redirectBase}
        statusLabels={STATUS_LABELS}
        duplicateAction={duplicateQuoteAction}
        convertAction={convertQuoteToInvoiceAction}
        deleteAction={deleteQuoteAction}
        changeStatusAction={changeQuoteStatusAction}
        bulkDeleteAction={bulkDeleteQuotesAction}
        bulkStatusAction={bulkChangeQuotesStatusAction}
        statusOptions={bulkStatusOptions}
        search={search}
        statut={statutParam}
        client={clientParam ?? ""}
        issueFrom={issueFrom ?? undefined}
        issueTo={issueTo ?? undefined}
        sort={sortParam}
      />

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
            sort={sortParam}
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
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
            sort={sortParam}
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
  sort,
}: {
  label: string;
  page: number;
  disabled: boolean;
  search: string;
  statut: QuoteStatus | "all";
  client: string;
  issueFrom: string;
  issueTo: string;
  sort: QuoteSort;
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
  if (sort && sort !== DEFAULT_QUOTE_SORT) params.set("tri", sort);
  params.set("page", String(page));

  return (
    <Link
      href={`/devis?${params.toString()}`}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {label}
    </Link>
  );
}
