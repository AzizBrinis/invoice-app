import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  OrderPaymentProofStatus,
  OrderPaymentStatus,
  OrderStatus,
  type Client,
  type User,
} from "@/lib/db/prisma-server";
import {
  getCatalogClientOrderDetail,
  listCatalogClientOrders,
} from "@/server/catalogue-orders";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

let alphaUser: User;
let betaUser: User;
let alphaClient: Client;
let otherAlphaClient: Client;
let betaClient: Client;
let linkedOrderId: string;
let otherClientOrderId: string;

describeWithDb("catalogue orders", () => {
  beforeAll(async () => {
    const timestamp = Date.now();

    alphaUser = await prisma.user.create({
      data: {
        email: `catalogue-orders-alpha-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Catalogue Alpha",
      },
    });

    betaUser = await prisma.user.create({
      data: {
        email: `catalogue-orders-beta-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Catalogue Beta",
      },
    });

    alphaClient = await prisma.client.create({
      data: {
        userId: alphaUser.id,
        displayName: "Alpha Client",
        email: `catalogue-orders-client-${timestamp}@example.com`,
        isActive: true,
      },
    });

    otherAlphaClient = await prisma.client.create({
      data: {
        userId: alphaUser.id,
        displayName: "Other Alpha Client",
        email: `catalogue-orders-other-client-${timestamp}@example.com`,
        isActive: true,
      },
    });

    betaClient = await prisma.client.create({
      data: {
        userId: betaUser.id,
        displayName: "Beta Client",
        email: `catalogue-orders-beta-client-${timestamp}@example.com`,
        isActive: true,
      },
    });

    const linkedOrder = await prisma.order.create({
      data: {
        userId: alphaUser.id,
        clientId: alphaClient.id,
        orderNumber: `cmd-linked-${timestamp}`,
        status: OrderStatus.FULFILLED,
        paymentStatus: OrderPaymentStatus.SUCCEEDED,
        currency: "TND",
        customerName: alphaClient.displayName,
        customerEmail: alphaClient.email ?? "",
        customerAddress: "12 Rue du Lac, Tunis",
        subtotalHTCents: 10000,
        totalDiscountCents: 0,
        totalTVACents: 1900,
        totalTTCCents: 11900,
        amountPaidCents: 11900,
        createdAt: new Date("2026-04-10T10:00:00.000Z"),
        updatedAt: new Date("2026-04-12T14:00:00.000Z"),
        items: {
          create: [
            {
              description: "Article lie",
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
        payments: {
          create: [
            {
              userId: alphaUser.id,
              status: OrderPaymentStatus.SUCCEEDED,
              amountCents: 11900,
              currency: "TND",
              method: "card",
              provider: "stripe",
              externalReference: "pi_test_linked",
              paidAt: new Date("2026-04-10T11:00:00.000Z"),
              createdAt: new Date("2026-04-10T11:00:00.000Z"),
            },
          ],
        },
      },
    });
    linkedOrderId = linkedOrder.id;

    await prisma.order.create({
      data: {
        userId: alphaUser.id,
        clientId: alphaClient.id,
        orderNumber: `cmd-fallback-${timestamp}`,
        status: OrderStatus.PENDING,
        paymentStatus: OrderPaymentStatus.PENDING,
        currency: "TND",
        customerName: alphaClient.displayName,
        customerEmail: alphaClient.email ?? "",
        subtotalHTCents: 5000,
        totalDiscountCents: 0,
        totalTVACents: 950,
        totalTTCCents: 5950,
        amountPaidCents: 0,
        createdAt: new Date("2026-04-14T09:00:00.000Z"),
        updatedAt: new Date("2026-04-14T09:00:00.000Z"),
        items: {
          create: [
            {
              description: "Commande historique sans lien client",
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
        payments: {
          create: [
            {
              userId: alphaUser.id,
              status: OrderPaymentStatus.PENDING,
              amountCents: 5950,
              currency: "TND",
              method: "bank_transfer",
              provider: "bank_transfer",
              proofStatus: OrderPaymentProofStatus.PENDING,
              proofUploadedAt: new Date("2026-04-14T10:00:00.000Z"),
              createdAt: new Date("2026-04-14T09:30:00.000Z"),
            },
          ],
        },
      },
    });

    const otherClientOrder = await prisma.order.create({
      data: {
        userId: alphaUser.id,
        clientId: otherAlphaClient.id,
        orderNumber: `cmd-other-client-${timestamp}`,
        status: OrderStatus.PAID,
        paymentStatus: OrderPaymentStatus.SUCCEEDED,
        currency: "TND",
        customerName: otherAlphaClient.displayName,
        customerEmail: otherAlphaClient.email ?? "",
        subtotalHTCents: 8000,
        totalDiscountCents: 0,
        totalTVACents: 1520,
        totalTTCCents: 9520,
        amountPaidCents: 9520,
        items: {
          create: [
            {
              description: "Commande autre client",
              quantity: 1,
              unit: "piece",
              unitPriceHTCents: 8000,
              vatRate: 19,
              totalHTCents: 8000,
              totalTVACents: 1520,
              totalTTCCents: 9520,
              position: 0,
            },
          ],
        },
      },
    });
    otherClientOrderId = otherClientOrder.id;

    await prisma.order.create({
      data: {
        userId: betaUser.id,
        clientId: betaClient.id,
        orderNumber: `cmd-other-tenant-${timestamp}`,
        status: OrderStatus.PAID,
        paymentStatus: OrderPaymentStatus.SUCCEEDED,
        currency: "TND",
        customerName: alphaClient.displayName,
        customerEmail: alphaClient.email ?? "",
        subtotalHTCents: 7000,
        totalDiscountCents: 0,
        totalTVACents: 1330,
        totalTTCCents: 8330,
        amountPaidCents: 8330,
        items: {
          create: [
            {
              description: "Commande autre tenant",
              quantity: 1,
              unit: "piece",
              unitPriceHTCents: 7000,
              vatRate: 19,
              totalHTCents: 7000,
              totalTVACents: 1330,
              totalTTCCents: 8330,
              position: 0,
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: {
        userId: { in: [alphaUser.id, betaUser.id] },
      },
    });
    await prisma.client.deleteMany({
      where: {
        userId: { in: [alphaUser.id, betaUser.id] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [alphaUser.id, betaUser.id] },
      },
    });
  });

  it("lists only the logged-in client's tenant-scoped orders", async () => {
    const result = await listCatalogClientOrders({
      tenantUserId: alphaUser.id,
      clientId: alphaClient.id,
      customerEmail: alphaClient.email,
      page: 1,
      pageSize: 10,
    });

    expect(result.orders).toHaveLength(2);
    expect(result.orders.map((order) => order.orderNumber)).toEqual([
      expect.stringContaining("cmd-fallback-"),
      expect.stringContaining("cmd-linked-"),
    ]);
    expect(result.orders.every((order) => order.id !== otherClientOrderId)).toBe(
      true,
    );
    expect(result.pagination.total).toBe(2);
  });

  it("loads a client-visible order detail and rejects foreign orders", async () => {
    const detail = await getCatalogClientOrderDetail({
      tenantUserId: alphaUser.id,
      clientId: alphaClient.id,
      customerEmail: alphaClient.email,
      orderId: linkedOrderId,
    });

    expect(detail).not.toBeNull();
    expect(detail?.orderNumber).toContain("cmd-linked-");
    expect(detail?.payments).toHaveLength(1);
    expect(detail?.timeline[0]?.label).toBeTruthy();

    const hiddenOrder = await getCatalogClientOrderDetail({
      tenantUserId: alphaUser.id,
      clientId: alphaClient.id,
      customerEmail: alphaClient.email,
      orderId: otherClientOrderId,
    });

    expect(hiddenOrder).toBeNull();
  });
});
