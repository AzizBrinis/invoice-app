import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Mailbox } from "@/server/messaging";

const DEFAULT_ATTACHMENT_CACHE_ROOT = path.join(
  os.tmpdir(),
  "invoices-app",
  "messaging-attachments",
);

type AttachmentCacheOptions = {
  rootDir?: string;
};

export function buildMessagingAttachmentCacheKey(params: {
  userId: string;
  mailbox: Mailbox;
  uid: number;
  attachmentId: string;
}) {
  const digest = createHash("sha256")
    .update(
      `${params.userId}:${params.mailbox}:${params.uid}:${params.attachmentId}`,
    )
    .digest("hex");

  return `${digest.slice(0, 2)}/${digest.slice(2)}.bin`;
}

function resolveAttachmentCachePath(
  cacheKey: string,
  options?: AttachmentCacheOptions,
) {
  return path.join(options?.rootDir ?? DEFAULT_ATTACHMENT_CACHE_ROOT, cacheKey);
}

export async function readCachedMessagingAttachment(
  cacheKey: string,
  options?: AttachmentCacheOptions,
): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveAttachmentCachePath(cacheKey, options));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function writeCachedMessagingAttachment(
  cacheKey: string,
  content: Buffer,
  options?: AttachmentCacheOptions,
): Promise<string> {
  const absolutePath = resolveAttachmentCachePath(cacheKey, options);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
  return cacheKey;
}

export const __testables = {
  DEFAULT_ATTACHMENT_CACHE_ROOT,
};
