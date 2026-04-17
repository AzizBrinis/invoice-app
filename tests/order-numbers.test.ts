import { describe, expect, it, vi } from "vitest";
import {
  HUMAN_ORDER_NUMBER_PATTERN,
  createWithUniqueOrderNumber,
  isHumanFriendlyOrderNumber,
  isOrderNumberUniqueConstraintViolation,
} from "@/server/order-numbers";

describe("order number helpers", () => {
  it("recognizes 6-digit human-facing order numbers", () => {
    expect(isHumanFriendlyOrderNumber("123456")).toBe(true);
    expect(isHumanFriendlyOrderNumber("012345")).toBe(true);
    expect(isHumanFriendlyOrderNumber("cmd-123456")).toBe(false);
    expect(isHumanFriendlyOrderNumber("12345")).toBe(false);
    expect(HUMAN_ORDER_NUMBER_PATTERN.test("654321")).toBe(true);
  });

  it("retries when the database reports an order-number uniqueness collision", async () => {
    const create = vi
      .fn<(orderNumber: string) => Promise<{ orderNumber: string }>>()
      .mockRejectedValueOnce({
        code: "P2002",
        meta: {
          target: ["userId", "orderNumber"],
        },
      })
      .mockImplementationOnce(async (orderNumber) => ({ orderNumber }));

    const created = await createWithUniqueOrderNumber({
      generateCandidate: vi
        .fn<() => string>()
        .mockReturnValueOnce("111111")
        .mockReturnValueOnce("222222"),
      create,
    });

    expect(created.orderNumber).toBe("222222");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map(([orderNumber]) => orderNumber)).toEqual([
      "111111",
      "222222",
    ]);
  });

  it("filters already-taken candidates before trying to create the order", async () => {
    const isAvailable = vi
      .fn<(orderNumber: string) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const create = vi.fn(async (orderNumber: string) => ({ orderNumber }));

    const created = await createWithUniqueOrderNumber({
      generateCandidate: vi
        .fn<() => string>()
        .mockReturnValueOnce("333333")
        .mockReturnValueOnce("444444"),
      isAvailable,
      create,
    });

    expect(created.orderNumber).toBe("444444");
    expect(isAvailable).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith("444444");
  });

  it("detects order-number unique constraint errors specifically", () => {
    expect(
      isOrderNumberUniqueConstraintViolation({
        code: "P2002",
        meta: { target: ["userId", "orderNumber"] },
      }),
    ).toBe(true);
    expect(
      isOrderNumberUniqueConstraintViolation({
        code: "P2002",
        meta: { target: ["userId", "email"] },
      }),
    ).toBe(false);
  });
});
