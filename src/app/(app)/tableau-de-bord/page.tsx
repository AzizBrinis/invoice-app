import { prisma } from "@/lib/prisma";
import { getDashboardMetrics } from "@/server/analytics";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

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

export default async function DashboardPage() {
  const settings = await getSettings();
  const dashboardCurrency = settings.defaultCurrency as CurrencyCode;

  const [metrics, recentInvoices, recentQuotes] = await Promise.all([
    getDashboardMetrics(dashboardCurrency),
    prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      take: 5,
      include: {
        client: true,
      },
    }),
    prisma.quote.findMany({
      orderBy: { issueDate: "desc" },
      take: 5,
      include: {
        client: true,
      },
    }),
  ]);

  const maxValue = Math.max(
    ...metrics.revenueHistory.map((value) => value.amountCents),
    1,
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-zinc-900">
          Indicateurs clés
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card p-5">
            <p className="text-sm text-zinc-500">Chiffre d&apos;affaires ce mois</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {formatCurrency(fromCents(metrics.revenueThisMonthCents), dashboardCurrency)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Invoices encaissées sur la période
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500">Montant impayé</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {formatCurrency(fromCents(metrics.outstandingAmountCents), dashboardCurrency)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Solde restant à percevoir
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500">Factures en retard</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {metrics.overdueInvoices}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Échéances dépassées
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-zinc-500">Devis à traiter</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {metrics.pendingQuotes}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Brouillons ou envoyés en attente
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="text-base font-semibold text-zinc-900">
          Évolution des encaissements (6 derniers mois)
        </h3>
        <div className="mt-6 flex h-48 items-end gap-4">
          {metrics.revenueHistory.map((item) => {
            const height = Math.max((item.amountCents / maxValue) * 100, 4);
            const [year, month] = item.month.split("-");
            return (
              <div key={item.month} className="flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t-lg bg-blue-500 transition-all"
                  style={{ height: `${height}%` }}
                  title={formatCurrency(fromCents(item.amountCents), dashboardCurrency)}
                />
                <span className="mt-2 text-xs font-medium text-zinc-500">
                  {month}/{year.slice(-2)}
                </span>
                <span className="text-xs text-zinc-400">
                  {formatCurrency(fromCents(item.amountCents), dashboardCurrency)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">
              Factures récentes
            </h3>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Numéro</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2 font-medium text-zinc-800">
                      {invoice.number}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {invoice.client?.displayName}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-800">
                      {formatCurrency(fromCents(invoice.totalTTCCents), invoice.currency)}
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
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Numéro</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2 font-medium text-zinc-800">
                      {quote.number}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {quote.client?.displayName}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {formatDate(quote.issueDate)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-800">
                      {formatCurrency(fromCents(quote.totalTTCCents), quote.currency)}
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
