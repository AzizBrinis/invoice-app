#!/usr/bin/env node
/**
 * Deeper NON-DESTRUCTIVE security probe of the production integration.
 *
 *   node scripts/security/prod-security-deep.mjs
 *   LICENCE_KEY="ts-licences-prod:<secret>" INVOICE_KEY="ts-invoices-prod:<secret>" node scripts/security/prod-security-deep.mjs
 *
 * Goes past "is it refused" into: injection payloads, auth-bypass tricks, IDOR,
 * method/header fuzzing, security-header audit, CORS, and sensitive-file
 * discovery. It still creates nothing (no order, invoice, licence or e-mail)
 * and sends only a modest, spaced volume so a WAF does not ban the runner.
 *
 * Exit code is always 0: this is a report, read WARN/FAIL lines and decide.
 * Overrides: APP_URL (https://techno-smart.net), SHOP_URL (https://techno-smart.tn)
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

const APP = (process.env.APP_URL ?? "https://techno-smart.net").replace(/\/$/, "");
const SHOP = (process.env.SHOP_URL ?? "https://techno-smart.tn").replace(/\/$/, "");
const ORDERS = "/api/integrations/prestashop/digital-orders";
const INVOICES = "/api/integrations/prestashop/invoices";
const LICENCES = "/api/integrations/digital-products/licences";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

let pass = 0, fail = 0, warn = 0, info = 0;
const log = (lvl, name, detail) => {
  ({ PASS: () => pass++, FAIL: () => fail++, WARN: () => warn++, INFO: () => info++ }[lvl])();
  console.log(`${lvl}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const rnd = () => randomBytes(16).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, init = {}) {
  try {
    const headers = url.startsWith(SHOP) ? { "user-agent": UA, ...init.headers } : init.headers;
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000), ...init, headers });
    const text = await r.text();
    let code; try { code = JSON.parse(text).error?.code; } catch { /* */ }
    return { status: r.status, code, text, headers: r.headers };
  } catch (e) { return { status: 0, code: String(e.cause?.code ?? e.name), text: "", headers: new Headers() }; }
}
function sign({ path, body, keyId, secret, scheme = "DPLIC1", ts = String(Math.floor(Date.now() / 1000)), n = rnd(), key = `deep-${Date.now()}-${rnd().slice(0, 6)}` }) {
  const sig = "v1=" + createHmac("sha256", secret).update([scheme, "POST", path, ts, n, key, sha(body)].join("\n")).digest("hex");
  return { "content-type": "application/json", "x-signature-key-id": keyId, "x-signature-timestamp": ts, "x-signature-nonce": n, "idempotency-key": key, "x-signature": sig };
}
const parseKey = (v) => { if (!v) return null; const i = v.indexOf(":"); return i > 0 ? { id: v.slice(0, i), secret: v.slice(i + 1) } : null; };
// Any of these means the request was turned away (app 401/422 or edge WAF 403).
const refused = (s) => [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(s);
// 0 = the TCP/TLS layer refused the verb outright (TRACE/CONNECT): also fine.
const rejectedOrUnsupported = (s) => refused(s) || s === 0;

const lic = parseKey(process.env.LICENCE_KEY);
const inv = parseKey(process.env.INVOICE_KEY);

// ── 1. invoice-app: HTTP method & smuggling surface ───────────────────────────
console.log(`\n== invoice-app method / header fuzzing (${APP}) ==`);
for (const m of ["PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", "HEAD", "CONNECT", "FOO"]) {
  const r = await req(APP + ORDERS, { method: m });
  // Mutating verbs must be refused; OPTIONS/HEAD may legitimately answer 2xx/405.
  const ok = rejectedOrUnsupported(r.status) || (["OPTIONS", "HEAD"].includes(m) && r.status < 300);
  log(ok ? "PASS" : "WARN", `method ${m} not accepted`, String(r.status));
}
{
  const r = await req(APP + ORDERS, { method: "POST", headers: { "content-type": "application/json", "transfer-encoding": "chunked", "content-length": "4" }, body: '{"schemaVersion":1}' });
  log(rejectedOrUnsupported(r.status) ? "PASS" : "WARN", "TE+CL smuggling header rejected", String(r.status));
}
{ // many/huge headers
  const headers = { "content-type": "application/json" };
  for (let i = 0; i < 60; i++) headers[`x-fuzz-${i}`] = "a".repeat(2000);
  const r = await req(APP + ORDERS, { method: "POST", headers, body: "{}" });
  log(refused(r.status) ? "PASS" : "WARN", "oversized/many headers rejected", String(r.status));
}

// ── 2. invoice-app: security headers ──────────────────────────────────────────
// Read on a real 200 page: an edge-WAF 403 block page would not carry the app's
// own headers, so reading those would give false "missing" results.
console.log(`\n== invoice-app response headers (/connexion) ==`);
{
  const r = await req(APP + "/connexion");
  const h = (k) => r.headers.get(k) ?? "";
  if (r.status !== 200) log("WARN", "headers inconclusive (page not 200 — edge blocked?)", String(r.status));
  log(h("x-content-type-options").toLowerCase() === "nosniff" ? "PASS" : "WARN", "X-Content-Type-Options nosniff", h("x-content-type-options") || "missing");
  log(/no-store/.test(h("cache-control")) ? "PASS" : "WARN", "app pages no-store", h("cache-control") || "missing");
  log(/content-security-policy/i.test([...r.headers.keys()].join()) ? "PASS" : "WARN", "CSP set", h("content-security-policy") ? "present" : "missing");
  log(h("x-frame-options") || /frame-ancestors/.test(h("content-security-policy")) ? "PASS" : "WARN", "clickjacking protection", h("x-frame-options") || (/(frame-ancestors)/.exec(h("content-security-policy"))?.[0] ?? "none"));
  log(h("referrer-policy") ? "PASS" : "WARN", "Referrer-Policy", h("referrer-policy") || "none");
  log(h("permissions-policy") ? "PASS" : "WARN", "Permissions-Policy", h("permissions-policy") ? "present" : "none");
  const sts = h("strict-transport-security");
  log(/max-age=([1-9]\d{6,})/.test(sts) ? "PASS" : "WARN", "app HSTS", sts || "missing");
}

// ── 3. invoice-app: CORS / origin reflection ──────────────────────────────────
console.log(`\n== invoice-app CORS ==`);
{
  const r = await req(APP + ORDERS, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
  const acao = r.headers.get("access-control-allow-origin") ?? "";
  log(acao === "" || acao === APP ? "PASS" : "FAIL", "no cross-origin reflection", acao ? acao : "no ACAO header");
  log(r.headers.get("access-control-allow-credentials") !== "true" || acao !== "*" ? "PASS" : "FAIL", "no credentials with wildcard origin");
}

// ── 4. invoice-app: auth-bypass & injection on the signed endpoints ───────────
console.log(`\n== invoice-app auth-bypass / injection ==`);
const B = JSON.stringify({ schemaVersion: 1 });
const bypass = [
  ["null-byte in key id", { ...sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64) }), "x-signature-key-id": "ts-licences-prod\u0000" }],
  ["array key id header", { ...sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64) }), "x-signature-key-id": "ts-licences-prod, admin" }],
  ["empty signature", { ...sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64) }), "x-signature": "" }],
  ["sha1-style signature", { ...sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64) }), "x-signature": "v1=" + "a".repeat(40) }],
  ["signature without v1= prefix", { ...sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64) }), "x-signature": "a".repeat(64) }],
  ["future timestamp (+1h)", sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64), ts: String(Math.floor(Date.now() / 1000) + 3600) }) ],
  ["negative timestamp", sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64), ts: "-1" }) ],
  ["nonce too short", sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64), n: "abc" }) ],
  ["path-traversal idem key", { ...sign({ path: ORDERS, body: B, keyId: "ts-licences-prod", secret: "x".repeat(64), key: "ok" }), "idempotency-key": "../../etc/passwd" }],
];
for (const [name, headers] of bypass) {
  const r = await req(APP + ORDERS, { method: "POST", body: B, headers });
  // Any refusal is a pass (app 400/401/415, or edge WAF 403). Only 200/201/5xx is bad.
  log(rejectedOrUnsupported(r.status) ? "PASS" : "FAIL", name, `${r.status}${r.code ? " " + r.code : ""}`);
  await sleep(120);
}
{ // host-header injection
  const r = await req(APP + ORDERS, { method: "POST", headers: { "content-type": "application/json", host: "evil.example", "x-forwarded-host": "evil.example" }, body: "{}" });
  log(refused(r.status) && !/evil\.example/.test(r.text) ? "PASS" : "WARN", "host-header injection ignored", String(r.status));
}

