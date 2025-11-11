import { describe, it, expect } from "vitest";
import { __emailTrackingInternals } from "@/server/email-tracking";

describe("email tracking internals", () => {
  it("produces resilient open pixel markup with multiple fallbacks", () => {
    const markup = __emailTrackingInternals.buildOpenPixelMarkup(
      "https://app.test/api/email/track-open/abc.png",
    );

    expect(markup).toContain("variant=img");
    expect(markup).toContain("variant=fallback");
    expect(markup).toContain("variant=bg");
    expect(markup).toContain("variant=noscript");
    expect(markup).toContain("variant=table");
    expect(markup).toContain("variant=mso");
    expect(markup).toContain("@font-face");
    expect(markup).toContain("variant=font");
    expect(markup).toContain("variant=css");
    expect(markup).toContain("variant=import");
    expect(markup).toContain("font-size:1px !important");
    expect(markup).toContain("font-display:block");
    expect(markup).toContain("/ 1px 1px;");
  });

  it("classifies Google image proxy hits as proxy events but not suppressed", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 GoogleImageProxy";
    expect(__emailTrackingInternals.isProxyOpenUserAgent(ua)).toBe(true);
    expect(__emailTrackingInternals.shouldSuppressOpenEvent(ua)).toBe(false);
  });

  it("classifies Proofpoint scanners to avoid false click positives", () => {
    const result = __emailTrackingInternals.shouldSuppressClickEvent(
      "Mozilla/5.0 Proofpoint URL Defense",
    );
    expect(result).toBe(true);
  });

  it("flags self opens when the viewer user matches the sender", () => {
    const isSelf = __emailTrackingInternals.isSelfOpen({
      viewerUserId: "user-1",
      emailUserId: "user-1",
      viewerSessionHash: null,
      senderSessionHash: null,
      viewerIpHash: null,
      senderIpHash: null,
    });
    expect(isSelf).toBe(true);
  });

  it("flags self opens based on session or IP fingerprints", () => {
    const sessionHash = __emailTrackingInternals.hashFingerprint("session-token");
    const ipHash = __emailTrackingInternals.hashFingerprint("203.0.113.5");

    const sessionMatch = __emailTrackingInternals.isSelfOpen({
      viewerUserId: null,
      emailUserId: "user-2",
      viewerSessionHash: sessionHash,
      senderSessionHash: sessionHash,
      viewerIpHash: null,
      senderIpHash: null,
    });

    const ipMatch = __emailTrackingInternals.isSelfOpen({
      viewerUserId: null,
      emailUserId: "user-2",
      viewerSessionHash: null,
      senderSessionHash: null,
      viewerIpHash: ipHash,
      senderIpHash: ipHash,
    });

    expect(sessionMatch).toBe(true);
    expect(ipMatch).toBe(true);
  });

  it("allows recipient opens when no fingerprint overlaps", () => {
    const result = __emailTrackingInternals.isSelfOpen({
      viewerUserId: "user-3",
      emailUserId: "user-4",
      viewerSessionHash: __emailTrackingInternals.hashFingerprint("session-a"),
      senderSessionHash: __emailTrackingInternals.hashFingerprint("session-b"),
      viewerIpHash: __emailTrackingInternals.hashFingerprint("198.51.100.10"),
      senderIpHash: __emailTrackingInternals.hashFingerprint("198.51.100.11"),
    });

    expect(result).toBe(false);
  });

  it("only rewrites http(s) anchors when injecting link tracking", () => {
    const html = `
      <p>
        <a href="https://example.com/a">A</a>
        <a href="mailto:sales@example.com">Email</a>
        <a href="https://example.com/b">B</a>
      </p>
    `;
    const map = new Map<number, string>();
    map.set(0, "https://tracker.test/first");
    map.set(1, "https://tracker.test/second");

    const result = __emailTrackingInternals.injectTrackingIntoHtml({
      html,
      openPixelUrl: null,
      linkUrls: map,
    });

    expect(result).toContain('href="https://tracker.test/first"');
    expect(result).toContain('href="https://tracker.test/second"');
    expect(result).toContain('href="mailto:sales@example.com"');
    expect(result).toMatch(/data-tracked="messagerie"/);
  });
});
