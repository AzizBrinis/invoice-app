import { describe, expect, it } from "vitest";
import { buildInitialComposeDraft } from "@/lib/messaging/compose-draft";
import type { MessageDetail } from "@/server/messaging";

function buildDetail(): MessageDetail {
  return {
    mailbox: "inbox",
    uid: 42,
    messageId: "message-42",
    subject: "Point projet",
    from: "Alice <alice@example.com>",
    to: ["Me <me@example.com>", "Bob <bob@example.com>"],
    cc: ["Carol <carol@example.com>"],
    bcc: [],
    replyTo: [],
    date: "2026-03-25T10:00:00.000Z",
    seen: false,
    html: "<p>Bonjour</p>",
    text: "Bonjour",
    attachments: [],
    fromAddress: {
      name: "Alice",
      address: "alice@example.com",
    },
    toAddresses: [
      {
        name: "Me",
        address: "me@example.com",
      },
      {
        name: "Bob",
        address: "bob@example.com",
      },
    ],
    ccAddresses: [
      {
        name: "Carol",
        address: "carol@example.com",
      },
    ],
    bccAddresses: [],
    replyToAddresses: [],
    tracking: null,
  };
}

describe("compose draft builder", () => {
  it("reply targets only the sender", () => {
    const draft = buildInitialComposeDraft(
      "reply",
      buildDetail(),
      "me@example.com",
    );

    expect(draft.to).toEqual([
      {
        display: "Alice",
        address: "alice@example.com",
      },
    ]);
    expect(draft.cc).toEqual([]);
    expect(draft.bcc).toEqual([]);
  });

  it("reply_all keeps the sender in to and others in cc", () => {
    const draft = buildInitialComposeDraft(
      "reply_all",
      buildDetail(),
      "me@example.com",
    );

    expect(draft.to).toEqual([
      {
        display: "Alice",
        address: "alice@example.com",
      },
    ]);
    expect(draft.cc).toEqual([
      {
        display: "Bob",
        address: "bob@example.com",
      },
      {
        display: "Carol",
        address: "carol@example.com",
      },
    ]);
  });
});
