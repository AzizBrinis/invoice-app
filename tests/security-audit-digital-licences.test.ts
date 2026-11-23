import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Adversarial security tests for Kaspersky activation codes, run against a
 * real Postgres (TEST_DATABASE_URL) with the real store, crypto, signature
 * and nonce store. Only the Chromium PDF renderer and the session lookup are
 * replaced: the "PDF" is the rendered HTML, so tests can see exactly which
 * codes reach the document.
 */

const pdfState = vi.hoisted(() => ({ delayMs: 0, html: [] as string[] }));
vi.mock("@/server/pdf", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  renderPdfFromHtml: async (html: string) => {
    pdfState.html.push(html);
    if (pdfState.delayMs) await new Promise((r) => setTimeout(r, pdfState.delayMs));
    return Buffer.from(html, "utf8");
  },
}));

const authState = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => authState.user,
  requireUser: async () => {
    if (!authState.user) throw new Error("UNAUTHENTICATED");
    return authState.user;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const redirectState = vi.hoisted(() => ({ targets: [] as string[] }));
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    redirectState.targets.push(target);
    const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw error;
  },
}));

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { formatLicenceCode } from "@/lib/digital-products/licence-code-format";
import { handleLicenceApiRequest } from "@/server/digital-products/api";
import { loadLicenceApiConfig, LICENCE_API_PATH } from "@/server/digital-products/api-config";
import { decryptLicenceCode } from "@/server/digital-products/licence-crypto";
import {
  importLicenceCodes,
  parseLicenceRequest,
  renderLicenceOrderPdf,
  requestLicenceDocument,
} from "@/server/digital-products/licences";
import {
  cancelPendingLicenceOrder,
  getOrderCodeCiphertexts,
  InsufficientLicenceStockError,
  listLicenceCodes,
  listLicenceOrders,
  revokeLicenceCode,
} from "@/server/digital-products/store";
import { computeSignature, sha256Hex } from "@/server/integrations/prestashop/signature";
import { GET as pdfRoute } from "@/app/api/produits-digitaux/licences/[id]/pdf/route";
import {
  cancelLicenceAction,
  generateLicenceAction,
  importCodesAction,
  revokeCodeAction,
} from "@/app/(app)/produits-digitaux/actions";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const SKU = "kaspersky-standard-3p-1y";
const SKU2 = "kaspersky-plus-5p-1y";
const KEY_ID = "audit-key";
const SECRET = "audit-secret-0123456789abcdef0123456789abcdef";
const run = Date.now().toString(36).toUpperCase().slice(-6).padStart(6, "Q");

let seq = 0;
function freshCodes(n: number, tag = "A") {
  return Array.from({ length: n }, () => {
    seq += 1;
    return `Z${tag}${run}${String(seq).padStart(12, "0")}`.slice(0, 20);
  });
}

function admin(tenantId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: tenantId,
    tenantId,
    activeTenantId: tenantId,
    role: "ADMIN",
    accountType: "FULL_APP",
    membershipRole: "OWNER",
    permissions: [],
    ...overrides,
  };
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

function apiConfig(tenantId: string, extra: Record<string, string> = {}) {
  return () =>
    loadLicenceApiConfig({
      DIGITAL_LICENCE_TENANT_ID: tenantId,
      DIGITAL_LICENCE_API_KEYS: `${KEY_ID}:${SECRET}`,
      NODE_ENV: "production",
      ...extra,
    });
}

