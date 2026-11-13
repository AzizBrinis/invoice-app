import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";
import { INITIAL_PRODUCT_FORM_STATE } from "@/app/(app)/produits/form-state";
import { createProductAction, submitProductFormAction, updateProductAction } from "@/app/(app)/produits/actions";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), settings: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { product: {
  create: mocks.create, update: mocks.update, findFirst: mocks.findFirst,
} } }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "tenant-1" }) }));
vi.mock("@/lib/authorization", () => ({ requireAppSectionAccess: vi.fn() }));
vi.mock("@/server/settings", () => ({ getSettingsDocumentDefaults: mocks.settings }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => {
  throw Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;replace;/produits;307;" });
}) }));

function form() {
  const data = new FormData();
  Object.entries({
    sku: "TTC-001", name: "Produit TTC", publicSlug: "produit-ttc", unit: "unité",
    priceBasis: "TTC", priceTTC: "119.000", priceHT: "999.999", vatRate: "19",
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("product TTC server actions and persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.mockResolvedValue({ defaultCurrency: "TND", taxConfiguration: DEFAULT_TAX_CONFIGURATION });
    mocks.findFirst.mockResolvedValue({ id: "product-1", userId: "tenant-1", publicSlug: "produit-ttc", vatRate: 19 });
    mocks.create.mockImplementation(async ({ data }) => ({ ...data, id: "product-1" }));
    mocks.update.mockImplementation(async ({ data }) => ({ ...data, id: "product-1" }));
  });

  it.each(["create", "edit"])("persists calculated HT and exact TTC through the %s form", async (flow) => {
    const data = form();
    if (flow === "edit") data.set("productId", "product-1");
    const result = await submitProductFormAction(INITIAL_PRODUCT_FORM_STATE, data);
    expect(result.status).toBe("success");
    const write = flow === "edit" ? mocks.update : mocks.create;
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      userId: "tenant-1", priceHTCents: 100000, priceTTCCents: 119000, vatRate: 19,
    }) }));
  });

  it("retains a stored TTC that cannot round-trip via rounded HT", async () => {
    const data = form();
    data.set("productId", "product-1");
    data.set("priceTTC", "0.003");
    const result = await submitProductFormAction(INITIAL_PRODUCT_FORM_STATE, data);
    expect(result.status).toBe("success");
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ priceHTCents: 3, priceTTCCents: 3 });
  });

  it("preserves an existing rate after settings change, using the tenant-scoped product lookup", async () => {
    mocks.findFirst.mockResolvedValue({ id: "product-1", publicSlug: "produit-ttc", vatRate: 20 });
    const data = form();
    data.set("productId", "product-1");
    data.set("vatRate", "20");
    data.set("priceTTC", "120.000");
    expect((await submitProductFormAction(INITIAL_PRODUCT_FORM_STATE, data)).status).toBe("success");
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "product-1", userId: "tenant-1" } });
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ priceHTCents: 100000, priceTTCCents: 120000, vatRate: 20 });
  });

  it.each(["create", "edit"])("supports TTC in the legacy %s action", async (flow) => {
    const run = flow === "create" ? createProductAction(form()) : updateProductAction("product-1", form());
    await expect(run).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect((flow === "create" ? mocks.create : mocks.update).mock.calls[0][0].data).toMatchObject({
      priceHTCents: 100000, priceTTCCents: 119000,
    });
  });

  it("preserves HT submissions and discounts", async () => {
    const data = form();
    data.delete("priceBasis");
    data.set("priceHT", "100.001");
    data.set("defaultDiscountType", "fixed");
    data.set("defaultDiscountValue", "5.125");
    expect((await submitProductFormAction(INITIAL_PRODUCT_FORM_STATE, data)).status).toBe("success");
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      priceHTCents: 100001, priceTTCCents: 119001, defaultDiscountAmountCents: 5125,
    });
  });

  it.each([
    ["priceTTC", "", "priceTTCCents"], ["priceTTC", "-1", "priceTTCCents"],
    ["priceTTC", "1.0001", "priceTTCCents"], ["priceTTC", "Infinity", "priceTTCCents"],
    ["priceTTC", "2147483.648", "priceTTCCents"], ["vatRate", "20", "vatRate"],
    ["vatRate", "", "vatRate"], ["priceBasis", "invalid", "priceBasis"],
  ])("rejects %s=%s before writing", async (field, value, errorField) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const data = form();
      data.set(field, value);
      const result = await submitProductFormAction(INITIAL_PRODUCT_FORM_STATE, data);
      expect(result.status).toBe("error");
      expect(result.fieldErrors?.[errorField]).toBeTruthy();
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
