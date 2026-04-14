import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONFIRMATION_TOKEN_MAX_AGE_MS,
  createConfirmationToken,
  parseConfirmationToken,
} from "@/lib/confirmation-token";
import {
  PublicRequestSecurityError,
  assertSameOriginMutationRequest,
} from "@/lib/security/public-request";

function createHeaders(
  entries: Record<string, string | null | undefined>,
): Headers {
  const headers = new Headers();
  Object.entries(entries).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers.set(key, value);
    }
  });
  return headers;
}

describe("public route security helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts same-origin mutation requests using the Origin header", () => {
    expect(() =>
      assertSameOriginMutationRequest(
        createHeaders({
          host: "shop.example.com",
          origin: "https://shop.example.com",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).not.toThrow();
  });

  it("accepts same-origin mutation requests using the Referer header when Origin is absent", () => {
    expect(() =>
      assertSameOriginMutationRequest(
        createHeaders({
          host: "shop.example.com",
          referer: "https://shop.example.com/checkout",
        }),
      ),
    ).not.toThrow();
  });

  it("rejects cross-site mutation requests", () => {
    expect(() =>
      assertSameOriginMutationRequest(
        createHeaders({
          host: "shop.example.com",
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toThrow(PublicRequestSecurityError);
  });

  it("rejects mismatched referer hosts", () => {
    expect(() =>
      assertSameOriginMutationRequest(
        createHeaders({
          host: "shop.example.com",
          referer: "https://evil.example/contact",
        }),
      ),
    ).toThrow(PublicRequestSecurityError);
  });

  it("binds confirmation tokens to the matching order", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const token = await createConfirmationToken("order-1");

    nowSpy.mockReturnValue(1_700_000_005_000);

    await expect(
      parseConfirmationToken(token, { orderId: "order-1" }),
    ).resolves.toMatchObject({
      orderId: "order-1",
    });
    await expect(
      parseConfirmationToken(token, { orderId: "order-2" }),
    ).resolves.toBeNull();
  });

  it("expires confirmation tokens after the configured max age", async () => {
    const issuedAt = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(issuedAt);
    const token = await createConfirmationToken("order-1");

    nowSpy.mockReturnValue(issuedAt + CONFIRMATION_TOKEN_MAX_AGE_MS + 1);

    await expect(parseConfirmationToken(token)).resolves.toBeNull();
  });
});
