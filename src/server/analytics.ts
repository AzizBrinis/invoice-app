import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { invoiceStatsTag } from "@/server/invoices";
import { Prisma, type InvoiceStatus } from "@prisma/client";

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
const RECENT_ITEMS_LIMIT = 5;

type RevenueHistorySlot = {
  label: string;
  startUtc: Date;
  endUtc: Date;
};

type RevenueHistoryPoint = {
  month: string;
  amountCents: number;
};

type DashboardMetrics = {
  revenueThisMonthCents: number;
  overdueInvoices: number;
  outstandingAmountCents: number;
  pendingQuotes: number;
  revenueHistory: RevenueHistoryPoint[];
};

type DashboardPayload = {
  metrics: DashboardMetrics;
  recentInvoices: Awaited<ReturnType<typeof fetchRecentInvoices>>;
  recentQuotes: Awaited<ReturnType<typeof fetchRecentQuotes>>;
};

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

export async function getDashboardPayload(currency?: string) {
  const user = await requireUser();
  const tenantId = resolveTenantId(user);
  const currencyKey = currency ?? ALL_CURRENCY_KEY;

  const cached = unstable_cache(
    async () => computeDashboardPayload(tenantId, currency),
    ["dashboard-payload", tenantId, currencyKey],
    {
      revalidate: DASHBOARD_REVALIDATE_SECONDS,
      tags: [invoiceStatsTag(tenantId)],
    },
  );

  return cached();
}

export async function getDashboardMetrics(currency?: string) {
  const payload = await getDashboardPayload(currency);
  return payload.metrics;
}

function resolveTenantId(user: { id: string; tenantId?: string | null }) {
  return user.tenantId ?? user.id;
}

async function computeDashboardPayload(
  tenantId: string,
  currency?: string,
): Promise<DashboardPayload> {
  const zonedNow = getCurrentZonedDate();
  const { startUtc: monthStart, endUtc: monthEnd } = getMonthBoundaries(zonedNow);
  const historySlots = getRevenueHistorySlots(zonedNow);
  const historyRangeStart = historySlots[0].startUtc;
  const historyRangeEnd = historySlots[historySlots.length - 1].endUtc;

  const [metrics, recentInvoices, recentQuotes] = await Promise.all([
    fetchDashboardStats({
      tenantId,
      currency,
      monthStart,
      monthEnd,
      historySlots,
      historyRangeStart,
      historyRangeEnd,
    }),
    fetchRecentInvoices(tenantId),
    fetchRecentQuotes(tenantId),
  ]);

  return {
    metrics,
    recentInvoices,
    recentQuotes,
  };
}

async function fetchDashboardStats(params: {
  tenantId: string;
  currency?: string;
  monthStart: Date;
  monthEnd: Date;
  historySlots: RevenueHistorySlot[];
  historyRangeStart: Date;
  historyRangeEnd: Date;
}): Promise<DashboardMetrics> {
  const {
    tenantId,
    currency,
    monthStart,
    monthEnd,
    historySlots,
    historyRangeStart,
    historyRangeEnd,
  } = params;

  const [statsRow] = await prisma.$queryRaw<Array<{
    revenue_this_month_cents: bigint | null;
    overdue_invoices: number | null;
    outstanding_amount_cents: bigint | null;
    pending_quotes: number | null;
  }>>`
    WITH filtered_invoices AS (
      SELECT "issueDate", "status", "amountPaidCents", "totalTTCCents"
      FROM "Invoice"
      WHERE "userId" = ${tenantId}
      ${currencyCondition(currency)}
    )
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN "status" IN ('PAYEE', 'PARTIELLE', 'ENVOYEE', 'RETARD')
              AND "issueDate" BETWEEN ${monthStart} AND ${monthEnd}
            THEN "amountPaidCents"
            ELSE 0
          END
        ),
        0
      )::bigint AS revenue_this_month_cents,
      COUNT(*) FILTER (WHERE "status" = 'RETARD')::int AS overdue_invoices,
      COALESCE(
        SUM(
          CASE
            WHEN "status" IN ('ENVOYEE', 'PARTIELLE', 'RETARD')
            THEN ("totalTTCCents" - "amountPaidCents")
            ELSE 0
          END
        ),
        0
      )::bigint AS outstanding_amount_cents,
      (
        SELECT COUNT(*)::int
        FROM "Quote"
        WHERE "userId" = ${tenantId}
        ${currencyCondition(currency)}
          AND "status" IN ('ENVOYE', 'BROUILLON')
      ) AS pending_quotes
    FROM filtered_invoices;
  `;

  const historyRows = await prisma.$queryRaw<Array<{
    month: string;
    amount_cents: bigint;
  }>>`
    SELECT
      to_char(
        date_trunc(
          'month',
          timezone(${TUNIS_TIMEZONE}, ("issueDate" AT TIME ZONE 'UTC'))
        ),
        'YYYY-MM'
      ) AS month,
      SUM("amountPaidCents")::bigint AS amount_cents
    FROM "Invoice"
    WHERE "userId" = ${tenantId}
      ${currencyCondition(currency)}
      AND "status" IN ('PAYEE', 'PARTIELLE', 'ENVOYEE', 'RETARD')
      AND "issueDate" BETWEEN ${historyRangeStart} AND ${historyRangeEnd}
    GROUP BY 1
    ORDER BY 1;
  `;

  const revenuesByMonth = new Map<string, number>();
  for (const row of historyRows) {
    revenuesByMonth.set(row.month, toNumber(row.amount_cents));
  }

  const history: RevenueHistoryPoint[] = historySlots.map((slot) => ({
    month: slot.label,
    amountCents: revenuesByMonth.get(slot.label) ?? 0,
  }));

  return {
    revenueThisMonthCents: toNumber(statsRow?.revenue_this_month_cents),
    overdueInvoices: statsRow?.overdue_invoices ?? 0,
    outstandingAmountCents: toNumber(statsRow?.outstanding_amount_cents),
    pendingQuotes: statsRow?.pending_quotes ?? 0,
    revenueHistory: history,
  };
}

async function fetchRecentInvoices(tenantId: string) {
  return prisma.invoice.findMany({
    where: { userId: tenantId },
    orderBy: { issueDate: "desc" },
    take: RECENT_ITEMS_LIMIT,
    include: {
      client: true,
    },
  });
}

async function fetchRecentQuotes(tenantId: string) {
  return prisma.quote.findMany({
    where: { userId: tenantId },
    orderBy: { issueDate: "desc" },
    take: RECENT_ITEMS_LIMIT,
    include: {
      client: true,
    },
  });
}

function getRevenueHistorySlots(reference: Date) {
  const slots: RevenueHistorySlot[] = [];
  for (let i = REVENUE_HISTORY_MONTHS - 1; i >= 0; i -= 1) {
    const target = subMonths(reference, i);
    slots.push(getMonthBoundaries(target));
  }
  return slots;
}

function currencyCondition(currency?: string) {
  if (!currency) {
    return Prisma.sql``;
  }
  return Prisma.sql`AND "currency" = ${currency}`;
}

function toNumber(value?: bigint | number | null) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value ?? 0;
}
