import { afterEach, describe, expect, it, vi } from "vitest";
import { exportInvoicesCsv } from "@/server/csv";
import { prisma } from "@/lib/prisma";
import type { Invoice, Client } from "@prisma/client";

const originalFindMany = prisma.invoice.findMany;

afterEach(() => {
  prisma.invoice.findMany = originalFindMany;
});

describe("CSV millime exports", () => {
  it("includes millime precision in invoice totals", async () => {
    const client: Client = {
      id: "client_1",
      displayName: "Client Millimes",
      companyName: null,
      address: null,
      email: null,
      phone: null,
      vatNumber: null,
      notes: null,
      isActive: true,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    };

    const invoice: Invoice = {
      id: "inv_1",
      number: "FAC-TEST",
      status: "PAYEE",
      reference: null,
      issueDate: new Date("2025-02-01T00:00:00Z"),
      dueDate: new Date("2025-02-15T00:00:00Z"),
      clientId: client.id,
      currency: "TND",
      globalDiscountRate: null,
      globalDiscountAmountCents: null,
      vatBreakdown: null,
      taxSummary: null,
      taxConfiguration: null,
      notes: null,
      terms: null,
      lateFeeRate: null,
      subtotalHTCents: 45_678,
      totalDiscountCents: 0,
      totalTVACents: 9_999,
      totalTTCCents: 55_677,
      amountPaidCents: 55_677,
      fodecAmountCents: 456,
      timbreAmountCents: 0,
      createdAt: new Date("2025-02-01T00:00:00Z"),
      updatedAt: new Date("2025-02-01T00:00:00Z"),
      quoteId: null,
    };

    prisma.invoice.findMany = vi.fn().mockResolvedValue([
      { ...invoice, client },
    ]);

    const csv = await exportInvoicesCsv();

    expect(csv).toContain("45,678 DT");
    expect(csv).toContain("55,677 DT");
  });
});
