import { prisma } from "@/lib/prisma";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const TUNIS_TIMEZONE = "Africa/Tunis";

export function getTunisMonthWindow(date: Date) {
  const zonedNow = toZonedTime(date, TUNIS_TIMEZONE);
  const startLocal = startOfMonth(zonedNow);
  const endLocal = endOfMonth(zonedNow);

  const startUtc = fromZonedTime(startLocal, TUNIS_TIMEZONE);
  const endUtc = fromZonedTime(endLocal, TUNIS_TIMEZONE);

  return {
    startUtc,
    endUtc,
    label: formatInTimeZone(startUtc, TUNIS_TIMEZONE, "yyyy-MM"),
  } as const;
}

export async function getDashboardMetrics(currency?: string) {
  const { startUtc: monthStart, endUtc: monthEnd } = getTunisMonthWindow(
    new Date(),
  );

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
  const now = toZonedTime(new Date(), TUNIS_TIMEZONE);
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
    const { startUtc: start, endUtc: end, label } = getTunisMonthWindow(target);

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
      month: label,
      amountCents: aggregate._sum.amountPaidCents ?? 0,
    });
  }

  return results;
}
