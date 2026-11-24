import { describe, expect, it, vi } from "vitest";
import { callbackUrlIssue, isPrivateAddress, notifyShopOrderSent, SHOP_CALLBACK_PATH, SHOP_CALLBACK_SCHEME, type ShopCallbackDeps } from "@/server/digital-products/shop-callback";
import { parseReviewedEmail, safeAttachmentName } from "@/server/digital-products/review-email";
import { sanitizeOrderEmailOverride } from "@/server/digital-products/order-email";
import { computeSignature, sha256Hex } from "@/server/integrations/prestashop/signature";

const SECRET = "ssssssssssssssssssssssssssssssssssssssss";
const FID = "dlful-00000000-0000-4000-8000-000000000001";
const BODY = '{"schemaVersion":1,"event":"order.sent","fulfilmentId":"dlful-00000000-0000-4000-8000-000000000001","shopId":1,"orderId":42,"orderReference":"018348"}';
const URL_OK = "https://shop.example.com/index.php?fc=module&module=tsinvoiceapp&controller=fulfilmentnotify";
const PROD = { NODE_ENV: "production" };

function deps(respond: () => Response | Promise<Response>, extra: Partial<ShopCallbackDeps> = {}) {
  const calls: { url: string; init: Parameters<ShopCallbackDeps["transport"]>[1] }[] = [];
  const fake: Partial<ShopCallbackDeps> = {
      loadConfig: () => ({ ok: true as const, config: { keys: new Map([["k1", Buffer.from(SECRET)]]) } as never }),
      transport: async (url, init) => {
        calls.push({ url: String(url), init });
        const response = await respond();
        return { status: response.status, text: await response.text() };
      },
      resolve: async () => [{ address: "93.184.216.34" }],
      wait: async () => {},
      env: PROD,
      ...extra,
  };
  return { calls, deps: fake };
}
const call = (d: Partial<ShopCallbackDeps>, url = URL_OK, keyId = "k1") =>
  notifyShopOrderSent({ url, keyId, fulfilmentId: FID, shopId: "1", orderId: 42, orderReference: "018348" }, d);
const ok = () => Response.json({ ok: true, state: "delivered" });

