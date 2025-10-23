import { prisma } from "@/lib/prisma";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

export async function getDashboardMetrics(currency?: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const currencyFilter = currency
    ? {
        currency,
      }
    : {};

  const [
    revenueThisMonth,
    overdueCount,
    outstandingAmount,
    pendingQuotes,
  ] = await prisma.$transaction([
    prisma.invoice.aggregate({
      where: {
        issueDate: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...currencyFilter,
        status: {
          in: ["PAYEE", "PARTIELLE", "ENVOYEE", "RETARD"],
        },
      },
      _sum: {
        amountPaidCents: true,
      },
    }),
    prisma.invoice.count({
      where: {
        ...currencyFilter,
        status: "RETARD",
      },
    }),
    prisma.invoice.aggregate({
      where: {
        ...currencyFilter,
        status: {
          in: ["ENVOYEE", "PARTIELLE", "RETARD"],
        },
      },
      _sum: {
        totalTTCCents: true,
        amountPaidCents: true,
      },
    }),
    prisma.quote.count({
      where: {
        ...currencyFilter,
        status: {
          in: ["ENVOYE", "BROUILLON"],
        },
      },
    }),
  ]);

  const unpaidSum =
    (outstandingAmount._sum.totalTTCCents ?? 0) -
    (outstandingAmount._sum.amountPaidCents ?? 0);

  const chart = await buildRevenueHistory(currency);

  return {
    revenueThisMonthCents: revenueThisMonth._sum.amountPaidCents ?? 0,
    overdueInvoices: overdueCount,
    outstandingAmountCents: unpaidSum,
    pendingQuotes,
    revenueHistory: chart,
  };
}

async function buildRevenueHistory(currency?: string) {
  const now = new Date();
  const results: {
    month: string;
    amountCents: number;
  }[] = [];
  const currencyFilter = currency
    ? {
        currency,
      }
    : {};

  for (let i = 5; i >= 0; i -= 1) {
    const target = subMonths(now, i);
    const start = startOfMonth(target);
    const end = endOfMonth(target);

    const aggregate = await prisma.invoice.aggregate({
      where: {
        issueDate: {
          gte: start,
          lte: end,
        },
        ...currencyFilter,
        status: {
          in: ["PAYEE", "PARTIELLE", "ENVOYEE", "RETARD"],
        },
      },
      _sum: {
        amountPaidCents: true,
      },
    });

    results.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      amountCents: aggregate._sum.amountPaidCents ?? 0,
    });
  }

  return results;
}
