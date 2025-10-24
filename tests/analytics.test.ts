import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDashboardMetrics } from "@/server/analytics";
import { InvoiceStatus } from "@prisma/client";

describe("getDashboardMetrics timezone handling", () => {
  const currency = "TZT";

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-12-15T12:00:00Z"));
  });

  afterAll(async () => {
    vi.useRealTimers();
    await prisma.invoice.deleteMany({ where: { currency } });
  });

  it("counts revenue using Africa/Tunis month boundaries", async () => {
    await prisma.invoice.deleteMany({ where: { currency } });

    const client = await prisma.client.create({
      data: {
        displayName: "Analytics Client",
      },
    });

    const baseInvoiceData = {
      clientId: client.id,
      currency,
      subtotalHTCents: 0,
      totalDiscountCents: 0,
      totalTVACents: 0,
      timbreAmountCents: 0,
      fodecAmountCents: 0,
    } as const;

    await prisma.invoice.create({
      data: {
        ...baseInvoiceData,
        number: "FAC-TZT-001",
        status: InvoiceStatus.PAYEE,
        issueDate: new Date("2024-11-30T23:30:00Z"),
        totalTTCCents: 1000,
        amountPaidCents: 1000,
      },
    });

    await prisma.invoice.create({
      data: {
        ...baseInvoiceData,
        number: "FAC-TZT-002",
        status: InvoiceStatus.PAYEE,
        issueDate: new Date("2024-12-31T22:30:00Z"),
        totalTTCCents: 2500,
        amountPaidCents: 2500,
      },
    });

    await prisma.invoice.create({
      data: {
        ...baseInvoiceData,
        number: "FAC-TZT-003",
        status: InvoiceStatus.PAYEE,
        issueDate: new Date("2025-01-01T00:15:00Z"),
        totalTTCCents: 800,
        amountPaidCents: 800,
      },
    });

    const metrics = await getDashboardMetrics(currency);

    expect(metrics.revenueThisMonthCents).toBe(3500);

    const decemberEntry = metrics.revenueHistory.at(-1);
    expect(decemberEntry).toEqual({ month: "2024-12", amountCents: 3500 });

    const novemberEntry = metrics.revenueHistory.find(
      (entry) => entry.month === "2024-11",
    );
    expect(novemberEntry?.amountCents).toBe(0);

    await prisma.invoice.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
  });
});
