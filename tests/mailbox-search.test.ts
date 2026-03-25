import { describe, expect, it } from "vitest";
import {
  buildMailboxSearchFieldQueries,
  buildMailboxSearchFallbackTermQuery,
  buildMailboxSearchTermQuery,
  isMailboxSearchQueryUsable,
  looksLikeMailboxAddressQuery,
  normalizeMailboxSearchQuery,
  tokenizeMailboxSearchQuery,
} from "@/lib/messaging/mailbox-search";

describe("mailbox search helpers", () => {
  it("normalizes whitespace and control characters", () => {
    expect(
      normalizeMailboxSearchQuery("  alice@example.com\n\tinvoice  "),
    ).toBe("alice@example.com invoice");
  });

  it("requires at least two characters after normalization", () => {
    expect(isMailboxSearchQueryUsable("a")).toBe(false);
    expect(isMailboxSearchQueryUsable("  ab  ")).toBe(true);
  });

  it("tokenizes queries into unique longest-first search terms", () => {
    expect(
      tokenizeMailboxSearchQuery(
        "  facturation acme urgent acme client support  ",
      ),
    ).toEqual(["facturation", "support", "urgent", "client"]);
  });

  it("detects address-like search terms", () => {
    expect(looksLikeMailboxAddressQuery("alice@")).toBe(true);
    expect(looksLikeMailboxAddressQuery("@gmail.com")).toBe(true);
    expect(looksLikeMailboxAddressQuery("invoice")).toBe(false);
  });

  it("builds a broad search query for a term", () => {
    expect(buildMailboxSearchTermQuery("acme")).toEqual({
      or: [
        { from: "acme" },
        { to: "acme" },
        { cc: "acme" },
        { bcc: "acme" },
        { header: { "Reply-To": "acme" } },
        { subject: "acme" },
        { body: "acme" },
      ],
    });
  });

  it("keeps fallback searches header-focused for address-like terms", () => {
    expect(buildMailboxSearchFallbackTermQuery("alice@acme.com")).toEqual({
      or: [
        { from: "alice@acme.com" },
        { to: "alice@acme.com" },
        { cc: "alice@acme.com" },
        { bcc: "alice@acme.com" },
        { header: { "Reply-To": "alice@acme.com" } },
        { subject: "alice@acme.com" },
      ],
    });
  });

  it("includes body fallback for plain text terms", () => {
    expect(buildMailboxSearchFallbackTermQuery("invoice")).toEqual({
      or: [
        { from: "invoice" },
        { to: "invoice" },
        { cc: "invoice" },
        { bcc: "invoice" },
        { header: { "Reply-To": "invoice" } },
        { subject: "invoice" },
        { body: "invoice" },
      ],
    });
  });

  it("builds field-by-field queries for robust IMAP searching", () => {
    expect(buildMailboxSearchFieldQueries("alice@acme.com")).toEqual([
      { from: "alice@acme.com" },
      { to: "alice@acme.com" },
      { cc: "alice@acme.com" },
      { bcc: "alice@acme.com" },
      { header: { "Reply-To": "alice@acme.com" } },
      { subject: "alice@acme.com" },
      { body: "alice@acme.com" },
    ]);
  });
});