// ── 5. invoice-app: IDOR / enumeration on the licence PDF route ────────────────
console.log(`\n== invoice-app IDOR / object access ==`);
for (const id of ["dlord-00000000-0000-0000-0000-000000000000", "dlord-11111111-1111-1111-1111-111111111111", "../../etc/passwd", "1 OR 1=1", "dlord-%2e%2e"]) {
  const r = await req(APP + "/api/produits-digitaux/licences/" + encodeURIComponent(id) + "/pdf");
  // Must never reach content without a session: 401/403/404 only, never 200/500.
  log([401, 403, 404].includes(r.status) ? "PASS" : "FAIL", `licence PDF id "${id.slice(0, 24)}"`, String(r.status));
}
for (const p of ["/produits-digitaux/kaspersky/licences", "/produits-digitaux/kaspersky/codes", "/factures", "/api/produits-digitaux/licences"]) {
  const r = await req(APP + p);
  log([301, 302, 303, 307, 308, 401, 403, 404, 405].includes(r.status) ? "PASS" : "FAIL", `gated page ${p}`, String(r.status));
}

// ── 6. invoice-app: signed injection with the REAL keys (payload validation) ──
if (lic || inv) {
  console.log(`\n== signed payload validation with real keys (nothing created) ==`);
  const inject = (ref) => JSON.stringify({ schemaVersion: 1, invoice: { order: { reference: ref } }, licences: [] });
  const payloads = [
    ["SQL in order reference", inject("1' OR '1'='1")],
    ["XSS in order reference", inject("<script>alert(1)</script>")],
    ["path traversal reference", inject("../../etc/passwd")],
    ["prototype pollution", JSON.stringify({ schemaVersion: 1, __proto__: { admin: true }, invoice: {}, licences: [] })],
    ["unknown top-level field", JSON.stringify({ schemaVersion: 1, evil: 1, invoice: {}, licences: [] })],
    ["huge quantity", JSON.stringify({ schemaVersion: 1, invoice: {}, licences: [{ lineId: 1, sku: "kaspersky-plus-1p-1y", quantity: 999999999 }] })],
  ];
  const k = lic ?? inv; const scheme = lic ? "DPLIC1" : "PSINV1"; const path = lic ? ORDERS : INVOICES;
  for (const [name, body] of payloads) {
    const r = await req(APP + path, { method: "POST", body, headers: sign({ path, body, keyId: k.id, secret: k.secret, scheme }) });
    // Malformed → app must answer 400/409/422, never 200/201/5xx. A 403 means the
    // edge WAF blocked it first: the app's own validation was not exercised (inconclusive).
    const lvl = [400, 409, 422].includes(r.status) ? "PASS" : r.status === 403 ? "WARN" : [200, 201].includes(r.status) || r.status >= 500 ? "FAIL" : "WARN";
    log(lvl, name, `${r.status}${r.code ? " " + r.code : ""}${lvl === "WARN" && r.status === 403 ? " edge-blocked, rerun slower" : ""}`);
    await sleep(600);
  }
}

