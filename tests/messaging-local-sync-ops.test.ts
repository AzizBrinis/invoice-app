import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __testables as localSyncOpsTestables,
  getMessagingLocalSyncMetricsSnapshot,
  isMessagingLocalSyncServerEnabled,
  recordMessagingLocalSyncActionObservation,
  recordMessagingLocalSyncFallback,
  recordMessagingLocalSyncHydration,
  recordMessagingLocalSyncSyncCompleted,
  recordMessagingLocalSyncSyncFailed,
} from "@/server/messaging-local-sync-ops";

describe("messaging local sync observability", () => {
  const originalEnvValue =
    process.env[localSyncOpsTestables.LOCAL_SYNC_SERVER_ENABLED_ENV];

  afterEach(() => {
    localSyncOpsTestables.resetMessagingLocalSyncMetrics();
    vi.restoreAllMocks();
    if (typeof originalEnvValue === "string") {
      process.env[localSyncOpsTestables.LOCAL_SYNC_SERVER_ENABLED_ENV] =
        originalEnvValue;
    } else {
      delete process.env[localSyncOpsTestables.LOCAL_SYNC_SERVER_ENABLED_ENV];
    }
  });

  it("parses the server rollout guard from the environment", () => {
    delete process.env[localSyncOpsTestables.LOCAL_SYNC_SERVER_ENABLED_ENV];
    expect(isMessagingLocalSyncServerEnabled()).toBe(true);

    process.env[localSyncOpsTestables.LOCAL_SYNC_SERVER_ENABLED_ENV] = "false";
    expect(isMessagingLocalSyncServerEnabled()).toBe(false);

    process.env[localSyncOpsTestables.LOCAL_SYNC_SERVER_ENABLED_ENV] = "0";
    expect(isMessagingLocalSyncServerEnabled()).toBe(false);

    process.env[localSyncOpsTestables.LOCAL_SYNC_SERVER_ENABLED_ENV] = "true";
    expect(isMessagingLocalSyncServerEnabled()).toBe(true);
  });

  it("records sync, hydration, fallback, and storage indicators in the shared snapshot", () => {
    recordMessagingLocalSyncSyncCompleted({
      userId: "tenant-a",
      mailbox: "inbox",
      status: "READY",
      durationMs: 1250,
      syncedCount: 24,
      failedCount: 2,
      localMessageCount: 120,
      remoteMessageCount: 150,
      bootstrapComplete: true,
      backfillComplete: false,
    });
    recordMessagingLocalSyncHydration({
      userId: "tenant-a",
      mailbox: "inbox",
      uid: 88,
      attachmentCount: 1,
    });
    recordMessagingLocalSyncFallback({
      userId: "tenant-a",
      mailbox: "inbox",
      operation: "detail",
      reason: "body-missing",
    });
    recordMessagingLocalSyncActionObservation({
      userId: "tenant-a",
      mailbox: "inbox",
      operation: "page",
      source: "local-db",
      durationMs: 80,
      success: true,
    });
    recordMessagingLocalSyncActionObservation({
      userId: "tenant-a",
      mailbox: "inbox",
      operation: "attachment",
      source: "local-cache",
      durationMs: 25,
      success: true,
    });
    recordMessagingLocalSyncActionObservation({
      userId: "tenant-a",
      mailbox: "spam",
      operation: "search",
      source: "live-imap",
      durationMs: 120,
      success: false,
    });
    recordMessagingLocalSyncSyncFailed({
      userId: "tenant-a",
      mailbox: "spam",
      durationMs: 250,
      error: "IMAP timeout",
    });

    expect(getMessagingLocalSyncMetricsSnapshot()).toEqual(
      expect.objectContaining({
        serverEnabled: true,
        syncCompleted: 1,
        syncFailed: 2,
        totalSyncDurationMs: 1500,
        messagesSynced: 24,
        failedMessages: 2,
        hydrationCount: 1,
        fallbackCount: 1,
        localHitRatePercent: 67,
        fallbackReasons: {
          "body-missing": 1,
        },
        operations: expect.objectContaining({
          page: expect.objectContaining({
            count: 1,
            successCount: 1,
            localHitCount: 1,
            remoteHitCount: 0,
            cacheHitCount: 0,
          }),
          attachment: expect.objectContaining({
            count: 1,
            successCount: 1,
            localHitCount: 1,
            remoteHitCount: 0,
            cacheHitCount: 1,
          }),
          search: expect.objectContaining({
            count: 1,
            errorCount: 1,
            localHitCount: 0,
            remoteHitCount: 1,
          }),
        }),
        mailboxes: expect.objectContaining({
          inbox: expect.objectContaining({
            syncCompleted: 1,
            syncFailed: 1,
            totalSyncDurationMs: 1250,
            messagesSynced: 24,
            failedMessages: 2,
            hydrationCount: 1,
            fallbackCount: 1,
            lastLocalMessageCount: 120,
            lastRemoteMessageCount: 150,
          }),
          spam: expect.objectContaining({
            syncCompleted: 0,
            syncFailed: 1,
            totalSyncDurationMs: 250,
          }),
        }),
      }),
    );
  });
});
