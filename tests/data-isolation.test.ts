import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "@/lib/prisma";
import {
  exportClientsCsv,
  exportInvoicesCsv,
  exportProductsCsv,
  exportQuotesCsv,
} from "@/server/csv";
import { listInvoices } from "@/server/invoices";
import { listQuotes } from "@/server/quotes";
import {
  InvoiceStatus,
  QuoteStatus,
  type User,
  Prisma,
} from "@prisma/client";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";

type IsolationFixture = {
  user: User;
  clientId: string;
  clientName: string;
  productId: string;
  productName: string;
  invoiceNumber: string;
  quoteNumber: string;
};

let activeUser: User;
let alphaFixture: IsolationFixture;
let betaFixture: IsolationFixture;

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>(
    "@/lib/auth",
  );
  return {
    ...actual,
    requireUser: vi.fn(async () => activeUser),
    getCurrentUser: vi.fn(async () => activeUser),
  };
});

describe("tenant data isolation", () => {
  beforeAll(async () => {
    const timestamp = Date.now();

    const alphaUser = await prisma.user.create({
      data: {
        email: `alpha-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Alpha User",
      },
    });

    const betaUser = await prisma.user.create({
      data: {
        email: `beta-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Beta User",
      },
    });

    await prisma.companySettings.create({
      data: {
        userId: alphaUser.id,
        companyName: `Alpha Company ${timestamp}`,
        defaultCurrency: "EUR",
        defaultVatRate: 19,
        invoiceNumberPrefix: "FAC",
        quoteNumberPrefix: "DEV",
        taxConfiguration:
          DEFAULT_TAX_CONFIGURATION as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.companySettings.create({
      data: {
        userId: betaUser.id,
        companyName: `Beta Company ${timestamp}`,
        defaultCurrency: "USD",
        defaultVatRate: 19,
        invoiceNumberPrefix: "FAC",
        quoteNumberPrefix: "DEV",
        taxConfiguration:
          DEFAULT_TAX_CONFIGURATION as unknown as Prisma.InputJsonValue,
      },
    });

    const alphaClient = await prisma.client.create({
      data: {
        displayName: `Alpha Client ${timestamp}`,
        email: `alpha-client-${timestamp}@example.com`,
        isActive: true,
        userId: alphaUser.id,
      },
    });

    const betaClient = await prisma.client.create({
      data: {
        displayName: `Beta Client ${timestamp}`,
        email: `beta-client-${timestamp}@example.com`,
        isActive: true,
        userId: betaUser.id,
      },
    });

    const alphaProduct = await prisma.product.create({
      data: {
        sku: `SKU-A-${timestamp}`,
        name: `Alpha Product ${timestamp}`,
        priceHTCents: 15000,
        priceTTCCents: 18000,
        vatRate: 20,
        unit: "unité",
        isActive: true,
        userId: alphaUser.id,
      },
    });

    const betaProduct = await prisma.product.create({
      data: {
        sku: `SKU-B-${timestamp}`,
        name: `Beta Product ${timestamp}`,
        priceHTCents: 20000,
        priceTTCCents: 24000,
        vatRate: 19,
        unit: "unité",
        isActive: true,
        userId: betaUser.id,
      },
    });

    const alphaQuoteNumber = `DEV-A-${timestamp}`;
    await prisma.quote.create({
      data: {
        userId: alphaUser.id,
        number: alphaQuoteNumber,
        status: QuoteStatus.ENVOYE,
        issueDate: new Date("2024-01-15T00:00:00Z"),
        validUntil: new Date("2024-02-15T00:00:00Z"),
        clientId: alphaClient.id,
        currency: "EUR",
        subtotalHTCents: 8000,
        totalDiscountCents: 0,
        totalTVACents: 1600,
        totalTTCCents: 9600,
      },
    });

    const betaQuoteNumber = `DEV-B-${timestamp}`;
    await prisma.quote.create({
      data: {
        userId: betaUser.id,
        number: betaQuoteNumber,
        status: QuoteStatus.ACCEPTE,
        issueDate: new Date("2024-01-20T00:00:00Z"),
        validUntil: new Date("2024-02-20T00:00:00Z"),
        clientId: betaClient.id,
        currency: "USD",
        subtotalHTCents: 12000,
        totalDiscountCents: 0,
        totalTVACents: 1800,
        totalTTCCents: 13800,
      },
    });

    const alphaInvoiceNumber = `FAC-A-${timestamp}`;
    await prisma.invoice.create({
      data: {
        userId: alphaUser.id,
        number: alphaInvoiceNumber,
        status: InvoiceStatus.ENVOYEE,
        issueDate: new Date("2024-03-01T00:00:00Z"),
        dueDate: new Date("2024-03-15T00:00:00Z"),
        clientId: alphaClient.id,
        currency: "EUR",
        subtotalHTCents: 15000,
        totalDiscountCents: 0,
        totalTVACents: 3000,
        totalTTCCents: 18000,
        amountPaidCents: 0,
      },
    });

    const betaInvoiceNumber = `FAC-B-${timestamp}`;
    await prisma.invoice.create({
      data: {
        userId: betaUser.id,
        number: betaInvoiceNumber,
        status: InvoiceStatus.PAYEE,
        issueDate: new Date("2024-03-05T00:00:00Z"),
        dueDate: new Date("2024-03-25T00:00:00Z"),
        clientId: betaClient.id,
        currency: "USD",
        subtotalHTCents: 22000,
        totalDiscountCents: 0,
        totalTVACents: 4400,
        totalTTCCents: 26400,
        amountPaidCents: 26400,
      },
    });

    alphaFixture = {
      user: alphaUser,
      clientId: alphaClient.id,
      clientName: alphaClient.displayName,
      productId: alphaProduct.id,
      productName: alphaProduct.name,
      invoiceNumber: alphaInvoiceNumber,
      quoteNumber: alphaQuoteNumber,
    };

    betaFixture = {
      user: betaUser,
      clientId: betaClient.id,
      clientName: betaClient.displayName,
      productId: betaProduct.id,
      productName: betaProduct.name,
      invoiceNumber: betaInvoiceNumber,
      quoteNumber: betaQuoteNumber,
    };

    activeUser = alphaUser;
  });

  beforeEach(() => {
    activeUser = alphaFixture.user;
  });

  afterAll(async () => {
    const userIds = [alphaFixture.user.id, betaFixture.user.id];

    await prisma.invoice.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.quote.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.product.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.client.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.companySettings.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.numberingSequence.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.messagingSettings.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  });

  it("returns only the active user's data for paginated listings", async () => {
    activeUser = alphaFixture.user;
    const alphaInvoices = await listInvoices({ pageSize: 10 });
    const alphaQuotes = await listQuotes({ pageSize: 10 });

    expect(alphaInvoices.total).toBe(1);
    expect(alphaInvoices.items[0]?.userId).toBe(alphaFixture.user.id);
    expect(alphaInvoices.items[0]?.number).toBe(alphaFixture.invoiceNumber);
    expect(alphaQuotes.total).toBe(1);
    expect(alphaQuotes.items[0]?.userId).toBe(alphaFixture.user.id);
    expect(alphaQuotes.items[0]?.number).toBe(alphaFixture.quoteNumber);

    activeUser = betaFixture.user;
    const betaInvoices = await listInvoices({ pageSize: 10 });
    const betaQuotes = await listQuotes({ pageSize: 10 });

    expect(betaInvoices.total).toBe(1);
    expect(betaInvoices.items[0]?.userId).toBe(betaFixture.user.id);
    expect(betaInvoices.items[0]?.number).toBe(betaFixture.invoiceNumber);
    expect(betaQuotes.total).toBe(1);
    expect(betaQuotes.items[0]?.userId).toBe(betaFixture.user.id);
    expect(betaQuotes.items[0]?.number).toBe(betaFixture.quoteNumber);
  });

  it("scopes exports to the current user only", async () => {
    activeUser = alphaFixture.user;
    const alphaInvoiceCsv = await exportInvoicesCsv();
    const alphaQuoteCsv = await exportQuotesCsv();
    const alphaProductCsv = await exportProductsCsv();
    const alphaClientCsv = await exportClientsCsv();

    expect(alphaInvoiceCsv).toContain(alphaFixture.invoiceNumber);
    expect(alphaInvoiceCsv).not.toContain(betaFixture.invoiceNumber);
    expect(alphaQuoteCsv).toContain(alphaFixture.quoteNumber);
    expect(alphaQuoteCsv).not.toContain(betaFixture.quoteNumber);
    expect(alphaProductCsv).toContain(alphaFixture.productName);
    expect(alphaProductCsv).toContain("Prix HT (EUR)");
    expect(alphaProductCsv).not.toContain(betaFixture.productName);
    expect(alphaProductCsv).not.toContain("Prix HT (USD)");
    expect(alphaClientCsv).toContain(alphaFixture.clientName);
    expect(alphaClientCsv).not.toContain(betaFixture.clientName);

    activeUser = betaFixture.user;
    const betaInvoiceCsv = await exportInvoicesCsv();
    const betaQuoteCsv = await exportQuotesCsv();
    const betaProductCsv = await exportProductsCsv();
    const betaClientCsv = await exportClientsCsv();

    expect(betaInvoiceCsv).toContain(betaFixture.invoiceNumber);
    expect(betaInvoiceCsv).not.toContain(alphaFixture.invoiceNumber);
    expect(betaQuoteCsv).toContain(betaFixture.quoteNumber);
    expect(betaQuoteCsv).not.toContain(alphaFixture.quoteNumber);
    expect(betaProductCsv).toContain(betaFixture.productName);
    expect(betaProductCsv).toContain("Prix HT (USD)");
    expect(betaProductCsv).not.toContain(alphaFixture.productName);
    expect(betaProductCsv).not.toContain("Prix HT (EUR)");
    expect(betaClientCsv).toContain(betaFixture.clientName);
    expect(betaClientCsv).not.toContain(alphaFixture.clientName);
  });
});
