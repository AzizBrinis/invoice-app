import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createInvoice, deleteInvoice, listInvoices } from "@/server/invoices";
import { InvoiceAuditAction, InvoiceStatus, type User } from "@prisma/client";

let user: User;
let clientId: string;
let productId: string;
const createdInvoiceIds: string[] = [];

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireUser: vi.fn(async () => user),
    getCurrentUser: vi.fn(async () => user),
  };
});

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `invoice-user-${Date.now()}@example.com`,
      passwordHash: "hashed",
      name: "Invoice User",
    },
  });

  const client = await prisma.client.create({
    data: {
      displayName: "Client Facture",
      companyName: "Société Facture",
      email: "facture@test.fr",
      isActive: true,
      userId: user.id,
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
      userId: user.id,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  if (createdInvoiceIds.length > 0) {
    await prisma.invoiceAuditLog.deleteMany({
      where: { invoiceId: { in: createdInvoiceIds }, userId: user.id },
    });
    await prisma.invoice.deleteMany({
      where: { id: { in: createdInvoiceIds }, userId: user.id },
    });
  }
  await prisma.product.delete({ where: { id: productId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.numberingSequence.deleteMany({ where: { userId: user.id } });
  await prisma.companySettings.deleteMany({ where: { userId: user.id } });
  await prisma.messagingSettings.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

function buildInvoiceInput(status: InvoiceStatus) {
  return {
    clientId,
    status,
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
  };
}

describe("deleteInvoice", () => {
  it("permanently deletes draft invoices and records the event", async () => {
    const invoice = await createInvoice(buildInvoiceInput(InvoiceStatus.BROUILLON));
    createdInvoiceIds.push(invoice.id);

    const outcome = await deleteInvoice(invoice.id);
    expect(outcome).toBe("deleted");

    const deleted = await prisma.invoice.findFirst({
      where: { id: invoice.id, userId: user.id },
    });
    expect(deleted).toBeNull();

    const logs = await prisma.invoiceAuditLog.findMany({
      where: { invoiceId: invoice.id, userId: user.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe(InvoiceAuditAction.DELETION);
    expect(logs[0]?.previousStatus).toBe(InvoiceStatus.BROUILLON);
  });

  it("cancels published invoices instead of deleting them", async () => {
    const invoice = await createInvoice(buildInvoiceInput(InvoiceStatus.ENVOYEE));
    createdInvoiceIds.push(invoice.id);

    const outcome = await deleteInvoice(invoice.id);
    expect(outcome).toBe("cancelled");

    const persisted = await prisma.invoice.findFirst({
      where: { id: invoice.id, userId: user.id },
    });
    expect(persisted?.status).toBe(InvoiceStatus.ANNULEE);

    const defaultListing = await listInvoices({ pageSize: 100 });
    expect(defaultListing.items.some((item) => item.id === invoice.id)).toBe(false);

    const annulledListing = await listInvoices({
      status: InvoiceStatus.ANNULEE,
      pageSize: 100,
    });
    expect(annulledListing.items.some((item) => item.id === invoice.id)).toBe(true);

    const logs = await prisma.invoiceAuditLog.findMany({
      where: { invoiceId: invoice.id, userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(logs[0]?.action).toBe(InvoiceAuditAction.CANCELLATION);
    expect(logs[0]?.previousStatus).toBe(InvoiceStatus.ENVOYEE);
    expect(logs[0]?.newStatus).toBe(InvoiceStatus.ANNULEE);
  });

  it("returns already-cancelled when attempting to delete a cancelled invoice again", async () => {
    const invoice = await createInvoice(buildInvoiceInput(InvoiceStatus.ENVOYEE));
    createdInvoiceIds.push(invoice.id);

    await deleteInvoice(invoice.id);
    const outcome = await deleteInvoice(invoice.id);
    expect(outcome).toBe("already-cancelled");
  });
});
