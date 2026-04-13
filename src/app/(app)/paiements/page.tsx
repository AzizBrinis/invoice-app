import type { Route } from "next";
import { AccountPermission } from "@/lib/db/prisma";
import {
  hasAccountPermission,
  requireAppSectionAccess,
} from "@/lib/authorization";
import {
  buildClientPaymentHref,
  parseClientPaymentFilters,
  parseClientPaymentPageParam,
  readClientPaymentSearchParam,
} from "@/lib/client-payment-filters";
import { getClient, searchClientPickerOptions } from "@/server/clients";
import {
  getClientPaymentPeriodSummary,
  listClientPaymentsPage,
} from "@/server/client-payments";
import { getSettingsSummary } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/components/export-button";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { AsyncClientPicker } from "@/app/(app)/paiements/_components/async-payment-pickers";
import { PaymentsWorkspaceShell } from "@/app/(app)/paiements/_components/payments-workspace-shell";
import type { ClientPickerOption } from "@/lib/client-payment-picker-types";

type SearchParams = Record<string, string | string[] | undefined>;
type PaymentsPageProps = { searchParams?: Promise<SearchParams> };
const PAYMENTS_PAGE_SIZE = 20;

export default async function PaymentsPage({
  searchParams,
}: PaymentsPageProps) {
  const user = await requireAppSectionAccess("payments", {
    redirectOnFailure: true,
  });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const filters = parseClientPaymentFilters(resolvedSearchParams);
  const currentPage = parseClientPaymentPageParam(resolvedSearchParams);
  const successMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "message") ?? null;
  const warningMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "warning") ?? null;
  const errorMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "error") ?? null;

  const flashMessages: FlashMessage[] = [];
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (warningMessage) {
    flashMessages.push({ variant: "warning", title: warningMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  const [selectedClient, settings, initialClientSearch] = await Promise.all([
    filters.clientId ? getClient(filters.clientId, tenantId) : Promise.resolve(null),
    getSettingsSummary(tenantId),
    searchClientPickerOptions(tenantId, null, 1),
  ]);
  const effectiveClientId = selectedClient ? filters.clientId : null;
  const selectedClientPickerOption: ClientPickerOption | null = selectedClient
    ? {
        id: selectedClient.id,
        displayName: selectedClient.displayName,
        companyName: selectedClient.companyName ?? null,
        email: selectedClient.email ?? null,
        isActive: selectedClient.isActive,
      }
    : null;
  const hasAnyClients = initialClientSearch.length > 0;

  const canManagePayments = hasAccountPermission(
    user,
    AccountPermission.PAYMENTS_MANAGE,
  );
  const canManageReceipts = hasAccountPermission(
    user,
    AccountPermission.RECEIPTS_MANAGE,
  );
  const [summary, paymentsPage] = await Promise.all([
    getClientPaymentPeriodSummary(
      {
        clientId: effectiveClientId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        search: filters.search,
        includeByClient: false,
      },
      tenantId,
    ),
    listClientPaymentsPage(
      {
        clientId: effectiveClientId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        search: filters.search,
        page: currentPage,
        pageSize: PAYMENTS_PAGE_SIZE,
      },
      tenantId,
    ),
  ]);
  const resetHref = buildClientPaymentHref({}) as Route;
  const pdfExportHref = buildClientPaymentHref(
    {
      search: filters.search,
      clientId: effectiveClientId,
      dateFromValue: filters.dateFromValue,
      dateToValue: filters.dateToValue,
    },
    "/api/clients/payments/export/pdf",
  );
  const excelExportHref = buildClientPaymentHref(
    {
      search: filters.search,
      clientId: effectiveClientId,
      dateFromValue: filters.dateFromValue,
      dateToValue: filters.dateToValue,
    },
    "/api/clients/payments/export/excel",
  );
  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Paiements
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Espace principal pour enregistrer, consulter et exporter les paiements
            clients.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <ExportButton href={pdfExportHref} variant="secondary">
            Export PDF
          </ExportButton>
          <ExportButton href={excelExportHref} variant="secondary">
            Export Excel
          </ExportButton>
          <Button asChild variant="ghost">
            <PrefetchLink href="/clients" prefetch={false}>
              Voir les clients
            </PrefetchLink>
          </Button>
        </div>
      </div>

      <form className="card grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_160px_160px_auto] xl:items-end">
        <div>
          <label className="label" htmlFor="payments-search">
            Recherche
          </label>
          <Input
            id="payments-search"
            name="recherche"
            type="search"
            defaultValue={filters.search}
            placeholder="Client, reçu, référence, service…"
          />
        </div>
        <div>
          <label className="label" htmlFor="client">
            Client
          </label>
          <AsyncClientPicker
            key={`payments-filter-client-${selectedClientPickerOption?.id ?? "all"}`}
            id="client"
            name="client"
            initialSelection={selectedClientPickerOption}
            placeholder="Tous les clients"
            emptyLabel="Tous"
          />
        </div>
        <div>
          <label className="label" htmlFor="du">
            Du
          </label>
          <input
            id="du"
            name="du"
            type="date"
            className="input"
            defaultValue={filters.dateFromValue ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="au">
            Au
          </label>
          <input
            id="au"
            name="au"
            type="date"
            className="input"
            defaultValue={filters.dateToValue ?? ""}
          />
        </div>
        <div className="flex gap-2 xl:justify-end">
          <Button type="submit" variant="secondary">
            Filtrer
          </Button>
          {filters.search || filters.clientId || filters.dateFromValue || filters.dateToValue ? (
            <Button asChild variant="ghost">
              <PrefetchLink href={resetHref} prefetch={false}>
                Réinitialiser
              </PrefetchLink>
            </Button>
          ) : null}
        </div>
      </form>

      <PaymentsWorkspaceShell
        canManagePayments={canManagePayments}
        canManageReceipts={canManageReceipts}
        currency={settings.defaultCurrency}
        currentPage={currentPage}
        filters={{
          ...filters,
          clientId: effectiveClientId,
        }}
        hasAnyClients={hasAnyClients}
        paymentMethodOptions={settings.clientPaymentMethods}
        selectedClient={selectedClient}
        selectedClientPickerOption={selectedClientPickerOption}
        summary={summary}
        paymentsPage={paymentsPage}
      />
    </div>
  );
}
