import { describe, expect, it } from "vitest";
import { __testables } from "@/server/background-jobs";

describe("background job maintenance helpers", () => {
  it("treats recurring messaging jobs as superseded when their lease expires", () => {
    expect(
      __testables.isSupersededWhenStale("messaging.dispatchScheduledEmails"),
    ).toBe(true);
    expect(
      __testables.isSupersededWhenStale("messaging.syncInboxAutoReplies"),
    ).toBe(true);
    expect(
      __testables.isSupersededWhenStale("messaging.localSyncDelta"),
    ).toBe(true);
  });

  it("keeps one-off billing and order email jobs recoverable", () => {
    expect(
      __testables.isSupersededWhenStale("billing.sendInvoiceEmail"),
    ).toBe(false);
    expect(
      __testables.isSupersededWhenStale("orders.sendCreatedEmail"),
    ).toBe(false);
  });
});
