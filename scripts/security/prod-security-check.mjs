#!/usr/bin/env node
/**
 * Non-destructive security check of the production PrestaShop ↔ invoice-app integration.
 *
 *   node scripts/security/prod-security-check.mjs
 *
 * Every request is one that MUST be refused: nothing is created (no order,
 * invoice, licence or e-mail). Signed probes only add a replay-protection nonce.
 *
 * Optional, to also prove the real keys (values never printed):
 *   LICENCE_KEY="ts-licences-prod:<secret>" INVOICE_KEY="ts-invoices-prod:<secret>" node scripts/security/prod-security-check.mjs
 * Overrides: APP_URL (default https://techno-smart.net), SHOP_URL (default https://techno-smart.tn)
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

const APP = (process.env.APP_URL ?? "https://techno-smart.net").replace(/\/$/, "");
const SHOP = (process.env.SHOP_URL ?? "https://techno-smart.tn").replace(/\/$/, "");
const ORDERS = "/api/integrations/prestashop/digital-orders";
const INVOICES = "/api/integrations/prestashop/invoices";
const LICENCES = "/api/integrations/digital-products/licences";

let pass = 0, fail = 0, warn = 0;
const result = (ok, name, detail) => {
  ok === true ? pass++ : ok === "warn" ? warn++ : fail++;
  console.log(`${ok === true ? "PASS" : ok === "warn" ? "WARN" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const nonce = () => randomBytes(16).toString("hex");
const now = () => String(Math.floor(Date.now() / 1000));

function signed({ path, body, keyId, secret, scheme = "DPLIC1", ts = now(), n = nonce(), key = `sec-probe-${Date.now()}-${nonce().slice(0, 6)}` }) {
  const sig = "v1=" + createHmac("sha256", secret).update([scheme, "POST", path, ts, n, key, sha(body)].join("\n")).digest("hex");
  return { "content-type": "application/json", "x-signature-key-id": keyId, "x-signature-timestamp": ts,
    "x-signature-nonce": n, "idempotency-key": key, "x-signature": sig };
}
// The shop sits behind Cloudflare, which answers 403 to non-browser clients.
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
async function req(url, init = {}) {
  try {
    const headers = url.startsWith(SHOP) ? { "user-agent": BROWSER_UA, ...init.headers } : init.headers;
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000), ...init, headers });
    const text = await r.text();
    let code; try { code = JSON.parse(text).error?.code; } catch { /* not JSON */ }
    return { status: r.status, code, text, headers: r.headers };
  } catch (e) { return { status: 0, code: String(e.cause?.code ?? e.name), text: "", headers: new Headers() }; }
}
const expect = async (name, url, init, statuses) => {
  const r = await req(url, init);
  result(statuses.includes(r.status), name, `${r.status}${r.code ? " " + r.code : ""}`);
  return r;
};
const parseKey = (v) => { if (!v) return null; const i = v.indexOf(":"); return i > 0 ? { id: v.slice(0, i), secret: v.slice(i + 1) } : null; };

const FAKE = "x".repeat(64);
const BODY = JSON.stringify({ schemaVersion: 1 });

