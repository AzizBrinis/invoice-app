import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTagMock, updateTagMock } = vi.hoisted(() => ({
  revalidateTagMock: vi.fn(),
  updateTagMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
  updateTag: updateTagMock,
}));

import { refreshTagForMutation } from "@/lib/cache-invalidation";

describe("cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses updateTag to give server actions read-your-own-writes", () => {
    refreshTagForMutation("client-payments:services:tenant-1");

    expect(updateTagMock).toHaveBeenCalledWith(
      "client-payments:services:tenant-1",
    );
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("falls back to revalidateTag outside server actions", () => {
    updateTagMock.mockImplementationOnce(() => {
      throw new Error(
        "updateTag can only be called from within a Server Action. See more info here.",
      );
    });

    refreshTagForMutation("client-payments:services:tenant-1");

    expect(updateTagMock).toHaveBeenCalledWith(
      "client-payments:services:tenant-1",
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "client-payments:services:tenant-1",
      "max",
    );
  });

  it("rethrows unexpected updateTag failures", () => {
    updateTagMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    expect(() => refreshTagForMutation("client-payments:services:tenant-1")).toThrow(
      "boom",
    );
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
