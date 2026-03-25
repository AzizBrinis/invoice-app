import type { QuoteRequestStatus } from "@prisma/client";
import { listQuoteRequests } from "@/server/quote-requests";
import { QuoteRequestsTableClient } from "@/app/(app)/site-web/demandes-de-devis/quote-requests-table-client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  CONVERTED: "Converti",
  CLOSED: "Clos",
};

const STATUS_VALUES: readonly QuoteRequestStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "CONVERTED",
  "CLOSED",
];

type SearchParams = Record<string, string | string[] | undefined>;
type DemandesDeDevisPageProps = { searchParams?: Promise<SearchParams> };

function isStatus(value: string): value is QuoteRequestStatus {
  return (STATUS_VALUES as readonly string[]).includes(value);
}

function parseStatusParam(
  value: string | string[] | undefined,
): QuoteRequestStatus | "all" {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate === "all") {
    return "all";
  }
  return isStatus(candidate) ? candidate : "all";
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

export default async function DemandesDeDevisPage({
  searchParams,
}: DemandesDeDevisPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const search = Array.isArray(resolvedSearchParams?.recherche)
    ? resolvedSearchParams.recherche[0]
    : resolvedSearchParams?.recherche ?? "";
  const statutParam = parseStatusParam(resolvedSearchParams?.statut);
  const createdFrom = Array.isArray(resolvedSearchParams?.du)
    ? resolvedSearchParams.du[0]
    : (resolvedSearchParams?.du as string | undefined);
  const createdTo = Array.isArray(resolvedSearchParams?.au)
    ? resolvedSearchParams.au[0]
    : (resolvedSearchParams?.au as string | undefined);
  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : (resolvedSearchParams?.page as string | undefined);

  const page = Number(pageParam ?? "1") || 1;

  const requests = await listQuoteRequests({
    search: search || undefined,
    status: statutParam,
    createdFrom: parseDateInput(createdFrom),
    createdTo: parseDateInput(createdTo),
    page,
  });

  const tableRequests = requests.items.map((request) => ({
    id: request.id,
    status: request.status,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerCompany: request.customerCompany ?? null,
    productName: request.product?.name ?? "-",
    quoteId: request.quoteId ?? null,
    createdAt: request.createdAt.toISOString(),
  }));

  const statusOptions = STATUS_VALUES.map((value) => ({
    value,
    label: STATUS_LABELS[value],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Demandes de devis
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Centralisez les demandes publiques et convertissez-les en devis.
          </p>
        </div>
      </div>

      <QuoteRequestsTableClient
        requests={tableRequests}
        page={requests.page}
        pageCount={requests.pageCount}
        search={search}
        status={statutParam}
        createdFrom={createdFrom ?? ""}
        createdTo={createdTo ?? ""}
        statusOptions={statusOptions}
        statusLabels={STATUS_LABELS}
      />
    </div>
  );
}
