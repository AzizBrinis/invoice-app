import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleLicenceApiRequest, type LicenceApiDeps } from "@/server/digital-products/api";
import { loadLicenceApiConfig, LICENCE_API_PATH } from "@/server/digital-products/api-config";
import { computeSignature, sha256Hex } from "@/server/integrations/prestashop/signature";
import {
  InsufficientLicenceStockError,
  type CreateLicenceOrderResult,
  type LicenceOrderRecord,
} from "@/server/digital-products/store";

const ENDPOINT = `https://invoices.example.com${LICENCE_API_PATH}`;
const KEY_ID = "ts-licences-2026";
const SECRET = "licence-secret-0123456789abcdef0123456789";
const TENANT = "tenant-1";
const FAKE_PDF = Buffer.from("%PDF-1.7 fake licence");
const PLAIN_CODE = "ABCDE12345FGHIJ67890";

function order(overrides: Partial<LicenceOrderRecord> = {}): LicenceOrderRecord {
  const now = new Date("2026-11-10T10:00:00Z");
  return {
    id: "dlord-11111111-1111-4111-8111-111111111111",
    userId: TENANT,
    number: "LIC-20261110-ABCDEF",
    productSku: "kaspersky-plus-3p-1y",
    quantity: 2,
    status: "PENDING",
    source: "API",
    idempotencyKey: "api:ps-1-42-7",
    requestHash: "hash",
    customerName: null,
    customerEmail: null,
    orderReference: "XKBKNABJK",
    activationRegion: null,
    useBefore: null,
    notes: null,
    externalSource: null,
    externalOrderId: null,
    externalLineId: null,
    invoiceId: null,
    createdById: null,
    createdByName: null,
    apiKeyId: KEY_ID,
    generationCount: 0,
    lastErrorCode: null,
    generatedAt: null,
    lastDownloadedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    sku: "kaspersky-plus-3p-1y",
    quantity: 2,
    customer: { name: "Amine", email: "amine@example.com" },
    order: { reference: "XKBKNABJK", source: "prestashop", id: 42, lineId: 7 },
    ...overrides,
  };
}

function signedRequest(
  body: unknown,
  options: {
    idempotencyKey?: string;
    nonce?: string;
    scheme?: string;
    secret?: string;
    accept?: string;
    timestamp?: number;
  } = {},
) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const idempotencyKey = options.idempotencyKey ?? "ps-1-42-7";
  const signature = computeSignature(options.secret ?? SECRET, {
    method: "POST",
    path: LICENCE_API_PATH,
    timestamp,
    nonce,
    idempotencyKey,
    bodySha256Hex: sha256Hex(raw),
    scheme: options.scheme ?? "DPLIC1",
  });
  return new Request(ENDPOINT, {
    method: "POST",
    body: raw,
    headers: {
      "content-type": "application/json",
      accept: options.accept ?? "application/json",
      "x-signature-key-id": KEY_ID,
      "x-signature-timestamp": timestamp,
      "x-signature-nonce": nonce,
      "idempotency-key": idempotencyKey,
      "x-signature": signature,
      "x-real-ip": "203.0.113.10",
    },
  });
}

function makeDeps(overrides: Partial<LicenceApiDeps> = {}) {
  const seenNonces = new Set<string>();
  const requestLicence = vi.fn<LicenceApiDeps["requestLicence"]>(
    async (): Promise<CreateLicenceOrderResult> => ({ kind: "created", order: order() }),
  );
  const renderPdf = vi.fn<LicenceApiDeps["renderPdf"]>(async () => ({
    order: order({ status: "GENERATED", generationCount: 1 }),
    pdf: FAKE_PDF,
    filename: "licence-kaspersky-plus-3p-LIC-20261110-ABCDEF.pdf",
  }));
  const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const deps: Partial<LicenceApiDeps> = {
    loadConfig: () =>
      loadLicenceApiConfig({
        DIGITAL_LICENCE_TENANT_ID: TENANT,
        DIGITAL_LICENCE_API_KEYS: `${KEY_ID}:${SECRET}`,
        DIGITAL_LICENCE_API_ALLOW_ALLOCATION: "true",
        NODE_ENV: "production",
      }),
    nonces: {
      registerNonce: async (keyId, nonce) => {
        const key = `${keyId}|${nonce}`;
        if (seenNonces.has(key)) return false;
        seenNonces.add(key);
        return true;
      },
      countRecentRequests: async () => 1,
      purgeExpiredNonces: async () => {},
    },
    requestLicence,
    renderPdf,
    getCodeHints: async () => [{ codeHint: "7890" }, { codeHint: "1234" }],
    log: (_level, event, fields) => logs.push({ event, fields }),
    random: () => 1,
    ...overrides,
  };
  return { deps, requestLicence, renderPdf, logs, seenNonces };
}

