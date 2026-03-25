import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder, markOrderPaid } from "@/server/orders";
import {
  OrderPaymentStatus,
  OrderStatus,
  ProductSaleMode,
  type User,
} from "@prisma/client";
import { ZodError } from "zod";

vi.mock("@/server/order-email-jobs", () => ({
  queueOrderCreatedEmailJob: vi.fn().mockResolvedValue({
    jobId: "job-order-created",
    deduped: false,
  }),
  queueOrderPaymentReceivedEmailJob: vi.fn().mockResolvedValue({
    jobId: "job-order-paid",
    deduped: false,
  }),
  queueQuoteRequestEmailJob: vi.fn().mockResolvedValue({
    jobId: "job-quote-request",
    deduped: false,
  }),
}));

let user: User;
let productId: string;
let otherUser: User;
let otherProductId: string;

beforeAll(async () => {
  const timestamp = Date.now();
  user = await prisma.user.create({
    data: {
      email: `orders-${timestamp}@example.com`,
      passwordHash: "hashed",
      name: "Orders User",
    },
  });

  const product = await prisma.product.create({
    data: {
      userId: user.id,
      sku: `SKU-ORDER-${timestamp}`,
      name: "Order Product",
      publicSlug: `order-product-${timestamp}`,
      saleMode: ProductSaleMode.INSTANT,
      priceHTCents: 1000,
      priceTTCCents: 1200,
      vatRate: 20,
      unit: "unit",
      isActive: true,
    },
  });

  productId = product.id;

  otherUser = await prisma.user.create({
    data: {
      email: `orders-tenant-${timestamp}@example.com`,
      passwordHash: "hashed",
      name: "Orders Tenant User",
    },
  });

  const otherProduct = await prisma.product.create({
    data: {
      userId: otherUser.id,
      sku: `SKU-ORDER-OTHER-${timestamp}`,
      name: "Other Order Product",
      publicSlug: `order-product-other-${timestamp}`,
      saleMode: ProductSaleMode.INSTANT,
      priceHTCents: 2000,
      priceTTCCents: 2400,
      vatRate: 20,
      unit: "unit",
      isActive: true,
    },
  });

  otherProductId = otherProduct.id;
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { userId: otherUser.id } });
  await prisma.client.deleteMany({ where: { userId: otherUser.id } });
  await prisma.product.delete({ where: { id: otherProductId } });
  await prisma.user.delete({ where: { id: otherUser.id } });
  await prisma.order.deleteMany({ where: { userId: user.id } });
  await prisma.client.deleteMany({ where: { userId: user.id } });
  await prisma.product.delete({ where: { id: productId } });
  await prisma.user.delete({ where: { id: user.id } });
});

describe("orders", () => {
  it("creates an order with computed totals", async () => {
    const order = await createOrder(
      {
        currency: "TND",
        customer: {
          name: "Test Customer",
          email: "CUSTOMER@EXAMPLE.COM",
          phone: null,
          company: "Test Co",
          address: "123 Main St",
        },
        items: [
          {
            productId,
            description: "Line One",
            quantity: 2,
            unit: "unit",
            unitPriceHTCents: 1000,
            vatRate: 10,
            discountRate: 10,
            discountAmountCents: null,
            position: 0,
          },
          {
            productId,
            description: "Line Two",
            quantity: 1,
            unit: "unit",
            unitPriceHTCents: 500,
            vatRate: 20,
            discountRate: null,
            discountAmountCents: 50,
            position: 1,
          },
        ],
      },
      user.id,
    );

    expect(order.orderNumber).toMatch(/^cmd-/);
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PENDING);
    expect(order.customerEmail).toBe("customer@example.com");
    expect(order.subtotalHTCents).toBe(2250);
    expect(order.totalDiscountCents).toBe(250);
    expect(order.totalTVACents).toBe(270);
    expect(order.totalTTCCents).toBe(2520);
    expect(order.amountPaidCents).toBe(0);

    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      orderBy: { position: "asc" },
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      discountRate: 10,
      discountAmountCents: 200,
      totalHTCents: 1800,
      totalTVACents: 180,
      totalTTCCents: 1980,
    });
    expect(items[1]).toMatchObject({
      discountRate: null,
      discountAmountCents: 50,
      totalHTCents: 450,
      totalTVACents: 90,
      totalTTCCents: 540,
    });
  });

  it("marks an order as paid", async () => {
    const order = await createOrder(
      {
        currency: "TND",
        customer: {
          name: "Paid Customer",
          email: "paid@example.com",
          phone: null,
          company: null,
          address: null,
        },
        items: [
          {
            productId,
            description: "One Line",
            quantity: 1,
            unit: "unit",
            unitPriceHTCents: 1500,
            vatRate: 20,
            discountRate: null,
            discountAmountCents: null,
            position: 0,
          },
        ],
      },
      user.id,
    );

    const updated = await markOrderPaid(order.id, user.id);

    expect(updated.status).toBe(OrderStatus.PAID);
    expect(updated.paymentStatus).toBe(OrderPaymentStatus.SUCCEEDED);
    expect(updated.amountPaidCents).toBe(order.totalTTCCents);

    const payments = await prisma.orderPayment.findMany({
      where: { orderId: order.id },
    });

    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      status: OrderPaymentStatus.SUCCEEDED,
      amountCents: order.totalTTCCents,
      method: "manual",
      provider: "manual",
    });
  });

  it("rejects order creation with no line items", async () => {
    await expect(
      createOrder(
        {
          currency: "TND",
          customer: {
            name: "Empty Cart",
            email: "empty@example.com",
            phone: null,
            company: null,
            address: null,
          },
          items: [],
        },
        user.id,
      ),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects order creation for products outside tenant scope", async () => {
    await expect(
      createOrder(
        {
          currency: "TND",
          customer: {
            name: "Scope Check",
            email: "scope@example.com",
            phone: null,
            company: null,
            address: null,
          },
          items: [
            {
              productId: otherProductId,
              description: "Other Tenant Line",
              quantity: 1,
              unit: "unit",
              unitPriceHTCents: 2000,
              vatRate: 20,
              discountRate: null,
              discountAmountCents: null,
              position: 0,
            },
          ],
        },
        user.id,
      ),
    ).rejects.toThrow("Produit introuvable");
  });
});