console.log(`\n== invoice-app API (${APP}) ==`);
for (const p of [ORDERS, INVOICES, LICENCES]) {
  await expect(`GET ${p} refused`, APP + p, {}, [405]);
  await expect(`unsigned POST ${p} refused`, APP + p, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, [401]);
}
await expect("forged signature (random secret)", APP + ORDERS, { method: "POST", body: BODY, headers: signed({ path: ORDERS, body: BODY, keyId: "ts-licences-prod", secret: FAKE }) }, [401]);
await expect("unknown key id", APP + ORDERS, { method: "POST", body: BODY, headers: signed({ path: ORDERS, body: BODY, keyId: "attacker", secret: FAKE }) }, [401]);
await expect("malformed signature header", APP + ORDERS, { method: "POST", body: BODY, headers: { ...signed({ path: ORDERS, body: BODY, keyId: "ts-licences-prod", secret: FAKE }), "x-signature": "v1=zz" } }, [401]);
await expect("missing Idempotency-Key", APP + ORDERS, { method: "POST", body: BODY, headers: { ...signed({ path: ORDERS, body: BODY, keyId: "ts-licences-prod", secret: FAKE }), "idempotency-key": "" } }, [401]);
await expect("wrong content-type", APP + ORDERS, { method: "POST", body: BODY, headers: { ...signed({ path: ORDERS, body: BODY, keyId: "ts-licences-prod", secret: FAKE }), "content-type": "text/plain" } }, [415]);
const big = JSON.stringify({ pad: "x".repeat(1100 * 1024) });
await expect("oversized body (>1 MiB)", APP + ORDERS, { method: "POST", body: big, headers: signed({ path: ORDERS, body: big, keyId: "ts-licences-prod", secret: FAKE }) }, [413]);
await expect("licence PDF without session", APP + "/api/produits-digitaux/licences/dlord-00000000-0000-0000-0000-000000000000/pdf", {}, [401]);
await expect("internal probe without token", APP + "/api/internal/document-precision", {}, [404]);
const http = await req(APP.replace(/^https:/, "http:") + ORDERS, { method: "POST" });
result([301, 302, 307, 308].includes(http.status), "plain HTTP redirected to HTTPS", String(http.status));
const errBody = await req(APP + ORDERS, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
result(!/stack|at \w+ \(|prisma|postgres|supabase|SELECT /i.test(errBody.text), "error body leaks no internals");
result(errBody.headers.get("cache-control")?.includes("no-store") ?? false, "API responses are no-store");
const admin = await req(APP + "/produits-digitaux/kaspersky/licences");
result([302, 303, 307, 308, 401, 403].includes(admin.status), "admin licence pages need login", String(admin.status));

const lic = parseKey(process.env.LICENCE_KEY), inv = parseKey(process.env.INVOICE_KEY);
if (lic || inv) console.log("\n== with the real keys (no data created) ==");
if (lic) {
  const h = signed({ path: ORDERS, body: BODY, keyId: lic.id, secret: lic.secret });
  await expect("licence key accepted (invalid payload → 422)", APP + ORDERS, { method: "POST", body: BODY, headers: h }, [422]);
  await expect("same request replayed (nonce) refused", APP + ORDERS, { method: "POST", body: BODY, headers: h }, [401]);
  await expect("signature for another path refused", APP + ORDERS, { method: "POST", body: BODY, headers: signed({ path: LICENCES, body: BODY, keyId: lic.id, secret: lic.secret }) }, [401]);
  await expect("stale timestamp (-1 h) refused", APP + ORDERS, { method: "POST", body: BODY, headers: signed({ path: ORDERS, body: BODY, keyId: lic.id, secret: lic.secret, ts: String(Number(now()) - 3600) }) }, [401]);
  await expect("body changed after signing refused", APP + ORDERS, { method: "POST", body: '{"schemaVersion":2}', headers: signed({ path: ORDERS, body: BODY, keyId: lic.id, secret: lic.secret }) }, [401]);
  await expect("invoice scheme (PSINV1) with licence key refused", APP + ORDERS, { method: "POST", body: BODY, headers: signed({ path: ORDERS, body: BODY, keyId: lic.id, secret: lic.secret, scheme: "PSINV1" }) }, [401]);
}
if (inv) {
  await expect("invoice key accepted on invoices (invalid payload → 422)", APP + INVOICES, { method: "POST", body: BODY, headers: signed({ path: INVOICES, body: BODY, keyId: inv.id, secret: inv.secret, scheme: "PSINV1" }) }, [422]);
  await expect("invoice key refused on digital-orders", APP + ORDERS, { method: "POST", body: BODY, headers: signed({ path: ORDERS, body: BODY, keyId: inv.id, secret: inv.secret }) }, [401]);
}

console.log(`\n== PrestaShop module files (${SHOP}) ==`);
const M = SHOP + "/modules/tsinvoiceapp";
await expect("tests/ folder not deployed or denied", M + "/tests/unit.php", {}, [403, 404]);
await expect("README.md denied", M + "/README.md", {}, [403, 404]);
await expect("Smarty templates denied", M + "/views/templates/hook/order_licences.tpl", {}, [403, 404]);
const cls = await req(M + "/classes/LicenceClient.php");
result([403, 404].includes(cls.status) || (cls.status === 200 && cls.text.trim() === ""), "PHP classes not executable/readable directly", String(cls.status));
const root = await req(M + "/");
result(!/Index of|<a href="classes/i.test(root.text), "no directory listing", String(root.status));
await expect("private PDF folder not reachable", SHOP + "/var/tsinvoiceapp/", {}, [403, 404]);
const cron = (t) => `${SHOP}/index.php?fc=module&module=tsinvoiceapp&controller=licencecron${t === undefined ? "" : `&token=${t}`}`;
await expect("retry cron without token refused", cron(), {}, [403]);
await expect("retry cron with wrong token refused", cron("not-the-token"), {}, [403]);
const shopHome = await req(SHOP + "/");
const hsts = shopHome.headers.get("strict-transport-security") ?? "";
result(shopHome.status === 200 ? true : "warn", "shop reachable for these checks", String(shopHome.status));
result(/max-age=([1-9]\d{6,})/.test(hsts) ? true : "warn", "shop HSTS enabled (max-age ≥ ~12 days)", hsts || "missing");

console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings`);
process.exit(fail ? 1 : 0);