describe("digital licence API", () => {
  it("allocates codes and returns the PDF with masked codes only", async () => {
    const { deps, requestLicence, logs } = makeDeps();
    const response = await handleLicenceApiRequest(signedRequest(payload()), deps);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.status).toBe("created");
    expect(json.licence).toMatchObject({
      number: "LIC-20261110-ABCDEF",
      sku: "kaspersky-plus-3p-1y",
      devices: 3,
      quantity: 2,
      codes: ["•••••-•••••-•••••-•7890", "•••••-•••••-•••••-•1234"],
    });
    expect(Buffer.from(json.pdf.base64, "base64").equals(FAKE_PDF)).toBe(true);
    expect(json.pdf.sha256).toBe(sha256Hex(FAKE_PDF));
    expect(response.headers.get("cache-control")).toBe("no-store");

    const call = requestLicence.mock.calls[0][0];
    expect(call).toMatchObject({
      tenantId: TENANT,
      idempotencyKey: "api:ps-1-42-7",
      source: "PRESTASHOP",
      apiKeyId: KEY_ID,
      external: { source: "prestashop", orderId: "42", lineId: "7" },
    });
    expect(call.request).toMatchObject({ sku: "kaspersky-plus-3p-1y", quantity: 2, customerEmail: "amine@example.com" });
    expect(JSON.stringify(json)).not.toContain(PLAIN_CODE);
    expect(JSON.stringify(logs)).not.toContain("amine@example.com");
  });

  it("returns the raw PDF when only application/pdf is accepted", async () => {
    const { deps } = makeDeps();
    const response = await handleLicenceApiRequest(signedRequest(payload(), { accept: "application/pdf" }), deps);
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("x-licence-number")).toBe("LIC-20261110-ABCDEF");
    expect(Buffer.from(await response.arrayBuffer()).equals(FAKE_PDF)).toBe(true);
  });

  it("replays an idempotent request with 200 and the same licence", async () => {
    const { deps } = makeDeps({
      requestLicence: vi.fn(async () => ({ kind: "existing", order: order({ status: "GENERATED" }) }) as const),
    });
    const response = await handleLicenceApiRequest(signedRequest(payload()), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-idempotent-replay")).toBe("true");
    expect((await response.json()).status).toBe("existing");
  });

  it("rejects bad signatures, other schemes, replayed nonces and stale timestamps", async () => {
    const { deps, requestLicence } = makeDeps();
    const wrongSecret = await handleLicenceApiRequest(
      signedRequest(payload(), { secret: "x".repeat(40) }),
      deps,
    );
    expect(wrongSecret.status).toBe(401);

    // A PrestaShop invoice signature (PSINV1) must not authorize licence minting.
    const otherScheme = await handleLicenceApiRequest(signedRequest(payload(), { scheme: "PSINV1" }), deps);
    expect(otherScheme.status).toBe(401);

    const stale = await handleLicenceApiRequest(
      signedRequest(payload(), { timestamp: Math.floor(Date.now() / 1000) - 3600 }),
      deps,
    );
    expect(stale.status).toBe(401);

    const nonce = randomBytes(16).toString("hex");
    expect((await handleLicenceApiRequest(signedRequest(payload(), { nonce }), deps)).status).toBe(201);
    expect((await handleLicenceApiRequest(signedRequest(payload(), { nonce }), deps)).status).toBe(401);
    expect(requestLicence).toHaveBeenCalledTimes(1);
  });

  it("enforces HTTPS and service configuration", async () => {
    const { deps } = makeDeps();
    const httpRequest = signedRequest(payload());
    const plain = new Request(httpRequest.url.replace("https:", "http:"), {
      method: "POST",
      headers: httpRequest.headers,
      body: await httpRequest.text(),
    });
    expect((await handleLicenceApiRequest(plain, deps)).status).toBe(403);

    const misconfigured = makeDeps({ loadConfig: () => loadLicenceApiConfig({}) });
    const response = await handleLicenceApiRequest(signedRequest(payload()), misconfigured.deps);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("DIGITAL_LICENCE");
  });

  it("validates the payload strictly", async () => {
    const { deps, requestLicence } = makeDeps();
    for (const body of [
      payload({ sku: "kaspersky-plus-2p-1y" }),
      payload({ quantity: 0 }),
      payload({ quantity: 51 }),
      payload({ unexpected: true }),
      payload({ customer: { email: "not-an-email" } }),
      payload({ useBefore: "2026-13-01" }),
    ]) {
      const response = await handleLicenceApiRequest(signedRequest(body), deps);
      expect(response.status).toBe(422);
    }
    const invalidJson = await handleLicenceApiRequest(signedRequest("{nope"), deps);
    expect(invalidJson.status).toBe(400);
    expect(requestLicence).not.toHaveBeenCalled();
  });

  it("maps allocation conflicts to 409 responses", async () => {
    const stock = makeDeps({
      requestLicence: vi.fn(async () => {
        throw new InsufficientLicenceStockError("kaspersky-plus-3p-1y", 2, 1);
      }),
    });
    const outOfStock = await handleLicenceApiRequest(signedRequest(payload()), stock.deps);
    expect(outOfStock.status).toBe(409);
    expect((await outOfStock.json()).error).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      retryable: false,
      details: { requested: 2, available: 1 },
    });

    const reused = makeDeps({
      requestLicence: vi.fn(async () => ({ kind: "idempotency_key_reused", order: order() }) as const),
    });
    const reusedResponse = await handleLicenceApiRequest(signedRequest(payload()), reused.deps);
    expect(reusedResponse.status).toBe(409);
    expect((await reusedResponse.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(reused.renderPdf).not.toHaveBeenCalled();

    const line = makeDeps({
      requestLicence: vi.fn(async () => ({ kind: "external_line_conflict", order: order() }) as const),
    });
    const lineResponse = await handleLicenceApiRequest(signedRequest(payload()), line.deps);
    expect((await lineResponse.json()).error.code).toBe("ORDER_LINE_ALREADY_FULFILLED");

    const cancelled = makeDeps({
      requestLicence: vi.fn(async () => ({ kind: "existing", order: order({ status: "CANCELLED" }) }) as const),
    });
    const cancelledResponse = await handleLicenceApiRequest(signedRequest(payload()), cancelled.deps);
    expect((await cancelledResponse.json()).error.code).toBe("LICENCE_CANCELLED");
  });

  it("reports PDF failures as retryable without losing the allocation", async () => {
    const { deps } = makeDeps({
      renderPdf: vi.fn(async () => {
        throw new Error("chromium crashed");
      }),
    });
    const response = await handleLicenceApiRequest(signedRequest(payload()), deps);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatchObject({ code: "PDF_GENERATION_FAILED", retryable: true });
  });
});

