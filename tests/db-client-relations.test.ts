import { describe, expect, it, vi } from "vitest";
import { createDatabaseClient } from "@/lib/db";

function createFakeSqlClient(
  handler: (
    statement: string,
    values: readonly unknown[],
  ) => Promise<Record<string, unknown>[]>,
) {
  return {
    begin: vi.fn(),
    end: vi.fn(async () => undefined),
    unsafe: vi.fn(
      async (statement: string, values: readonly unknown[] = []) =>
        handler(statement, values),
    ),
  };
}

describe("db client relation compatibility", () => {
  it("keeps selected client payment service links matched to their payment", async () => {
    const serviceLinkCalls: Array<{
      statement: string;
      values: readonly unknown[];
    }> = [];
    const sqlClient = createFakeSqlClient(async (statement, values) => {
      if (statement.includes('"public"."ClientPaymentService"')) {
        serviceLinkCalls.push({ statement, values });
        return [
          {
            id: "link-1",
            clientPaymentId: "payment-1",
            clientServiceId: "service-1",
            titleSnapshot: "Service lié",
            position: 0,
          },
        ];
      }

      if (statement.includes('"public"."ClientPayment"')) {
        return [
          {
            id: "payment-1",
            userId: "tenant-1",
            clientId: "client-1",
            amountCents: 12000,
          },
        ];
      }

      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      clientPayment: {
        findFirst: (args: Record<string, unknown>) => Promise<{
          id: string;
          serviceLinks: Array<{
            id: string;
            clientPaymentId?: string;
            clientServiceId: string;
            titleSnapshot: string;
          }>;
        } | null>;
      };
    };

    const payment = await client.clientPayment.findFirst({
      where: { id: "payment-1", userId: "tenant-1" },
      include: {
        serviceLinks: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            clientServiceId: true,
            titleSnapshot: true,
            position: true,
          },
        },
      },
    });

    expect(payment?.serviceLinks).toEqual([
      {
        id: "link-1",
        clientServiceId: "service-1",
        titleSnapshot: "Service lié",
        position: 0,
      },
    ]);
    expect(serviceLinkCalls).toHaveLength(1);
    expect(serviceLinkCalls[0].statement).toContain('"clientPaymentId"');
    expect(serviceLinkCalls[0].values).toEqual(["payment-1"]);
  });

  it("loads one latest payment per listed order like src/server/orders.ts", async () => {
    const paymentCalls: Array<{
      statement: string;
      values: readonly unknown[];
    }> = [];
    const sqlClient = createFakeSqlClient(async (statement, values) => {
      if (statement.includes('"public"."OrderPayment"')) {
        paymentCalls.push({ statement, values });
        const [orderId] = values;
        return [
          {
            id: `payment-${orderId}`,
            orderId,
            method: orderId === "order-1" ? "card" : "bank_transfer",
            proofStatus: null,
            proofUrl: null,
            createdAt: new Date(
              orderId === "order-1"
                ? "2026-04-12T10:00:00.000Z"
                : "2026-04-12T11:00:00.000Z",
            ),
          },
        ];
      }

      if (statement.includes('"public"."Order"')) {
        return [
          {
            id: "order-1",
            userId: "tenant-1",
            orderNumber: "cmd-1",
            createdAt: new Date("2026-04-12T10:00:00.000Z"),
          },
          {
            id: "order-2",
            userId: "tenant-1",
            orderNumber: "cmd-2",
            createdAt: new Date("2026-04-12T11:00:00.000Z"),
          },
        ];
      }

      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      order: {
        findMany: (args: Record<string, unknown>) => Promise<Array<{
          id: string;
          payments: Array<{ id: string; method: string }>;
        }>>;
      };
    };

    const orders = await client.order.findMany({
      where: { userId: "tenant-1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            method: true,
            proofStatus: true,
            proofUrl: true,
          },
        },
      },
    });

    expect(orders).toEqual([
      {
        id: "order-1",
        payments: [{ id: "payment-order-1", method: "card", proofStatus: null, proofUrl: null }],
      },
      {
        id: "order-2",
        payments: [{ id: "payment-order-2", method: "bank_transfer", proofStatus: null, proofUrl: null }],
      },
    ]);
    expect(paymentCalls).toHaveLength(2);
    expect(paymentCalls.map((call) => call.values)).toEqual([
      ["order-1", 1],
      ["order-2", 1],
    ]);
  });

  it("keeps nested payment filters like src/server/order-email.ts", async () => {
    const paymentCalls: Array<{
      statement: string;
      values: readonly unknown[];
    }> = [];
    const sqlClient = createFakeSqlClient(async (statement, values) => {
      if (statement.includes('"public"."OrderPayment"')) {
        paymentCalls.push({ statement, values });
        return [
          {
            id: "payment-succeeded",
            orderId: "order-1",
            status: "SUCCEEDED",
            amountCents: 1200,
            paidAt: new Date("2026-04-12T12:00:00.000Z"),
          },
        ];
      }

      if (statement.includes('"public"."Order"')) {
        return [
          {
            id: "order-1",
            userId: "tenant-1",
            customerEmail: "customer@example.com",
          },
        ];
      }

      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      order: {
        findFirst: (args: Record<string, unknown>) => Promise<{
          id: string;
          payments: Array<{ id: string; status: string }>;
        } | null>;
      };
    };

    const order = await client.order.findFirst({
      where: { id: "order-1", userId: "tenant-1" },
      include: {
        payments: {
          where: { status: "SUCCEEDED" },
          orderBy: { paidAt: "desc" },
          take: 1,
        },
      },
    });

    expect(order?.payments).toEqual([
      expect.objectContaining({
        id: "payment-succeeded",
        status: "SUCCEEDED",
      }),
    ]);
    expect(paymentCalls).toHaveLength(1);
    expect(paymentCalls[0].statement).toContain(" AND ");
    expect(paymentCalls[0].statement).toContain('"status" = $2');
    expect(paymentCalls[0].values).toEqual(["order-1", "SUCCEEDED", 1]);
  });

  it("loads the latest payment summary like src/app/api/catalogue/orders/[id]/route.ts", async () => {
    const paymentCalls: Array<{
      statement: string;
      values: readonly unknown[];
    }> = [];
    const sqlClient = createFakeSqlClient(async (statement, values) => {
      if (statement.includes('"public"."OrderPayment"')) {
        paymentCalls.push({ statement, values });
        return [
          {
            orderId: "order-1",
            method: "bank_transfer",
            status: "PENDING",
            proofStatus: "PENDING",
            proofUploadedAt: new Date("2026-04-12T12:00:00.000Z"),
            createdAt: new Date("2026-04-12T12:00:00.000Z"),
          },
        ];
      }

      if (statement.includes('"public"."Order"')) {
        return [
          {
            id: "order-1",
            userId: "tenant-1",
            orderNumber: "cmd-1",
          },
        ];
      }

      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      order: {
        findFirst: (args: Record<string, unknown>) => Promise<{
          id: string;
          payments: Array<{
            method: string;
            proofStatus: string;
          }>;
        } | null>;
      };
    };

    const order = await client.order.findFirst({
      where: { id: "order-1", userId: "tenant-1" },
      select: {
        id: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            method: true,
            status: true,
            proofStatus: true,
            proofUploadedAt: true,
          },
        },
      },
    });

    expect(order?.payments).toEqual([
      {
        method: "bank_transfer",
        status: "PENDING",
        proofStatus: "PENDING",
        proofUploadedAt: new Date("2026-04-12T12:00:00.000Z"),
      },
    ]);
    expect(paymentCalls).toHaveLength(1);
    expect(paymentCalls[0].values).toEqual(["order-1", 1]);
  });

  it("pushes messaging summary scalar selects down without large body fields", async () => {
    const messageCalls: Array<{
      statement: string;
      values: readonly unknown[];
    }> = [];
    const sqlClient = createFakeSqlClient(async (statement, values) => {
      if (statement.includes('"public"."MessagingLocalMessage"')) {
        messageCalls.push({ statement, values });
        return [
          {
            id: "message-1",
            userId: "tenant-1",
            mailbox: "INBOX",
            uidValidity: 1,
            uid: 100,
            messageId: "message@example.com",
            subject: "Hello",
            fromLabel: "Customer",
            fromAddress: "customer@example.com",
            toRecipients: [],
            internalDate: new Date("2026-04-12T12:00:00.000Z"),
            sentAt: null,
            seen: false,
            hasAttachments: false,
            previewText: "A short preview",
            bodyState: "TEXT_READY",
            updatedAt: new Date("2026-04-12T12:00:00.000Z"),
          },
        ];
      }

      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      messagingLocalMessage: {
        findMany: (args: Record<string, unknown>) => Promise<Array<{
          id: string;
          subject: string;
          previewText: string;
          sanitizedHtml?: string;
          normalizedText?: string;
          searchText?: string;
        }>>;
      };
    };

    const messages = await client.messagingLocalMessage.findMany({
      where: {
        userId: "tenant-1",
        mailbox: "INBOX",
      },
      select: {
        id: true,
        userId: true,
        mailbox: true,
        remotePath: true,
        uidValidity: true,
        uid: true,
        messageId: true,
        subject: true,
        fromLabel: true,
        fromAddress: true,
        toRecipients: true,
        internalDate: true,
        sentAt: true,
        seen: true,
        hasAttachments: true,
        previewText: true,
        bodyState: true,
        updatedAt: true,
      },
      orderBy: [
        { internalDate: "desc" },
        { uid: "desc" },
      ],
      take: 20,
    });

    expect(messages).toEqual([
      expect.objectContaining({
        id: "message-1",
        subject: "Hello",
        previewText: "A short preview",
      }),
    ]);
    expect(messages[0]).not.toHaveProperty("sanitizedHtml");
    expect(messages[0]).not.toHaveProperty("normalizedText");
    expect(messages[0]).not.toHaveProperty("searchText");
    expect(messageCalls).toHaveLength(1);
    expect(messageCalls[0].statement).not.toContain("SELECT *");
    expect(messageCalls[0].statement).not.toContain('"sanitizedHtml"');
    expect(messageCalls[0].statement).not.toContain('"normalizedText"');
    expect(messageCalls[0].statement).not.toContain('"searchText"');
    expect(messageCalls[0].statement).toContain('"previewText"');
  });
});
