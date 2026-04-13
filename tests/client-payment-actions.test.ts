import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(readonly href: string) {
    super(href);
  }
}

const redirectMock = vi.fn((href: string) => {
  throw new RedirectSignal(String(href));
});
const revalidatePathMock = vi.fn();
const requireAccountPermissionMock = vi.fn();
const createClientPaymentMock = vi.fn();
const deleteClientPaymentMock = vi.fn();
const revalidateClientPaymentDataMock = vi.fn();
const getSettingsMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/server/clients", () => ({
  clientSchema: {
    parse: vi.fn((value) => value),
  },
  createClient: vi.fn(),
  deleteClient: vi.fn(),
  getClientTenantId: vi.fn(
    (user: { activeTenantId?: string | null; tenantId?: string | null; id: string }) =>
      user.activeTenantId ?? user.tenantId ?? user.id,
  ),
  revalidateClientFilters: vi.fn(),
  updateClient: vi.fn(),
}));

vi.mock("@/server/quotes", () => ({
  revalidateQuoteFilterClients: vi.fn(),
}));

vi.mock("@/lib/next", () => ({
  isRedirectError: vi.fn((error: unknown) => error instanceof RedirectSignal),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/server/client-payments", () => ({
  createClientPayment: createClientPaymentMock,
  createClientService: vi.fn(),
  deleteClientPayment: deleteClientPaymentMock,
  deleteClientService: vi.fn(),
  revalidateClientPaymentData: revalidateClientPaymentDataMock,
  revalidatePaymentServiceCatalog: vi.fn(),
  updateClientService: vi.fn(),
}));

vi.mock("@/server/accounts", () => ({
  createAccountInvitation: vi.fn(),
}));

vi.mock("@/server/messaging", () => ({
  getMessagingSettingsSummary: vi.fn(),
}));

vi.mock("@/server/settings", () => ({
  getSettings: getSettingsMock,
}));

vi.mock("@/server/document-email-jobs", () => ({
  queueReceiptEmailJob: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  requireAccountPermission: requireAccountPermissionMock,
}));

class MockAuthorizationError extends Error {}

vi.mock("@/lib/errors", () => ({
  AuthorizationError: MockAuthorizationError,
}));

vi.mock("@/lib/money", () => ({
  toCents: vi.fn((amount: number) => Math.round(amount * 100)),
}));

