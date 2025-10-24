import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createInvoice, deleteInvoice } from "@/server/invoices";
import { InvoiceAuditAction, InvoiceStatus } from "@prisma/client";

let clientId: string;
let productId: string;
const createdInvoiceIds: string[] = [];

beforeAll(async () => {
  const client = await prisma.client.create({
    data: {
      displayName: "Client Facture",
      companyName: "Société Facture",
      email: "facture@test.fr",
      isActive: true,
    },
  });
  clientId = client.id;

  const product = await prisma.product.create({
    data: {
      sku: `SKU-INV-${Date.now()}`,
      name: "Service Facturation",
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
  if (createdInvoiceIds.length > 0) {
    await prisma.invoiceAuditLog.deleteMany({
      where: { invoiceId: { in: createdInvoiceIds } },
    });
    await prisma.invoice.deleteMany({
      where: { id: { in: createdInvoiceIds } },
    });
  }
  await prisma.product.delete({ where: { id: productId } });
  await prisma.client.delete({ where: { id: clientId } });
});

describe("deleteInvoice", () => {
  it("permanently deletes draft invoices and records the event", async () => {
    const invoice = await createInvoice({
      clientId,
      status: InvoiceStatus.BROUILLON,
      issueDate: new Date(),
      dueDate: new Date(),
      currency: "TND",
      lines: [
        {
          productId,
          description: "Service Facturation",
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

    createdInvoiceIds.push(invoice.id);

    await deleteInvoice(invoice.id);

    const deleted = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(deleted).toBeNull();

    const logs = await prisma.invoiceAuditLog.findMany({
      where: { invoiceId: invoice.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe(InvoiceAuditAction.DELETION);
    expect(logs[0]?.previousStatus).toBe(InvoiceStatus.BROUILLON);
  });

  it("cancels published invoices instead of deleting them", async () => {
    const invoice = await createInvoice({
      clientId,
      status: InvoiceStatus.ENVOYEE,
      issueDate: new Date(),
      dueDate: new Date(),
      currency: "TND",
      lines: [
        {
          productId,
          description: "Service Facturation",
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

    createdInvoiceIds.push(invoice.id);

    await deleteInvoice(invoice.id);

    const persisted = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(persisted.status).toBe(InvoiceStatus.ANNULEE);

    const logs = await prisma.invoiceAuditLog.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: "desc" },
    });
    expect(logs[0]?.action).toBe(InvoiceAuditAction.CANCELLATION);
    expect(logs[0]?.previousStatus).toBe(InvoiceStatus.ENVOYEE);
    expect(logs[0]?.newStatus).toBe(InvoiceStatus.ANNULEE);
  });
});