describe("licence API without allocation (production default)", () => {
  const replayOnly = () =>
    loadLicenceApiConfig({ DIGITAL_LICENCE_TENANT_ID: TENANT, DIGITAL_LICENCE_API_KEYS: `${KEY_ID}:${SECRET}`, NODE_ENV: "production" });

  it("cannot create a licence, nor read one that was never delivered", async () => {
    const requestLicence = vi.fn();
    const renderPdf = vi.fn();
    const { deps } = makeDeps({ loadConfig: replayOnly, requestLicence, renderPdf, findLicence: async () => null });
    const refused = await handleLicenceApiRequest(signedRequest(payload()), deps);
    expect(refused.status).toBe(403);
    expect((await refused.json()).error).toMatchObject({ code: "ALLOCATION_DISABLED", retryable: false });
    const pending = makeDeps({ loadConfig: replayOnly, requestLicence, renderPdf, findLicence: async () => order() });
    const response = await handleLicenceApiRequest(signedRequest(payload()), pending.deps);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("LICENCE_NOT_DELIVERED");
    expect(requestLicence).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it("still replays a delivered licence (\"Télécharger le PDF\")", async () => {
    const findLicence = vi.fn(async () => order({ status: "DELIVERED" }));
    const { deps } = makeDeps({
      loadConfig: replayOnly,
      findLicence,
      requestLicence: vi.fn(async () => ({ kind: "existing", order: order({ status: "DELIVERED" }) }) as const),
    });
    const response = await handleLicenceApiRequest(signedRequest(payload(), { accept: "application/pdf" }), deps);
    expect(response.status).toBe(200);
    expect(findLicence).toHaveBeenCalledWith(TENANT, "api:ps-1-42-7");
  });

  it("counts stock lookups apart from deliveries", async () => {
    const keys: string[] = [];
    const base = makeDeps().deps;
    const nonces = { ...base.nonces!, registerNonce: async (key: string) => { keys.push(key); return true; } };
    const { handleLicenceStockRequest } = await import("@/server/digital-products/stock-api");
    const raw = signedRequest(payload());
    await handleLicenceApiRequest(raw, { ...base, nonces });
    const stockBody = JSON.stringify({ schemaVersion: 1, skus: ["idm-1p-1y"] });
    const path = "/api/integrations/digital-products/stock";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString("hex");
    const response = await handleLicenceStockRequest(new Request(`https://invoices.example.com${path}`, {
      method: "POST", body: stockBody,
      headers: {
        "content-type": "application/json", "x-signature-key-id": KEY_ID, "x-signature-timestamp": timestamp, "x-signature-nonce": nonce,
        "idempotency-key": "stock-12345678",
        "x-signature": computeSignature(SECRET, { method: "POST", path, timestamp, nonce, idempotencyKey: "stock-12345678", bodySha256Hex: sha256Hex(stockBody), scheme: "DPLIC1" }),
      },
    }), { loadConfig: base.loadConfig!, nonces, random: () => 1, log: () => {}, getInventoryCounts: async () => [] });
    expect(response.status).toBe(200);
    expect(keys).toEqual([`dplic:${KEY_ID}`, `dplic:stock:${KEY_ID}`]);
  });
});
