import { describe, expect, it, vi } from "vitest";
import { __testables as messagingJobsTestables } from "@/server/messaging-jobs";
import { MESSAGING_LOCAL_SYNC_MAILBOX_VALUES } from "@/server/messaging-local-sync";

describe("messaging local sync jobs", () => {
  it("schedules bootstrap, delta, reconcile, and purge jobs only where they apply", async () => {
    const {
      scheduleMessagingJobsWithRuntime,
      LOCAL_SYNC_JOB_TYPES,
    } = messagingJobsTestables;
    const enqueueJob = vi.fn(async ({ type, dedupeKey }: {
      type: string;
      dedupeKey?: string | null;
    }) => ({
      deduped: false,
      job: {
        id: `job-${type}-${dedupeKey ?? "none"}`,
      },
    }));
    const readyStates = MESSAGING_LOCAL_SYNC_MAILBOX_VALUES.map((mailbox) => ({
      userId: "enabled-ready",
      mailbox,
      status: "READY",
      lastSuccessfulSyncAt: "2026-03-26T09:00:00.000Z",
    }));
    const runtime = {
      enqueueJob,
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => [
        "enabled-bootstrap",
        "enabled-ready",
      ]),
      findLocalSyncStatesForUsers: vi.fn(async () => readyStates),
      findUsersWithLocalSyncData: vi.fn(async () => [
        "enabled-bootstrap",
        "enabled-ready",
        "disabled-stale",
      ]),
      findLocalSyncSettings: vi.fn(async () => [
        { userId: "enabled-bootstrap", localSyncEnabled: true },
        { userId: "enabled-ready", localSyncEnabled: true },
        { userId: "disabled-stale", localSyncEnabled: false },
      ]),
    };

    const result = await scheduleMessagingJobsWithRuntime(
      new Date("2026-03-26T10:00:00.000Z"),
      runtime as never,
    );
    const localSyncTypes = enqueueJob.mock.calls
      .map(([options]) => options.type)
      .filter((type) =>
        LOCAL_SYNC_JOB_TYPES.includes(type as (typeof LOCAL_SYNC_JOB_TYPES)[number]),
      );

    expect(result.localSync).toMatchObject({
      enabledUsers: 2,
      bootstrap: {
        requested: 1,
        enqueued: 1,
      },
      delta: {
        requested: 1,
        enqueued: 1,
      },
      reconcile: {
        requested: 1,
        enqueued: 1,
      },
      purge: {
        requested: 1,
        enqueued: 1,
      },
    });
    expect(localSyncTypes).toEqual([
      "messaging.localSyncBootstrap",
      "messaging.localSyncDelta",
      "messaging.localSyncReconcile",
      "messaging.localSyncPurge",
    ]);
  });

  it("can schedule and process local-sync cron work in separate phases", async () => {
    const {
      scheduleMessagingCronTickWithRuntime,
      processMessagingCronQueueWithRuntime,
      LOCAL_SYNC_JOB_TYPES,
    } = messagingJobsTestables;
    const enqueueJob = vi.fn(async ({ type }: { type: string }) => ({
      deduped: false,
      job: {
        id: `job-${type}`,
      },
    }));
    const processJobQueue = vi.fn(async () => ({
      processed: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      skipped: 0,
      details: [],
    }));
    const runtime = {
      enqueueJob,
      processJobQueue,
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(async () => []),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => ["enabled-user"]),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };

    const scheduled = await scheduleMessagingCronTickWithRuntime(
      new Date("2026-03-31T09:20:00.000Z"),
      runtime as never,
      "local-sync",
    );

    expect(scheduled).toMatchObject({
      scope: "local-sync",
      scheduled: {
        localSync: {
          enabledUsers: 1,
        },
      },
    });
    expect(processJobQueue).not.toHaveBeenCalled();

    await processMessagingCronQueueWithRuntime(runtime as never, "local-sync");

    expect(processJobQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        maxJobs: 5,
        allowedTypes: LOCAL_SYNC_JOB_TYPES,
      }),
    );
  });

  it("does not execute local sync handlers once the user disabled the feature", async () => {
    const { createMessagingJobHandlers } = messagingJobsTestables;
    const runtime = {
      enqueueJob: vi.fn(),
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => false),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };
    const handlers = createMessagingJobHandlers(runtime as never);

    await handlers["messaging.localSyncDelta"]({
      job: {
        id: "job-local-sync-delta",
        type: "messaging.localSyncDelta",
      },
      payload: {
        userId: "tenant-disabled",
      },
    } as never);

    expect(runtime.syncMessagingMailboxesToLocal).not.toHaveBeenCalled();
  });

  it("runs cron bootstrap jobs one mailbox at a time", async () => {
    const { createMessagingJobHandlers } = messagingJobsTestables;
    const runtime = {
      enqueueJob: vi.fn(),
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(async () => [
        {
          userId: "tenant-a",
          mailbox: "sent",
          status: "READY",
          lastSuccessfulSyncAt: "2026-03-31T08:55:00.000Z",
          lastFullResyncAt: "2026-03-31T08:55:00.000Z",
        },
      ]),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };
    const handlers = createMessagingJobHandlers(runtime as never);

    await handlers["messaging.localSyncBootstrap"]({
      job: {
        id: "job-local-sync-bootstrap",
        type: "messaging.localSyncBootstrap",
      },
      payload: {
        userId: "tenant-a",
        reason: "bootstrap",
      },
    } as never);

    expect(runtime.syncMessagingMailboxToLocal).toHaveBeenCalledWith({
      userId: "tenant-a",
      mailbox: "inbox",
      includeBackfill: true,
    });
    expect(runtime.syncMessagingMailboxesToLocal).not.toHaveBeenCalled();
  });

  it("routes delta and reconcile jobs to the expected sync depth", async () => {
    const { createMessagingJobHandlers } = messagingJobsTestables;
    const runtime = {
      enqueueJob: vi.fn(),
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };
    const handlers = createMessagingJobHandlers(runtime as never);

    await handlers["messaging.localSyncDelta"]({
      job: {
        id: "job-local-sync-delta",
        type: "messaging.localSyncDelta",
      },
      payload: {
        userId: "tenant-a",
      },
    } as never);
    await handlers["messaging.localSyncReconcile"]({
      job: {
        id: "job-local-sync-reconcile",
        type: "messaging.localSyncReconcile",
      },
      payload: {
        userId: "tenant-a",
      },
    } as never);

    expect(runtime.syncMessagingMailboxesToLocal).toHaveBeenNthCalledWith(1, {
      userId: "tenant-a",
      includeBackfill: false,
      continuePriorityBackfill: true,
    });
    expect(runtime.syncMessagingMailboxesToLocal).toHaveBeenNthCalledWith(2, {
      userId: "tenant-a",
      includeBackfill: true,
    });
  });

  it("runs cron delta jobs against the stalest mailbox only", async () => {
    const { createMessagingJobHandlers } = messagingJobsTestables;
    const runtime = {
      enqueueJob: vi.fn(),
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(async () => [
        {
          userId: "tenant-a",
          mailbox: "inbox",
          status: "READY",
          lastSuccessfulSyncAt: "2026-03-31T09:15:00.000Z",
          lastFullResyncAt: "2026-03-31T08:00:00.000Z",
        },
        {
          userId: "tenant-a",
          mailbox: "sent",
          status: "READY",
          lastSuccessfulSyncAt: "2026-03-31T08:55:00.000Z",
          lastFullResyncAt: "2026-03-31T08:30:00.000Z",
        },
        {
          userId: "tenant-a",
          mailbox: "drafts",
          status: "READY",
          lastSuccessfulSyncAt: "2026-03-31T09:10:00.000Z",
          lastFullResyncAt: "2026-03-31T08:40:00.000Z",
        },
        {
          userId: "tenant-a",
          mailbox: "trash",
          status: "READY",
          lastSuccessfulSyncAt: "2026-03-31T09:12:00.000Z",
          lastFullResyncAt: "2026-03-31T08:45:00.000Z",
        },
        {
          userId: "tenant-a",
          mailbox: "spam",
          status: "READY",
          lastSuccessfulSyncAt: "2026-03-31T09:14:00.000Z",
          lastFullResyncAt: "2026-03-31T08:50:00.000Z",
        },
      ]),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };
    const handlers = createMessagingJobHandlers(runtime as never);

    await handlers["messaging.localSyncDelta"]({
      job: {
        id: "job-local-sync-delta",
        type: "messaging.localSyncDelta",
      },
      payload: {
        userId: "tenant-a",
        reason: "delta",
      },
    } as never);

    expect(runtime.syncMessagingMailboxToLocal).toHaveBeenCalledWith({
      userId: "tenant-a",
      mailbox: "sent",
      includeBackfill: false,
      continuePriorityBackfill: true,
    });
    expect(runtime.syncMessagingMailboxesToLocal).not.toHaveBeenCalled();
  });

  it("keeps manual bootstrap and reconcile jobs as full mailbox sweeps", async () => {
    const { createMessagingJobHandlers } = messagingJobsTestables;
    const runtime = {
      enqueueJob: vi.fn(),
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(async () => []),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };
    const handlers = createMessagingJobHandlers(runtime as never);

    await handlers["messaging.localSyncBootstrap"]({
      job: {
        id: "job-local-sync-bootstrap",
        type: "messaging.localSyncBootstrap",
      },
      payload: {
        userId: "tenant-a",
        reason: "settings-enable",
      },
    } as never);
    await handlers["messaging.localSyncReconcile"]({
      job: {
        id: "job-local-sync-reconcile",
        type: "messaging.localSyncReconcile",
      },
      payload: {
        userId: "tenant-a",
        reason: "settings-manual-sync",
      },
    } as never);

    expect(runtime.syncMessagingMailboxesToLocal).toHaveBeenNthCalledWith(1, {
      userId: "tenant-a",
      includeBackfill: true,
    });
    expect(runtime.syncMessagingMailboxesToLocal).toHaveBeenNthCalledWith(2, {
      userId: "tenant-a",
      includeBackfill: true,
    });
    expect(runtime.syncMessagingMailboxToLocal).not.toHaveBeenCalled();
  });

  it("skips local-sync scheduling and handlers entirely when the server rollout guard is disabled", async () => {
    const {
      scheduleMessagingJobsWithRuntime,
      createMessagingJobHandlers,
      LOCAL_SYNC_JOB_TYPES,
    } = messagingJobsTestables;
    const runtime = {
      enqueueJob: vi.fn(async ({ type }: { type: string }) => ({
        deduped: false,
        job: {
          id: `job-${type}`,
        },
      })),
      processJobQueue: vi.fn(),
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => false),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => ["enabled-user"]),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => ["enabled-user"]),
      findLocalSyncSettings: vi.fn(async () => [
        { userId: "enabled-user", localSyncEnabled: true },
      ]),
    };

    const scheduled = await scheduleMessagingJobsWithRuntime(
      new Date("2026-03-26T10:00:00.000Z"),
      runtime as never,
    );
    const handlers = createMessagingJobHandlers(runtime as never);
    await handlers["messaging.localSyncBootstrap"]({
      job: {
        id: "job-local-sync-bootstrap",
        type: "messaging.localSyncBootstrap",
      },
      payload: {
        userId: "enabled-user",
      },
    } as never);

    expect(scheduled.localSync).toEqual({
      enabledUsers: 0,
      bootstrap: { requested: 0, enqueued: 0, deduped: 0 },
      delta: { requested: 0, enqueued: 0, deduped: 0 },
      reconcile: { requested: 0, enqueued: 0, deduped: 0 },
      purge: { requested: 0, enqueued: 0, deduped: 0 },
    });
    const localSyncEnqueueCalls = runtime.enqueueJob.mock.calls.filter(
      ([options]) =>
        LOCAL_SYNC_JOB_TYPES.includes(
          options.type as (typeof LOCAL_SYNC_JOB_TYPES)[number],
        ),
    );
    expect(localSyncEnqueueCalls).toHaveLength(0);
    expect(runtime.syncMessagingMailboxesToLocal).not.toHaveBeenCalled();
  });

  it("runs a manual mailbox local sync immediately through the background job queue", async () => {
    const { runManualMailboxLocalSyncNowWithRuntime } = messagingJobsTestables;
    const enqueueJob = vi.fn(async ({ type }: { type: string }) => ({
      deduped: false,
      job: {
        id: `job-${type}`,
      },
    }));
    const processJobQueue = vi.fn(async () => ({
      processed: 1,
      completed: 1,
      failed: 0,
      retried: 0,
      skipped: 0,
      details: [
        {
          jobId: "job-messaging.localSyncManualMailbox",
          type: "messaging.localSyncManualMailbox",
          status: "success" as const,
          attempts: 1,
        },
      ],
    }));
    const runtime = {
      enqueueJob,
      processJobQueue,
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => []),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };

    const result = await runManualMailboxLocalSyncNowWithRuntime(
      {
        userId: "tenant-a",
        mailbox: "inbox",
        now: new Date("2026-03-26T10:12:00.000Z"),
      },
      runtime as never,
    );

    expect(result).toMatchObject({
      deduped: false,
      queue: {
        processed: 1,
        completed: 1,
      },
    });
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "messaging.localSyncManualMailbox",
        priority: 220,
        payload: {
          userId: "tenant-a",
          mailbox: "inbox",
          reason: "manual-refresh",
        },
      }),
    );
    expect(processJobQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        maxJobs: 1,
        allowedTypes: ["messaging.localSyncManualMailbox"],
      }),
    );
  });

  it("keeps email automation work out of the local-sync cron scope", async () => {
    const { LOCAL_SYNC_JOB_TYPES, runMessagingCronTickWithRuntime } =
      messagingJobsTestables;
    const enqueueJob = vi.fn(async ({ type }: { type: string }) => ({
      deduped: false,
      job: {
        id: `job-${type}`,
      },
    }));
    const processJobQueue = vi.fn(async () => ({
      processed: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      skipped: 0,
      details: [],
    }));
    const runtime = {
      enqueueJob,
      processJobQueue,
      runScheduledEmailDispatchCycle: vi.fn(),
      runAutomatedReplySweepForUser: vi.fn(),
      isMessagingLocalSyncServerEnabled: vi.fn(() => true),
      getMessagingLocalSyncPreference: vi.fn(async () => true),
      listMessagingMailboxLocalSyncStates: vi.fn(),
      syncMessagingMailboxToLocal: vi.fn(),
      syncMessagingMailboxesToLocal: vi.fn(),
      purgeMessagingLocalSyncData: vi.fn(),
      findAutoReplyCandidates: vi.fn(async () => []),
      findEnabledLocalSyncUsers: vi.fn(async () => ["enabled-user"]),
      findLocalSyncStatesForUsers: vi.fn(async () => []),
      findUsersWithLocalSyncData: vi.fn(async () => []),
      findLocalSyncSettings: vi.fn(async () => []),
    };

    const result = await runMessagingCronTickWithRuntime(
      new Date("2026-03-31T09:20:00.000Z"),
      runtime as never,
      "local-sync",
    );

    expect(result.scope).toBe("local-sync");
    expect(result.scheduled.scheduledEmails).toBeUndefined();
    expect(result.scheduled.autoReplies).toBeUndefined();
    expect(runtime.findAutoReplyCandidates).not.toHaveBeenCalled();
    expect(processJobQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        maxJobs: 5,
        allowedTypes: LOCAL_SYNC_JOB_TYPES,
      }),
    );
  });
});
