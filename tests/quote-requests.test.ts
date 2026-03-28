import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  convertQuoteRequestToQuote,
  createQuoteRequest,
  quoteRequestInputSchema,
} from "@/server/quote-requests";
import {
  ProductSaleMode,
  QuoteRequestStatus,
  QuoteStatus,
  type User,
} from "@prisma/client";
import type { CatalogPayload } from "@/server/website";
import {
  getCatalogPayloadByDomain,
  getCatalogPayloadBySlug,
  resolveCatalogMetadata,
} from "@/server/website";
import { generateMetadata } from "@/app/catalogue/[[...segments]]/page";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

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

vi.mock("@/server/website", async () => {
  const actual = await vi.importActual<typeof import("@/server/website")>(
    "@/server/website",
  );
  return {
    ...actual,
    getCatalogPayloadByDomain: vi.fn(),
    getCatalogPayloadBySlug: vi.fn(),
    resolveCatalogMetadata: vi.fn(),
  };
});

const getCatalogPayloadByDomainMock = vi.mocked(getCatalogPayloadByDomain);
const getCatalogPayloadBySlugMock = vi.mocked(getCatalogPayloadBySlug);
const resolveCatalogMetadataMock = vi.mocked(resolveCatalogMetadata);

describeWithDb("quote requests", () => {
  let user: User;
  let productId: string;
  let productName: string;
  let productUnit: string;
  let productPrice: number;
  let productVat: number;
  let productDiscount: number | null;

  beforeAll(async () => {
    const timestamp = Date.now();
    user = await prisma.user.create({
      data: {
        email: `quote-requests-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Quote Request User",
      },
    });

    productName = "Quote Product";
    productUnit = "unit";
    productPrice = 20000;
    productVat = 19;
    productDiscount = 5;

    const product = await prisma.product.create({
      data: {
        userId: user.id,
        sku: `SKU-QUOTE-${timestamp}`,
        name: productName,
        publicSlug: `quote-product-${timestamp}`,
        saleMode: ProductSaleMode.QUOTE,
        priceHTCents: productPrice,
        priceTTCCents: Math.round(productPrice * (1 + productVat / 100)),
        vatRate: productVat,
        unit: productUnit,
        defaultDiscountRate: productDiscount,
        isActive: true,
      },
    });

    productId = product.id;
  });

  afterAll(async () => {
    await prisma.quoteRequest.deleteMany({ where: { userId: user.id } });
    await prisma.quote.deleteMany({ where: { userId: user.id } });
    await prisma.client.deleteMany({ where: { userId: user.id } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.numberingSequence.deleteMany({ where: { userId: user.id } });
    await prisma.companySettings.deleteMany({ where: { userId: user.id } });
    await prisma.messagingSettings.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates email address on input schema", () => {
    const result = quoteRequestInputSchema.safeParse({
      customer: { name: "Test", email: "not-an-email" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("E-mail invalide");
    }
  });

  it("rejects invalid attachment URLs on input schema", () => {
    const result = quoteRequestInputSchema.safeParse({
      customer: { name: "Test", email: "test@example.com" },
      attachments: [{ fileName: "brief.pdf", fileUrl: "not-a-url" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("URL invalide");
    }
  });

  it("rejects non-object form data on input schema", () => {
    const result = quoteRequestInputSchema.safeParse({
      customer: { name: "Test", email: "test@example.com" },
      formData: "not-json",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "formData"),
      ).toBe(true);
    }
  });

  it("converts a quote request into a quote", async () => {
    const request = await createQuoteRequest(
      {
        productId,
        customer: {
          name: "Prospect Name",
          email: "Prospect@Example.com",
          phone: null,
          company: "Prospect Co",
          address: null,
        },
        message: "Need a custom quote",
        formData: { budget: "2000" },
        sourcePath: "/catalogue/service",
      },
      user.id,
    );

    expect(request.status).toBe(QuoteRequestStatus.NEW);
    expect(request.customerEmail).toBe("prospect@example.com");

    const quote = await convertQuoteRequestToQuote(request.id, user.id);

    expect(quote.status).toBe(QuoteStatus.BROUILLON);
    expect(quote.clientId).toBe(request.clientId);
    expect(quote.currency).toBe("TND");
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]).toMatchObject({
      productId,
      description: productName,
      unit: productUnit,
      unitPriceHTCents: productPrice,
      vatRate: productVat,
      discountRate: productDiscount,
    });

    const updated = await prisma.quoteRequest.findUnique({
      where: { id: request.id },
    });

    expect(updated?.status).toBe(QuoteRequestStatus.CONVERTED);
    expect(updated?.quoteId).toBe(quote.id);
  });
});

describe("catalog routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the domain search param to resolve metadata", async () => {
    const payload = {
      website: {
        contact: { companyName: "Test Co" },
      },
    } as unknown as CatalogPayload;

    getCatalogPayloadByDomainMock.mockResolvedValue(payload);
    resolveCatalogMetadataMock.mockReturnValue({
      title: "Catalog Title",
      description: "Catalog Description",
      canonicalUrl: "https://example.com/catalog",
      socialImageUrl: null,
      keywords: null,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ segments: ["site-slug", "extra"] }),
      searchParams: Promise.resolve({
        domain: "shop.example.com",
        path: "/checkout",
      }),
    });

    expect(getCatalogPayloadByDomainMock).toHaveBeenCalledWith(
      "shop.example.com",
      "/checkout",
    );
    expect(getCatalogPayloadBySlugMock).not.toHaveBeenCalled();
    expect(resolveCatalogMetadataMock).toHaveBeenCalledWith({
      payload,
      path: "/checkout",
    });
    expect(metadata.title).toBe("Catalog Title");
    expect(metadata.alternates?.canonical).toBe("https://example.com/catalog");
    expect(metadata.openGraph?.siteName).toBe("Test Co");
  });
});