describe("signed call to the shop", () => {
  it("matches the module's verification vector (tests/licences-unit.php)", () => {
    expect(computeSignature(SECRET, {
      method: "POST", path: SHOP_CALLBACK_PATH, timestamp: "1700000000", nonce: "abababababababababababababababab", idempotencyKey: FID,
      bodySha256Hex: sha256Hex(BODY), scheme: SHOP_CALLBACK_SCHEME,
    })).toBe("v1=6c02ffad5bdc98b989e61eb8996ccc19756226de029a63f95c2ac2aa0734bdc1");
  });

  it("signs the exact body, follows no redirect and sends no customer data", async () => {
    const { calls, deps: d } = deps(ok);
    expect(await call(d)).toEqual({ ok: true, state: "delivered" });
    expect(calls).toHaveLength(1);
    const { init } = calls[0];
    expect(init.body).toBe(BODY);
    const { headers } = init;
    expect(headers["X-Signature"]).toBe(computeSignature(SECRET, {
      method: "POST", path: SHOP_CALLBACK_PATH, timestamp: headers["X-Signature-Timestamp"], nonce: headers["X-Signature-Nonce"],
      idempotencyKey: FID, bodySha256Hex: sha256Hex(BODY), scheme: SHOP_CALLBACK_SCHEME,
    }));
  });

  it("refuses non-public targets in production (SSRF)", async () => {
    for (const url of ["http://shop.example.com/", "https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://169.254.169.254/",
      "https://shop.internal/", "https://u:p@shop.example.com/", "https://shop.example.com:8443/", "ftp://shop.example.com/", "not a url",
      `https://shop.example.com/${"a".repeat(600)}`]) {
      expect(callbackUrlIssue(url, PROD), url).not.toBeNull();
    }
    expect(callbackUrlIssue(URL_OK, PROD)).toBeNull();
    expect(callbackUrlIssue(URL_OK, { ...PROD, PRESTASHOP_CALLBACK_HOSTS: "other.example.com" })).toBe("host_not_allowed");
    const { calls, deps: d } = deps(ok, { resolve: async () => [{ address: "93.184.216.34" }, { address: "10.0.0.5" }] });
    expect(await call(d)).toEqual({ ok: false, code: "CALLBACK_URL_REFUSED" });
    expect(calls).toHaveLength(0);
    for (const ip of ["10.1.2.3", "127.0.0.1", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "104.16.1.1", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("retries once on network errors and 5xx only, and reports refusals", async () => {
    let n = 0;
    const flaky = deps(() => { n += 1; if (n === 1) throw new Error("reset"); return ok(); });
    expect(await call(flaky.deps)).toEqual({ ok: true, state: "delivered" });
    expect(flaky.calls).toHaveLength(2);
    const refused = deps(() => Response.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 }));
    expect(await call(refused.deps)).toEqual({ ok: false, code: "SHOP_UNAUTHORIZED" });
    expect(refused.calls).toHaveLength(1);
    expect(await call(deps(() => new Response("<html>", { status: 403 })).deps)).toEqual({ ok: false, code: "SHOP_BLOCKED" });
    expect(await call(deps(() => new Response("<html>ok</html>", { status: 200 })).deps)).toEqual({ ok: false, code: "SHOP_HTTP_200" });
    expect(await call(deps(() => Response.redirect("https://evil.example.com/", 302)).deps)).toEqual({ ok: false, code: "SHOP_HTTP_302" });
    expect(await call(deps(ok).deps, URL_OK, "unknown")).toEqual({ ok: false, code: "CALLBACK_KEY_UNKNOWN" });
  });
});

describe("edited order e-mail", () => {
  const form = (entries: [string, string | File][]) => {
    const data = new FormData();
    for (const [key, value] of [["subject", "Objet"], ["html", "<p>Bonjour</p>"], ...entries] as [string, string | File][]) {
      if (typeof value === "string") data.append(key, value); else data.append(key, value, value.name);
    }
    return data;
  };
  const file = (name: string, type: string, size = 10) => {
    const bytes = new Uint8Array(size);
    bytes.set([0x25, 0x50, 0x44, 0x46]); // %PDF
    return new File([bytes], name, { type });
  };

  it("sanitizes the HTML and keeps the subject on one line", () => {
    const result = sanitizeOrderEmailOverride({
      subject: "Commande\r\nBcc: x@evil.example",
      html: '<p onclick="x()">Bonjour<script>alert(1)</script><a href="javascript:alert(1)">l</a><iframe src="https://e"></iframe></p>',
    });
    expect(result.subject).toBe("Commande Bcc: x@evil.example");
    expect(result.html).not.toMatch(/script|onclick|iframe|javascript:/i);
    expect(result.text).toContain("Bonjour");
    expect(() => sanitizeOrderEmailOverride({ subject: " ", html: "<p>x</p>" })).toThrow(/objet/);
    expect(() => sanitizeOrderEmailOverride({ subject: "x", html: "<p> </p>" })).toThrow(/vide/);
    expect(() => sanitizeOrderEmailOverride({ subject: "x".repeat(201), html: "<p>x</p>" })).toThrow();
  });

  it("keeps the chosen documents and added files", async () => {
    const parsed = await parseReviewedEmail(form([["licence", "dlord-a"], ["files", file("guide.pdf", "application/pdf")]]), ["dlord-a", "dlord-b"]);
    expect(parsed).toMatchObject({ includeInvoice: false, licenceOrderIds: ["dlord-a"] });
    expect(parsed.extraAttachments.map((entry) => entry.filename)).toEqual(["guide.pdf"]);
  });

  it("refuses another order's licence, dangerous or oversized files", async () => {
    await expect(parseReviewedEmail(form([["licence", "dlord-z"]]), ["dlord-a"])).rejects.toThrow(/inconnue/);
    for (const bad of [file("a.html", "text/html"), file("a.svg", "image/svg+xml"), file("a.exe", "application/pdf"), file("a.bin", ""), file("a.js", "text/javascript")]) {
      await expect(parseReviewedEmail(form([["files", bad]]), [])).rejects.toThrow(/non autorisé/);
    }
    await expect(parseReviewedEmail(form([["files", file("a.pdf", "application/pdf", 4 * 1024 * 1024 + 1)]]), [])).rejects.toThrow(/4 Mo/);
    await expect(parseReviewedEmail(form(Array.from({ length: 11 }, (_, i) => ["files", file(`${i}.pdf`, "application/pdf")] as [string, File])), [])).rejects.toThrow(/10 fichiers/);
    expect(safeAttachmentName('../../e\u202etc/pa"ss\r\n.pdf')).toBe("pa_ss_.pdf");
  });
});
