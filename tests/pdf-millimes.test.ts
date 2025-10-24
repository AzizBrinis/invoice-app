import { describe, expect, it } from "vitest";
import type { Invoice, InvoiceLine, Payment, Client } from "@prisma/client";
import { __pdfTesting } from "@/server/pdf";

function createInvoiceWithMillimes() {
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

  const lines: InvoiceLine[] = [
    {
      id: "line_1",
      invoiceId: "inv_1",
      productId: null,
      description: "Service avec millimes",
      quantity: 1,
      unit: "unité",
      unitPriceHTCents: 12_345,
      vatRate: 19,
      discountRate: null,
      discountAmountCents: null,
      totalHTCents: 12_345,
      totalTVACents: 2_346,
      totalTTCCents: 14_691,
      fodecRate: null,
      fodecAmountCents: 789,
      position: 0,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    },
  ];

  const payments: Payment[] = [];

  const invoice: Invoice = {
    id: "inv_1",
    number: "FAC-TEST",
    status: "ENVOYEE",
    reference: null,
    issueDate: new Date("2025-01-05T00:00:00Z"),
    dueDate: new Date("2025-01-20T00:00:00Z"),
    clientId: client.id,
    currency: "TND",
    globalDiscountRate: null,
    globalDiscountAmountCents: null,
    vatBreakdown: null,
    taxSummary: [
      {
        label: "FODEC",
        amountCents: 789,
        baseCents: 12_345,
        rate: 1,
        type: "FODEC",
      },
    ],
    taxConfiguration: null,
    notes: null,
    terms: null,
    lateFeeRate: null,
    subtotalHTCents: 12_345,
    totalDiscountCents: 0,
    totalTVACents: 2_346,
    totalTTCCents: 14_691,
    amountPaidCents: 0,
    fodecAmountCents: 789,
    timbreAmountCents: 0,
    createdAt: new Date("2025-01-05T00:00:00Z"),
    updatedAt: new Date("2025-01-05T00:00:00Z"),
    quoteId: null,
  };

  return {
    invoice: { ...invoice, client, lines, payments },
    client,
    lines,
    payments,
  } as const;
}

describe("PDF millime rendering", () => {
  it("renders Tunisian amounts with millimes", () => {
    const { invoice } = createInvoiceWithMillimes();

    const html = __pdfTesting.buildHtml("invoice", invoice, null);

    expect(html).toContain("12,345 DT");
    expect(html).toContain("14,691 DT");
    expect(html).toContain("0,789 DT");
  });
});
