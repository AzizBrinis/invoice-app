import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { invoiceStatsTag } from "@/server/invoices";
import type { InvoiceStatus } from "@prisma/client";

const TUNIS_TIMEZONE = "Africa/Tunis";
const DASHBOARD_REVALIDATE_SECONDS = 30;
const REVENUE_HISTORY_MONTHS = 6;
const REVENUE_STATUSES: InvoiceStatus[] = [
  "PAYEE",
  "PARTIELLE",
  "ENVOYEE",
  "RETARD",
];
const ALL_CURRENCY_KEY = "__ALL__";

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
  const user = await requireUser();
  const tenantId = resolveTenantId(user);
  const currencyKey = currency ?? ALL_CURRENCY_KEY;

  const cached = unstable_cache(
    async () => computeDashboardMetrics(tenantId, currency),
    ["dashboard-metrics", tenantId, currencyKey],
    {
      revalidate: DASHBOARD_REVALIDATE_SECONDS,
      tags: [invoiceStatsTag(tenantId)],
    },
  );

  return cached();
}

function resolveTenantId(user: { id: string; tenantId?: string | null }) {
  return user.tenantId ?? user.id;
}

async function computeDashboardMetrics(tenantId: string, currency?: string) {
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
    revenueHistory,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        userId: tenantId,
        issueDate: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...currencyFilter,
        status: {
          in: REVENUE_STATUSES,
        },
      },
      _sum: {
        amountPaidCents: true,
      },
    }),
    prisma.invoice.count({
      where: {
        userId: tenantId,
        ...currencyFilter,
        status: "RETARD",
      },
    }),
    prisma.invoice.aggregate({
      where: {
        userId: tenantId,
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
        userId: tenantId,
        ...currencyFilter,
        status: {
          in: ["ENVOYE", "BROUILLON"],
        },
      },
    }),
    buildRevenueHistory(tenantId, currency, zonedNow),
  ]);

  const unpaidSum =
    (outstandingAmount._sum.totalTTCCents ?? 0) -
    (outstandingAmount._sum.amountPaidCents ?? 0);

  return {
    revenueThisMonthCents: revenueThisMonth._sum.amountPaidCents ?? 0,
    overdueInvoices: overdueCount,
    outstandingAmountCents: unpaidSum,
    pendingQuotes,
    revenueHistory,
  };
}

async function buildRevenueHistory(
  tenantId: string,
  currency: string | undefined,
  referenceDate: Date,
) {
  const monthSlots = getRevenueHistorySlots(referenceDate);
  const currencyFilter = currency
    ? {
        currency,
      }
    : {};

  const { startUtc: rangeStart } = monthSlots[0];
  const { endUtc: rangeEnd } = monthSlots[monthSlots.length - 1];

  const rows = await prisma.invoice.findMany({
    where: {
      userId: tenantId,
      issueDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
      ...currencyFilter,
      status: {
        in: REVENUE_STATUSES,
      },
    },
    select: {
      issueDate: true,
      amountPaidCents: true,
    },
  });

  const buckets = new Map<string, number>();
  for (const slot of monthSlots) {
    buckets.set(slot.label, 0);
  }

  for (const row of rows) {
    const zonedIssueDate = toZonedTime(row.issueDate, TUNIS_TIMEZONE);
    const label = formatInTimeZone(zonedIssueDate, TUNIS_TIMEZONE, "yyyy-MM");
    if (buckets.has(label)) {
      const current = buckets.get(label) ?? 0;
      buckets.set(label, current + row.amountPaidCents);
    }
  }

  return monthSlots.map((slot) => ({
    month: slot.label,
    amountCents: buckets.get(slot.label) ?? 0,
  }));
}

function getRevenueHistorySlots(reference: Date) {
  const slots: Array<{ label: string; startUtc: Date; endUtc: Date }> = [];
  for (let i = REVENUE_HISTORY_MONTHS - 1; i >= 0; i -= 1) {
    const target = subMonths(reference, i);
    slots.push(getMonthBoundaries(target));
  }
  return slots;
}
