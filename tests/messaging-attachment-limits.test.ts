import { describe, expect, it } from "vitest";
import {
  MESSAGING_ATTACHMENT_TOTAL_LIMIT_BYTES,
  MESSAGING_ATTACHMENT_TOTAL_LIMIT_LABEL,
  formatMessagingAttachmentSize,
  getMessagingAttachmentsTotalSize,
  isAllowedMessagingAttachmentType,
} from "@/lib/messaging/attachments";

describe("messaging attachment limits", () => {
  it("defines a 100 MB total attachment limit", () => {
    expect(MESSAGING_ATTACHMENT_TOTAL_LIMIT_BYTES).toBe(100 * 1024 * 1024);
    expect(MESSAGING_ATTACHMENT_TOTAL_LIMIT_LABEL).toBe("100.0 Mo");
  });

  it("sums multiple attachment sizes for total validation", () => {
    expect(
      getMessagingAttachmentsTotalSize([
        { size: 40 * 1024 * 1024 },
        { size: 35 * 1024 * 1024 },
        { size: 25 * 1024 * 1024 },
      ]),
    ).toBe(MESSAGING_ATTACHMENT_TOTAL_LIMIT_BYTES);

    expect(
      getMessagingAttachmentsTotalSize([
        { size: 60 * 1024 * 1024 },
        { size: 41 * 1024 * 1024 },
      ]),
    ).toBeGreaterThan(MESSAGING_ATTACHMENT_TOTAL_LIMIT_BYTES);
  });

  it("keeps the existing accepted attachment families", () => {
    expect(isAllowedMessagingAttachmentType("application/pdf")).toBe(true);
    expect(isAllowedMessagingAttachmentType("image/png")).toBe(true);
    expect(isAllowedMessagingAttachmentType("audio/mpeg")).toBe(true);
    expect(isAllowedMessagingAttachmentType("application/x-msdownload")).toBe(
      false,
    );
  });

  it("formats byte sizes for French UI labels", () => {
    expect(formatMessagingAttachmentSize(1536)).toBe("1.5 ko");
    expect(formatMessagingAttachmentSize(100 * 1024 * 1024)).toBe("100.0 Mo");
  });
});
