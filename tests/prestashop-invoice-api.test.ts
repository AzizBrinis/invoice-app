import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";
import { buildPayload } from "./fixtures/prestashop-order";

vi.mock("@/server/settings", () => ({
  getSettingsDocumentDefaults: vi.fn(async () => ({
    defaultCurrency: "TND",
    taxConfiguration: DEFAULT_TAX_CONFIGURATION,
  })),
}));

import type { InvoiceInput } from "@/server/invoices";
import { previewInvoiceTotalsForUser } from "@/server/invoices";
import { loadPrestashopIntegrationConfig, parseApiKeys } from "@/server/integrations/prestashop/config";
import {
  mapPrestashopOrder,
  prestashopOrderPayloadSchema,
  scaleDecimal,
  toCurrencyMinor,
} from "@/server/integrations/prestashop/payload";
import {
  handlePrestashopInvoiceDownload,
  handlePrestashopInvoiceRequest,
  MAX_BODY_BYTES,
  type InvoiceSummary,
  type PrestashopInvoiceDeps,
} from "@/server/integrations/prestashop/service";
import { computeSignature, sha256Hex, verifyRequestSignature } from "@/server/integrations/prestashop/signature";
import { invoiceNumberingYear } from "@/server/sequences";
import type {
  ClaimInput,
  ClaimResult,
  PrestashopInvoiceStore,
} from "@/server/integrations/prestashop/store";

const ENDPOINT = "https://invoices.example.com/api/integrations/prestashop/invoices";
const PATH = "/api/integrations/prestashop/invoices";
const KEY_ID = "techno-smart-2026";
const SECRET = "s3cr3t-0123456789abcdef0123456789abcdef";
const TENANT = "tenant-user-1";
const FAKE_PDF = new Uint8Array(Buffer.from("%PDF-1.7 fake invoice"));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------


let ipCounter = 0;

