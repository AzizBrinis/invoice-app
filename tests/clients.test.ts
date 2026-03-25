import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const findManyMock = vi.fn();
const countMock = vi.fn();
const findFirstMock = vi.fn();
const { revalidateTagMock, unstableCacheMock, updateTagMock } = vi.hoisted(() => ({
  revalidateTagMock: vi.fn(),
  unstableCacheMock: vi.fn((fn: () => unknown) => fn),
  updateTagMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
  unstable_cache: unstableCacheMock,
  updateTag: updateTagMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      count: countMock,
      findFirst: findFirstMock,
      findMany: findManyMock,
    },
  },
}));

describe("client helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-parent",
      activeTenantId: "tenant-active",
    });
  });

  it("uses an explicit tenant id without calling requireUser", async () => {
    const { getClient, listClientFilterOptions, listClients } = await import(
      "@/server/clients"
    );

    findManyMock
      .mockResolvedValueOnce([
        {
          id: "client-1",
          displayName: "Acme",
          companyName: "Acme SARL",
          email: "acme@example.com",
          phone: "+21670000000",
          vatNumber: "TN123",
          isActive: true,
          updatedAt: new Date("2026-03-21T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "client-1",
          displayName: "Acme",
        },
      ]);
    countMock.mockResolvedValue(1);
    findFirstMock.mockResolvedValue({
      id: "client-1",
      displayName: "Acme",
      companyName: "Acme SARL",
      address: null,
      email: "acme@example.com",
      phone: "+21670000000",
      vatNumber: "TN123",
      notes: null,
      isActive: true,
      source: "MANUAL",
      leadMetadata: null,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-21T00:00:00.000Z"),
    });

    await listClients(
      {
        search: "Acme",
        page: 1,
        pageSize: 10,
        isActive: "all",
      },
      "tenant-explicit",
    );
    await listClientFilterOptions("tenant-explicit");
    await getClient("client-1", "tenant-explicit");

    expect(requireUserMock).not.toHaveBeenCalled();
    expect(findManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "tenant-explicit",
        }),
      }),
    );
    expect(countMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "tenant-explicit",
        }),
      }),
    );
    expect(findManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "tenant-explicit",
        }),
      }),
    );
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "client-1",
          userId: "tenant-explicit",
        },
      }),
    );
  });

  it("invalidates list, filters and detail tags with read-your-own-writes semantics", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");

    const {
      revalidateClientDetail,
      revalidateClientFilters,
      revalidateClientList,
    } = await import("@/server/clients");

    try {
      revalidateClientList("tenant-active");
      revalidateClientFilters("tenant-active");
      revalidateClientDetail("tenant-active", "client-1");

      expect(updateTagMock).toHaveBeenCalledWith("clients:list:tenant-active");
      expect(updateTagMock).toHaveBeenCalledWith(
        "clients:filters:tenant-active",
      );
      expect(updateTagMock).toHaveBeenCalledWith(
        "clients:detail:tenant-active:client-1",
      );
      expect(revalidateTagMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
