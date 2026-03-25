import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("client payment cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates payment collection tags with read-your-own-writes semantics", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");

    try {
      const { revalidateClientPaymentData } = await import(
        "@/server/client-payments"
      );

      revalidateClientPaymentData("tenant-1", { paymentId: "payment-1" });

      expect(updateTagMock).toHaveBeenCalledWith(
        "client-payments:collection:tenant-1",
      );
      expect(updateTagMock).toHaveBeenCalledWith(
        "client-payments:summary:tenant-1",
      );
      expect(updateTagMock).toHaveBeenCalledWith(
        "client-payments:dashboard:tenant-1",
      );
      expect(updateTagMock).toHaveBeenCalledWith(
        "client-payments:detail:tenant-1:payment-1",
      );
      expect(revalidateTagMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
