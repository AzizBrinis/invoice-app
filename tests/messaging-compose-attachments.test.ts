import { beforeEach, describe, expect, it, vi } from "vitest";

const noopAsyncMock = vi.fn().mockResolvedValue(undefined);
const noopSyncMock = vi.fn();
const requireAppSectionAccessMock = vi.fn();
const sendEmailMessageMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: noopSyncMock,
}));

vi.mock("@/lib/authorization", () => ({
  requireAppSectionAccess: requireAppSectionAccessMock,
}));

vi.mock("@/server/assistant/providers", () => ({
  callSelectedModel: noopAsyncMock,
}));

vi.mock("@/server/messaging", () => ({
  sendEmailMessage: sendEmailMessageMock,
  testImapConnection: noopAsyncMock,
  testSmtpConnection: noopAsyncMock,
  updateMailboxMessageSeenState: noopAsyncMock,
  updateMessagingConnections: noopAsyncMock,
  updateMessagingAutoReplySettings: noopAsyncMock,
  updateMessagingAutoForwardSettings: noopAsyncMock,
  updateMessagingSenderIdentity: noopAsyncMock,
  updateEmailTrackingPreference: noopAsyncMock,
  getMessagingSettingsSummary: noopAsyncMock,
  normalizeForwardingEmailAddresses: (values: string[]) =>
    values.map((value) => value.trim().toLowerCase()).filter(Boolean),
  moveMailboxMessage: noopAsyncMock,
  fetchMailboxUpdates: noopAsyncMock,
}));

vi.mock("@/server/messaging-read-mode", () => ({
  readMailboxPage: noopAsyncMock,
  readMailboxSearch: noopAsyncMock,
  readMessageDetail: noopAsyncMock,
  shouldUseMailboxSnapshotRefresh: noopSyncMock,
}));

vi.mock("@/server/messaging-local-sync", () => ({
  applyMessagingLocalMoveProjection: noopAsyncMock,
  getMessagingLocalSyncPreference: noopAsyncMock,
  markMessagingMailboxLocalSyncStateDegraded: noopAsyncMock,
  setMessagingLocalSyncPreference: noopAsyncMock,
  updateMessagingLocalMessageSeenState: noopAsyncMock,
}));

vi.mock("@/server/messaging-jobs", () => ({
  queueMessagingLocalPurge: noopAsyncMock,
  runManualMailboxLocalSyncNow: noopAsyncMock,
  runMessagingLocalBootstrapNow: noopAsyncMock,
  runMessagingLocalPurgeNow: noopAsyncMock,
  runMessagingLocalReconcileNow: noopAsyncMock,
}));

vi.mock("@/server/messaging-local-sync-ops", () => ({
  isMessagingLocalSyncServerEnabled: noopSyncMock,
  recordMessagingLocalSyncActionObservation: noopAsyncMock,
}));

vi.mock("@/server/messaging-scheduled", () => ({
  scheduleEmailDraft: noopAsyncMock,
  rescheduleScheduledEmail: noopAsyncMock,
  cancelScheduledEmail: noopAsyncMock,
}));

vi.mock("@/server/spam-detection", () => ({
  recordManualSpamFeedback: noopAsyncMock,
}));

vi.mock("@/server/messaging-responses", () => ({
  createSavedResponse: noopAsyncMock,
  updateSavedResponse: noopAsyncMock,
  deleteSavedResponse: noopAsyncMock,
}));

function baseComposeFormData() {
  const formData = new FormData();
  formData.append("to", "recipient@example.com");
  formData.append("cc", "");
  formData.append("bcc", "");
  formData.append("subject", "Attachments");
  formData.append("body", "Bonjour, pièces jointes.");
  formData.append("bodyHtml", "");
  formData.append("bodyFormat", "plain");
  formData.append("quotedHtml", "");
  formData.append("quotedText", "");
  formData.append("quotedHeaderHtml", "");
  formData.append("quotedHeaderText", "");
  return formData;
}

function createFile(name: string, size: number, type = "application/pdf") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("messaging compose attachment payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noopAsyncMock.mockResolvedValue(undefined);
    sendEmailMessageMock.mockResolvedValue({
      message: null,
      totalMessages: null,
      remotePath: null,
      uidValidity: null,
    });
  });

  it("sends multiple attachments above the old 10 MB request cutoff through the server action", async () => {
    requireAppSectionAccessMock.mockResolvedValue({
      id: "user-1",
      activeTenantId: "tenant-1",
      tenantId: "tenant-parent",
    });
    const { sendEmailAction } = await import("@/app/(app)/messagerie/actions");
    const formData = baseComposeFormData();
    formData.append("attachments", createFile("one.pdf", 6 * 1024 * 1024));
    formData.append("attachments", createFile("two.pdf", 6 * 1024 * 1024));

    const result = await sendEmailAction(formData);

    expect(result.success).toBe(true);
    expect(sendEmailMessageMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMessageMock.mock.calls[0]?.[0];
    expect(payload.attachments).toHaveLength(2);
    expect(payload.attachments[0].content.byteLength).toBe(6 * 1024 * 1024);
    expect(payload.attachments[1].content.byteLength).toBe(6 * 1024 * 1024);
  });

  it("rejects unsupported attachment types before sending", async () => {
    requireAppSectionAccessMock.mockResolvedValue({
      id: "user-1",
      activeTenantId: "tenant-1",
      tenantId: "tenant-parent",
    });
    const { sendEmailAction } = await import("@/app/(app)/messagerie/actions");
    const formData = baseComposeFormData();
    formData.append("attachments", createFile("setup.exe", 1024, "application/x-msdownload"));

    const result = await sendEmailAction(formData);

    expect(result).toEqual({
      success: false,
      message: "Type de fichier non supporté.",
    });
    expect(sendEmailMessageMock).not.toHaveBeenCalled();
  });
});