function signedRequest(
  body: unknown,
  options: {
    idempotencyKey?: string;
    nonce?: string;
    timestamp?: number;
    secret?: string;
    keyId?: string;
    accept?: string;
    contentType?: string;
    tamper?: (raw: string) => string;
    omit?: string[];
    url?: string;
  } = {},
) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const idempotencyKey = options.idempotencyKey ?? `order-4521-${randomBytes(4).toString("hex")}`;
  const signature = computeSignature(options.secret ?? SECRET, {
    method: "POST",
    path: PATH,
    timestamp,
    nonce,
    idempotencyKey,
    bodySha256Hex: sha256Hex(raw),
  });
  ipCounter += 1;
  const headers: Record<string, string> = {
    "content-type": options.contentType ?? "application/json",
    "x-signature-key-id": options.keyId ?? KEY_ID,
    "x-signature-timestamp": timestamp,
    "x-signature-nonce": nonce,
    "x-signature": signature,
    "idempotency-key": idempotencyKey,
    "x-real-ip": `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
    ...(options.accept ? { accept: options.accept } : {}),
  };
  for (const name of options.omit ?? []) delete headers[name];
  return new Request(options.url ?? ENDPOINT, {
    method: "POST",
    headers,
    body: options.tamper ? options.tamper(raw) : raw,
  });
}

// ---------------------------------------------------------------------------
// In-memory store with the same semantics as the Postgres implementation
// ---------------------------------------------------------------------------

type Row = ClaimInput & {
  id: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  invoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  lastErrorCode: string | null;
};

class MemoryStore implements PrestashopInvoiceStore {
  nonces = new Map<string, number>();
  rows: Row[] = [];
  staleAfterMs = 180_000;
  invoicesByReference = new Map<string, string>();
  private seq = 0;

  async registerNonce(keyId: string, nonce: string) {
    const key = `${keyId}:${nonce}`;
    if (this.nonces.has(key)) return false;
    this.nonces.set(key, Date.now());
    return true;
  }
  async countRecentRequests(keyId: string, windowSeconds: number) {
    const since = Date.now() - windowSeconds * 1000;
    return [...this.nonces.entries()].filter(
      ([key, at]) => key.startsWith(`${keyId}:`) && at > since,
    ).length;
  }
  async purgeExpiredNonces() {}
  async claimRequest(input: ClaimInput): Promise<ClaimResult> {
    const byOrder = this.rows.find(
      (row) =>
        row.tenantUserId === input.tenantUserId &&
        row.shopId === input.shopId &&
        row.externalOrderId === input.externalOrderId,
    );
    const byKey = this.rows.find(
      (row) => row.tenantUserId === input.tenantUserId && row.idempotencyKey === input.idempotencyKey,
    );
    if (!byOrder && !byKey) {
      const row: Row = {
        ...input,
        id: `req-${++this.seq}`,
        status: "PROCESSING",
        invoiceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        lastErrorCode: null,
      };
      this.rows.push(row);
      return { kind: "claimed", requestId: row.id, reclaimed: false, claimedSince: row.createdAt };
    }
    if (!byOrder) return { kind: "idempotency_key_reused" };
    if (byOrder.status === "COMPLETED" && byOrder.invoiceId) {
      if (byOrder.payloadHash === input.payloadHash) {
        return { kind: "completed", requestId: byOrder.id, invoiceId: byOrder.invoiceId };
      }
      return byOrder.idempotencyKey === input.idempotencyKey
        ? { kind: "idempotency_key_reused" }
        : { kind: "order_already_invoiced", invoiceId: byOrder.invoiceId };
    }
    const stale = Date.now() - byOrder.updatedAt.getTime() > this.staleAfterMs;
    if (byOrder.status === "PROCESSING" && !stale) return { kind: "in_progress" };
    byOrder.status = "PROCESSING";
    byOrder.payloadHash = input.payloadHash;
    byOrder.attempts += 1;
    byOrder.updatedAt = new Date();
    return { kind: "claimed", requestId: byOrder.id, reclaimed: true, claimedSince: byOrder.createdAt };
  }
  async markCompleted(requestId: string, invoiceId: string) {
    const row = this.rows.find((candidate) => candidate.id === requestId)!;
    row.status = "COMPLETED";
    row.invoiceId = invoiceId;
    row.updatedAt = new Date();
  }
  async markFailed(requestId: string, code: string) {
    const row = this.rows.find((candidate) => candidate.id === requestId)!;
    if (row.status !== "PROCESSING") return;
    row.status = "FAILED";
    row.lastErrorCode = code;
    row.updatedAt = new Date();
  }
  async findInvoiceForOrder(tenant: string, shopId: string, orderId: string) {
    const row = this.rows.find(
      (candidate) =>
        candidate.tenantUserId === tenant &&
        candidate.shopId === shopId &&
        candidate.externalOrderId === orderId &&
        candidate.status === "COMPLETED",
    );
    return row?.invoiceId ?? null;
  }
  async findOrphanInvoice(_tenant: string, reference: string) {
    return this.invoicesByReference.get(reference) ?? null;
  }
  async tenantExists(tenantUserId: string) {
    return tenantUserId === TENANT;
  }
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Harness = {
  store: MemoryStore;
  invoices: Map<string, InvoiceSummary & { input: InvoiceInput }>;
  logs: Array<{ level: string; event: string; fields: Record<string, unknown> }>;
  deps: Partial<PrestashopInvoiceDeps> & {
    createInvoice: ReturnType<typeof vi.fn>;
    resolveClient: ReturnType<typeof vi.fn>;
    recordPayment: ReturnType<typeof vi.fn>;
    renderPdf: ReturnType<typeof vi.fn>;
    onInvoiceChanged: ReturnType<typeof vi.fn>;
  };
  call: (request: Request) => Promise<Response>;
};

function createHarness(env: Record<string, string> = {}): Harness {
  const store = new MemoryStore();
  const invoices: Harness["invoices"] = new Map();
  const logs: Harness["logs"] = [];
  let invoiceSeq = 0;

  const deps = {
    loadConfig: () =>
      loadPrestashopIntegrationConfig({
        PRESTASHOP_INVOICE_TENANT_ID: TENANT,
        PRESTASHOP_INVOICE_API_KEYS: `${KEY_ID}:${SECRET}`,
        NODE_ENV: "production",
        ...env,
      }),
    store,
    resolveClient: vi.fn(async () => ({ id: "client-1" })),
    previewTotals: previewInvoiceTotalsForUser,
    createInvoice: vi.fn(async (_tenant: string, input: InvoiceInput) => {
      const preview = await previewInvoiceTotalsForUser(TENANT, input);
      invoiceSeq += 1;
      const id = `inv-${invoiceSeq}`;
      invoices.set(id, {
        id,
        number: `FAC-2026-${String(invoiceSeq).padStart(4, "0")}`,
        status: input.status,
        reference: input.reference ?? null,
        issueDate: input.issueDate,
        currency: input.currency,
        totalTTCCents: preview.totals.totalTTCCents,
        totalTVACents: preview.totals.totalTVACents,
        timbreAmountCents: preview.timbreAmountCents,
        fodecAmountCents: 0,
        vatBreakdown: preview.totals.vatEntries.map((entry: { rate: number }) => ({ rate: entry.rate })),
        amountPaidCents: 0,
        input,
      });
      return { id };
    }),
    recordPayment: vi.fn(async (_tenant: string, payment: { invoiceId: string; amountCents: number }) => {
      const invoice = invoices.get(payment.invoiceId)!;
      invoice.amountPaidCents += payment.amountCents;
      invoice.status = invoice.amountPaidCents >= invoice.totalTTCCents ? "PAYEE" : "PARTIELLE";
    }),
    getInvoice: async (_tenant: string, id: string) => invoices.get(id) ?? null,
    getTaxRules: vi.fn(async () => ({ vatRates: [19, 13, 7, 0] })),
    renderPdf: vi.fn(async () => FAKE_PDF),
    onInvoiceChanged: vi.fn(),
    log: (level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) => {
      logs.push({ level, event, fields });
    },
    random: () => 1,
  };

  return {
    store,
    invoices,
    logs,
    deps,
    call: (request) => handlePrestashopInvoiceRequest(request, deps),
  };
}

async function errorCode(response: Response) {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

// ---------------------------------------------------------------------------
// Unit tests: signing, config, decimal mapping
// ---------------------------------------------------------------------------

describe("PrestaShop request signature", () => {
  const base = {
    method: "POST",
    path: PATH,
    timestamp: "1762700000",
    nonce: "0123456789abcdef0123",
    idempotencyKey: "order-1-abcdef",
    bodySha256Hex: sha256Hex("{}"),
  };

  it("produces a stable v1 hex signature matching a plain HMAC of the canonical string", () => {
    const canonical = ["PSINV1", "POST", PATH, base.timestamp, base.nonce, base.idempotencyKey, base.bodySha256Hex].join("\n");
    const signature = computeSignature(SECRET, base);
    expect(signature).toBe(`v1=${createHmac("sha256", SECRET).update(canonical).digest("hex")}`);
    expect(computeSignature(SECRET, base)).toBe(signature);
    expect(computeSignature(`${SECRET}x`, base)).not.toBe(signature);
  });

  it("rejects signatures computed for another path or method", () => {
    const signature = computeSignature(SECRET, base);
    const headers = new Headers({
      "x-signature-key-id": KEY_ID,
      "x-signature-timestamp": base.timestamp,
      "x-signature-nonce": base.nonce,
      "x-signature": signature,
      "idempotency-key": base.idempotencyKey,
    });
    const common = {
      headers,
      rawBody: new Uint8Array(Buffer.from("{}")),
      keys: new Map([[KEY_ID, Buffer.from(SECRET)]]),
      maxClockSkewSeconds: 300,
      nowMs: Number(base.timestamp) * 1000,
    };
    expect(verifyRequestSignature({ ...common, method: "POST", path: PATH }).ok).toBe(true);
    expect(verifyRequestSignature({ ...common, method: "POST", path: "/api/other" })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(verifyRequestSignature({ ...common, method: "PUT", path: PATH }).ok).toBe(false);
  });

  it("validates key configuration strictly", () => {
    expect(parseApiKeys(undefined)).toBeTypeOf("string");
    expect(parseApiKeys("main:short")).toBeTypeOf("string");
    expect(parseApiKeys(`bad id:${SECRET}`)).toBeTypeOf("string");
    expect(parseApiKeys(`a1b:${SECRET},a1b:${SECRET}`)).toBeTypeOf("string");
    const keys = parseApiKeys(`old-key:${SECRET},new-key:${SECRET}zz`);
    expect(keys).toBeInstanceOf(Map);
    expect((keys as Map<string, Buffer>).size).toBe(2);
    expect(loadPrestashopIntegrationConfig({ PRESTASHOP_INVOICE_API_KEYS: `${KEY_ID}:${SECRET}` }).ok).toBe(false);
  });
});

describe("PrestaShop payload mapping", () => {
  it("rounds decimal strings half-up without floating point drift", () => {
    expect(scaleDecimal("8.403361", 3)).toBe(8403);
    expect(scaleDecimal("0.0005", 3)).toBe(1);
    expect(scaleDecimal("0.000499999", 3)).toBe(0);
    expect(scaleDecimal("1.005", 2)).toBe(101);
    expect(scaleDecimal("119", 3)).toBe(119000);
    expect(toCurrencyMinor("245.000000", "TND")).toBe(245000);
    expect(toCurrencyMinor("19.995", "EUR")).toBe(2000);
  });

  it("maps lines on the TTC basis and applies free shipping to the shipping line", () => {
    const payload = prestashopOrderPayloadSchema.parse(
      buildPayload({
        discounts: [
          { name: "Livraison offerte", amountTaxExcl: "5.882353", amountTaxIncl: "7.000000", freeShipping: true },
        ],
        totals: {
          ...buildPayload().totals,
          discountsTaxExcl: "5.882353",
          discountsTaxIncl: "7.000000",
          totalTaxExcl: "208.403361",
          totalTaxIncl: "248.000000",
          totalPaid: "248.000000",
        },
      }),
    );
    const mapped = mapPrestashopOrder(payload, {
      totalTolerance: "0.010",
      applyTimbre: false,
      recordPayments: true,
    });
    expect(mapped.invoice.lines).toHaveLength(3);
    expect(mapped.invoice.lines[0]).toMatchObject({
      description: "Casque Bluetooth X (Réf. CASQ-X)",
      quantity: 2,
      unitPriceTTCCents: 119000,
      vatRate: 19,
      productId: null,
    });
    expect(mapped.invoice.lines[2]).toMatchObject({
      description: "Frais de livraison – Aramex",
      unitPriceTTCCents: 7000,
      discountAmountCents: 5882,
    });
    expect(mapped.invoice.globalDiscountAmountCents).toBeNull();
    expect(mapped.expectedTotalTTCMinor).toBe(248000);
    expect(mapped.contact).toMatchObject({
      name: "Amine Ben Salah",
      email: "client.test@example.com",
      company: "ACME SARL",
      address: "12 Rue de Marseille\n1000 Tunis\nTunisie",
    });
    expect(mapped.payment).toMatchObject({ amountMinor: 248000, method: "Paiement à la livraison" });
  });

  it("keeps fractional minor units for 2-decimal currencies", () => {
    const payload = prestashopOrderPayloadSchema.parse(
      buildPayload({
        order: { ...buildPayload().order, currency: "EUR" },
        lines: [{ ...buildPayload().lines[1], unitPriceTaxIncl: "10.125000" }],
      }),
    );
    expect(() =>
      mapPrestashopOrder(payload, { totalTolerance: "0.010", applyTimbre: false, recordPayments: false }),
    ).not.toThrow();
    const mapped = mapPrestashopOrder(payload, {
      totalTolerance: "0.010",
      applyTimbre: false,
      recordPayments: false,
    });
    expect(mapped.invoice.lines[0].unitPriceTTCCents).toBe(1012.5);
    expect(mapped.payment).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Endpoint behaviour
// ---------------------------------------------------------------------------

describe("POST /api/integrations/prestashop/invoices", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("successful generation", () => {
    it("creates the invoice, records the payment and returns the PDF as JSON", async () => {
      const response = await harness.call(signedRequest(buildPayload()));
      expect(response.status).toBe(201);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-idempotent-replay")).toBe("false");
      expect(response.headers.get("x-request-id")).toBeTruthy();

      const body = await response.json();
      expect(body.status).toBe("created");
      expect(body.invoice).toMatchObject({
        id: "inv-1",
        number: "FAC-2026-0001",
        orderId: 4521,
        orderReference: "XKBKNABJK",
        currency: "TND",
        // Order total 245.000 + timbre fiscal 1.000 from the tenant tax settings.
        totalTaxIncl: "246.000",
        timbreAmount: "1.000",
        totalVat: "39.118",
        totalTaxExcl: "205.882",
        vatRates: ["19.000"],
        // A fully paid order settles the whole invoice, timbre included.
        amountPaid: "246.000",
        status: "PAYEE",
      });
      expect(body.payment).toEqual({ recorded: true });
      expect(body.totalsCheck).toEqual({
        orderTotalTaxIncl: "245.000",
        timbreChargedByShop: false,
        invoiceTotalWithoutTimbre: "245.000",
        difference: "0.000",
      });
      expect(Buffer.from(body.pdf.base64, "base64")).toEqual(Buffer.from(FAKE_PDF));
      expect(body.pdf.sha256).toBe(sha256Hex(FAKE_PDF));
      expect(body.pdf.filename).toBe("facture-FAC-2026-0001.pdf");

      const [tenant, input] = harness.deps.createInvoice.mock.calls[0];
      expect(tenant).toBe(TENANT);
      expect(input).toMatchObject({
        clientId: "client-1",
        reference: "XKBKNABJK",
        currency: "TND",
        status: "ENVOYEE",
        globalDiscountAmountCents: 8403,
        taxes: { applyFodec: false, applyTimbre: true },
      });
      expect(input).not.toHaveProperty("number");
      // Only the order reference identifies the order; never the internal id 4521.
      expect(input.notes).toContain("Référence de commande : XKBKNABJK");
      expect(input.notes).not.toContain("4521");
      expect(input.lines.map((line: { description: string }) => line.description)).toEqual([
        "Casque Bluetooth X (Réf. CASQ-X)",
        "Câble USB-C",
        "Frais de livraison – Aramex",
      ]);
      expect(harness.deps.resolveClient).toHaveBeenCalledWith(
        expect.objectContaining({ email: "client.test@example.com", vatNumber: "1234567/A/M/000" }),
        TENANT,
        { source: "prestashop", shopId: 1, customerId: 77 },
      );
      expect(harness.deps.onInvoiceChanged).toHaveBeenCalledWith(TENANT, "inv-1");
      expect(harness.store.rows[0]).toMatchObject({ status: "COMPLETED", invoiceId: "inv-1" });
    });

    it("returns the raw PDF when Accept: application/pdf is requested", async () => {
      const response = await harness.call(signedRequest(buildPayload(), { accept: "application/pdf" }));
      expect(response.status).toBe(201);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("x-invoice-number")).toBe("FAC-2026-0001");
      expect(response.headers.get("x-content-sha256")).toBe(sha256Hex(FAKE_PDF));
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(FAKE_PDF);
    });

    it("records only the amount paid when the order is partly paid", async () => {
      const payload = buildPayload({ totals: { ...buildPayload().totals, totalPaid: "100.000000" } });
      const response = await harness.call(signedRequest(payload));
      const body = await response.json();
      expect(body.invoice).toMatchObject({ amountPaid: "100.000", status: "PARTIELLE" });
    });

    it("does not record a payment for unpaid orders", async () => {
      const payload = buildPayload({ order: { ...buildPayload().order, isPaid: false, paidAt: null } });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.payment).toBeNull();
      expect(body.invoice.status).toBe("ENVOYEE");
      expect(harness.deps.recordPayment).not.toHaveBeenCalled();
    });

    it("still returns the invoice when recording the payment fails", async () => {
      harness.deps.recordPayment.mockRejectedValueOnce(new Error("db down"));
      const response = await harness.call(signedRequest(buildPayload()));
      expect(response.status).toBe(201);
      expect((await response.json()).payment).toEqual({ recorded: false });
    });
  });

  describe("authentication and transport security", () => {
    it.each([
      ["missing signature", { omit: ["x-signature"] }],
      ["missing idempotency key", { omit: ["idempotency-key"] }],
      ["wrong secret", { secret: "another-secret-0123456789abcdef0123456789" }],
      ["unknown key id", { keyId: "unknown-key" }],
      ["expired timestamp", { timestamp: Math.floor(Date.now() / 1000) - 3600 }],
      ["future timestamp", { timestamp: Math.floor(Date.now() / 1000) + 3600 }],
      ["malformed nonce", { nonce: "short" }],
      ["tampered body", { tamper: (raw: string) => raw.replace("245.000000", "1.000000") }],
    ])("rejects %s with a generic 401", async (_label, options) => {
      const response = await harness.call(signedRequest(buildPayload(), options));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toMatchObject({ code: "UNAUTHORIZED", message: "Authentification invalide.", retryable: false });
      expect(JSON.stringify(body)).not.toMatch(/signature|timestamp|nonce|key/i);
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
      expect(harness.store.nonces.size).toBe(0);
    });

    it("rejects a replayed request (same nonce) even with a valid signature", async () => {
      const first = signedRequest(buildPayload(), { nonce: "replay-nonce-1234567890", idempotencyKey: "order-4521-fixed" });
      const replay = signedRequest(buildPayload(), { nonce: "replay-nonce-1234567890", idempotencyKey: "order-4521-fixed" });
      expect((await harness.call(first)).status).toBe(201);
      const response = await harness.call(replay);
      expect(response.status).toBe(401);
      expect(harness.deps.createInvoice).toHaveBeenCalledTimes(1);
    });

    it("accepts any configured key to allow secret rotation", async () => {
      harness = createHarness({
        PRESTASHOP_INVOICE_API_KEYS: `${KEY_ID}:${SECRET},next-key:${SECRET}-rotated`,
      });
      const response = await harness.call(
        signedRequest(buildPayload(), { keyId: "next-key", secret: `${SECRET}-rotated` }),
      );
      expect(response.status).toBe(201);
    });

    it("requires HTTPS in production", async () => {
      const response = await harness.call(
        signedRequest(buildPayload(), { url: "http://invoices.example.com/api/integrations/prestashop/invoices" }),
      );
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("HTTPS_REQUIRED");
    });

    it("enforces the optional IP allowlist", async () => {
      harness = createHarness({ PRESTASHOP_INVOICE_ALLOWED_IPS: "203.0.113.10" });
      const response = await harness.call(signedRequest(buildPayload()));
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("FORBIDDEN");
    });

    it("returns 503 without leaking details when the integration is not configured", async () => {
      harness = createHarness({ PRESTASHOP_INVOICE_API_KEYS: "" });
      const response = await harness.call(signedRequest(buildPayload()));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(JSON.stringify(body)).not.toContain("PRESTASHOP");
    });

    it("rate limits per API key", async () => {
      harness = createHarness({ PRESTASHOP_INVOICE_RATE_LIMIT_PER_MINUTE: "2" });
      const payload = buildPayload();
      expect((await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-rl" }))).status).toBe(201);
      expect((await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-rl" }))).status).toBe(200);
      const limited = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-rl" }));
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBe("60");
      expect(await errorCode(limited)).toBe("RATE_LIMITED");
    });

    it("never logs customer data, secrets or signatures", async () => {
      await harness.call(signedRequest(buildPayload()));
      await harness.call(signedRequest(buildPayload(), { secret: "wrong-secret-0123456789abcdef0123456789" }));
      const logged = JSON.stringify(harness.logs);
      expect(logged).not.toContain(SECRET);
      expect(logged).not.toMatch(/example\.com|Ben Salah|Rue de Marseille|\+216|v1=/i);
      expect(harness.logs.some((entry) => entry.event === "auth_failed")).toBe(true);
    });
  });

  describe("payload validation", () => {
    it("rejects a non-JSON content type", async () => {
      const response = await harness.call(signedRequest(buildPayload(), { contentType: "text/plain" }));
      expect(response.status).toBe(415);
    });

    it("rejects oversized bodies before verifying them", async () => {
      const big = JSON.stringify({ padding: "x".repeat(MAX_BODY_BYTES + 10) });
      const response = await harness.call(signedRequest(big));
      expect(response.status).toBe(413);
      expect(await errorCode(response)).toBe("PAYLOAD_TOO_LARGE");
    });

    it("rejects malformed JSON", async () => {
      const response = await harness.call(signedRequest("{not json"));
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("INVALID_JSON");
    });

    it("returns field-level details for schema violations", async () => {
      const payload = buildPayload({
        customer: { ...buildPayload().customer, email: "not-an-email" },
        lines: [{ ...buildPayload().lines[0], quantity: 0, unitPriceTaxIncl: 119.0 }],
      });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      const paths = body.error.details.map((detail: { path: string }) => detail.path);
      expect(paths).toEqual(
        expect.arrayContaining(["customer.email", "lines.0.quantity", "lines.0.unitPriceTaxIncl"]),
      );
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
    });

    it("rejects unknown fields and unsupported schema versions", async () => {
      const unknownField = await harness.call(signedRequest({ ...buildPayload(), injected: true }));
      expect(unknownField.status).toBe(422);
      const badVersion = await harness.call(signedRequest(buildPayload({ schemaVersion: 2 })));
      expect(badVersion.status).toBe(422);
    });

    it("rejects inconsistent discount totals", async () => {
      const payload = buildPayload({ discounts: [] });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.details[0].path).toBe("discounts");
    });

    it("refuses to issue an invoice whose total differs from the order total", async () => {
      // The order totals add up, but the lines do not produce them.
      const base = buildPayload();
      const payload = buildPayload({
        lines: [{ ...base.lines[0], unitPriceTaxIncl: "146.500000" }, base.lines[1]],
      });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("TOTALS_MISMATCH");
      expect(body.error.details[0].message).toMatch(/^Attendu 245\.000, calculé 300\.00\d$/);
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
      expect(harness.store.rows).toHaveLength(0);
    });

    it("rejects order totals that do not add up instead of trusting them", async () => {
      const payload = buildPayload({
        totals: { ...buildPayload().totals, totalTaxIncl: "300.000000", totalPaid: "300.000000" },
      });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(body.error.details.map((issue: { path: string }) => issue.path)).toContain("totals.totalTaxIncl");
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
    });

    it("rejects TTC discounts that do not match the order discount total", async () => {
      const payload = buildPayload({
        discounts: [{ name: "BIENVENUE", amountTaxExcl: "8.403361", amountTaxIncl: "12.000000", freeShipping: false }],
      });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(422);
      expect((await response.json()).error.details[0].path).toBe("discounts");
    });

    it("never accepts an invoice number from the shop", async () => {
      const response = await harness.call(signedRequest(buildPayload({ number: "FAC-2026-9999" })));
      expect(response.status).toBe(422);
      expect(await errorCode(response)).toBe("VALIDATION_FAILED");
      const nested = buildPayload({ invoiceOptions: { vatRate: "19.000", number: "FAC-2026-9999" } });
      expect((await harness.call(signedRequest(nested))).status).toBe(422);
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
    });

    it("rejects a VAT rate that is not configured in invoice-app", async () => {
      const payload = buildPayload({ invoiceOptions: { vatRate: "18.000" } });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VAT_RATE_NOT_ALLOWED");
      expect(body.error.retryable).toBe(false);
      expect(body.error.details[0]).toMatchObject({ path: "invoiceOptions.vatRate" });
      expect(body.error.details[0].message).toContain("19 %");
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
      expect(harness.store.rows).toHaveLength(0);
    });

    it("rejects malformed VAT rates", async () => {
      for (const vatRate of ["19", "abc", "101.000", "-7.000", 19]) {
        const response = await harness.call(signedRequest(buildPayload({ invoiceOptions: { vatRate } })));
        if (vatRate === "19") {
          expect(response.status).toBe(201); // "19" is a valid decimal string
          harness = createHarness();
          continue;
        }
        expect(response.status).toBe(422);
        expect(await errorCode(response)).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("VAT selection and timbre fiscal", () => {
    // A real techno-smart.tn order: products recorded at 0 % in PrestaShop.
    const zeroRatedOrder = (overrides: Record<string, unknown> = {}) => {
      const base = buildPayload();
      return buildPayload({
        lines: [
          { ...base.lines[0], quantity: 1, unitPriceTaxExcl: "69.000000", unitPriceTaxIncl: "69.000000", taxRate: "0.000" },
          { ...base.lines[1], quantity: 2, unitPriceTaxExcl: "15.500000", unitPriceTaxIncl: "15.500000", taxRate: "0.000" },
        ],
        shipping: { carrierName: "Aramex", amountTaxExcl: "7.000000", amountTaxIncl: "7.000000", taxRate: "0.000" },
        discounts: [{ name: "BIENVENUE", amountTaxExcl: "10.000000", amountTaxIncl: "10.000000", freeShipping: false }],
        totals: {
          productsTaxExcl: "100.000000",
          productsTaxIncl: "100.000000",
          discountsTaxExcl: "10.000000",
          discountsTaxIncl: "10.000000",
          shippingTaxExcl: "7.000000",
          shippingTaxIncl: "7.000000",
          wrappingTaxExcl: "0.000000",
          wrappingTaxIncl: "0.000000",
          totalTaxExcl: "97.000000",
          totalTaxIncl: "97.000000",
          totalPaid: "97.000000",
        },
        ...overrides,
      });
    };

    it.each([
      // Exact HT = 97 / (1 + rate); the engine rounds per line (≤ 0.002 TND apart).
      ["19.000", 81.513, ["19.000"]],
      ["7.000", 90.654, ["7.000"]],
      ["0.000", 97, ["0.000"]],
    ])(
      "applies the selected VAT %s%% to every line while keeping the TTC paid",
      async (vatRate, exactTaxExcl, vatRates) => {
        const response = await harness.call(signedRequest(zeroRatedOrder({ invoiceOptions: { vatRate } })));
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.invoice).toMatchObject({ timbreAmount: "1.000", vatRates });
        // Invoice = order total (97.000) + timbre (1.000), up to a reported VAT
        // rounding residue on the discount allocation, bounded by the tolerance.
        const difference = Number(body.totalsCheck.difference);
        expect(body.totalsCheck.orderTotalTaxIncl).toBe("97.000");
        expect(Math.abs(difference)).toBeLessThanOrEqual(0.01);
        expect(Number(body.invoice.totalTaxIncl)).toBeCloseTo(98 + difference, 3);
        const ht = Number(body.invoice.totalTaxExcl);
        const vat = Number(body.invoice.totalVat);
        expect(Math.round((ht + vat) * 1000)).toBe(Math.round((97 + difference) * 1000));
        expect(Math.abs(ht - exactTaxExcl)).toBeLessThanOrEqual(0.002);
        expect(Math.abs(vat - (97 - exactTaxExcl))).toBeLessThanOrEqual(0.002);
        const [, input] = harness.deps.createInvoice.mock.calls[0];
        expect(input.lines.every((line: { vatRate: number }) => line.vatRate === Number(vatRate))).toBe(true);
        expect(input.lines.map((line: { unitPriceTTCCents: number }) => line.unitPriceTTCCents)).toEqual([
          69000, 15500, 7000,
        ]);
        expect(input.notes).toContain(`TVA appliquée : ${Number(vatRate)} %`);
        expect(input.taxes).toEqual({ applyFodec: false, applyTimbre: true });
      },
    );

    it("converts free-shipping discounts at the selected rate", async () => {
      const payload = zeroRatedOrder({
        invoiceOptions: { vatRate: "19.000" },
        discounts: [{ name: "Livraison offerte", amountTaxExcl: "7.000000", amountTaxIncl: "7.000000", freeShipping: true }],
        totals: {
          ...zeroRatedOrder().totals,
          discountsTaxExcl: "7.000000",
          discountsTaxIncl: "7.000000",
          totalTaxExcl: "100.000000",
          totalTaxIncl: "100.000000",
          totalPaid: "100.000000",
        },
      });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.invoice.totalTaxIncl).toBe("101.000");
      const [, input] = harness.deps.createInvoice.mock.calls[0];
      expect(input.lines[2]).toMatchObject({ vatRate: 19, unitPriceTTCCents: 7000, discountAmountCents: 5882 });
      expect(input.globalDiscountAmountCents).toBeNull();
    });

    it("keeps each line's shop rate when no VAT is selected", async () => {
      const response = await harness.call(signedRequest(buildPayload({ invoiceOptions: { vatRate: null } })));
      expect(response.status).toBe(201);
      const [, input] = harness.deps.createInvoice.mock.calls[0];
      expect(input.lines.map((line: { vatRate: number }) => line.vatRate)).toEqual([19, 19, 19]);
    });

    it("omits the timbre when it is disabled for the integration", async () => {
      harness = createHarness({ PRESTASHOP_INVOICE_APPLY_TIMBRE: "false" });
      const response = await harness.call(signedRequest(zeroRatedOrder({ invoiceOptions: { vatRate: "19.000" } })));
      const body = await response.json();
      expect(body.invoice).toMatchObject({ totalTaxIncl: "97.000", timbreAmount: "0.000", status: "PAYEE" });
    });

    // Timbre charged at checkout (hidden product): in the order totals, not in lines.
    const orderWithShopTimbre = (overrides: Record<string, unknown> = {}) =>
      zeroRatedOrder({
        timbreFiscal: { amount: "1.000000" },
        totals: {
          ...zeroRatedOrder().totals,
          productsTaxExcl: "101.000000",
          productsTaxIncl: "101.000000",
          totalTaxExcl: "98.000000",
          totalTaxIncl: "98.000000",
          totalPaid: "98.000000",
        },
        ...overrides,
      });

    it("uses the timbre charged at checkout once instead of adding another one", async () => {
      const response = await harness.call(signedRequest(orderWithShopTimbre({ invoiceOptions: { vatRate: "19.000" } })));
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.invoice).toMatchObject({
        timbreAmount: "1.000",
        status: "PAYEE",
      });
      // Invoice total = what the customer paid (98.000, timbre included), up to the
      // reported VAT rounding residue on the discount.
      expect(body.totalsCheck).toMatchObject({ orderTotalTaxIncl: "98.000", timbreChargedByShop: true });
      expect(Math.abs(Number(body.totalsCheck.difference))).toBeLessThanOrEqual(0.01);
      expect(Number(body.invoice.totalTaxIncl)).toBeCloseTo(98 + Number(body.totalsCheck.difference), 3);
      expect(body.invoice.amountPaid).toBe(body.invoice.totalTaxIncl);
      const [, input] = harness.deps.createInvoice.mock.calls[0];
      expect(input.taxes).toEqual({ applyFodec: false, applyTimbre: true });
      expect(input.lines).toHaveLength(3); // 2 products + shipping, no timbre product line
    });

    it("keeps the shop timbre even when the integration does not add one", async () => {
      harness = createHarness({ PRESTASHOP_INVOICE_APPLY_TIMBRE: "false" });
      const response = await harness.call(signedRequest(orderWithShopTimbre({ invoiceOptions: { vatRate: "0.000" } })));
      const body = await response.json();
      expect(body.invoice).toMatchObject({ totalTaxIncl: "98.000", timbreAmount: "1.000", status: "PAYEE" });
    });

    it("rejects a shop timbre that differs from the tenant's timbre", async () => {
      const payload = orderWithShopTimbre({
        timbreFiscal: { amount: "2.000000" },
        totals: { ...orderWithShopTimbre().totals, productsTaxExcl: "102.000000", productsTaxIncl: "102.000000", totalTaxExcl: "99.000000", totalTaxIncl: "99.000000", totalPaid: "99.000000" },
      });
      const response = await harness.call(signedRequest(payload));
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("TIMBRE_MISMATCH");
      expect(body.error.details[0].message).toContain("Boutique 2.000, invoice-app 1.000");
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
    });

    it("rejects a shop timbre missing from the order totals", async () => {
      const response = await harness.call(signedRequest(zeroRatedOrder({ timbreFiscal: { amount: "1.000000" } })));
      expect(response.status).toBe(422);
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
    });

    it("treats a different VAT selection after invoicing as a changed order", async () => {
      const first = await harness.call(
        signedRequest(zeroRatedOrder({ invoiceOptions: { vatRate: "19.000" } }), { idempotencyKey: "ps-1-4521" }),
      );
      expect(first.status).toBe(201);
      const sameKey = await harness.call(
        signedRequest(zeroRatedOrder({ invoiceOptions: { vatRate: "7.000" } }), { idempotencyKey: "ps-1-4521" }),
      );
      expect(sameKey.status).toBe(422);
      expect(await errorCode(sameKey)).toBe("IDEMPOTENCY_KEY_REUSED");
      const newKey = await harness.call(
        signedRequest(zeroRatedOrder({ invoiceOptions: { vatRate: "7.000" } }), { idempotencyKey: "ps-1-4521-b" }),
      );
      expect(newKey.status).toBe(409);
      expect(await errorCode(newKey)).toBe("ORDER_ALREADY_INVOICED");
      expect(harness.deps.createInvoice).toHaveBeenCalledTimes(1);
    });
  });

  describe("duplicate requests and idempotency", () => {
    it("replays the same invoice for a retried request with the same idempotency key", async () => {
      const payload = buildPayload();
      const first = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-v1" }));
      const second = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-v1" }));
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.headers.get("x-idempotent-replay")).toBe("true");
      const [a, b] = [await first.json(), await second.json()];
      expect(b.status).toBe("existing");
      expect(b.invoice.number).toBe(a.invoice.number);
      expect(harness.deps.createInvoice).toHaveBeenCalledTimes(1);
      expect(harness.deps.recordPayment).toHaveBeenCalledTimes(1);
    });

    it("returns the existing invoice when the same order is sent again with a new key", async () => {
      const payload = buildPayload();
      await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-click1" }));
      const second = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-click2" }));
      expect(second.status).toBe(200);
      expect((await second.json()).invoice.id).toBe("inv-1");
      expect(harness.deps.createInvoice).toHaveBeenCalledTimes(1);
    });

    it("rejects reuse of an idempotency key with a different payload", async () => {
      await harness.call(signedRequest(buildPayload(), { idempotencyKey: "order-4521-same" }));
      const changed = buildPayload({ order: { ...buildPayload().order, paymentMethod: "Carte bancaire" } });
      const response = await harness.call(signedRequest(changed, { idempotencyKey: "order-4521-same" }));
      expect(response.status).toBe(422);
      expect(await errorCode(response)).toBe("IDEMPOTENCY_KEY_REUSED");
    });

    it("rejects reuse of an idempotency key for another order", async () => {
      await harness.call(signedRequest(buildPayload(), { idempotencyKey: "shared-key-123" }));
      const other = buildPayload({ order: { ...buildPayload().order, id: 9999, reference: "OTHERREF" } });
      const response = await harness.call(signedRequest(other, { idempotencyKey: "shared-key-123" }));
      expect(response.status).toBe(422);
      expect(await errorCode(response)).toBe("IDEMPOTENCY_KEY_REUSED");
      expect(harness.deps.createInvoice).toHaveBeenCalledTimes(1);
    });

    it("refuses to silently change an already invoiced order", async () => {
      await harness.call(signedRequest(buildPayload(), { idempotencyKey: "order-4521-a" }));
      const changed = buildPayload({ order: { ...buildPayload().order, paymentMethod: "Virement" } });
      const response = await harness.call(signedRequest(changed, { idempotencyKey: "order-4521-b" }));
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("ORDER_ALREADY_INVOICED");
      expect(body.error.details).toEqual({ invoiceId: "inv-1", invoiceNumber: "FAC-2026-0001" });
    });

    it("creates exactly one invoice for concurrent duplicate requests", async () => {
      const payload = buildPayload();
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          harness.call(signedRequest(payload, { idempotencyKey: `order-4521-c${index}` })),
        ),
      );
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.every((status) => [200, 201, 409].includes(status))).toBe(true);
      expect(harness.deps.createInvoice).toHaveBeenCalledTimes(1);
    });

    it("reports an in-progress generation with Retry-After", async () => {
      harness.store.rows.push({
        tenantUserId: TENANT,
        shopId: "1",
        externalOrderId: "4521",
        externalOrderReference: "XKBKNABJK",
        idempotencyKey: "other-instance-key",
        payloadHash: "x",
        id: "req-busy",
        status: "PROCESSING",
        invoiceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 1,
        lastErrorCode: null,
      });
      const response = await harness.call(signedRequest(buildPayload()));
      expect(response.status).toBe(409);
      expect(response.headers.get("retry-after")).toBe("5");
      expect(await errorCode(response)).toBe("REQUEST_IN_PROGRESS");
    });

    it("recovers an invoice created by a crashed attempt instead of duplicating it", async () => {
      harness.invoices.set("inv-orphan", {
        id: "inv-orphan",
        number: "FAC-2026-0099",
        status: "ENVOYEE",
        reference: "XKBKNABJK",
        issueDate: new Date(),
        currency: "TND",
        totalTTCCents: 245000,
        amountPaidCents: 0,
        input: {} as InvoiceInput,
      });
      harness.store.invoicesByReference.set("XKBKNABJK", "inv-orphan");
      harness.store.rows.push({
        tenantUserId: TENANT,
        shopId: "1",
        externalOrderId: "4521",
        externalOrderReference: "XKBKNABJK",
        idempotencyKey: "crashed-key-1",
        payloadHash: "x",
        id: "req-crashed",
        status: "PROCESSING",
        invoiceId: null,
        createdAt: new Date(Date.now() - 600_000),
        updatedAt: new Date(Date.now() - 600_000),
        attempts: 1,
        lastErrorCode: null,
      });
      const response = await harness.call(signedRequest(buildPayload()));
      expect(response.status).toBe(200);
      expect((await response.json()).invoice.number).toBe("FAC-2026-0099");
      expect(harness.deps.createInvoice).not.toHaveBeenCalled();
    });
  });

  describe("generation failures", () => {
    it("marks the request failed and lets a retry generate the invoice", async () => {
      harness.deps.createInvoice.mockRejectedValueOnce(new Error("sequence locked"));
      const payload = buildPayload();
      const failed = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-retry" }));
      expect(failed.status).toBe(500);
      const failedBody = await failed.json();
      expect(failedBody.error).toMatchObject({ code: "INVOICE_GENERATION_FAILED", retryable: true });
      expect(JSON.stringify(failedBody)).not.toContain("sequence locked");
      expect(harness.store.rows[0]).toMatchObject({ status: "FAILED", lastErrorCode: "INVOICE_GENERATION_FAILED" });

      const retried = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-retry" }));
      expect(retried.status).toBe(201);
      expect(harness.store.rows[0]).toMatchObject({ status: "COMPLETED", attempts: 2 });
    });

    it("keeps the invoice when PDF rendering fails and replays it on retry", async () => {
      harness.deps.renderPdf.mockRejectedValueOnce(new Error("chromium crashed"));
      const payload = buildPayload();
      const failed = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-pdf" }));
      expect(failed.status).toBe(500);
      const body = await failed.json();
      expect(body.error).toMatchObject({
        code: "PDF_GENERATION_FAILED",
        retryable: true,
        details: { invoiceId: "inv-1", invoiceNumber: "FAC-2026-0001" },
      });

      const retried = await harness.call(signedRequest(payload, { idempotencyKey: "order-4521-pdf" }));
      expect(retried.status).toBe(200);
      expect((await retried.json()).invoice.id).toBe("inv-1");
      expect(harness.deps.createInvoice).toHaveBeenCalledTimes(1);
    });

    it("hides unexpected internal errors behind a generic 500", async () => {
      harness.store.claimRequest = async () => {
        throw new Error('relation "ExternalInvoiceRequest" does not exist');
      };
      const response = await harness.call(signedRequest(buildPayload()));
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Erreur interne." });
      expect(JSON.stringify(body)).not.toContain("relation");
    });
  });
});

// ---------------------------------------------------------------------------
// Invoice numbering stays in invoice-app
// ---------------------------------------------------------------------------

describe("invoice numbering ownership", () => {
  it("never takes the invoice number from PrestaShop", async () => {
    const harness = createHarness();
    for (const field of ["number", "invoiceNumber"]) {
      const response = await harness.call(signedRequest({ ...buildPayload(), [field]: "FAC-2026-9999" }));
      expect(response.status).toBe(422);
      const sneaky = buildPayload({ order: { ...buildPayload().order, [field]: "FAC-2026-9999" } });
      expect((await harness.call(signedRequest(sneaky))).status).toBe(422);
    }
    expect(harness.deps.createInvoice).not.toHaveBeenCalled();

    const response = await harness.call(signedRequest(buildPayload()));
    expect(response.status).toBe(201);
    const [, input] = harness.deps.createInvoice.mock.calls[0];
    // No number => createInvoiceForUser reserves the next one from the app sequence.
    expect(input).not.toHaveProperty("number");
  });

  it("consumes exactly one number per order, whatever happens on the shop side", async () => {
    const harness = createHarness();
    const order = (id: number) =>
      buildPayload({ order: { ...buildPayload().order, id, reference: `REF${id}` } });

    expect((await harness.call(signedRequest(order(1)))).status).toBe(201);
    // Rejected before any number is reserved.
    const mismatch = order(2);
    mismatch.totals = { ...mismatch.totals, totalTaxIncl: "999.000000" };
    expect((await harness.call(signedRequest(mismatch))).status).toBe(422);
    // Duplicate clicks / retries reuse the existing invoice.
    expect((await harness.call(signedRequest(order(1)))).status).toBe(200);
    expect((await harness.call(signedRequest(order(1)))).status).toBe(200);
    // Creation failure: nothing reserved (the real allocator rolls back with the insert).
    harness.deps.createInvoice.mockRejectedValueOnce(new Error("insert failed"));
    expect((await harness.call(signedRequest(order(3)))).status).toBe(500);
    expect((await harness.call(signedRequest(order(3)))).status).toBe(201);
    expect((await harness.call(signedRequest(order(4)))).status).toBe(201);

    const numbers = [...harness.invoices.values()].map((invoice) => invoice.number);
    expect(numbers).toEqual(["FAC-2026-0001", "FAC-2026-0002", "FAC-2026-0003"]);
  });

  it("uses the Tunis calendar year for the annual series", () => {
    // 31 Dec 23:30 UTC is already 1 Jan 00:30 in Tunis (UTC+1).
    expect(invoiceNumberingYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(invoiceNumberingYear(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
  });
});

// ---------------------------------------------------------------------------
// GET download: always re-rendered with the current company settings
// ---------------------------------------------------------------------------

function signedGet(
  shopId: string,
  orderId: string,
  options: { secret?: string; signedPath?: string; nonce?: string; body?: string; accept?: string } = {},
) {
  const path = `${PATH}/${shopId}/${orderId}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const signature = computeSignature(options.secret ?? SECRET, {
    method: "GET",
    path: options.signedPath ?? path,
    timestamp,
    nonce,
    idempotencyKey: "",
    bodySha256Hex: sha256Hex(options.body ?? ""),
  });
  ipCounter += 1;
  return new Request(`https://invoices.example.com${path}`, {
    method: options.body ? "POST" : "GET",
    headers: {
      "x-signature-key-id": KEY_ID,
      "x-signature-timestamp": timestamp,
      "x-signature-nonce": nonce,
      "x-signature": signature,
      "x-real-ip": `10.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
      ...(options.accept ? { accept: options.accept } : {}),
    },
    ...(options.body ? { body: options.body } : {}),
  });
}

describe("GET /api/integrations/prestashop/invoices/{shopId}/{orderId}", () => {
  let harness: Harness;
  let companyName: string;
  const download = (request: Request, shopId = "1", orderId = "4521") =>
    handlePrestashopInvoiceDownload(request, { shopId, orderId }, harness.deps);

  beforeEach(async () => {
    harness = createHarness();
    companyName = "Techno Smart SARL";
    // Simulated renderer: the PDF embeds the company settings read at render time.
    harness.deps.renderPdf.mockImplementation(async () =>
      new Uint8Array(Buffer.from(`%PDF fake ${companyName}`)),
    );
    expect((await harness.call(signedRequest(buildPayload()))).status).toBe(201);
    harness.deps.createInvoice.mockClear();
  });

  it("re-renders the PDF on every download so company settings are always current", async () => {
    const first = await download(signedGet("1", "4521"));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.invoice).toMatchObject({ id: "inv-1", number: "FAC-2026-0001", orderId: 4521 });
    expect(Buffer.from(firstBody.pdf.base64, "base64").toString()).toContain("Techno Smart SARL");
    expect(firstBody.totalsCheck).toBeNull();

    companyName = "Techno Smart SA"; // e.g. edited in Paramètres généraux
    const second = await download(signedGet("1", "4521", { accept: "application/pdf" }));
    expect(second.status).toBe(200);
    expect(second.headers.get("x-invoice-number")).toBe("FAC-2026-0001");
    expect(Buffer.from(await second.arrayBuffer()).toString()).toContain("Techno Smart SA");
    expect(harness.deps.renderPdf).toHaveBeenCalledTimes(3);
    expect(harness.deps.createInvoice).not.toHaveBeenCalled();
  });

  it("returns 404 for an order without invoice", async () => {
    const response = await download(signedGet("1", "9999"), "1", "9999");
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe("INVOICE_NOT_FOUND");
    expect((await download(signedGet("1", "abc"), "1", "abc")).status).toBe(404);
  });

  it("binds the signature to the requested order", async () => {
    // Signed for order 4521 but sent to another order's URL.
    const response = await download(
      signedGet("1", "4522", { signedPath: `${PATH}/1/4521` }),
      "1",
      "4522",
    );
    expect(response.status).toBe(401);
  });

  it("rejects bad signatures and replayed nonces", async () => {
    expect((await download(signedGet("1", "4521", { secret: "x".repeat(40) }))).status).toBe(401);
    const nonce = "download-nonce-1234567890";
    expect((await download(signedGet("1", "4521", { nonce }))).status).toBe(200);
    expect((await download(signedGet("1", "4521", { nonce }))).status).toBe(401);
  });
});