function signed(body: unknown, opts: { idem?: string; ip?: string; headers?: Record<string, string>; accept?: string } = {}) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const idempotencyKey = opts.idem ?? `audit-${randomBytes(8).toString("hex")}`;
  const signature = computeSignature(SECRET, {
    method: "POST",
    path: LICENCE_API_PATH,
    timestamp,
    nonce,
    idempotencyKey,
    bodySha256Hex: sha256Hex(raw),
    scheme: "DPLIC1",
  });
  return new Request(`https://invoices.example.com${LICENCE_API_PATH}`, {
    method: "POST",
    body: raw,
    headers: {
      "content-type": "application/json",
      accept: opts.accept ?? "application/json",
      "x-forwarded-proto": "https",
      "x-signature-key-id": KEY_ID,
      "x-signature-timestamp": timestamp,
      "x-signature-nonce": nonce,
      "idempotency-key": idempotencyKey,
      "x-signature": signature,
      "x-real-ip": opts.ip ?? "198.51.100.7",
      ...opts.headers,
    },
  });
}

async function codeRows(tenantId: string) {
  return prisma.$queryRaw<{ id: string; status: string; orderId: string | null }[]>(Prisma.sql`
    SELECT "id", "status", "orderId" FROM "DigitalLicenceCode" WHERE "userId" = ${tenantId}
  `);
}

async function dumpAllLicenceData(): Promise<string> {
  const tables = ["DigitalLicenceCode", "DigitalLicenceOrder", "DigitalLicenceEvent", "IntegrationRequestNonce"];
  const parts: string[] = [];
  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<{ j: string }[]>(
      `SELECT row_to_json(t)::text AS j FROM "${table}" t`,
    );
    parts.push(...rows.map((r) => r.j));
  }
  return parts.join("\n");
}

