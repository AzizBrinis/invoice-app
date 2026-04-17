import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  type Client,
  type User,
} from "@/lib/db/prisma-server";
import {
  getCatalogBillingOverview,
  listAdminInvoiceRequestSummariesForOrders,
  resolveOrderInvoiceRequestEligibility,
  submitCatalogInvoiceRequest,
} from "@/server/invoice-requests";
import { createInvoiceFromOrder } from "@/server/invoices";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

async function ensureInvoiceRequestTable() {
  await prisma.$executeRaw(Prisma.sql`
    CREATE TABLE IF NOT EXISTS "InvoiceRequest" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "clientId" text NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
      "orderId" text NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
      "invoiceId" text REFERENCES "Invoice"("id") ON DELETE SET NULL,
      "status" text NOT NULL DEFAULT 'PENDING',
      "deliveryEmail" text NOT NULL,
      "companyName" text NOT NULL,
      "vatNumber" text NOT NULL,
      "billingAddress" text NOT NULL,
      "requestedAt" timestamptz NOT NULL DEFAULT NOW(),
      "processedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT "InvoiceRequest_status_check"
        CHECK ("status" IN ('PENDING', 'COMPLETED')),
      CONSTRAINT "InvoiceRequest_userId_orderId_key"
        UNIQUE ("userId", "orderId")
    )
  `);
}

describe("invoice request eligibility", () => {
  it("uses Africa/Tunis month boundaries instead of UTC", () => {
    const eligibility = resolveOrderInvoiceRequestEligibility({
      orderDate: new Date("2026-03-31T23:30:00.000Z"),
      now: new Date("2026-04-01T10:00:00.000Z"),
    });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reason).toBe("ELIGIBLE");
  });
});

let user: User;
let client: Client;
let eligibleOrderId: string;
let staleOrderId: string;

describeWithDb("invoice requests", () => {
  beforeAll(async () => {
    await ensureInvoiceRequestTable();

    const timestamp = Date.now();
    user = await prisma.user.create({
      data: {
        email: `invoice-requests-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Invoice Requests User",
      },
    });

    client = await prisma.client.create({
      data: {
        userId: user.id,
        displayName: "Invoice Request Client",
        email: `invoice-requests-client-${timestamp}@example.com`,
        isActive: true,
      },
    });

    const eligibleOrder = await prisma.order.create({
      data: {
        userId: user.id,
        clientId: client.id,
        orderNumber: `cmd-invoice-eligible-${timestamp}`,
        status: OrderStatus.PAID,
        paymentStatus: OrderPaymentStatus.SUCCEEDED,
        currency: "TND",
        customerName: client.displayName,
        customerEmail: client.email ?? "",
        subtotalHTCents: 10000,
        totalDiscountCents: 0,
        totalTVACents: 1900,
        totalTTCCents: 11900,
        amountPaidCents: 11900,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: {
          create: [
            {
              description: "Article facture",
              quantity: 1,
              unit: "piece",
              unitPriceHTCents: 10000,
              vatRate: 19,
              totalHTCents: 10000,
              totalTVACents: 1900,
              totalTTCCents: 11900,
              position: 0,
            },
          ],
        },
      },
    });
    eligibleOrderId = eligibleOrder.id;

    const staleOrder = await prisma.order.create({
      data: {
        userId: user.id,
        clientId: client.id,
        orderNumber: `cmd-invoice-stale-${timestamp}`,
        status: OrderStatus.PAID,
        paymentStatus: OrderPaymentStatus.SUCCEEDED,
        currency: "TND",
        customerName: client.displayName,
        customerEmail: client.email ?? "",
        subtotalHTCents: 5000,
        totalDiscountCents: 0,
        totalTVACents: 950,
        totalTTCCents: 5950,
        amountPaidCents: 5950,
        createdAt: new Date("2026-03-12T09:00:00.000Z"),
        updatedAt: new Date("2026-03-12T09:00:00.000Z"),
        items: {
          create: [
            {
              description: "Article hors délai",
              quantity: 1,
              unit: "piece",
              unitPriceHTCents: 5000,
              vatRate: 19,
              totalHTCents: 5000,
              totalTVACents: 950,
              totalTTCCents: 5950,
              position: 0,
            },
          ],
        },
      },
    });
    staleOrderId = staleOrder.id;
  });

  afterAll(async () => {
    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "InvoiceRequest"
      WHERE "userId" = ${user.id}
    `);
    await prisma.order.deleteMany({ where: { userId: user.id } });
    await prisma.invoice.deleteMany({ where: { userId: user.id } });
    await prisma.client.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("persists a request, updates billing fields, and exposes it to the admin flow", async () => {
    const submission = await submitCatalogInvoiceRequest({
      tenantUserId: user.id,
      clientId: client.id,
      orderId: eligibleOrderId,
      companyName: "Ciesco Home Pro",
      vatNumber: "TVA-7788",
      billingAddress: "10 Rue des Oliviers\n1053 Tunis",
      deliveryEmail: client.email,
    });

    expect(submission.request.status).toBe("PENDING");
    expect(submission.request.companyName).toBe("Ciesco Home Pro");
    expect(submission.request.vatNumber).toBe("TVA-7788");
    expect(submission.deliveryEmail).toBe(client.email);

    const updatedClient = await prisma.client.findUnique({
      where: { id: client.id },
      select: {
        companyName: true,
        vatNumber: true,
        address: true,
      },
    });

    expect(updatedClient).toMatchObject({
      companyName: "Ciesco Home Pro",
      vatNumber: "TVA-7788",
      address: "10 Rue des Oliviers\n1053 Tunis",
    });

    const overview = await getCatalogBillingOverview({
      tenantUserId: user.id,
      clientId: client.id,
    });
    const billingOrder = overview.orders.find(
      (entry) => entry.id === eligibleOrderId,
    );
    expect(billingOrder?.invoiceRequest?.status).toBe("PENDING");
    expect(billingOrder?.invoiceRequest?.companyName).toBe("Ciesco Home Pro");

    const summaries = await listAdminInvoiceRequestSummariesForOrders(
      [
        {
          id: eligibleOrderId,
          createdAt: new Date(billingOrder?.createdAt ?? new Date()),
          invoiceId: null,
        },
      ],
      user.id,
    );
    expect(summaries[0]?.invoiceRequest?.status).toBe("PENDING");

    const createdInvoice = await createInvoiceFromOrder(eligibleOrderId, user.id);

    const completed = await listAdminInvoiceRequestSummariesForOrders(
      [
        {
          id: eligibleOrderId,
          createdAt: new Date(billingOrder?.createdAt ?? new Date()),
          invoiceId: createdInvoice.id,
        },
      ],
      user.id,
    );
    expect(completed[0]?.invoiceRequest?.status).toBe("COMPLETED");
    expect(completed[0]?.invoiceRequest?.invoiceId).toBe(createdInvoice.id);
  });

  it("rejects requests for orders outside the allowed month window", async () => {
    await expect(
      submitCatalogInvoiceRequest({
        tenantUserId: user.id,
        clientId: client.id,
        orderId: staleOrderId,
        companyName: "Late Request Co",
        vatNumber: "TVA-LATE",
        billingAddress: "5 Rue de Test, Tunis",
        deliveryEmail: client.email,
      }),
    ).rejects.toThrow(
      "Les factures ne peuvent être demandées que pendant le même mois calendaire que la commande.",
    );
  });
});
