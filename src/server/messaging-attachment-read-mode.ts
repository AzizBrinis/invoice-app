import {
  fetchMessageAttachment,
  resolveUserId,
  type Mailbox,
} from "@/server/messaging";
import {
  getMessagingLocalAttachmentById,
  getMessagingLocalSyncPreference,
  updateMessagingLocalAttachmentCache,
} from "@/server/messaging-local-sync";
import {
  buildMessagingAttachmentCacheKey,
  readCachedMessagingAttachment,
  writeCachedMessagingAttachment,
} from "@/server/messaging-attachment-cache";
import {
  isMessagingLocalSyncServerEnabled,
  recordMessagingLocalSyncActionObservation,
} from "@/server/messaging-local-sync-ops";

type AttachmentReadResult = Awaited<ReturnType<typeof fetchMessageAttachment>>;

type MessagingAttachmentReadRuntime = {
  resolveUserId: typeof resolveUserId;
  fetchMessageAttachment: typeof fetchMessageAttachment;
  getMessagingLocalSyncPreference: typeof getMessagingLocalSyncPreference;
  isMessagingLocalSyncServerEnabled: typeof isMessagingLocalSyncServerEnabled;
  getMessagingLocalAttachmentById: typeof getMessagingLocalAttachmentById;
  updateMessagingLocalAttachmentCache: typeof updateMessagingLocalAttachmentCache;
  buildMessagingAttachmentCacheKey: typeof buildMessagingAttachmentCacheKey;
  readCachedMessagingAttachment: typeof readCachedMessagingAttachment;
  writeCachedMessagingAttachment: typeof writeCachedMessagingAttachment;
  recordMessagingLocalSyncActionObservation: typeof recordMessagingLocalSyncActionObservation;
  now: () => Date;
};

const defaultAttachmentReadRuntime: MessagingAttachmentReadRuntime = {
  resolveUserId,
  fetchMessageAttachment,
  getMessagingLocalSyncPreference,
  isMessagingLocalSyncServerEnabled,
  getMessagingLocalAttachmentById,
  updateMessagingLocalAttachmentCache,
  buildMessagingAttachmentCacheKey,
  readCachedMessagingAttachment,
  writeCachedMessagingAttachment,
  recordMessagingLocalSyncActionObservation,
  now: () => new Date(),
};

async function readMessageAttachmentWithRuntime(
  params: {
    mailbox: Mailbox;
    uid: number;
    attachmentId: string;
    userId?: string;
  },
  runtime: MessagingAttachmentReadRuntime,
): Promise<AttachmentReadResult> {
  const startedAt = runtime.now().getTime();
  const resolvedUserId = await runtime.resolveUserId(params.userId);
  const localSyncEnabled = await runtime.getMessagingLocalSyncPreference(
    resolvedUserId,
  );
  const localSyncActive =
    localSyncEnabled && runtime.isMessagingLocalSyncServerEnabled();
  const localAttachment = localSyncActive
    ? await runtime.getMessagingLocalAttachmentById({
        userId: resolvedUserId,
        mailbox: params.mailbox,
        uid: params.uid,
        attachmentId: params.attachmentId,
      })
    : null;

  try {
    if (localAttachment?.cachedBlobKey) {
      const cachedContent = await runtime.readCachedMessagingAttachment(
        localAttachment.cachedBlobKey,
      );
      if (cachedContent) {
        runtime.recordMessagingLocalSyncActionObservation({
          userId: resolvedUserId,
          mailbox: params.mailbox,
          operation: "attachment",
          source: "local-cache",
          durationMs: runtime.now().getTime() - startedAt,
          success: true,
        });
        return {
          filename: localAttachment.filename,
          contentType: localAttachment.contentType,
          content: cachedContent,
        };
      }

      await runtime.updateMessagingLocalAttachmentCache({
        userId: resolvedUserId,
        mailbox: params.mailbox,
        uid: params.uid,
        attachmentId: params.attachmentId,
        cachedBlobKey: null,
        cachedAt: null,
      });
    }

    const fetched = await runtime.fetchMessageAttachment({
      ...params,
      userId: resolvedUserId,
    });

    if (localAttachment) {
      const cacheKey = runtime.buildMessagingAttachmentCacheKey({
        userId: resolvedUserId,
        mailbox: params.mailbox,
        uid: params.uid,
        attachmentId: params.attachmentId,
      });

      try {
        await runtime.writeCachedMessagingAttachment(cacheKey, fetched.content);
        await runtime.updateMessagingLocalAttachmentCache({
          userId: resolvedUserId,
          mailbox: params.mailbox,
          uid: params.uid,
          attachmentId: params.attachmentId,
          cachedBlobKey: cacheKey,
          cachedAt: runtime.now(),
        });
      } catch (error) {
        console.warn("[messaging-local-sync] attachment cache write failed", {
          mailbox: params.mailbox,
          uid: params.uid,
          attachmentId: params.attachmentId,
          error,
        });
      }
    }

    runtime.recordMessagingLocalSyncActionObservation({
      userId: resolvedUserId,
      mailbox: params.mailbox,
      operation: "attachment",
      source: "live-imap",
      durationMs: runtime.now().getTime() - startedAt,
      success: true,
    });

    return fetched;
  } catch (error) {
    runtime.recordMessagingLocalSyncActionObservation({
      userId: resolvedUserId,
      mailbox: params.mailbox,
      operation: "attachment",
      source: "live-imap",
      durationMs: runtime.now().getTime() - startedAt,
      success: false,
    });
    throw error;
  }
}

export async function readMessageAttachment(params: {
  mailbox: Mailbox;
  uid: number;
  attachmentId: string;
  userId?: string;
}) {
  return readMessageAttachmentWithRuntime(params, defaultAttachmentReadRuntime);
}

export const __testables = {
  readMessageAttachmentWithRuntime,
};
