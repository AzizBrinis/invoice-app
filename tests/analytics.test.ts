import { describe, expect, it, vi, afterEach } from "vitest";
import { getDashboardMetrics, getTunisMonthWindow } from "@/server/analytics";
import { prisma } from "@/lib/prisma";

const originalAggregate = prisma.invoice.aggregate;
const originalInvoiceCount = prisma.invoice.count;
const originalQuoteCount = prisma.quote.count;
const originalTransaction = prisma.$transaction;

afterEach(() => {
  vi.useRealTimers();
  prisma.invoice.aggregate = originalAggregate;
  prisma.invoice.count = originalInvoiceCount;
  prisma.quote.count = originalQuoteCount;
  prisma.$transaction = originalTransaction;
});

describe("analytics timezone handling", () => {
  it("computes Tunis month boundaries for edge UTC timestamps", () => {
    const { startUtc, endUtc, label } = getTunisMonthWindow(
      new Date("2025-03-31T23:30:00Z"),
    );

    expect(startUtc.toISOString()).toBe("2025-03-31T23:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2025-04-30T22:59:59.999Z");
    expect(label).toBe("2025-04");
  });

  it("builds dashboard queries using Africa/Tunis boundaries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-31T23:30:00Z"));

    const aggregateMock = vi.fn().mockResolvedValue({
      _sum: { amountPaidCents: 0 },
    });
    aggregateMock
      .mockResolvedValueOnce({ _sum: { amountPaidCents: 0 } })
      .mockResolvedValueOnce({
        _sum: { totalTTCCents: 0, amountPaidCents: 0 },
      })
      .mockResolvedValue({ _sum: { amountPaidCents: 0 } });

    prisma.invoice.aggregate = aggregateMock as typeof prisma.invoice.aggregate;

    const invoiceCountMock = vi.fn().mockResolvedValue(0);
    prisma.invoice.count = invoiceCountMock as typeof prisma.invoice.count;

    const quoteCountMock = vi.fn().mockResolvedValue(0);
    prisma.quote.count = quoteCountMock as typeof prisma.quote.count;

    prisma.$transaction = (async (actions: Promise<unknown>[]) =>
      Promise.all(actions)) as typeof prisma.$transaction;

    const metrics = await getDashboardMetrics();

    expect(aggregateMock).toHaveBeenCalled();
    const firstArgs = aggregateMock.mock.calls[0]?.[0] as {
      where: { issueDate: { gte: Date; lte: Date } };
    };
    expect(firstArgs.where.issueDate.gte.toISOString()).toBe(
      "2025-03-31T23:00:00.000Z",
    );
    expect(firstArgs.where.issueDate.lte.toISOString()).toBe(
      "2025-04-30T22:59:59.999Z",
    );
    expect(metrics.revenueHistory.at(-1)?.month).toBe("2025-04");
  });
});
