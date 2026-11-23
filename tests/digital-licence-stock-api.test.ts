import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { MAX_LICENCE_QUANTITY } from "@/lib/digital-products/kaspersky-catalog";
import { loadLicenceApiConfig, LICENCE_API_PATH, LICENCE_STOCK_API_PATH } from "@/server/digital-products/api-config";
import { handleLicenceStockRequest, type LicenceStockDeps } from "@/server/digital-products/stock-api";
import { computeSignature, sha256Hex } from "@/server/integrations/prestashop/signature";

const KEY_ID = "ts-licences-2026";
const SECRET = "licence-secret-0123456789abcdef0123456789";
const TENANT = "tenant-1";

function signed(body: unknown, options: { path?: string; signedPath?: string; secret?: string; nonce?: string } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const idempotencyKey = `stock-${nonce}`;
  const signature = computeSignature(options.secret ?? SECRET, {
    method: "POST",
    path: options.signedPath ?? LICENCE_STOCK_API_PATH,
    timestamp,
    nonce,
    idempotencyKey,
    bodySha256Hex: sha256Hex(raw),
    scheme: "DPLIC1",
  });
  return new Request(`https://invoices.example.com${options.path ?? LICENCE_STOCK_API_PATH}`, {
    method: "POST",
    body: raw,
    headers: {
      "content-type": "application/json",
      "x-signature-key-id": KEY_ID,
      "x-signature-timestamp": timestamp,
      "x-signature-nonce": nonce,
      "idempotency-key": idempotencyKey,
      "x-signature": signature,
      "x-real-ip": "203.0.113.11",
    },
  });
}

function makeDeps(overrides: Partial<LicenceStockDeps> = {}) {
  const seen = new Set<string>();
  const getInventoryCounts = vi.fn<LicenceStockDeps["getInventoryCounts"]>(async () => [
    { productSku: "idm-1p-1y", status: "AVAILABLE", count: 3 },
    { productSku: "idm-1p-1y", status: "USED", count: 40 },
    { productSku: "idm-1p-lifetime", status: "RESERVED", count: 2 },
    { productSku: "kaspersky-plus-3p-1y", status: "AVAILABLE", count: 500 },
  ]);
  const deps: Partial<LicenceStockDeps> = {
    loadConfig: () =>
      loadLicenceApiConfig({
        DIGITAL_LICENCE_TENANT_ID: TENANT,
        DIGITAL_LICENCE_API_KEYS: `${KEY_ID}:${SECRET}`,
        NODE_ENV: "production",
      }),
    nonces: {
      registerNonce: async (keyId, nonce) => {
        const key = `${keyId}|${nonce}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      },
      countRecentRequests: async () => 1,
      purgeExpiredNonces: async () => {},
    },
    getInventoryCounts,
    log: () => {},
    random: () => 1,
    ...overrides,
  };
  return { deps, getInventoryCounts };
}

const body = { schemaVersion: 1, skus: ["idm-1p-1y", "idm-1p-lifetime", "kaspersky-plus-3p-1y", "windows-11-pro"] };

describe("licence stock API", () => {
  it("returns AVAILABLE codes per SKU, capped at the per-request maximum", async () => {
    const { deps, getInventoryCounts } = makeDeps();
    const response = await handleLicenceStockRequest(signed(body), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const json = await response.json();
    expect(json.maxQuantity).toBe(MAX_LICENCE_QUANTITY);
    expect(json.stock).toEqual([
      { sku: "idm-1p-1y", available: 3 },
      { sku: "idm-1p-lifetime", available: 0 }, // reserved codes are not available
      { sku: "kaspersky-plus-3p-1y", available: MAX_LICENCE_QUANTITY }, // exact stock never exposed
      { sku: "windows-11-pro", available: 0 },
    ]);
    expect(getInventoryCounts).toHaveBeenCalledWith(TENANT);
    expect(JSON.stringify(json)).not.toMatch(/code|hint/i);
  });

  it("rejects unsigned, forged and replayed requests", async () => {
    const { deps, getInventoryCounts } = makeDeps();
    const unsigned = new Request(`https://invoices.example.com${LICENCE_STOCK_API_PATH}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    expect((await handleLicenceStockRequest(unsigned, deps)).status).toBe(401);
    expect((await handleLicenceStockRequest(signed(body, { secret: "wrong-secret-0123456789abcdef0123456789" }), deps)).status).toBe(401);
    // A signature made for the licence endpoint cannot be used here.
    expect((await handleLicenceStockRequest(signed(body, { signedPath: LICENCE_API_PATH }), deps)).status).toBe(401);
    expect((await handleLicenceStockRequest(signed(body, { nonce: "0123456789abcdef0123456789abcdef" }), deps)).status).toBe(200);
    expect((await handleLicenceStockRequest(signed(body, { nonce: "0123456789abcdef0123456789abcdef" }), deps)).status).toBe(401);
    expect(getInventoryCounts).toHaveBeenCalledTimes(1);
  });

  it("validates the payload", async () => {
    const { deps, getInventoryCounts } = makeDeps();
    expect((await handleLicenceStockRequest(signed({ schemaVersion: 1, skus: ["idm-2p-1y"] }), deps)).status).toBe(422);
    expect((await handleLicenceStockRequest(signed({ schemaVersion: 1, skus: [] }), deps)).status).toBe(422);
    expect((await handleLicenceStockRequest(signed({ schemaVersion: 1, skus: ["idm-1p-1y"], extra: 1 }), deps)).status).toBe(422);
    expect((await handleLicenceStockRequest(signed("{not json"), deps)).status).toBe(400);
    expect(getInventoryCounts).not.toHaveBeenCalled();
  });

  it("answers 503 when not configured and 500 without details on a database error", async () => {
    const misconfigured = makeDeps({ loadConfig: () => loadLicenceApiConfig({}) });
    expect((await handleLicenceStockRequest(signed(body), misconfigured.deps)).status).toBe(503);
    const failing = makeDeps({ getInventoryCounts: async () => { throw new Error("db down secret"); } });
    const response = await handleLicenceStockRequest(signed(body), failing.deps);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});
