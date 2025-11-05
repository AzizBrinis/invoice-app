import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const TUNIS_TIMEZONE = "Africa/Tunis";

function getCurrentZonedDate() {
  return toZonedTime(new Date(), TUNIS_TIMEZONE);
}

function getMonthBoundaries(zonedDate: Date) {
  const startZoned = startOfMonth(zonedDate);
  const endZoned = endOfMonth(zonedDate);

  return {
    startUtc: fromZonedTime(startZoned, TUNIS_TIMEZONE),
    endUtc: fromZonedTime(endZoned, TUNIS_TIMEZONE),
    label: formatInTimeZone(startZoned, TUNIS_TIMEZONE, "yyyy-MM"),
  };
}

export async function getDashboardMetrics(currency?: string) {
  const { id: userId } = await requireUser();
  const zonedNow = getCurrentZonedDate();
  const { startUtc: monthStart, endUtc: monthEnd } = getMonthBoundaries(zonedNow);

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
        userId,
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
        userId,
        ...currencyFilter,
        status: "RETARD",
      },
    }),
    prisma.invoice.aggregate({
      where: {
        userId,
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
        userId,
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

  const chart = await buildRevenueHistory(userId, currency, zonedNow);

  return {
    revenueThisMonthCents: revenueThisMonth._sum.amountPaidCents ?? 0,
    overdueInvoices: overdueCount,
    outstandingAmountCents: unpaidSum,
    pendingQuotes,
    revenueHistory: chart,
  };
}

async function buildRevenueHistory(userId: string, currency?: string, referenceDate?: Date) {
  const zonedReference = referenceDate ?? getCurrentZonedDate();
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
    const target = subMonths(zonedReference, i);
    const { startUtc, endUtc, label } = getMonthBoundaries(target);

    const aggregate = await prisma.invoice.aggregate({
      where: {
        userId,
        issueDate: {
          gte: startUtc,
          lte: endUtc,
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
