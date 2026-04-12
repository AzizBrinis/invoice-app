import { beforeEach, describe, expect, it, vi } from "vitest";

const globalTransactionMock = vi.fn();
const getSettingsMock = vi.fn();
const requireUserMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: globalTransactionMock,
    numberingSequence: {},
  },
}));

vi.mock("@/server/settings", () => ({
  getSettings: getSettingsMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

describe("receipt numbering sequences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reserves a receipt number with the provided transaction client", async () => {
    const { nextReceiptNumberWithDatabaseClient } = await import(
      "@/server/sequences"
    );
    const db = {
      numberingSequence: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          year: new Date().getFullYear(),
          counter: 1,
        }),
        update: vi.fn(),
      },
    } as unknown as Parameters<typeof nextReceiptNumberWithDatabaseClient>[2];

    const receiptNumber = await nextReceiptNumberWithDatabaseClient(
      "tenant-1",
      {
        resetNumberingAnnually: true,
      },
      db,
    );

    expect(receiptNumber).toBe(`REC-${new Date().getFullYear()}-0001`);
    expect(db.numberingSequence.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "tenant-1",
        type: "RECU",
        year: new Date().getFullYear(),
      },
    });
    expect(db.numberingSequence.create).toHaveBeenCalledWith({
      data: {
        userId: "tenant-1",
        type: "RECU",
        year: new Date().getFullYear(),
        prefix: "REC",
        counter: 1,
      },
    });
    expect(globalTransactionMock).not.toHaveBeenCalled();
    expect(getSettingsMock).not.toHaveBeenCalled();
    expect(requireUserMock).not.toHaveBeenCalled();
  });

  it("increments an existing receipt sequence inside the provided client", async () => {
    const { nextReceiptNumberWithDatabaseClient } = await import(
      "@/server/sequences"
    );
    const db = {
      numberingSequence: {
        findFirst: vi.fn().mockResolvedValue({
          id: "sequence-1",
          year: 0,
        }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({
          year: 0,
          counter: 42,
        }),
      },
    } as unknown as Parameters<typeof nextReceiptNumberWithDatabaseClient>[2];

    const receiptNumber = await nextReceiptNumberWithDatabaseClient(
      "tenant-1",
      {
        resetNumberingAnnually: false,
        receiptNumberPrefix: "PAY",
      },
      db,
    );

    expect(receiptNumber).toBe("PAY-0042");
    expect(db.numberingSequence.update).toHaveBeenCalledWith({
      where: { id: "sequence-1" },
      data: {
        prefix: "PAY",
        counter: { increment: 1 },
      },
    });
    expect(db.numberingSequence.create).not.toHaveBeenCalled();
    expect(globalTransactionMock).not.toHaveBeenCalled();
    expect(getSettingsMock).not.toHaveBeenCalled();
    expect(requireUserMock).not.toHaveBeenCalled();
  });
});
