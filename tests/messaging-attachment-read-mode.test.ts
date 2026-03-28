import { describe, expect, it, vi } from "vitest";
import { __testables as attachmentReadModeTestables } from "@/server/messaging-attachment-read-mode";

type AttachmentReadRuntime = Parameters<
  typeof attachmentReadModeTestables.readMessageAttachmentWithRuntime
>[1];

function createRuntime(): AttachmentReadRuntime {
  return {
    resolveUserId: vi.fn(async () => "tenant-1"),
    fetchMessageAttachment: vi.fn(async () => ({
      filename: "invoice.pdf",
      contentType: "application/pdf",
      content: Buffer.from("remote"),
    })),
    getMessagingLocalSyncPreference: vi.fn(async () => true),
    isMessagingLocalSyncServerEnabled: vi.fn(() => true),
    getMessagingLocalAttachmentById: vi.fn(async () => null),
    updateMessagingLocalAttachmentCache: vi.fn(async () => null),
    buildMessagingAttachmentCacheKey: vi.fn(() => "aa/cache-key.bin"),
    readCachedMessagingAttachment: vi.fn(async () => null),
    writeCachedMessagingAttachment: vi.fn(async () => "aa/cache-key.bin"),
    recordMessagingLocalSyncActionObservation: vi.fn(),
    now: vi.fn(() => new Date("2026-03-27T12:00:00.000Z")),
  };
}

describe("messaging attachment read mode", () => {
  it("serves a cached local attachment without re-fetching IMAP", async () => {
    const runtime = createRuntime();
    vi.mocked(runtime.getMessagingLocalAttachmentById).mockResolvedValue({
      id: "attachment-1",
      userId: "tenant-1",
      mailbox: "inbox",
      uid: 42,
      uidValidity: 10,
      attachmentId: "part-1",
      filename: "invoice.pdf",
      contentType: "application/pdf",
      size: 1234,
      contentId: null,
      contentLocation: null,
      inline: false,
      cachedBlobKey: "aa/cache-key.bin",
      cachedAt: "2026-03-27T11:59:00.000Z",
    });
    vi.mocked(runtime.readCachedMessagingAttachment).mockResolvedValue(
      Buffer.from("cached"),
    );

    const result =
      await attachmentReadModeTestables.readMessageAttachmentWithRuntime(
        {
          mailbox: "inbox",
          uid: 42,
          attachmentId: "part-1",
        },
        runtime,
      );

    expect(result.content.toString()).toBe("cached");
    expect(runtime.fetchMessageAttachment).not.toHaveBeenCalled();
    expect(runtime.updateMessagingLocalAttachmentCache).not.toHaveBeenCalled();
    expect(runtime.recordMessagingLocalSyncActionObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        mailbox: "inbox",
        operation: "attachment",
        source: "local-cache",
        success: true,
      }),
    );
  });

  it("fills the local attachment cache after an IMAP fetch when local metadata exists", async () => {
    const runtime = createRuntime();
    vi.mocked(runtime.getMessagingLocalAttachmentById).mockResolvedValue({
      id: "attachment-1",
      userId: "tenant-1",
      mailbox: "inbox",
      uid: 42,
      uidValidity: 10,
      attachmentId: "part-1",
      filename: "invoice.pdf",
      contentType: "application/pdf",
      size: 1234,
      contentId: null,
      contentLocation: null,
      inline: false,
      cachedBlobKey: null,
      cachedAt: null,
    });

    const result =
      await attachmentReadModeTestables.readMessageAttachmentWithRuntime(
        {
          mailbox: "inbox",
          uid: 42,
          attachmentId: "part-1",
        },
        runtime,
      );

    expect(result.content.toString()).toBe("remote");
    expect(runtime.fetchMessageAttachment).toHaveBeenCalledWith({
      mailbox: "inbox",
      uid: 42,
      attachmentId: "part-1",
      userId: "tenant-1",
    });
    expect(runtime.buildMessagingAttachmentCacheKey).toHaveBeenCalledWith({
      userId: "tenant-1",
      mailbox: "inbox",
      uid: 42,
      attachmentId: "part-1",
    });
    expect(runtime.writeCachedMessagingAttachment).toHaveBeenCalledWith(
      "aa/cache-key.bin",
      expect.any(Buffer),
    );
    expect(runtime.updateMessagingLocalAttachmentCache).toHaveBeenCalledWith({
      userId: "tenant-1",
      mailbox: "inbox",
      uid: 42,
      attachmentId: "part-1",
      cachedBlobKey: "aa/cache-key.bin",
      cachedAt: new Date("2026-03-27T12:00:00.000Z"),
    });
    expect(runtime.recordMessagingLocalSyncActionObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        mailbox: "inbox",
        operation: "attachment",
        source: "live-imap",
        success: true,
      }),
    );
  });
});
