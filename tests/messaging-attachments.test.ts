import { describe, expect, it } from "vitest";
import type { Attachment } from "mailparser";
import { Readable } from "node:stream";
import { __testables as messagingTestables } from "@/server/messaging";

describe("attachment content type helpers", () => {
  it("normalizes declared content types", () => {
    const { normalizeAttachmentContentType } = messagingTestables;
    expect(
      normalizeAttachmentContentType("Image/PNG; name=foo.png"),
    ).toBe("image/png");
    expect(normalizeAttachmentContentType(null)).toBe(
      "application/octet-stream",
    );
  });

  it("detects common image signatures", () => {
    const { detectAttachmentMimeType } = messagingTestables;
    expect(
      detectAttachmentMimeType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(
      detectAttachmentMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xdb])),
    ).toBe("image/jpeg");
    expect(
      detectAttachmentMimeType(Buffer.from("GIF89a")),
    ).toBe("image/gif");
    const webpHeader = Buffer.from("RIFFaaaaWEBP", "ascii");
    expect(detectAttachmentMimeType(webpHeader)).toBe("image/webp");
    expect(detectAttachmentMimeType(Buffer.from([0, 1, 2, 3]))).toBeNull();
  });
});

describe("readAttachmentContent", () => {
  it("returns raw buffers", async () => {
    const { readAttachmentContent } = messagingTestables;
    const buffer = Buffer.from([1, 2, 3]);
    const result = await readAttachmentContent({
      content: buffer,
    } as Attachment);
    expect(result).toBe(buffer);
  });

  it("converts Uint8Array and ArrayBuffer inputs", async () => {
    const { readAttachmentContent } = messagingTestables;
    const uint8 = new Uint8Array([4, 5, 6]);
    const arrayBuffer = Uint8Array.from([7, 8]).buffer;
    const merged = await readAttachmentContent({
      content: uint8,
    } as Attachment);
    expect([...merged]).toEqual([4, 5, 6]);
    const buffer = await readAttachmentContent({
      content: arrayBuffer as unknown,
    } as Attachment);
    expect([...buffer]).toEqual([7, 8]);
  });

  it("decodes string sources", async () => {
    const { readAttachmentContent } = messagingTestables;
    const result = await readAttachmentContent({
      content: "plain-text",
    } as Attachment);
    expect(result.toString("utf-8")).toBe("plain-text");
  });

  it("concatenates async iterables", async () => {
    const { readAttachmentContent } = messagingTestables;
    async function* iterator() {
      yield Buffer.from("he");
      yield new Uint8Array(Buffer.from("ll"));
      yield "o";
    }
    const result = await readAttachmentContent({
      content: iterator(),
    } as Attachment);
    expect(result.toString("utf-8")).toBe("hello");
  });

  it("accepts synchronous iterables", async () => {
    const { readAttachmentContent } = messagingTestables;
    const iterable = {
      *[Symbol.iterator]() {
        yield Buffer.from("wo");
        yield "rld";
      },
    };
    const result = await readAttachmentContent({
      content: iterable as unknown,
    } as Attachment);
    expect(result.toString("utf-8")).toBe("world");
  });

  it("handles array buffer chunks inside iterables", async () => {
    const { readAttachmentContent } = messagingTestables;
    const iterable = {
      *[Symbol.iterator]() {
        yield Uint8Array.from(Buffer.from("ty"));
        yield Buffer.from("pe");
        yield Uint8Array.from(Buffer.from("d")).buffer;
      },
    };
    const result = await readAttachmentContent({
      content: iterable as unknown,
    } as Attachment);
    expect(result.toString("utf-8")).toBe("typed");
  });

  it("consumes readable streams", async () => {
    const { readAttachmentContent } = messagingTestables;
    const stream = Readable.from([Buffer.from("st"), "ream"]);
    const result = await readAttachmentContent({
      content: stream as unknown,
    } as Attachment);
    expect(result.toString("utf-8")).toBe("stream");
  });

  it("returns empty buffers for missing content", async () => {
    const { readAttachmentContent } = messagingTestables;
    const result = await readAttachmentContent({
      content: null,
    } as Attachment);
    expect(result.byteLength).toBe(0);
  });
});
