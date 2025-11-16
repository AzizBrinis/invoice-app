import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDashboardPayload } from "@/server/analytics";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";
import { DashboardSkeleton } from "@/components/skeletons";
import { RevenueHistoryChart } from "@/components/dashboard/revenue-history-chart";

export const dynamic = "force-dynamic";

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

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const dashboardCurrency = settings.defaultCurrency as CurrencyCode;

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
              {formatCurrency(fromCents(metrics.revenueThisMonthCents, dashboardCurrency), dashboardCurrency)}
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
              {formatCurrency(fromCents(metrics.outstandingAmountCents, dashboardCurrency), dashboardCurrency)}
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
                        {formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className="whitespace-nowrap" variant={statusVariant(invoice.status)}>
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
                    {formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}
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
                        {formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}
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
                    {formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}
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
