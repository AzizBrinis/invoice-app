export const MESSAGING_ATTACHMENT_TOTAL_LIMIT_BYTES = 100 * 1024 * 1024;

export const MESSAGING_ATTACHMENT_ALLOWED_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/json",
  "text/plain",
]);

const MESSAGING_ATTACHMENT_ALLOWED_PREFIXES = ["image/", "audio/"];

export type MessagingAttachmentCandidate = {
  size: number;
  type?: string | null;
};

export function isAllowedMessagingAttachmentType(
  mime: string | undefined | null,
): boolean {
  if (!mime) return true;
  if (MESSAGING_ATTACHMENT_ALLOWED_TYPES.has(mime)) return true;
  return MESSAGING_ATTACHMENT_ALLOWED_PREFIXES.some((prefix) =>
    mime.startsWith(prefix),
  );
}

export function getMessagingAttachmentsTotalSize(
  files: readonly MessagingAttachmentCandidate[],
): number {
  return files.reduce((total, file) => total + file.size, 0);
}

export function formatMessagingAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 ko";
  }
  const units = ["octets", "ko", "Mo", "Go"] as const;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const display = exponent === 0 ? value : value.toFixed(1);
  return `${display} ${units[exponent]}`;
}

export const MESSAGING_ATTACHMENT_TOTAL_LIMIT_LABEL =
  formatMessagingAttachmentSize(MESSAGING_ATTACHMENT_TOTAL_LIMIT_BYTES);