// ── 7. PrestaShop: sensitive files & admin discovery ──────────────────────────
console.log(`\n== PrestaShop sensitive paths (${SHOP}) ==`);
const sensitive = [
  "/.env", "/.git/config", "/composer.json", "/composer.lock",
  "/app/config/parameters.php", "/config/settings.inc.php", "/config/settings.old.php",
  "/var/logs/prod.log", "/var/logs/dev.log", "/admin/", "/install/", "/install-dev/",
  "/phpmyadmin/", "/.htaccess", "/backup/", "/.DS_Store",
  "/modules/tsinvoiceapp/config_fr.xml", "/modules/tsinvoiceapp/tsinvoiceapp.php",
  "/modules/tsinvoiceapp/classes/Config.php", "/modules/tsinvoiceapp/logs/",
];
for (const p of sensitive) {
  const r = await req(SHOP + p);
  const leak = r.status === 200 && /define\(|DB_|_DB_|parameters|APP_SECRET|password|BEGIN|root:x:|\[core\]/i.test(r.text);
  // Empty 200 = a PHP file behind the "_PS_VERSION_" guard (no content served): fine.
  const emptyGuard = r.status === 200 && r.text.trim() === "";
  log(leak ? "FAIL" : r.status === 200 && !emptyGuard ? "WARN" : "PASS", `path ${p}`, `${r.status}${leak ? " LEAK" : emptyGuard ? " empty" : ""}`);
  await sleep(120);
}

// ── 8. PrestaShop: classic param tampering (no WAF-tripping payloads) ──────────
console.log(`\n== PrestaShop param handling ==`);
for (const [name, path] of [
  ["SQL-ish id_product", "/index.php?controller=product&id_product=1%27"],
  ["path traversal in controller", "/index.php?controller=../../../../etc/passwd"],
  ["XSS reflected in search", "/index.php?controller=search&s=%3Cscript%3Ealert(1)%3C/script%3E"],
]) {
  const r = await req(SHOP + path);
  const sqlErr = /SQL syntax|mysqli|PDOException|You have an error in your SQL/i.test(r.text);
  const xss = /<script>alert\(1\)<\/script>/.test(r.text);
  log(sqlErr ? "FAIL" : xss ? "FAIL" : "PASS", name, sqlErr ? "SQL error leaked" : xss ? "unescaped reflection" : String(r.status));
  await sleep(150);
}
{ // directory listing on module dirs
  const r = await req(SHOP + "/modules/tsinvoiceapp/classes/");
  log(/Index of|Directory listing|<a href="autoload/i.test(r.text) ? "FAIL" : "PASS", "no module directory listing", String(r.status));
}

console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings, ${info} info`);