describeWithDb("SECURITY AUDIT — Kaspersky activation codes", () => {
  let tenantA: string;
  let tenantB: string;
  const allPlainCodes: string[] = [];
  const consoleLines: string[] = [];

  beforeAll(async () => {
    const mk = (label: string) =>
      prisma.user.create({
        data: { email: `audit-${label}-${run}@example.com`, passwordHash: "x", name: `Audit ${label}` },
      });
    tenantA = (await mk("a")).id;
    tenantB = (await mk("b")).id;
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        consoleLines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      });
    }
  });

  afterAll(async () => {
    for (const t of [tenantA, tenantB].filter(Boolean)) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceEvent" WHERE "userId" = ${t}`);
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceCode" WHERE "userId" = ${t}`);
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceOrder" WHERE "userId" = ${t}`);
      await prisma.user.delete({ where: { id: t } });
    }
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Per-key rate limiting is persisted; isolate each test's budget.
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "IntegrationRequestNonce" WHERE "keyId" = ${`dplic:${KEY_ID}`}`,
    );
    pdfState.delayMs = 0;
    pdfState.html = [];
    redirectState.targets = [];
    authState.user = null;
  });

  async function stock(tenantId: string, n: number, sku = SKU) {
    const codes = freshCodes(n);
    allPlainCodes.push(...codes);
    const summary = await importLicenceCodes({ tenantId, actorUserId: tenantId, sku, text: codes.join("\n") });
    expect(summary.imported).toBe(n);
    return codes;
  }

  // -------------------------------------------------------------------------
  describe("1. encryption at rest", () => {
    it("stores no plaintext code anywhere in licence tables; ciphertexts are unique per row", async () => {
      const codes = await stock(tenantA, 10);
      const dump = await dumpAllLicenceData();
      for (const code of codes) {
        expect(dump).not.toContain(code);
        expect(dump).not.toContain(formatLicenceCode(code));
        expect(dump).not.toContain(code.slice(0, 16)); // nothing beyond the 4-char hint
      }
      const rows = await prisma.$queryRaw<{ codeCiphertext: string; codeHint: string; codeFingerprint: string }[]>(
        Prisma.sql`SELECT "codeCiphertext", "codeHint", "codeFingerprint" FROM "DigitalLicenceCode" WHERE "userId" = ${tenantA}`,
      );
      expect(rows.every((r) => /^v1:[A-Za-z0-9_-]+$/.test(r.codeCiphertext))).toBe(true);
      expect(rows.every((r) => r.codeHint.length === 4)).toBe(true);
      expect(new Set(rows.map((r) => r.codeCiphertext)).size).toBe(rows.length);
      expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.codeFingerprint))).toBe(true);
    });

    it("refuses a ciphertext moved to another row or tenant (AAD binding) and tampered ciphertext", async () => {
      const rows = await prisma.$queryRaw<{ id: string; codeCiphertext: string }[]>(
        Prisma.sql`SELECT "id", "codeCiphertext" FROM "DigitalLicenceCode" WHERE "userId" = ${tenantA} LIMIT 2`,
      );
      const [a, b] = rows;
      expect(() => decryptLicenceCode({ tenantId: tenantA, codeId: b.id, ciphertext: a.codeCiphertext })).toThrow();
      expect(() => decryptLicenceCode({ tenantId: tenantB, codeId: a.id, ciphertext: a.codeCiphertext })).toThrow();
      const flipped = a.codeCiphertext.slice(0, -2) + (a.codeCiphertext.endsWith("A") ? "BB" : "AA");
      expect(() => decryptLicenceCode({ tenantId: tenantA, codeId: a.id, ciphertext: flipped })).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe("2. authentication & permissions (admin PDF route + server actions)", () => {
    let orderA: string;
    beforeAll(async () => {
      await stock(tenantA, 4, SKU2);
      const r = await requestLicenceDocument({
        tenantId: tenantA,
        request: parseLicenceRequest({ sku: SKU2, quantity: 2 }),
        idempotencyKey: `audit:${run}:authz`,
        source: "MANUAL",
        actor: "test",
      });
      orderA = r.order.id;
    });
    const call = (id: string) =>
      pdfRoute(new Request(`http://localhost/api/produits-digitaux/licences/${id}/pdf`), {
        params: Promise.resolve({ id }),
      });

    it("PDF route: 401 anonymous, 403 for every non-admin profile", async () => {
      expect((await call(orderA)).status).toBe(401);
      const denied = [
        { role: "VIEWER" },
        { role: "ACCOUNTANT" },
        { membershipRole: "MEMBER" },
        { membershipRole: "ADMIN", role: "VIEWER" },
        { accountType: "CLIENT_PAYMENTS" },
      ];
      for (const overrides of denied) {
        authState.user = admin(tenantA, overrides);
        const res = await call(orderA);
        expect(res.status, JSON.stringify(overrides)).toBe(403);
        expect(res.headers.get("content-type")).not.toContain("pdf");
      }
      expect(pdfState.html).toHaveLength(0);
    });

    it("PDF route IDOR: admin of tenant B cannot fetch tenant A's licence; codes stay RESERVED", async () => {
      authState.user = admin(tenantB);
      const res = await call(orderA);
      expect(res.status).toBe(409);
      expect(await res.text()).not.toContain("PDF");
      expect(pdfState.html).toHaveLength(0);
      const rows = (await codeRows(tenantA)).filter((r) => r.orderId === orderA);
      expect(rows.every((r) => r.status === "RESERVED")).toBe(true);
    });

    it("PDF route rejects malformed / injected ids with 404", async () => {
      authState.user = admin(tenantA);
      for (const id of ["dlord-' OR '1'='1", "../../etc/passwd", `${orderA}' --`, "dlord-%00"]) {
        expect((await call(id)).status).toBe(404);
      }
    });

    it("PDF route serves owner admin with no-store headers", async () => {
      authState.user = admin(tenantA);
      const res = await call(orderA);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(res.headers.get("content-type")).toBe("application/pdf");
    });

    it("server actions refuse non-admins and other tenants", async () => {
      const before = (await codeRows(tenantA)).length;
      authState.user = admin(tenantA, { role: "VIEWER" });
      const imp = await importCodesAction({}, form({ sku: SKU, codes: freshCodes(3).join("\n") }));
      expect(imp.status).toBe("error");
      const gen = await generateLicenceAction({}, form({ sku: SKU, quantity: "1", formToken: crypto.randomUUID() }));
      expect(gen.status).toBe("error");
      expect((await codeRows(tenantA)).length).toBe(before);

      authState.user = null;
      expect((await importCodesAction({}, form({ sku: SKU, codes: freshCodes(1).join("\n") }))).status).toBe("error");

      // Cross-tenant cancel / revoke through the actions.
      authState.user = admin(tenantB);
      await expect(cancelLicenceAction(form({ orderId: orderA }))).rejects.toThrow("NEXT_REDIRECT");
      const codeA = (await codeRows(tenantA)).find((r) => r.status === "AVAILABLE")!;
      await expect(revokeCodeAction(form({ codeId: codeA.id }))).rejects.toThrow("NEXT_REDIRECT");
      const after = await codeRows(tenantA);
      expect(after.find((r) => r.id === codeA.id)!.status).toBe("AVAILABLE");
      const order = await prisma.$queryRaw<{ status: string }[]>(
        Prisma.sql`SELECT "status" FROM "DigitalLicenceOrder" WHERE "id" = ${orderA}`,
      );
      expect(order[0].status).not.toBe("CANCELLED");
    });

    it("redirectTo cannot escape the Kaspersky section (no open redirect)", async () => {
      authState.user = admin(tenantA);
      const hostile = [
        "/produits-digitaux/kaspersky/../..//evil.example",
        "/produits-digitaux/kaspersky\\..\\..\\\\evil.example",
        "/produits-digitaux/kaspersky/../../../evil.example/x",
        "//evil.example/produits-digitaux/kaspersky",
        "https://evil.example/produits-digitaux/kaspersky",
        "/produits-digitaux/kasperskyevil",
        "/\\evil.example",
      ];
      for (const redirectTo of hostile) {
        redirectState.targets = [];
        await expect(revokeCodeAction(form({ codeId: "nope", redirectTo }))).rejects.toThrow("NEXT_REDIRECT");
        expect(redirectState.targets[0], redirectTo).toMatch(/^\/produits-digitaux\/kaspersky\/codes\?/);
      }
      // A legitimate in-section target with its query is kept.
      redirectState.targets = [];
      await expect(
        revokeCodeAction(form({ codeId: "nope", redirectTo: "/produits-digitaux/kaspersky/codes?statut=AVAILABLE" })),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(redirectState.targets[0]).toMatch(/^\/produits-digitaux\/kaspersky\/codes\?statut=AVAILABLE&error=/);
    });
  });

  // -------------------------------------------------------------------------
  describe("3. SQL injection", () => {
    it("filters and search are parameterized and stay tenant-scoped", async () => {
      await stock(tenantB, 2);
      const payloads = ["' OR '1'='1", "%' OR 1=1 --", "\\'; DROP TABLE \"DigitalLicenceCode\"; --", "%", "_"];
      for (const p of payloads) {
        const codes = await listLicenceCodes({ tenantId: tenantB, hint: p, page: 1, pageSize: 100 });
        expect(codes.total).toBe(0);
        const orders = await listLicenceOrders({ tenantId: tenantB, search: p, page: 1, pageSize: 100 });
        expect(orders.total).toBe(0);
        const bySku = await listLicenceCodes({ tenantId: tenantB, productSku: p, page: 1, pageSize: 100 });
        expect(bySku.total).toBe(0);
        const byStatus = await listLicenceCodes({
          tenantId: tenantB,
          status: p as never,
          page: 1,
          pageSize: 100,
        });
        expect(byStatus.total).toBe(0);
      }
      const all = await listLicenceCodes({ tenantId: tenantB, page: 1, pageSize: 100 });
      expect(all.total).toBe(2); // tenant B sees only its own 2 codes, table intact
      await expect(
        importLicenceCodes({ tenantId: tenantB, actorUserId: tenantB, sku: "x' OR '1'='1", text: freshCodes(1)[0] }),
      ).rejects.toThrow("Produit inconnu");
    });

    it("API rejects injected sku / quantity before touching the database", async () => {
      for (const body of [
        { schemaVersion: 1, sku: "kaspersky-standard-3p-1y' OR 1=1--", quantity: 1 },
        { schemaVersion: 1, sku: SKU, quantity: "1; DELETE FROM x" },
        { schemaVersion: 1, sku: SKU, quantity: 1, extra: "x" },
      ]) {
        const res = await handleLicenceApiRequest(signed(body), { loadConfig: apiConfig(tenantB) });
        expect(res.status).toBe(422);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("4. XSS", () => {
    it("customer-controlled fields are escaped in the licence document", async () => {
      await stock(tenantB, 1, SKU2);
      const xss = `<script>alert(1)</script><img src=x onerror=alert(2)>"'`;
      const res = await handleLicenceApiRequest(
        signed({
          schemaVersion: 1,
          sku: SKU2,
          quantity: 1,
          customer: { name: xss },
          order: { reference: `"><svg onload=alert(3)>` },
          activationRegion: `</div><iframe src="file:///etc/passwd">`,
        }),
        { loadConfig: apiConfig(tenantB) },
      );
      expect(res.status).toBe(201);
      const html = pdfState.html.at(-1)!;
      expect(html).not.toMatch(/<script|<img src=x|<svg onload|<iframe/i);
      expect(html).toContain("&lt;script&gt;");
    });
  });

  // -------------------------------------------------------------------------
  describe("5. API exposure (real store, real nonce table)", () => {
    it("codes appear only inside the PDF; JSON/headers/logs carry masks only", async () => {
      const codes = await stock(tenantB, 3, "kaspersky-plus-3p-1y");
      const res = await handleLicenceApiRequest(
        signed({ schemaVersion: 1, sku: "kaspersky-plus-3p-1y", quantity: 3, customer: { email: "victim@example.com" } }),
        { loadConfig: apiConfig(tenantB) },
      );
      expect(res.status).toBe(201);
      const headerText = JSON.stringify([...res.headers.entries()]);
      const body = (await res.json()) as { licence: { codes: string[] }; pdf: { base64: string } };
      const pdfText = Buffer.from(body.pdf.base64, "base64").toString("utf8");
      const withoutPdf = JSON.stringify({ ...body, pdf: { ...body.pdf, base64: "" } });
      const issued = codes.filter((c) => pdfText.includes(formatLicenceCode(c)));
      expect(issued).toHaveLength(3); // exactly the allocated codes are in the PDF
      for (const c of allPlainCodes) {
        expect(withoutPdf).not.toContain(c);
        expect(withoutPdf).not.toContain(formatLicenceCode(c));
        expect(headerText).not.toContain(c);
      }
      expect(body.licence.codes.every((m) => /^•••••-•••••-•••••-•[A-Z0-9]{4}$/.test(m))).toBe(true);
      expect(withoutPdf).not.toContain("v1:");
      // Stock that was not allocated never reaches the PDF.
      const others = allPlainCodes.filter((c) => !codes.includes(c));
      for (const c of others) expect(pdfText).not.toContain(formatLicenceCode(c));
    });

    it("errors are generic and never echo codes, ciphertext or secrets", async () => {
      const responses = await Promise.all([
        handleLicenceApiRequest(signed({ schemaVersion: 1, sku: "kaspersky-standard-1p-1y", quantity: 50 }), { loadConfig: apiConfig(tenantB) }),
        handleLicenceApiRequest(
          new Request(`https://x${LICENCE_API_PATH}`, { method: "POST", body: "{}", headers: { "content-type": "application/json", "x-real-ip": "198.51.100.99" } }),
          { loadConfig: apiConfig(tenantB) },
        ),
        handleLicenceApiRequest(signed({ schemaVersion: 1, sku: SKU, quantity: 1 }), {
          loadConfig: apiConfig(tenantB, { DIGITAL_LICENCE_API_KEYS: "" }),
        }),
      ]);
      expect(responses.map((r) => r.status)).toEqual([409, 401, 503]);
      const text = (await Promise.all(responses.map((r) => r.text()))).join("\n");
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("v1:");
      for (const c of allPlainCodes) expect(text).not.toContain(c);
    });

    it("a corrupted ciphertext fails closed without leaking anything", async () => {
      await stock(tenantB, 1, SKU2);
      const r = await requestLicenceDocument({
        tenantId: tenantB,
        request: parseLicenceRequest({ sku: SKU2, quantity: 1 }),
        idempotencyKey: `audit:${run}:corrupt`,
        source: "MANUAL",
        actor: "test",
      });
      const [cipher] = await getOrderCodeCiphertexts(tenantB, r.order.id);
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "DigitalLicenceCode" SET "codeCiphertext" = ${cipher.codeCiphertext.slice(0, -3) + "AAA"} WHERE "id" = ${cipher.id}`,
      );
      await expect(renderLicenceOrderPdf({ tenantId: tenantB, orderId: r.order.id, actor: "t" })).rejects.toThrow();
      const ev = await prisma.$queryRaw<{ details: unknown }[]>(
        Prisma.sql`SELECT "details" FROM "DigitalLicenceEvent" WHERE "orderId" = ${r.order.id} AND "type" = 'PDF_FAILED'`,
      );
      expect(ev).toHaveLength(1);
      expect(JSON.stringify(ev[0].details)).not.toContain("v1:");
    });
  });

  // -------------------------------------------------------------------------
  describe("6. rate limiting & network controls", () => {
    it("per-key limit (Postgres-backed) returns 429 past the configured budget", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const res = await handleLicenceApiRequest(signed({ schemaVersion: 1, sku: "kaspersky-plus-10p-1y", quantity: 1 }, { ip: `192.0.2.${i}` }), {
          loadConfig: apiConfig(tenantB, { DIGITAL_LICENCE_RATE_LIMIT_PER_MINUTE: "3" }),
        });
        statuses.push(res.status);
      }
      expect(statuses).toEqual([409, 409, 409, 429, 429]);
    });

    it("pre-auth IP limiter blocks floods from one IP", async () => {
      const ip = "203.0.113.200";
      let last = 0;
      for (let i = 0; i < 121; i += 1) {
        const res = await handleLicenceApiRequest(
          new Request(`https://x${LICENCE_API_PATH}`, { method: "POST", body: "{}", headers: { "content-type": "application/json", "x-real-ip": ip } }),
          { loadConfig: apiConfig(tenantB) },
        );
        last = res.status;
      }
      expect(last).toBe(429);
    });

    it("FINDING (conditional): client-supplied forwarding headers decide the IP", async () => {
      // Rotating X-Forwarded-For evades the per-IP limiter when not behind a
      // proxy that overwrites it.
      const statuses = new Set<number>();
      for (let i = 0; i < 130; i += 1) {
        const res = await handleLicenceApiRequest(
          new Request(`https://x${LICENCE_API_PATH}`, {
            method: "POST",
            body: "{}",
            headers: { "content-type": "application/json", "x-forwarded-for": `100.64.${i >> 8}.${i & 255}` },
          }),
          { loadConfig: apiConfig(tenantB) },
        );
        statuses.add(res.status);
      }
      expect(statuses.has(429)).toBe(false);

      // IP allowlist trusts x-vercel-forwarded-for.
      const cfg = apiConfig(tenantB, { DIGITAL_LICENCE_ALLOWED_IPS: "10.9.8.7" });
      const blocked = await handleLicenceApiRequest(
        new Request(`https://x${LICENCE_API_PATH}`, { method: "POST", body: "{}", headers: { "content-type": "application/json", "x-real-ip": "6.6.6.6" } }),
        { loadConfig: cfg },
      );
      expect(blocked.status).toBe(403);
      const spoofed = await handleLicenceApiRequest(
        new Request(`https://x${LICENCE_API_PATH}`, {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json", "x-real-ip": "6.6.6.6", "x-vercel-forwarded-for": "10.9.8.7" },
        }),
        { loadConfig: cfg },
      );
      expect(spoofed.status).toBe(401); // passed the allowlist, stopped by HMAC
    });

    it("HTTPS check trusts x-forwarded-proto", async () => {
      const req = new Request(`http://x${LICENCE_API_PATH}`, { method: "POST", body: "{}", headers: { "content-type": "application/json", "x-real-ip": "198.51.100.150" } });
      expect((await handleLicenceApiRequest(req, { loadConfig: apiConfig(tenantB) })).status).toBe(403);
      const spoof = new Request(`http://x${LICENCE_API_PATH}`, { method: "POST", body: "{}", headers: { "content-type": "application/json", "x-forwarded-proto": "https", "x-real-ip": "198.51.100.151" } });
      expect((await handleLicenceApiRequest(spoof, { loadConfig: apiConfig(tenantB) })).status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  describe("7. concurrent allocation", () => {
    it("60 codes, 40 parallel requests x2: exactly 30 orders, no code shared, no leak from rolled-back orders", async () => {
      const tenant = (await prisma.user.create({ data: { email: `audit-c-${run}@example.com`, passwordHash: "x" } })).id;
      try {
        const codes = freshCodes(60, "C");
        await importLicenceCodes({ tenantId: tenant, actorUserId: tenant, sku: SKU, text: codes.join("\n") });
        const results = await Promise.allSettled(
          Array.from({ length: 40 }, (_, i) =>
            requestLicenceDocument({
              tenantId: tenant,
              request: parseLicenceRequest({ sku: SKU, quantity: 2 }),
              idempotencyKey: `audit:${run}:conc:${i}`,
              source: "API",
              actor: "test",
            }),
          ),
        );
        const ok = results.filter((r) => r.status === "fulfilled");
        const fail = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
        expect(ok).toHaveLength(30);
        expect(fail.every((f) => f.reason instanceof InsufficientLicenceStockError)).toBe(true);
        const rows = await codeRows(tenant);
        expect(rows.filter((r) => r.status === "RESERVED")).toHaveLength(60);
        const perOrder = new Map<string, number>();
        rows.forEach((r) => perOrder.set(r.orderId!, (perOrder.get(r.orderId!) ?? 0) + 1));
        expect([...perOrder.values()].every((n) => n === 2)).toBe(true);
        const orders = await prisma.$queryRaw<{ n: number }[]>(
          Prisma.sql`SELECT COUNT(*)::int AS n FROM "DigitalLicenceOrder" WHERE "userId" = ${tenant}`,
        );
        expect(orders[0].n).toBe(30); // failed transactions left no order behind

        // Render all 30 PDFs in parallel: every code appears in exactly one PDF.
        pdfState.html = [];
        const ids = [...perOrder.keys()];
        await Promise.all(ids.map((orderId) => renderLicenceOrderPdf({ tenantId: tenant, orderId, actor: "t" })));
        for (const c of codes) {
          expect(pdfState.html.filter((h) => h.includes(formatLicenceCode(c)))).toHaveLength(1);
        }
      } finally {
        await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceEvent" WHERE "userId" = ${tenant}`);
        await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceCode" WHERE "userId" = ${tenant}`);
        await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceOrder" WHERE "userId" = ${tenant}`);
        await prisma.user.delete({ where: { id: tenant } });
      }
    });

    it("20 parallel API calls with the same Idempotency-Key create one licence with the same codes", async () => {
      await stock(tenantB, 6, "kaspersky-premium-5p-1y");
      const body = { schemaVersion: 1, sku: "kaspersky-premium-5p-1y", quantity: 2 };
      const idem = `audit-same-${run}`;
      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          handleLicenceApiRequest(signed(body, { idem, ip: `198.18.0.${i}` }), {
            loadConfig: apiConfig(tenantB, { DIGITAL_LICENCE_RATE_LIMIT_PER_MINUTE: "1000" }),
          }),
        ),
      );
      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.every((s) => s === 201 || s === 200 || s === 500)).toBe(true);
      const ids = new Set(responses.filter((r) => r.ok).map((r) => r.headers.get("x-licence-id")));
      expect(ids.size).toBe(1);
      const reservedOrUsed = (await codeRows(tenantB)).filter(
        (r) => r.orderId === [...ids][0],
      );
      expect(reservedOrUsed).toHaveLength(2);
    });

    it("parallel duplicate imports never store a code twice", async () => {
      const codes = freshCodes(50, "D");
      await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          importLicenceCodes({ tenantId: tenantB, actorUserId: tenantB, sku: SKU, text: codes.join("\n") }),
        ),
      );
      const fps = await prisma.$queryRaw<{ n: number; d: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS n, COUNT(DISTINCT "codeFingerprint")::int AS d
        FROM "DigitalLicenceCode" WHERE "userId" = ${tenantB} AND "batchLabel" IS NULL
      `);
      expect(fps[0].n).toBe(fps[0].d);
    });

    it("cancel racing a PDF render never yields a PDF whose codes went back to stock", async () => {
      for (let round = 0; round < 6; round += 1) {
        await stock(tenantB, 2, "kaspersky-plus-1p-1y");
        const r = await requestLicenceDocument({
          tenantId: tenantB,
          request: parseLicenceRequest({ sku: "kaspersky-plus-1p-1y", quantity: 2 }),
          idempotencyKey: `audit:${run}:race:${round}`,
          source: "MANUAL",
          actor: "t",
        });
        pdfState.delayMs = round * 40;
        const [render, cancel] = await Promise.allSettled([
          renderLicenceOrderPdf({ tenantId: tenantB, orderId: r.order.id, actor: "t" }),
          new Promise((res) => setTimeout(res, 20)).then(() =>
            cancelPendingLicenceOrder({ tenantId: tenantB, orderId: r.order.id, actor: "t" }),
          ),
        ]);
        const codes = (await codeRows(tenantB)).filter((c) => c.orderId === r.order.id);
        const cancelled = cancel.status === "fulfilled" && cancel.value !== null;
        if (render.status === "fulfilled") {
          expect(cancelled).toBe(false);
          expect(codes.every((c) => c.status === "USED")).toBe(true);
        } else {
          expect(cancelled).toBe(true);
          expect(codes).toHaveLength(0); // released back to stock, no PDF delivered
        }
      }
    });

    it("revoked / used codes are never re-allocated", async () => {
      const tenant = tenantB;
      const before = await codeRows(tenant);
      const used = new Set(before.filter((r) => r.status === "USED" || r.status === "REVOKED").map((r) => r.id));
      const available = before.find((r) => r.status === "AVAILABLE")!;
      expect(await revokeLicenceCode({ tenantId: tenant, codeId: available.id, actor: "t" })).toBe(true);
      used.add(available.id);
      const after = await codeRows(tenant);
      expect(after.filter((r) => used.has(r.id)).every((r) => r.status === "USED" || r.status === "REVOKED")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe("8. logs", () => {
    it("nothing logged during the audit contains a code, ciphertext, secret or customer e-mail", () => {
      const text = consoleLines.join("\n");
      expect(consoleLines.length).toBeGreaterThan(0);
      for (const c of allPlainCodes) {
        expect(text).not.toContain(c);
        expect(text).not.toContain(formatLicenceCode(c));
      }
      expect(text).not.toContain("v1:");
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain("victim@example.com");
    });
  });
});