describe("client payment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAccountPermissionMock.mockResolvedValue({
      id: "user-1",
      activeTenantId: "tenant-1",
      tenantId: "tenant-parent",
    });
    getSettingsMock.mockResolvedValue({
      defaultCurrency: "TND",
    });
    createClientPaymentMock.mockResolvedValue({
      id: "payment-1",
    });
    deleteClientPaymentMock.mockResolvedValue(undefined);
  });

  it("preserves the filtered payments view when creating a payment from the payments section", async () => {
    const { createClientPaymentAction } = await import(
      "@/app/(app)/clients/actions"
    );

    const formData = new FormData();
    formData.set("clientId", "client-123");
    formData.set("amount", "180");
    formData.set("currency", "TND");
    formData.set("date", "2026-03-19");
    formData.set("method", "Virement bancaire");
    formData.set("reference", "VIR-2026-900");
    formData.set("description", "Paiement depuis /paiements");
    formData.set("note", "Merci");
    formData.set("privateNote", "Suivi interne");
    formData.set(
      "redirectTo",
      "/paiements?client=client-123&recherche=vip&du=2026-03-01&au=2026-03-31&page=2",
    );
    formData.append("clientServiceIds", "service-a");
    formData.append("clientServiceIds", "service-b");

    await expect(createClientPaymentAction(formData)).rejects.toMatchObject({
      href: expect.any(String),
    });

    expect(createClientPaymentMock).toHaveBeenCalledWith(
      {
        clientId: "client-123",
        amount: 180,
        currency: "TND",
        date: new Date("2026-03-19"),
        method: "Virement bancaire",
        reference: "VIR-2026-900",
        description: "Paiement depuis /paiements",
        note: "Merci",
        privateNote: "Suivi interne",
        serviceLinks: [
          {
            clientServiceId: "service-a",
            position: 0,
          },
          {
            clientServiceId: "service-b",
            position: 1,
          },
        ],
      },
      "tenant-1",
    );
    expect(revalidateClientPaymentDataMock).toHaveBeenCalledWith("tenant-1", {
      paymentId: "payment-1",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledOnce();

    const redirectHref = String(redirectMock.mock.calls[0]?.[0] ?? "");
    const redirectUrl = new URL(`https://example.com${redirectHref}`);

    expect(redirectUrl.pathname).toBe("/paiements");
    expect(redirectUrl.searchParams.get("client")).toBe("client-123");
    expect(redirectUrl.searchParams.get("recherche")).toBe("vip");
    expect(redirectUrl.searchParams.get("du")).toBe("2026-03-01");
    expect(redirectUrl.searchParams.get("au")).toBe("2026-03-31");
    expect(redirectUrl.searchParams.get("page")).toBe("2");
    expect(redirectUrl.searchParams.get("message")).toBe(
      "Paiement client enregistré",
    );
  });

  it("preserves the filtered payments view when deleting a payment from the detail page", async () => {
    const { deleteClientPaymentAction } = await import(
      "@/app/(app)/clients/actions"
    );

    const formData = new FormData();
    formData.set(
      "redirectTo",
      "/paiements?client=client-123&recherche=vip&du=2026-03-01&au=2026-03-31&page=2",
    );

    await expect(
      deleteClientPaymentAction("payment-9", "client-123", formData),
    ).rejects.toMatchObject({
      href: expect.any(String),
    });

    expect(deleteClientPaymentMock).toHaveBeenCalledWith("payment-9", "tenant-1");
    expect(revalidateClientPaymentDataMock).toHaveBeenCalledWith("tenant-1", {
      paymentId: "payment-9",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();

    const redirectHref = String(redirectMock.mock.calls[0]?.[0] ?? "");
    const redirectUrl = new URL(`https://example.com${redirectHref}`);

    expect(redirectUrl.pathname).toBe("/paiements");
    expect(redirectUrl.searchParams.get("client")).toBe("client-123");
    expect(redirectUrl.searchParams.get("recherche")).toBe("vip");
    expect(redirectUrl.searchParams.get("du")).toBe("2026-03-01");
    expect(redirectUrl.searchParams.get("au")).toBe("2026-03-31");
    expect(redirectUrl.searchParams.get("page")).toBe("2");
    expect(redirectUrl.searchParams.get("message")).toBe(
      "Paiement client supprimé",
    );
  });

  it("rejects payment creation when the service link is missing", async () => {
    const { createClientPaymentInlineAction } = await import(
      "@/app/(app)/clients/actions"
    );

    const formData = new FormData();
    formData.set("clientId", "client-123");
    formData.set("amount", "180");
    formData.set("currency", "TND");
    formData.set("date", "2026-03-19");
    formData.set("method", "Virement bancaire");

    const result = await createClientPaymentInlineAction(formData);

    expect(result).toMatchObject({
      status: "error",
      message: "Sélectionnez au moins un service à lier au paiement.",
    });
    expect(createClientPaymentMock).not.toHaveBeenCalled();
  });

  it("rejects duplicated service links before creating the payment", async () => {
    const { createClientPaymentInlineAction } = await import(
      "@/app/(app)/clients/actions"
    );

    const formData = new FormData();
    formData.set("clientId", "client-123");
    formData.set("amount", "180");
    formData.set("currency", "TND");
    formData.set("date", "2026-03-19");
    formData.set("method", "Virement bancaire");
    formData.append("clientServiceIds", "service-a");
    formData.append("clientServiceIds", "service-a");

    const result = await createClientPaymentInlineAction(formData);

    expect(result).toMatchObject({
      status: "error",
      message: "Un service ne peut pas être lié plusieurs fois au même paiement.",
    });
    expect(createClientPaymentMock).not.toHaveBeenCalled();
  });
});
