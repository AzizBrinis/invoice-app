import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
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

vi.mock("@/lib/db", () => ({
  prisma: {
    companySettings: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe("settings cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates settings tags with read-your-own-writes semantics", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");

    try {
      const { revalidateSettings } = await import("@/server/settings");

      revalidateSettings("tenant-1");

      expect(updateTagMock).toHaveBeenCalledWith("settings:tenant-1");
      expect(revalidateTagMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
