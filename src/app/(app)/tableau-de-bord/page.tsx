import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { endOfMonth, startOfMonth } from "date-fns";
import { AccountPermission } from "@/lib/db/prisma";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import {
  hasAccountPermission,
  isClientPaymentsAccount,
  requireAppSectionAccess,
} from "@/lib/authorization";
import { getDashboardPayload } from "@/server/analytics";
import {
  getClientPaymentDashboardSummary,
  getClientPaymentPeriodSummary,
} from "@/server/client-payments";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";
import {
  DashboardChartSkeleton,
  DashboardSkeleton,
} from "@/components/skeletons";

const RevenueHistoryChart = nextDynamic(
  () =>
    import("@/components/dashboard/revenue-history-chart").then((mod) => ({
      default: mod.RevenueHistoryChart,
    })),
  {
    loading: () => <DashboardChartSkeleton />,
  },
);

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type DashboardPageProps = { searchParams?: Promise<SearchParams> };

function statusVariant(status: string) {
  switch (status) {
    case "PAYEE":
      return "success" as const;
    case "RETARD":
    case "ANNULEE":
      return "danger" as const;
    case "PARTIELLE":
      return "warning" as const;
    default:
      return "info" as const;
  }
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

function formatDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardPageContent({
  searchParams,
}: DashboardPageProps) {
  const user = await requireAppSectionAccess("dashboard", {
    redirectOnFailure: true,
  });
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const settings = await getSettings(tenantId);
  const dashboardCurrency = settings.defaultCurrency as CurrencyCode;

  if (isClientPaymentsAccount(user)) {
    return renderClientPaymentsDashboard({
      user,
      tenantId,
      dashboardCurrency,
      searchParams: resolvedSearchParams,
    });
  }

  const { metrics, recentInvoices, recentQuotes } = await getDashboardPayload(
    dashboardCurrency,
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Indicateurs clés
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Chiffre d&apos;affaires ce mois
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(
                fromCents(metrics.revenueThisMonthCents, dashboardCurrency),
                dashboardCurrency,
              )}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Invoices encaissées sur la période
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Montant impayé
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(
                fromCents(metrics.outstandingAmountCents, dashboardCurrency),
                dashboardCurrency,
              )}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Solde restant à percevoir
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Factures en retard
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {metrics.overdueInvoices}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Échéances dépassées
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Devis à traiter
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {metrics.pendingQuotes}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Brouillons ou envoyés en attente
            </p>
          </div>
        </div>
      </section>

      <RevenueHistoryChart
        history={metrics.revenueHistory}
        currency={dashboardCurrency}
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card flex flex-col p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Factures récentes
            </h3>
          </div>
          <div className="mt-4 hidden md:block">
            <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Numéro
                    </th>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Client
                    </th>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Date
                    </th>
                    <th className="px-3 py-2 text-right text-zinc-500 dark:text-zinc-400">
                      Montant
                    </th>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                        {invoice.number}
                      </td>
                      <td className="px-3 py-2 break-words text-zinc-600 dark:text-zinc-300">
                        {invoice.client?.displayName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {formatDate(invoice.issueDate)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-800 dark:text-zinc-100">
                        {formatCurrency(
                          fromCents(invoice.totalTTCCents, invoice.currency),
                          invoice.currency,
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className="whitespace-nowrap"
                          variant={statusVariant(invoice.status)}
                        >
                          {invoice.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm transition-colors dark:border-zinc-800/80 dark:bg-zinc-950/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {invoice.number}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {invoice.client?.displayName ?? "—"}
                    </p>
                  </div>
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(
                      fromCents(invoice.totalTTCCents, invoice.currency),
                      invoice.currency,
                    )}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{formatDate(invoice.issueDate)}</span>
                  <Badge
                    className="whitespace-nowrap"
                    variant={statusVariant(invoice.status)}
                  >
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card flex flex-col p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-900">
              Devis récents
            </h3>
          </div>
          <div className="mt-4 hidden md:block">
            <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Numéro
                    </th>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Client
                    </th>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Date
                    </th>
                    <th className="px-3 py-2 text-right text-zinc-500 dark:text-zinc-400">
                      Montant
                    </th>
                    <th className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentQuotes.map((quote) => (
                    <tr
                      key={quote.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                        {quote.number}
                      </td>
                      <td className="px-3 py-2 break-words text-zinc-600 dark:text-zinc-300">
                        {quote.client?.displayName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {formatDate(quote.issueDate)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-800 dark:text-zinc-100">
                        {formatCurrency(
                          fromCents(quote.totalTTCCents, quote.currency),
                          quote.currency,
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className="whitespace-nowrap" variant="info">
                          {quote.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {recentQuotes.map((quote) => (
              <div
                key={quote.id}
                className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm transition-colors dark:border-zinc-800/80 dark:bg-zinc-950/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {quote.number}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {quote.client?.displayName ?? "—"}
                    </p>
                  </div>
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(
                      fromCents(quote.totalTTCCents, quote.currency),
                      quote.currency,
                    )}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{formatDate(quote.issueDate)}</span>
                  <Badge className="whitespace-nowrap" variant="info">
                    {quote.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

async function renderClientPaymentsDashboard(options: {
  user: Awaited<ReturnType<typeof requireAppSectionAccess>>;
  tenantId: string;
  dashboardCurrency: CurrencyCode;
  searchParams: SearchParams;
}) {
  const { user, tenantId, dashboardCurrency, searchParams } = options;
  const today = new Date();
  const dateFrom = parseDateParam(
    Array.isArray(searchParams.du) ? searchParams.du[0] : searchParams.du,
    startOfMonth(today),
  );
  const dateTo = parseDateParam(
    Array.isArray(searchParams.au) ? searchParams.au[0] : searchParams.au,
    endOfMonth(today),
  );
  const canViewReports = hasAccountPermission(
    user,
    AccountPermission.REPORTS_VIEW,
  );

  const [summary, report] = await Promise.all([
    getClientPaymentDashboardSummary(
      { months: 6, currency: dashboardCurrency },
      tenantId,
    ),
    canViewReports
      ? getClientPaymentPeriodSummary(
          {
            dateFrom,
            dateTo,
          },
          tenantId,
        )
      : Promise.resolve(null),
  ]);
  const reportCurrencyTotals = report?.totals.totalsByCurrency ?? [];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Tableau de bord paiements
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Suivi simple des encaissements clients, reçus émis et activité récente.
          </p>
        </div>
        <form className="card grid gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="du" className="label">
              Du
            </label>
            <input
              id="du"
              name="du"
              type="date"
              className="input"
              defaultValue={formatDateInputValue(dateFrom)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="au" className="label">
              Au
            </label>
            <input
              id="au"
              name="au"
              type="date"
              className="input"
              defaultValue={formatDateInputValue(dateTo)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Mettre à jour
            </Button>
          </div>
        </form>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Encaissements sur la période
            </p>
            <div className="mt-2 space-y-1">
              {report ? (
                reportCurrencyTotals.length ? (
                  reportCurrencyTotals.map((totals) => (
                    <p
                      key={totals.currency}
                      className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
                    >
                      {formatCurrency(
                        fromCents(totals.totalAmountCents, totals.currency),
                        totals.currency,
                      )}
                    </p>
                  ))
                ) : (
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(fromCents(0, dashboardCurrency), dashboardCurrency)}
                  </p>
                )
              ) : (
                <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(
                    fromCents(summary.metrics.collectedThisMonthCents, dashboardCurrency),
                    dashboardCurrency,
                  )}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {report
                ? reportCurrencyTotals.length > 1
                  ? "Totaux séparés par devise sur la période."
                  : `Devise affichée : ${reportCurrencyTotals[0]?.currency ?? dashboardCurrency}`
                : `Devise affichée : ${dashboardCurrency}`}
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Paiements enregistrés
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {report?.totals.paymentCount ?? summary.metrics.paymentCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Activité filtrée sur la période
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Reçus émis
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {report?.totals.receiptCount ?? summary.metrics.receiptsIssuedCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Reçus générés pour les paiements
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Clients actifs
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {report?.totals.clientCount ?? summary.metrics.clientCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Clients avec paiements sur la période
            </p>
          </div>
        </div>
      </section>

      <RevenueHistoryChart
        history={summary.metrics.revenueHistory}
        currency={dashboardCurrency}
      />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Rapport clients
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(dateFrom)} au {formatDate(dateTo)}
            </p>
          </div>

          {!canViewReports ? (
            <Alert
              variant="warning"
              title="Rapports non autorisés"
              description="Cette collaboration peut consulter le tableau de bord, mais pas le détail des rapports clients."
            />
          ) : report && report.byClient.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2 text-right">Paiements</th>
                    <th className="px-3 py-2 text-right">Reçus</th>
                    <th className="px-3 py-2 text-right">Dernier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {report.byClient.map((client) => (
                    <tr key={client.clientId}>
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                        {client.clientName}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-200">
                        <div className="space-y-1">
                          {client.totalsByCurrency.map((totals) => (
                            <p key={`${client.clientId}-${totals.currency}`}>
                              {formatCurrency(
                                fromCents(totals.totalAmountCents, totals.currency),
                                totals.currency,
                              )}
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">
                        {client.paymentCount}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">
                        {client.receiptCount}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">
                        {formatDate(client.lastPaymentDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Alert
              variant="warning"
              title="Aucun paiement sur la période"
              description="Aucun client n’a de paiement enregistré pour les dates sélectionnées."
            />
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Paiements récents
          </h2>
          <div className="mt-4 space-y-3">
            {summary.recentPayments.length ? (
              summary.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm transition-colors dark:border-zinc-800/80 dark:bg-zinc-950/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {payment.client.displayName}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {payment.description ?? payment.method ?? "Paiement client"}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(
                        fromCents(payment.amountCents, payment.currency),
                        payment.currency,
                      )}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{formatDate(payment.date)}</span>
                    {payment.receiptNumber ? (
                      <Badge variant="success">{payment.receiptNumber}</Badge>
                    ) : (
                      <Badge variant="info">Reçu à générer</Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Aucun paiement récent pour le moment.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
