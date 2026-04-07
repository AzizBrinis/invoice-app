import { Prisma, ProductSaleMode } from "@prisma/client";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { toCents } from "@/lib/money";
import { getToolByName } from "@/server/assistant/tools";
import { searchProductsForAssistant } from "@/server/assistant/search";
import { createProduct } from "@/server/products";

vi.mock("@/server/assistant/audit", () => ({
  logAiAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/server/assistant/search", async () => {
  const actual = await vi.importActual<typeof import("@/server/assistant/search")>(
    "@/server/assistant/search",
  );
  return {
    ...actual,
    searchProductsForAssistant: vi.fn(),
  };
});

vi.mock("@/server/products", () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

describe("assistant create_product tool", () => {
  type CreatedProduct = Awaited<ReturnType<typeof createProduct>>;
  type CreateProductInput = Parameters<typeof createProduct>[0];

  const context = { userId: "user_1", conversationId: "conv_1" };
  const baseInput = {
    sku: "SRV-001",
    name: "Maintenance Serveur",
    unit: "heure",
    unitPrice: 120,
    vatRate: 19,
    category: "Services",
  };
  const defaultCreatedAt = new Date("2024-04-01T00:00:00.000Z");

  function toJsonValue(value: unknown): Prisma.JsonValue {
    return (value ?? null) as Prisma.JsonValue;
  }

  function buildCreateProductInput(
    overrides: Partial<CreateProductInput> = {},
  ): CreateProductInput {
    const priceHTCents =
      overrides.priceHTCents ?? toCents(baseInput.unitPrice, "TND");

    return {
      sku: overrides.sku ?? baseInput.sku,
      name: overrides.name ?? baseInput.name,
      publicSlug: overrides.publicSlug,
      saleMode: overrides.saleMode ?? ProductSaleMode.INSTANT,
      description: overrides.description ?? null,
      descriptionHtml: overrides.descriptionHtml ?? null,
      shortDescriptionHtml: overrides.shortDescriptionHtml ?? null,
      excerpt: overrides.excerpt ?? null,
      metaTitle: overrides.metaTitle ?? null,
      metaDescription: overrides.metaDescription ?? null,
      coverImageUrl: overrides.coverImageUrl ?? null,
      gallery: overrides.gallery ?? null,
      faqItems: overrides.faqItems ?? null,
      quoteFormSchema: overrides.quoteFormSchema ?? null,
      optionConfig: overrides.optionConfig ?? null,
      variantStock: overrides.variantStock ?? null,
      category: overrides.category ?? baseInput.category,
      unit: overrides.unit ?? baseInput.unit,
      stockQuantity: overrides.stockQuantity ?? null,
      priceHTCents,
      priceTTCCents: overrides.priceTTCCents ?? Math.round(priceHTCents * 1.19),
      vatRate: overrides.vatRate ?? baseInput.vatRate,
      defaultDiscountRate: overrides.defaultDiscountRate ?? null,
      defaultDiscountAmountCents:
        overrides.defaultDiscountAmountCents ?? null,
      isActive: overrides.isActive ?? true,
      isListedInCatalog: overrides.isListedInCatalog ?? true,
      id: overrides.id,
    };
  }

  function buildCreatedProduct(
    input: CreateProductInput,
    overrides: Partial<CreatedProduct> = {},
  ): CreatedProduct {
    return {
      id: overrides.id ?? input.id ?? "prod_new",
      userId: overrides.userId ?? context.userId,
      sku: overrides.sku ?? input.sku,
      name: overrides.name ?? input.name,
      publicSlug:
        overrides.publicSlug ??
        input.publicSlug ??
        `${input.sku.toLowerCase()}-slug`,
      saleMode: overrides.saleMode ?? input.saleMode,
      description: overrides.description ?? input.description ?? null,
      descriptionHtml:
        overrides.descriptionHtml ?? input.descriptionHtml ?? null,
      shortDescriptionHtml:
        overrides.shortDescriptionHtml ?? input.shortDescriptionHtml ?? null,
      excerpt: overrides.excerpt ?? input.excerpt ?? null,
      metaTitle: overrides.metaTitle ?? input.metaTitle ?? null,
      metaDescription:
        overrides.metaDescription ?? input.metaDescription ?? null,
      coverImageUrl: overrides.coverImageUrl ?? input.coverImageUrl ?? null,
      gallery: toJsonValue(overrides.gallery ?? input.gallery),
      faqItems: toJsonValue(overrides.faqItems ?? input.faqItems),
      quoteFormSchema:
        toJsonValue(overrides.quoteFormSchema ?? input.quoteFormSchema),
      optionConfig: toJsonValue(overrides.optionConfig ?? input.optionConfig),
      variantStock: toJsonValue(overrides.variantStock ?? input.variantStock),
      category: overrides.category ?? input.category ?? null,
      unit: overrides.unit ?? input.unit,
      stockQuantity: overrides.stockQuantity ?? input.stockQuantity ?? null,
      priceHTCents: overrides.priceHTCents ?? input.priceHTCents,
      priceTTCCents: overrides.priceTTCCents ?? input.priceTTCCents,
      vatRate: overrides.vatRate ?? input.vatRate,
      defaultDiscountRate:
        overrides.defaultDiscountRate ?? input.defaultDiscountRate ?? null,
      defaultDiscountAmountCents:
        overrides.defaultDiscountAmountCents ??
        input.defaultDiscountAmountCents ??
        null,
      isActive: overrides.isActive ?? input.isActive,
      isListedInCatalog:
        overrides.isListedInCatalog ?? input.isListedInCatalog,
      createdAt: overrides.createdAt ?? defaultCreatedAt,
      updatedAt: overrides.updatedAt ?? defaultCreatedAt,
    };
  }

  const searchProductsMock = vi.mocked(searchProductsForAssistant);
  const createProductMock = vi.mocked(createProduct);

  beforeAll(() => {
    if (!process.env.TEST_DATABASE_URL) {
      vi.stubEnv(
        "TEST_DATABASE_URL",
        "postgresql://stub:stub@localhost:5432/testdb",
      );
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    searchProductsMock.mockReset();
    createProductMock.mockReset();
  });

  it("reuses an existing product when a strong match is found", async () => {
    const priceHT = toCents(baseInput.unitPrice, "TND");
    searchProductsMock.mockResolvedValue({
      hasExactMatch: true,
      bestConfidence: 0.92,
      matches: [
        {
          id: "prod_existing",
          name: "Maintenance Serveur",
          sku: "SRV-001",
          description: "Support",
          category: "Services",
          unit: "heure",
          priceHTCents: priceHT,
          priceTTCCents: Math.round(priceHT * 1.19),
          vatRate: 19,
          defaultDiscountRate: null,
          isActive: true,
          isListedInCatalog: true,
          updatedAt: new Date("2024-01-01T00:00:00.000Z"),
          currency: "TND",
          confidence: 0.92,
          matchFields: ["sku", "price"],
        },
      ],
    });

    const tool = getToolByName("create_product");
    expect(tool).toBeTruthy();

    const result = await tool!.handler(baseInput, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({ productId: "prod_existing" }),
    );
    expect(result.summary.toLowerCase()).toContain("réutilisé");
    expect(createProductMock).not.toHaveBeenCalled();
  });

  it("creates a new product when the closest match does not share the requested identity", async () => {
    const priceHT = toCents(baseInput.unitPrice, "TND");
    const lowerPriceHT = Math.max(1, Math.round(priceHT * 0.8));
    searchProductsMock.mockResolvedValue({
      hasExactMatch: true,
      bestConfidence: 0.95,
      matches: [
        {
          id: "prod_other",
          name: "Design Interface UX",
          sku: "UX-650",
          description: "UI design",
          category: "Services",
          unit: "jour",
          priceHTCents: lowerPriceHT,
          priceTTCCents: Math.round(lowerPriceHT * 1.19),
          vatRate: 19,
          defaultDiscountRate: null,
          isActive: true,
          isListedInCatalog: true,
          updatedAt: new Date("2024-02-01T00:00:00.000Z"),
          currency: "TND",
          confidence: 0.95,
          matchFields: ["name"],
        },
      ],
    });
    const createPayload = buildCreateProductInput({
      priceHTCents: priceHT,
      priceTTCCents: Math.round(priceHT * 1.19),
    });
    createProductMock.mockResolvedValue(
      buildCreatedProduct(createPayload, {
        id: "prod_new",
      }),
    );

    const tool = getToolByName("create_product");
    expect(tool).toBeTruthy();

    const result = await tool!.handler(baseInput, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({ productId: "prod_new" }),
    );
    expect(result.summary.toLowerCase()).not.toContain("réutilisé");
    expect(createProductMock).toHaveBeenCalledTimes(1);
  });

  it("creates a product when no reasonable match exists", async () => {
    searchProductsMock.mockResolvedValue({
      hasExactMatch: false,
      bestConfidence: 0.2,
      matches: [],
    });
    createProductMock.mockImplementation(async (payload: CreateProductInput) =>
      buildCreatedProduct(payload, {
        id: "prod_new",
      }),
    );

    const tool = getToolByName("create_product");
    expect(tool).toBeTruthy();

    const result = await tool!.handler(baseInput, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({ productId: "prod_new" }),
    );
    expect(createProductMock).toHaveBeenCalledTimes(1);
  });
});
