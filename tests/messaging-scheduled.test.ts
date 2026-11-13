import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelScheduledEmail, runScheduledEmailDispatchCycle } from "@/server/messaging-scheduled";

const { emails, send } = vi.hoisted(() => ({
  emails: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  send: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { messagingScheduledEmail: emails } }));
vi.mock("@/server/messaging", () => ({
  resolveUserId: async () => "tenant",
  getMessagingCredentials: async () => ({}),
  sendEmailMessageForUser: send,
}));

describe("scheduled email dispatch", () => {
  beforeEach(() => vi.resetAllMocks());

  it("recovers abandoned sends on each tick without retrying delivery", async () => {
    emails.findMany.mockResolvedValue([]);
    await runScheduledEmailDispatchCycle();
    await runScheduledEmailDispatchCycle();
    expect(emails.updateMany).toHaveBeenCalledTimes(2);
    expect(emails.updateMany).toHaveBeenLastCalledWith({
      where: { status: "SENDING", updatedAt: { lt: expect.any(Date) } },
      data: { status: "FAILED", failureReason: expect.stringContaining("Vérifiez") },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("rechecks the deadline when claiming a selected email", async () => {
    emails.findMany.mockResolvedValue([{ id: "rescheduled" }]);
    emails.updateMany.mockResolvedValue({ count: 0 });
    await runScheduledEmailDispatchCycle();
    const cutoff = emails.findMany.mock.calls[0][0].where.sendAt.lte;
    expect(emails.updateMany).toHaveBeenCalledWith({
      where: { id: "rescheduled", status: "PENDING", sendAt: { lte: cutoff } },
      data: { status: "SENDING" },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps an accepted delivery out of retry when saving its result fails", async () => {
    emails.findMany.mockResolvedValue([{
      id: "accepted", userId: "tenant", to: ["test@example.test"], attachments: [],
      subject: "Test", text: "Message", html: "Message",
    }]);
    emails.updateMany.mockResolvedValue({ count: 1 });
    emails.update.mockRejectedValue(new Error("database offline"));
    await expect(runScheduledEmailDispatchCycle()).rejects.toThrow("database offline");
    expect(send).toHaveBeenCalledOnce();
    expect(emails.update).toHaveBeenCalledTimes(1);
    expect(emails.update).toHaveBeenCalledWith({
      where: { id: "accepted" },
      data: { status: "SENT", sentAt: expect.any(Date), failureReason: null },
    });
  });

  it("refuses cancellation once delivery has claimed the email", async () => {
    emails.updateMany.mockResolvedValue({ count: 0 });
    await expect(cancelScheduledEmail({ id: "claimed" })).rejects.toThrow("annuler");
    expect(emails.updateMany).toHaveBeenCalledWith({
      where: { id: "claimed", userId: "tenant", status: { in: ["PENDING", "FAILED"] } },
      data: { status: "CANCELLED", canceledAt: expect.any(Date), failureReason: null },
    });
  });
});
