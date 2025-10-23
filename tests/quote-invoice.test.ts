import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createQuote, convertQuoteToInvoice } from "@/server/quotes";
import { createInvoice } from "@/server/invoices";
import { nextQuoteNumber, nextInvoiceNumber } from "@/server/sequences";
import { QuoteStatus, InvoiceStatus } from "@prisma/client";

let clientId: string;
let productId: string;

beforeAll(async () => {
  const client = await prisma.client.create({
    data: {
      displayName: "Client Test",
      companyName: "SAS Test",
      email: "client@test.fr",
      isActive: true,
    },
  });
  clientId = client.id;

  const product = await prisma.product.create({
    data: {
      sku: `SKU-TEST-${Date.now()}`,
      name: "Produit Test",
      priceHTCents: 10000,
      priceTTCCents: 12000,
      vatRate: 20,
      unit: "unité",
      isActive: true,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { clientId } });
  await prisma.invoice.deleteMany({ where: { clientId } });
  await prisma.product.delete({ where: { id: productId } });
  await prisma.client.delete({ where: { id: clientId } });
});

describe("Quotes and invoices", () => {
  it("generates sequential numbers", async () => {
    const quoteNumber = await nextQuoteNumber();
    expect(quoteNumber).toMatch(/DEV-/);
    const invoiceNumber = await nextInvoiceNumber();
    expect(invoiceNumber).toMatch(/FAC-/);
  });

  it("creates a quote and converts it to an invoice", async () => {
    const quote = await createQuote({
      clientId,
      status: QuoteStatus.BROUILLON,
      issueDate: new Date(),
      validUntil: new Date(),
      currency: "EUR",
      lines: [
        {
          productId,
          description: "Produit Test",
          quantity: 2,
          unit: "unité",
          unitPriceHTCents: 10000,
          vatRate: 20,
          discountRate: null,
          discountAmountCents: null,
          position: 0,
        },
      ],
    });

    expect(quote.totalTTCCents).toBeGreaterThan(0);

    const invoice = await convertQuoteToInvoice(quote.id);
    expect(invoice.totalTTCCents).toBe(quote.totalTTCCents);
    expect(invoice.status).toBe(InvoiceStatus.ENVOYEE);
  });

  it("creates an invoice directly", async () => {
    const invoice = await createInvoice({
      clientId,
      status: InvoiceStatus.BROUILLON,
      issueDate: new Date(),
      dueDate: new Date(),
      currency: "EUR",
      lines: [
        {
          productId,
          description: "Produit Test",
          quantity: 1,
          unit: "unité",
          unitPriceHTCents: 10000,
          vatRate: 20,
          discountRate: null,
          discountAmountCents: null,
          position: 0,
        },
      ],
    });

    expect(invoice.totalTTCCents).toBeGreaterThan(0);
  });
});
