import { describe, expect, it } from "vitest";
import { __testables as messagingJobsTestables } from "@/server/messaging-jobs";
import { __testables as messagingTestables } from "@/server/messaging";
import type { MailboxListItem } from "@/server/messaging";

describe("messaging job scheduler", () => {
  it("schedules auto replies when the standard autoresponder is enabled", () => {
    const { shouldScheduleAutoReply } = messagingJobsTestables;
    const now = new Date("2025-01-01T10:00:00Z");
    expect(
      shouldScheduleAutoReply(
        {
          autoReplyEnabled: true,
          vacationModeEnabled: false,
          vacationStartDate: null,
          vacationEndDate: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("only schedules vacation replies during the selected window", () => {
    const { shouldScheduleAutoReply } = messagingJobsTestables;
    const start = new Date("2025-08-10T00:00:00Z");
    const end = new Date("2025-08-15T00:00:00Z");

    expect(
      shouldScheduleAutoReply(
        {
          autoReplyEnabled: false,
          vacationModeEnabled: true,
          vacationStartDate: start,
          vacationEndDate: end,
        },
        new Date("2025-08-12T12:00:00Z"),
      ),
    ).toBe(true);

    expect(
      shouldScheduleAutoReply(
        {
          autoReplyEnabled: false,
          vacationModeEnabled: true,
          vacationStartDate: start,
          vacationEndDate: end,
        },
        new Date("2025-09-01T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("uses deterministic slot keys to deduplicate jobs per interval", () => {
    const { computeSlotKey } = messagingJobsTestables;
    const a = computeSlotKey(new Date("2025-05-01T10:00:15Z"), 60_000);
    const b = computeSlotKey(new Date("2025-05-01T10:00:45Z"), 60_000);
    const c = computeSlotKey(new Date("2025-05-01T10:01:01Z"), 60_000);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe("auto reply selection helpers", () => {
  const { selectAutoReplyCandidates, computeAutoReplyStartUid } = messagingTestables;

  const inboxSample = (uid: number): MailboxListItem => ({
    uid,
    messageId: `mid-${uid}`,
    subject: `Message ${uid}`,
    from: "sender@example.com",
    to: ["owner@example.com"],
    date: new Date().toISOString(),
    seen: false,
    hasAttachments: false,
  });

  it("skips historical messages during bootstrap when asked", () => {
    const result = selectAutoReplyCandidates(
      [inboxSample(5), inboxSample(6)],
      0,
      "skip",
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.bootstrapped).toBe(true);
    expect(result.highestUid).toBe(6);
  });

  it("only returns messages newer than the stored cursor", () => {
    const result = selectAutoReplyCandidates(
      [inboxSample(7), inboxSample(9)],
      7,
      "process",
    );
    expect(result.candidates.map((item) => item.uid)).toEqual([9]);
    expect(result.bootstrapped).toBe(false);
  });

  it("backfills at most the requested bootstrap window", () => {
    const start = computeAutoReplyStartUid({
      lastSeenUid: 0,
      nextUid: 501,
      maxBootstrapWindow: 120,
    });
    expect(start).toBe(381);
  });

  it("jumps directly to the next UID when a cursor already exists", () => {
    const start = computeAutoReplyStartUid({
      lastSeenUid: 42,
      nextUid: 200,
      maxBootstrapWindow: 120,
    });
    expect(start).toBe(43);
  });
});
