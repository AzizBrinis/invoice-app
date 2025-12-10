import { beforeEach, describe, expect, it, vi } from "vitest";
import { getToolByName } from "@/server/assistant/tools";

const {
  mockProductFindMany,
  createInvoiceMock,
  createQuoteMock,
} = vi.hoisted(() => ({
  mockProductFindMany: vi.fn(),
  createInvoiceMock: vi.fn(),
  createQuoteMock: vi.fn(),
}));

vi.mock("@/server/assistant/audit", () => ({
  logAiAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: mockProductFindMany,
    },
  },
}));

vi.mock("@/server/invoices", () => ({
  createInvoice: createInvoiceMock,
  updateInvoice: vi.fn(),
  duplicateInvoice: vi.fn(),
  convertQuoteToInvoice: vi.fn(),
}));

vi.mock("@/server/quotes", () => ({
  createQuote: createQuoteMock,
  updateQuote: vi.fn(),
  duplicateQuote: vi.fn(),
  convertQuoteToInvoice: vi.fn(),
}));

vi.mock("@/server/products", () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("@/server/assistant/search", () => ({
  searchClientsForAssistant: vi.fn(),
  searchProductsForAssistant: vi.fn(),
}));

vi.mock("@/server/document-email-jobs", () => ({
  queueInvoiceEmailJob: vi.fn(),
  queueQuoteEmailJob: vi.fn(),
}));

vi.mock("@/server/messaging", () => ({
  fetchMessageDetail: vi.fn(),
  fetchRecentMailboxEmails: vi.fn(),
  getMailboxDisplayName: vi.fn(),
  getMessagingSettingsSummary: vi.fn(),
  sendEmailMessageForUser: vi.fn(),
}));

vi.mock("@/server/messaging-scheduled", () => ({
  listScheduledEmails: vi.fn(),
  scheduleEmailDraft: vi.fn(),
}));

vi.mock("@/server/assistant/email-scheduling", () => ({
  formatScheduledTime: vi.fn(),
  parseRequestedSendTime: vi.fn(),
}));

vi.mock("@/server/assistant/usage", () => ({
  enforceUsageLimit: vi.fn(),
  incrementUsage: vi.fn(),
}));

vi.mock("@/server/assistant/pending-tools", () => ({
  createPendingToolCall: vi.fn(),
  consumePendingToolCall: vi.fn(),
}));

vi.mock("@/server/clients", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
}));

describe("assistant document pricing with products", () => {
  const context = { userId: "user_1", conversationId: "conv_1" };
  const product = {
    id: "prod_1",
    priceHTCents: 280_000,
    vatRate: 19,
    unit: "unité",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProductFindMany.mockResolvedValue([product]);
    createInvoiceMock.mockResolvedValue({
      id: "inv_1",
      number: "FAC-2025-001",
      totalTTCCents: 0,
      currency: "TND",
      client: { displayName: "Client" },
    });
    createQuoteMock.mockResolvedValue({
      id: "quote_1",
      number: "DEV-2025-001",
      totalTTCCents: 0,
      currency: "TND",
      client: { displayName: "Client" },
    });
  });

  it("reuses the stored product price when creating an invoice", async () => {
    const tool = getToolByName("create_invoice");
    expect(tool).toBeTruthy();

    const input = {
      clientId: "client_1",
      currency: "TND",
      lines: [
        {
          productId: product.id,
          description: "Produit facturé",
          quantity: 1,
          unit: "pièce",
          unitPrice: 2800, // mis-scaled value from the AI output
          vatRate: 19,
        },
      ],
    };

    const result = await tool!.handler(input as any, context);

    expect(result.success).toBe(true);
    expect(mockProductFindMany).toHaveBeenCalledWith({
      where: { id: { in: [product.id] }, userId: context.userId },
      select: {
        id: true,
        priceHTCents: true,
        vatRate: true,
        unit: true,
      },
    });
    expect(createInvoiceMock).toHaveBeenCalledTimes(1);
    const payload = createInvoiceMock.mock.calls[0][0];
    expect(payload.lines[0].unitPriceHTCents).toBe(product.priceHTCents);
    expect(payload.lines[0].vatRate).toBe(product.vatRate);
  });

  it("reuses the stored product price when creating a quote", async () => {
    const tool = getToolByName("create_quote");
    expect(tool).toBeTruthy();

    const input = {
      clientId: "client_1",
      currency: "TND",
      lines: [
        {
          productId: product.id,
          description: "Produit devis",
          quantity: 2,
          unit: "pièce",
          unitPrice: 5600, // should be interpreted as 2 * 280 TND, not millimes scaled
          vatRate: 19,
        },
      ],
    };

    const result = await tool!.handler(input as any, context);

    expect(result.success).toBe(true);
    expect(createQuoteMock).toHaveBeenCalledTimes(1);
    const payload = createQuoteMock.mock.calls[0][0];
    expect(payload.lines[0].unitPriceHTCents).toBe(product.priceHTCents);
    expect(payload.lines[0].vatRate).toBe(product.vatRate);
  });
});
