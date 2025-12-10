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
  const context = { userId: "user_1", conversationId: "conv_1" };
  const baseInput = {
    sku: "SRV-001",
    name: "Maintenance Serveur",
    unit: "heure",
    unitPrice: 120,
    vatRate: 19,
    category: "Services",
  };

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

    const result = await tool!.handler(baseInput as any, context);

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
    createProductMock.mockResolvedValue({
      id: "prod_new",
      ...baseInput,
      priceHTCents: priceHT,
      priceTTCCents: Math.round(priceHT * 1.19),
      createdAt: new Date("2024-04-01T00:00:00.000Z"),
      updatedAt: new Date("2024-04-01T00:00:00.000Z"),
      currency: "TND",
    } as any);

    const tool = getToolByName("create_product");
    expect(tool).toBeTruthy();

    const result = await tool!.handler(baseInput as any, context);

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
    createProductMock.mockImplementation(async (payload: any) => ({
      id: "prod_new",
      ...payload,
      createdAt: new Date("2024-04-01T00:00:00.000Z"),
      updatedAt: new Date("2024-04-01T00:00:00.000Z"),
    }));

    const tool = getToolByName("create_product");
    expect(tool).toBeTruthy();

    const result = await tool!.handler(baseInput as any, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({ productId: "prod_new" }),
    );
    expect(createProductMock).toHaveBeenCalledTimes(1);
  });
});
