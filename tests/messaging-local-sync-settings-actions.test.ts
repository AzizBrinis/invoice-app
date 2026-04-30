import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAppSectionAccessMock = vi.fn();
const revalidatePathMock = vi.fn();
const getMessagingSettingsSummaryMock = vi.fn();
const updateMessagingAutoForwardSettingsMock = vi.fn();
const updateMailboxMessageSeenStateMock = vi.fn();
const getMessagingLocalSyncPreferenceMock = vi.fn();
const setMessagingLocalSyncPreferenceMock = vi.fn();
const updateMessagingLocalMessageSeenStateMock = vi.fn();
const markMessagingMailboxLocalSyncStateDegradedMock = vi.fn();
const queueMessagingLocalPurgeMock = vi.fn();
const runMessagingLocalBootstrapNowMock = vi.fn();
const runMessagingLocalPurgeNowMock = vi.fn();
const runMessagingLocalReconcileNowMock = vi.fn();
const isMessagingLocalSyncServerEnabledMock = vi.fn();
const readMailboxPageMock = vi.fn();
const noopAsyncMock = vi.fn().mockResolvedValue(undefined);
const noopSyncMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/authorization", () => ({
  requireAppSectionAccess: requireAppSectionAccessMock,
}));

vi.mock("@/server/messaging", () => ({
  sendEmailMessage: noopAsyncMock,
  testImapConnection: noopAsyncMock,
  testSmtpConnection: noopAsyncMock,
  updateMailboxMessageSeenState: updateMailboxMessageSeenStateMock,
  updateMessagingConnections: noopAsyncMock,
  updateMessagingAutoReplySettings: noopAsyncMock,
  updateMessagingAutoForwardSettings: updateMessagingAutoForwardSettingsMock,
  updateMessagingSenderIdentity: noopAsyncMock,
  updateEmailTrackingPreference: noopAsyncMock,
  getMessagingSettingsSummary: getMessagingSettingsSummaryMock,
  normalizeForwardingEmailAddresses: (values: string[]) =>
    values.map((value) => value.trim().toLowerCase()).filter(Boolean),
  moveMailboxMessage: noopAsyncMock,
  fetchMailboxUpdates: noopAsyncMock,
}));

vi.mock("@/server/messaging-read-mode", () => ({
  readMailboxPage: readMailboxPageMock,
  readMailboxSearch: noopAsyncMock,
  readMessageDetail: noopAsyncMock,
  shouldUseMailboxSnapshotRefresh: noopSyncMock,
}));

vi.mock("@/server/messaging-local-sync", () => ({
  applyMessagingLocalMoveProjection: noopAsyncMock,
  getMessagingLocalSyncPreference: getMessagingLocalSyncPreferenceMock,
  markMessagingMailboxLocalSyncStateDegraded:
    markMessagingMailboxLocalSyncStateDegradedMock,
  setMessagingLocalSyncPreference: setMessagingLocalSyncPreferenceMock,
  updateMessagingLocalMessageSeenState: updateMessagingLocalMessageSeenStateMock,
}));

vi.mock("@/server/messaging-jobs", () => ({
  queueMessagingLocalPurge: queueMessagingLocalPurgeMock,
  runManualMailboxLocalSyncNow: noopAsyncMock,
  runMessagingLocalBootstrapNow: runMessagingLocalBootstrapNowMock,
  runMessagingLocalPurgeNow: runMessagingLocalPurgeNowMock,
  runMessagingLocalReconcileNow: runMessagingLocalReconcileNowMock,
}));

vi.mock("@/server/messaging-local-sync-ops", () => ({
  isMessagingLocalSyncServerEnabled: isMessagingLocalSyncServerEnabledMock,
  recordMessagingLocalSyncActionObservation: noopAsyncMock,
}));

function createImmediateJobResult(type: string) {
  return {
    jobId: `${type}-job`,
    deduped: false,
    queue: {
      processed: 1,
      completed: 1,
      failed: 0,
      retried: 0,
      skipped: 0,
      details: [
        {
          jobId: `${type}-job`,
          type,
          status: "success" as const,
          attempts: 1,
        },
      ],
    },
  };
}

