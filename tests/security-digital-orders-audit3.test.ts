import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dns = vi.hoisted(() => ({ answer: [{ address: "127.0.0.1", family: 4 }] }));
vi.mock("node:dns/promises", () => ({ lookup: async () => dns.answer }));

import { sanitizeEmailHtml } from "@/lib/email-html";
import { loadDeliveryPolicy } from "@/server/digital-products/delivery-policy";
import { parseReviewedEmail } from "@/server/digital-products/review-email";
import { checkShopOrder, shopTransport, type ShopCallbackDeps } from "@/server/digital-products/shop-callback";
import { loadLicenceApiConfig } from "@/server/digital-products/api-config";
import { requirePaidOrderFromEnv } from "@/server/digital-products/fulfilment";
import { loadPrestashopIntegrationConfig } from "@/server/integrations/prestashop/config";
import { allowLoginAttempt } from "@/server/security/login-throttle";

/** Audit 3 (2026-11-24): pure/unit regressions. Order flows are in digital-order-fulfilment.test.ts. */

describe("shop transport (SSRF)", () => {
  let server: Server;
  let hits = 0;
  let respond: string = "{}";
  let port = 0;
  beforeEach(async () => {
    hits = 0;
    server = createServer((_request, response) => {
      hits += 1;
      response.end(respond);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(() => new Promise((resolve) => server.close(resolve)));
  const post = (publicOnly: boolean, host = "rebind.example.com") =>
    shopTransport({ publicOnly })(new URL(`http://${host}:${port}/`), {
      method: "POST", body: "{}", headers: {}, signal: AbortSignal.timeout(3000),
    });

  it("refuses the connection when the name resolves to a private address at connect time (DNS rebinding)", async () => {
    dns.answer = [{ address: "127.0.0.1", family: 4 }];
    await expect(post(true)).rejects.toThrow("non_public_address");
    dns.answer = [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }];
    await expect(post(true)).rejects.toThrow("non_public_address");
    dns.answer = [{ address: "fd00::1", family: 6 }];
    await expect(post(true)).rejects.toThrow("non_public_address");
    expect(hits).toBe(0);
  });

  it("never keeps more than 8 KiB of the answer", async () => {
    respond = "x".repeat(2_000_000);
    const response = await post(false, "127.0.0.1");
    expect(response.status).toBe(200);
    expect(response.text.length).toBe(8192);
    respond = "{}";
  });

  it("reads a normal answer", async () => {
    respond = '{"ok":true}';
    expect(await post(false, "127.0.0.1")).toEqual({ status: 200, text: '{"ok":true}' });
  });
});

describe("order.check answers", () => {
  const SECRET = "s".repeat(40);
  const check = (json: unknown, status = 200) => {
    const bodies: string[] = [];
    const deps: Partial<ShopCallbackDeps> = {
      loadConfig: () => ({ ok: true as const, config: { keys: new Map([["k1", Buffer.from(SECRET)]]) } as never }),
      transport: async (_url, init) => {
        bodies.push(init.body);
        return { status, text: typeof json === "string" ? json : JSON.stringify(json) };
      },
      resolve: async () => [{ address: "93.184.216.34" }],
      wait: async () => {},
      env: { NODE_ENV: "production" },
    };
    return checkShopOrder(
      { url: "https://shop.example.com/n", keyId: "k1", fulfilmentId: "dlful-x", shopId: 1, orderId: 42, orderReference: "R" },
      deps,
    ).then((result) => ({ result, bodies }));
  };

  it("only an explicit answer about this order confirms the payment", async () => {
    const good = { ok: true, event: "order.check", orderId: 42, payable: true };
    expect((await check(good)).result).toEqual({ ok: true, payable: true });
    expect(JSON.parse((await check(good)).bodies[0]).event).toBe("order.check");
    expect((await check({ ...good, payable: false, reason: "ORDER_CHANGED" })).result).toEqual({ ok: true, payable: false, reason: "ORDER_CHANGED" });
    expect((await check({ ...good, payable: false, reason: "<script>" })).result).toEqual({ ok: true, payable: false, reason: "ORDER_NOT_PAID" });
    for (const bad of [{ ...good, orderId: 43 }, { ...good, payable: "true" }, { ...good, event: "order.sent" }, { ok: true, state: "delivered" }, "null", "[]", "<html>", ""]) {
      expect((await check(bad)).result.ok, JSON.stringify(bad)).toBe(false);
    }
    expect((await check({ ...good, ok: true }, 500)).result.ok).toBe(false);
  });
});

describe("configuration fails closed", () => {
  it("cannot switch the payment gate off in production", () => {
    expect(requirePaidOrderFromEnv({ NODE_ENV: "production", DIGITAL_ORDER_REQUIRE_PAYMENT: "false" })).toBe(true);
    expect(requirePaidOrderFromEnv({ NODE_ENV: "development", DIGITAL_ORDER_REQUIRE_PAYMENT: "false" })).toBe(false);
  });

  it("keeps the delivery limits when a value is unreadable", () => {
    const defaults = loadDeliveryPolicy({});
    expect(defaults).toEqual({ maxAutoCodesPerOrder: 100, maxCodesPerHour: 200, allowFreeOrders: false, reviewMaxAgeMinutes: 120 });
    for (const bad of ["-1", "abc", "1e9", "99999999", " "]) {
      expect(loadDeliveryPolicy({ DIGITAL_ORDER_MAX_AUTO_CODES: bad, DIGITAL_ORDER_MAX_CODES_PER_HOUR: bad, DIGITAL_ORDER_REVIEW_MAX_AGE_MINUTES: bad, DIGITAL_ORDER_ALLOW_FREE: bad })).toEqual(defaults);
    }
    expect(loadDeliveryPolicy({ DIGITAL_ORDER_MAX_CODES_PER_HOUR: "0", DIGITAL_ORDER_ALLOW_FREE: "true" })).toMatchObject({ maxCodesPerHour: 0, allowFreeOrders: true });
  });

  it("minting through the licence API is off in production unless asked", () => {
    const load = (extra: Record<string, string>) => {
      const result = loadLicenceApiConfig({ DIGITAL_LICENCE_TENANT_ID: "t", DIGITAL_LICENCE_API_KEYS: `key-1:${"s".repeat(40)}`, ...extra });
      return result.ok && result.config.allowAllocation;
    };
    expect(load({ NODE_ENV: "production" })).toBe(false);
    expect(load({ NODE_ENV: "production", DIGITAL_LICENCE_API_ALLOW_ALLOCATION: "true" })).toBe(true);
  });

  it("refuses a malformed shop allowlist instead of ignoring it", () => {
    const load = (ids?: string) => loadPrestashopIntegrationConfig(
      { PRESTASHOP_INVOICE_TENANT_ID: "t", ...(ids === undefined ? {} : { PRESTASHOP_ALLOWED_SHOP_IDS: ids }) }, { requireKeys: false });
    expect(load("1,x").ok).toBe(false);
    const one = load("1, 2");
    expect(one.ok && [...one.config.allowedShopIds!]).toEqual(["1", "2"]);
    const none = load();
    expect(none.ok && none.config.allowedShopIds).toBeNull();
  });
});

describe("review attachments", () => {
  const form = (name: string, type: string, bytes: number[]) => {
    const data = new FormData();
    data.set("subject", "Objet");
    data.set("html", "<p>x</p>");
    const file = new File([new Uint8Array(bytes)], name, { type });
    data.append("files", file, file.name);
    return data;
  };
  const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
  it("accepts only listed extensions whose content matches", async () => {
    await expect(parseReviewedEmail(form("a.pdf", "application/pdf", PDF), [])).resolves.toBeTruthy();
    for (const name of ["a.docm", "a.pif", "a.reg", "a.url", "a.one", "a.pdf.wsf", "pdf", "a.htm"]) {
      await expect(parseReviewedEmail(form(name, "application/pdf", PDF), []), name).rejects.toThrow(/non autorisé/);
    }
    await expect(parseReviewedEmail(form("a.pdf", "application/pdf", [0x4d, 0x5a, 0x90, 0]), [])).rejects.toThrow(/ne correspond pas/);
    await expect(parseReviewedEmail(form("a.png", "image/png", PDF), [])).rejects.toThrow(/ne correspond pas/);
  });
});

describe("e-mail HTML", () => {
  it("drops data: links but keeps inline images", () => {
    const html = sanitizeEmailHtml('<a href="data:text/html,<b>x</b>">l</a><img src="data:image/png;base64,AAAA"><a href="https://ok.example">k</a>');
    expect(html).not.toContain("data:text/html");
    expect(html).toContain("data:image/png");
    expect(html).toContain("https://ok.example");
  });
});

describe("administrator login throttling", () => {
  const headers = (ip: string) => new Headers({ "x-vercel-forwarded-for": ip });
  function sharedCounter() {
    const counts = new Map<string, number>();
    return {
      counts,
      registerNonce: async (key: string) => { counts.set(key, (counts.get(key) ?? 0) + 1); return true; },
      countRecentRequests: async (key: string) => counts.get(key) ?? 0,
    };
  }
  const resetMemory = () => { delete (globalThis as Record<string, unknown>).__publicRouteRateLimitStore; };
  beforeEach(resetMemory);

  it("stops a password guesser after 10 tries, case-insensitively, and leaves others alone", async () => {
    const counter = sharedCounter();
    const results = [];
    for (let i = 0; i < 12; i += 1) results.push(await allowLoginAttempt(headers("198.51.100.1"), i % 2 ? "Admin@x.tn" : "admin@x.tn ", { counter }));
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(await allowLoginAttempt(headers("198.51.100.2"), "admin@x.tn", { counter })).toBe(true);
    expect([...counter.counts.keys()].join()).not.toMatch(/x\.tn|198\.51/);
  });

  it("holds across instances (memory lost, database counters kept)", async () => {
    const counter = sharedCounter();
    for (let i = 0; i < 10; i += 1) { resetMemory(); await allowLoginAttempt(headers("198.51.100.3"), "a@x.tn", { counter }); }
    resetMemory();
    expect(await allowLoginAttempt(headers("198.51.100.3"), "a@x.tn", { counter })).toBe(false);
  });

  it("limits one source spraying many accounts, and one account attacked from many sources", async () => {
    const counter = sharedCounter();
    let allowed = 0;
    for (let i = 0; i < 60; i += 1) if (await allowLoginAttempt(headers("198.51.100.4"), `u${i}@x.tn`, { counter })) allowed += 1;
    expect(allowed).toBe(40);
    allowed = 0;
    for (let i = 0; i < 80; i += 1) if (await allowLoginAttempt(headers(`203.0.113.${i}`), "target@x.tn", { counter })) allowed += 1;
    expect(allowed).toBe(60);
  });

  it("still limits when the database counter is unavailable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const counter = { registerNonce: async () => { throw new Error("relation missing"); }, countRecentRequests: async () => 0 };
    let allowed = 0;
    for (let i = 0; i < 15; i += 1) if (await allowLoginAttempt(headers("198.51.100.5"), "a@x.tn", { counter })) allowed += 1;
    expect(allowed).toBe(10);
    error.mockRestore();
  });
});
