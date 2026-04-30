import { describe, expect, it, vi } from "vitest";
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

  it("keeps local-sync work out of the email automation cron scope", async () => {
    const { EMAIL_CRON_JOB_TYPES, runMessagingCronTickWithRuntime } =
      messagingJobsTestables;
    const processJobQueue = vi.fn(async () => ({
      processed: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      skipped: 0,
      details: [],
    }));
    const runtime = {
      enqueueJob: vi.fn(async ({ type }: { type: string }) => ({
        deduped: false,
        job: {
          id: `job-${type}`,
        },
      })),
      processJobQueue,
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      runAutoForwardSweepForUser: vi.fn(),
      forwardInboxMessageForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findAutoForwardCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => ["tenant-a"]),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };

    const result = await runMessagingCronTickWithRuntime(
      new Date("2026-03-31T09:20:00.000Z"),
      runtime as never,
      "email",
    );

    expect(result.scope).toBe("email");
    expect(result.scheduled.localSync).toBeUndefined();
    expect(runtime.findEnabledLocalSyncUsers).not.toHaveBeenCalled();
    expect(processJobQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        maxJobs: 25,
        allowedTypes: EMAIL_CRON_JOB_TYPES,
      }),
    );
  });

  it("schedules auto-forward sweeps for enabled tenants", async () => {
    const { scheduleMessagingCronTickWithRuntime } = messagingJobsTestables;
    const enqueueJob = vi.fn(async ({ type }: { type: string }) => ({
      deduped: false,
      job: {
        id: `job-${type}`,
      },
    }));
    const runtime = {
      enqueueJob,
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      runAutoForwardSweepForUser: vi.fn(),
      forwardInboxMessageForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findAutoForwardCandidates: vi.fn(async () => ["tenant-forward"]),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };

    const result = await scheduleMessagingCronTickWithRuntime(
      new Date("2026-04-30T10:00:00.000Z"),
      runtime as never,
      "email",
    );

    expect(result.scheduled.autoForwards).toEqual({
      requested: 1,
      enqueued: 1,
      deduped: 0,
    });
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "messaging.syncInboxAutoForwards",
        payload: {
          userId: "tenant-forward",
          bootstrapMode: "skip",
        },
      }),
    );
  });

  it("keeps email automation running if auto-forward candidate lookup fails", async () => {
    const { scheduleMessagingCronTickWithRuntime } = messagingJobsTestables;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const enqueueJob = vi.fn(async ({ type }: { type: string }) => ({
      deduped: false,
      job: {
        id: `job-${type}`,
      },
    }));
    const runtime = {
      enqueueJob,
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      runAutoForwardSweepForUser: vi.fn(),
      forwardInboxMessageForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findAutoForwardCandidates: vi.fn(async () => {
        throw new Error("bad forwarding settings");
      }),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };

    const result = await scheduleMessagingCronTickWithRuntime(
      new Date("2026-04-30T10:05:00.000Z"),
      runtime as never,
      "email",
    );

    expect(result.scheduled.scheduledEmails).toEqual({
      deduped: false,
      jobId: "job-messaging.dispatchScheduledEmails",
    });
    expect(result.scheduled.autoForwards).toEqual({
      requested: 0,
      enqueued: 0,
      deduped: 0,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[messaging-auto-forward] candidate lookup failed",
      expect.any(Error),
    );
    warnSpy.mockRestore();
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
    expect(start).toBe(380);
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
