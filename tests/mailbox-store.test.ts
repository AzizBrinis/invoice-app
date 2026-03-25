import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendMailboxMessages,
  cacheMessageDetail,
  clearMailboxCache,
  getMailboxStoreSnapshot,
  initializeMailboxCache,
  replaceMailboxMessages,
  setMailboxCacheUser,
} from "@/app/(app)/messagerie/_state/mailbox-store";
import type { MailboxListItem, MessageDetail } from "@/server/messaging";

function buildMessage(uid: number): MailboxListItem {
  return {
    uid,
    messageId: `message-${uid}`,
    subject: `Sujet ${uid}`,
    from: `sender-${uid}@example.com`,
    to: [`recipient-${uid}@example.com`],
    date: new Date(Date.UTC(2026, 0, 1, 0, uid, 0)).toISOString(),
    seen: false,
    hasAttachments: false,
    tracking: null,
  };
}

function buildDetail(uid: number): MessageDetail {
  return {
    mailbox: "inbox",
    uid,
    messageId: `message-${uid}`,
    subject: `Sujet ${uid}`,
    from: `sender-${uid}@example.com`,
    to: [`recipient-${uid}@example.com`],
    cc: [],
    bcc: [],
    replyTo: [],
    date: new Date(Date.UTC(2026, 0, 1, 0, uid, 0)).toISOString(),
    seen: false,
    html: null,
    text: `Contenu ${uid}`,
    attachments: [],
    fromAddress: {
      name: `Sender ${uid}`,
      address: `sender-${uid}@example.com`,
    },
    toAddresses: [
      {
        name: `Recipient ${uid}`,
        address: `recipient-${uid}@example.com`,
      },
    ],
    ccAddresses: [],
    bccAddresses: [],
    replyToAddresses: [],
    tracking: null,
  };
}

describe("mailbox store", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.useFakeTimers();
    const sessionStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage,
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
      },
    });
    setMailboxCacheUser("test-user");
    clearMailboxCache("test-user");
  });

  afterEach(() => {
    clearMailboxCache("test-user");
    setMailboxCacheUser(null);
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  it("preserves previously loaded pages when page 1 is refreshed", () => {
    initializeMailboxCache("inbox", {
      messages: Array.from({ length: 20 }, (_, index) =>
        buildMessage(40 - index),
      ),
      page: 1,
      pageSize: 20,
      hasMore: true,
      totalMessages: 40,
    });

    appendMailboxMessages(
      "inbox",
      Array.from({ length: 20 }, (_, index) => buildMessage(20 - index)),
      {
        page: 2,
        pageSize: 20,
        hasMore: false,
        totalMessages: 40,
      },
    );

    replaceMailboxMessages("inbox", {
      messages: Array.from({ length: 20 }, (_, index) =>
        buildMessage(42 - index),
      ),
      page: 1,
      pageSize: 20,
      hasMore: true,
      totalMessages: 42,
    });

    const inbox = getMailboxStoreSnapshot().mailboxes.inbox;

    expect(inbox.page).toBe(2);
    expect(inbox.hasMore).toBe(false);
    expect(inbox.totalMessages).toBe(42);
    expect(inbox.messages).toHaveLength(42);
    expect(inbox.messages[0]?.uid).toBe(42);
    expect(inbox.messages.at(-1)?.uid).toBe(1);
  });

  it("does not persist mailbox state when caching message details", () => {
    initializeMailboxCache("inbox", {
      messages: [buildMessage(1)],
      page: 1,
      pageSize: 20,
      hasMore: false,
      totalMessages: 1,
    });

    vi.runAllTimers();
    const sessionStorage = globalThis.window?.sessionStorage;
    const setItemMock = sessionStorage
      ? vi.mocked(sessionStorage.setItem)
      : undefined;
    setItemMock?.mockClear();

    cacheMessageDetail("inbox", buildDetail(1));

    vi.runAllTimers();

    expect(setItemMock).not.toHaveBeenCalled();
  });
});
