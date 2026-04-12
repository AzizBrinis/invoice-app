import { beforeEach, describe, expect, it, vi } from "vitest";

const executeStatementMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/postgres", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/postgres")>(
    "@/lib/db/postgres",
  );
  return {
    ...actual,
    executeStatement: executeStatementMock,
  };
});

describe("quote product search", () => {
  beforeEach(() => {
    executeStatementMock.mockReset();
  });

  it("uses a narrow tenant-scoped active-product lookup", async () => {
    executeStatementMock.mockResolvedValueOnce([
      {
        id: "product_1",
        name: "Audit SEO",
        priceHTCents: 100000,
        vatRate: 20,
        unit: "forfait",
        defaultDiscountRate: null,
        defaultDiscountAmountCents: null,
      },
    ]);

    const { searchQuoteProducts } = await import("@/server/quotes");
    const items = await searchQuoteProducts("tenant_1", "seo", 200);

    expect(items).toHaveLength(1);
    expect(executeStatementMock).toHaveBeenCalledOnce();

    const [sql, values] = executeStatementMock.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('FROM public."Product"');
    expect(sql).toContain('"userId" = $1');
    expect(sql).toContain('"isActive" = TRUE');
    expect(sql).toContain('"name" ILIKE $2 OR "sku" ILIKE $2');
    expect(sql).not.toContain("SELECT *");
    expect(values).toEqual(["tenant_1", "%seo%", "seo%", 50]);
  });

  it("keeps the empty search path simple and capped", async () => {
    executeStatementMock.mockResolvedValueOnce([]);

    const { searchQuoteProducts } = await import("@/server/quotes");
    const items = await searchQuoteProducts("tenant_2", "   ", 0);

    expect(items).toEqual([]);
    const [sql, values] = executeStatementMock.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).not.toContain("ILIKE");
    expect(values).toEqual(["tenant_2", 20]);
  });
});
