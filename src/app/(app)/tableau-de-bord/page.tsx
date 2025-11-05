import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDashboardMetrics } from "@/server/analytics";
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

  const [metrics, recentInvoices, recentQuotes] = await Promise.all([
    getDashboardMetrics(dashboardCurrency),
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { issueDate: "desc" },
      take: 5,
      include: {
        client: true,
      },
    }),
    prisma.quote.findMany({
      where: { userId: user.id },
      orderBy: { issueDate: "desc" },
      take: 5,
      include: {
        client: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Indicateurs clés
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Factures récentes
            </h3>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Numéro</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {invoice.number}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                      {invoice.client?.displayName}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-800 dark:text-zinc-100">
                      {formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">
              Devis récents
            </h3>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Numéro</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      {quote.number}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                      {quote.client?.displayName}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                      {formatDate(quote.issueDate)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-800 dark:text-zinc-100">
                      {formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="info">{quote.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