describe("messaging local sync settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppSectionAccessMock.mockResolvedValue({
      id: "user-1",
      activeTenantId: "tenant-1",
      tenantId: "tenant-parent",
    });
    getMessagingSettingsSummaryMock.mockResolvedValue({
      imapConfigured: true,
      smtpConfigured: true,
    });
    getMessagingLocalSyncPreferenceMock.mockResolvedValue(true);
    setMessagingLocalSyncPreferenceMock.mockResolvedValue({
      userId: "tenant-1",
      localSyncEnabled: true,
    });
    updateMessagingAutoForwardSettingsMock.mockResolvedValue(undefined);
    isMessagingLocalSyncServerEnabledMock.mockReturnValue(true);
    queueMessagingLocalPurgeMock.mockResolvedValue({
      jobId: "purge-job",
      deduped: false,
    });
    runMessagingLocalBootstrapNowMock.mockResolvedValue(
      createImmediateJobResult("messaging.localSyncBootstrap"),
    );
    runMessagingLocalPurgeNowMock.mockResolvedValue(
      createImmediateJobResult("messaging.localSyncPurge"),
    );
    runMessagingLocalReconcileNowMock.mockResolvedValue(
      createImmediateJobResult("messaging.localSyncReconcile"),
    );
    readMailboxPageMock.mockResolvedValue({
      mailbox: "inbox",
      page: 1,
      pageSize: 20,
      totalMessages: 0,
      hasMore: false,
      messages: [],
    });
    updateMailboxMessageSeenStateMock.mockResolvedValue(undefined);
    updateMessagingLocalMessageSeenStateMock.mockResolvedValue(undefined);
    markMessagingMailboxLocalSyncStateDegradedMock.mockResolvedValue(undefined);
  });

  it("updates automatic forwarding settings with tenant scope", async () => {
    const { updateAutoForwardSettingsAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    const formData = new FormData();
    formData.append("autoForwardEnabled", "true");
    formData.append(
      "autoForwardRecipients",
      "Ops@Example.com\nsupport@example.com",
    );

    const result = await updateAutoForwardSettingsAction(formData);

    expect(getMessagingSettingsSummaryMock).toHaveBeenCalledWith("tenant-1");
    expect(updateMessagingAutoForwardSettingsMock).toHaveBeenCalledWith({
      autoForwardEnabled: true,
      autoForwardRecipients: ["ops@example.com", "support@example.com"],
    });
    expect(result).toEqual({
      success: true,
      message: "Transfert automatique activé.",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/messagerie/parametres");
  });

  it("requires SMTP before enabling automatic forwarding", async () => {
    const { updateAutoForwardSettingsAction } = await import(
      "@/app/(app)/messagerie/actions"
    );
    getMessagingSettingsSummaryMock.mockResolvedValueOnce({
      imapConfigured: true,
      smtpConfigured: false,
    });

    const formData = new FormData();
    formData.append("autoForwardEnabled", "true");
    formData.append("autoForwardRecipients", "ops@example.com");

    const result = await updateAutoForwardSettingsAction(formData);

    expect(updateMessagingAutoForwardSettingsMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: "Configurez SMTP avant d'activer le transfert automatique.",
    });
  });

  it("requires IMAP before enabling automatic forwarding", async () => {
    const { updateAutoForwardSettingsAction } = await import(
      "@/app/(app)/messagerie/actions"
    );
    getMessagingSettingsSummaryMock.mockResolvedValueOnce({
      imapConfigured: false,
      smtpConfigured: true,
    });

    const formData = new FormData();
    formData.append("autoForwardEnabled", "true");
    formData.append("autoForwardRecipients", "ops@example.com");

    const result = await updateAutoForwardSettingsAction(formData);

    expect(updateMessagingAutoForwardSettingsMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message: "Configurez IMAP avant d'activer le transfert automatique.",
    });
  });

  it("enables local sync, keeps the preference, and starts bootstrap immediately", async () => {
    const { updateMessagingLocalSyncPreferenceAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    const formData = new FormData();
    formData.append("enabled", "true");

    const result = await updateMessagingLocalSyncPreferenceAction(formData);

    expect(setMessagingLocalSyncPreferenceMock).toHaveBeenCalledWith(
      true,
      "tenant-1",
    );
    expect(runMessagingLocalBootstrapNowMock).toHaveBeenCalledWith({
      userId: "tenant-1",
    });
    expect(queueMessagingLocalPurgeMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          enabled: true,
        },
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/messagerie/parametres");
    expect(revalidatePathMock).toHaveBeenCalledWith("/messagerie/recus");
  });

  it("blocks new opt-in attempts when the server rollout guard is disabled", async () => {
    const { updateMessagingLocalSyncPreferenceAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    isMessagingLocalSyncServerEnabledMock.mockReturnValue(false);

    const formData = new FormData();
    formData.append("enabled", "true");

    const result = await updateMessagingLocalSyncPreferenceAction(formData);

    expect(setMessagingLocalSyncPreferenceMock).not.toHaveBeenCalled();
    expect(runMessagingLocalBootstrapNowMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      message:
        "La synchronisation locale Messagerie est temporairement désactivée côté serveur.",
    });
  });

  it("disables local sync and queues purge without blocking the switch back to live mode", async () => {
    const { updateMessagingLocalSyncPreferenceAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    const formData = new FormData();
    formData.append("enabled", "false");

    const result = await updateMessagingLocalSyncPreferenceAction(formData);

    expect(setMessagingLocalSyncPreferenceMock).toHaveBeenCalledWith(
      false,
      "tenant-1",
    );
    expect(queueMessagingLocalPurgeMock).toHaveBeenCalledWith({
      userId: "tenant-1",
    });
    expect(runMessagingLocalBootstrapNowMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          enabled: false,
        },
      }),
    );
  });

  it("runs a settings-level local sync only when the optional mode is enabled", async () => {
    const { triggerMessagingLocalSyncNowAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    getMessagingLocalSyncPreferenceMock.mockResolvedValueOnce(false);
    const disabledResult = await triggerMessagingLocalSyncNowAction();
    const enabledResult = await triggerMessagingLocalSyncNowAction();

    expect(disabledResult).toEqual({
      success: true,
      data: {
        applied: false,
      },
    });
    expect(enabledResult).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          applied: true,
        },
      }),
    );
    expect(runMessagingLocalReconcileNowMock).toHaveBeenCalledWith({
      userId: "tenant-1",
    });
  });

  it("uses the active tenant scope for mailbox page reads", async () => {
    const { fetchMailboxPageAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    const result = await fetchMailboxPageAction({
      mailbox: "inbox",
      page: 1,
      pageSize: 20,
    });

    expect(readMailboxPageMock).toHaveBeenCalledWith({
      mailbox: "inbox",
      page: 1,
      pageSize: 20,
      userId: "tenant-1",
    });
    expect(result).toEqual({
      success: true,
      data: {
        mailbox: "inbox",
        page: 1,
        pageSize: 20,
        totalMessages: 0,
        hasMore: false,
        messages: [],
      },
    });
  });

  it("uses the active tenant scope for local seen projection and remote seen writeback", async () => {
    const { updateMailboxMessageSeenStateAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    const result = await updateMailboxMessageSeenStateAction({
      mailbox: "inbox",
      uid: 42,
      seen: true,
    });

    expect(getMessagingLocalSyncPreferenceMock).toHaveBeenCalledWith("tenant-1");
    expect(updateMessagingLocalMessageSeenStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "tenant-1",
        mailbox: "inbox",
        uid: 42,
        seen: true,
      }),
    );
    expect(updateMailboxMessageSeenStateMock).toHaveBeenCalledWith({
      mailbox: "inbox",
      uid: 42,
      seen: true,
      userId: "tenant-1",
    });
    expect(markMessagingMailboxLocalSyncStateDegradedMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: {
        applied: true,
      },
    });
  });

  it("purges local data through the same background job infrastructure", async () => {
    const { purgeMessagingLocalSyncDataAction } = await import(
      "@/app/(app)/messagerie/actions"
    );

    const result = await purgeMessagingLocalSyncDataAction();

    expect(runMessagingLocalPurgeNowMock).toHaveBeenCalledWith({
      userId: "tenant-1",
    });
    expect(result).toEqual({
      success: true,
      message: "Données locales purgées.",
      data: {
        purged: true,
      },
    });
  });
});
