import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAppSectionAccessMock = vi.fn();
const getSettingsMock = vi.fn();
const updateSettingsMock = vi.fn();
const revalidateSettingsMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    companySettings: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authorization", () => ({
  isClientPaymentsAccount: vi.fn(() => true),
  requireAppSectionAccess: requireAppSectionAccessMock,
}));

vi.mock("@/server/clients", () => ({
  getClientTenantId: vi.fn(
    (user: { activeTenantId?: string | null; tenantId?: string | null; id: string }) =>
      user.activeTenantId ?? user.tenantId ?? user.id,
  ),
}));

vi.mock("@/server/settings", async () => {
  const actual = await vi.importActual<typeof import("@/server/settings")>(
    "@/server/settings",
  );

  return {
    ...actual,
    getSettings: getSettingsMock,
    revalidateSettings: revalidateSettingsMock,
    updateSettings: updateSettingsMock,
  };
});

function buildCurrentSettings() {
  return {
    companyName: "Compte paiements",
    logoUrl: null,
    logoData: null,
    matriculeFiscal: null,
    tvaNumber: null,
    address: "Tunis",
    email: "contact@example.com",
    phone: "+21670000000",
    iban: null,
    stampImage: null,
    signatureImage: null,
    stampPosition: "bottom-right",
    signaturePosition: "bottom-right",
    defaultCurrency: "TND",
    defaultVatRate: 20,
    paymentTerms: null,
    clientPaymentMethods: [
      "Espèces / Cash",
      "Chèque",
      "Virement bancaire",
      "Carte bancaire",
    ],
    invoiceNumberPrefix: "FAC",
    quoteNumberPrefix: "DEV",
    resetNumberingAnnually: true,
    defaultInvoiceFooter: null,
    defaultQuoteFooter: null,
    legalFooter: null,
    defaultConditions: null,
    invoiceTemplateId: null,
    quoteTemplateId: null,
    taxConfiguration: undefined,
  };
}

describe("client payment settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    requireAppSectionAccessMock.mockResolvedValue({
      id: "user-1",
      activeTenantId: "tenant-1",
      tenantId: "tenant-parent",
    });
    getSettingsMock.mockResolvedValue(buildCurrentSettings());
    updateSettingsMock.mockResolvedValue(buildCurrentSettings());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a normalized configurable payment method list", async () => {
    const { updateClientPaymentSettingsInlineAction } = await import(
      "@/app/(app)/parametres/actions"
    );

    const formData = new FormData();
    formData.set("companyName", "Compte paiements");
    formData.set("defaultCurrency", "TND");
    formData.set("legalFooter", "Merci pour votre paiement.");
    formData.append("clientPaymentMethods", "  Espèces / Cash ");
    formData.append("clientPaymentMethods", "");
    formData.append("clientPaymentMethods", "Paiement mobile");
    formData.append("clientPaymentMethods", "espèces / cash");

    const result = await updateClientPaymentSettingsInlineAction({}, formData);

    expect(updateSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Compte paiements",
        defaultCurrency: "TND",
        legalFooter: "Merci pour votre paiement.",
        clientPaymentMethods: ["Espèces / Cash", "Paiement mobile"],
      }),
      "tenant-1",
    );
    expect(revalidateSettingsMock).toHaveBeenCalledWith("tenant-1");
    expect(result).toEqual({
      status: "success",
      message: "Paramètres des paiements enregistrés",
    });
  });

  it("returns a clean validation error when no payment method remains", async () => {
    const { updateClientPaymentSettingsInlineAction } = await import(
      "@/app/(app)/parametres/actions"
    );

    const formData = new FormData();
    formData.set("companyName", "Compte paiements");
    formData.set("defaultCurrency", "TND");
    formData.append("clientPaymentMethods", "   ");

    const result = await updateClientPaymentSettingsInlineAction({}, formData);

    expect(updateSettingsMock).not.toHaveBeenCalled();
    expect(revalidateSettingsMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "error",
      message: "Ajoutez au moins un mode de paiement.",
    });
  });
});
