import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/integrations/prestashop/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/integrations/prestashop/service")>();
  return { ...original, processPrestashopInvoice: vi.fn() };
});

import { processPrestashopInvoice } from "@/server/integrations/prestashop/service";
import { loadLicenceApiConfig } from "@/server/digital-products/api-config";
import {
  customerNameOf,
  handleDigitalOrderRequest,
  licenceLineKey,
  loadFulfilmentInvoiceConfig,
  requirePaidOrderFromEnv,
  reviewVersionOf,
  notifyShopForReview,
  sendReviewedDigitalOrder,
  unpaidOrderReason,
  type DigitalOrderDeps,
} from "@/server/digital-products/fulfilment";
import type { FulfilmentClaim, FulfilmentClaimInput, FulfilmentRecord, FulfilmentStore } from "@/server/digital-products/fulfilment-store";
import { loadDeliveryPolicy } from "@/server/digital-products/delivery-policy";
import { OrderEmailError } from "@/server/digital-products/order-email";
import { InsufficientLicenceStockError, type LicenceOrderRecord } from "@/server/digital-products/store";
import { hashLicenceRequest, parseLicenceRequest } from "@/server/digital-products/licences";
import { computeSignature, sha256Hex } from "@/server/integrations/prestashop/signature";
import { buildPayload } from "./fixtures/prestashop-order";

const PATH = "/api/integrations/prestashop/digital-orders";
const KEY_ID = "ts-licences-test";
const SECRET = "fulfilment-secret-0123456789abcdef0123456789";
const TENANT = "tenant-1";
const INVOICE_PDF = Buffer.from("%PDF-1.7 invoice");
const LICENCE_PDF = Buffer.from("%PDF-1.7 licence");

const processInvoice = vi.mocked(processPrestashopInvoice);

function licenceOrder(id: string, overrides: Partial<LicenceOrderRecord> = {}): LicenceOrderRecord {
  const now = new Date("2026-11-13T10:00:00Z");
  return {
    id, userId: TENANT, number: `LIC-20261113-${id.slice(-6).toUpperCase()}`, productSku: "kaspersky-plus-3p-1y",
    quantity: 1, status: "PENDING", source: "PRESTASHOP", idempotencyKey: null, requestHash: null,
    customerName: null, customerEmail: null, orderReference: null, activationRegion: null, useBefore: null,
    notes: null, externalSource: "prestashop", externalOrderId: "4521", externalLineId: null, invoiceId: null,
    createdById: null, createdByName: null, apiKeyId: KEY_ID, generationCount: 0, lastErrorCode: null,
    generatedAt: null, lastDownloadedAt: null, deliveredAt: null, cancelledAt: null, createdAt: now, updatedAt: now,
    ...overrides,
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    invoice: buildPayload(),
    licences: [
      { lineId: 9876, sku: "kaspersky-plus-3p-1y", quantity: 1 },
      { lineId: "9877", sku: "kaspersky-standard-1p-1y", quantity: 2 },
    ],
    ...overrides,
  };
}

function signed(payload: unknown, options: { key?: string; scheme?: string; path?: string } = {}) {
  const raw = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const idempotencyKey = options.key ?? "ps-1-4521";
  const signature = computeSignature(SECRET, {
    method: "POST", path: options.path ?? PATH, timestamp, nonce, idempotencyKey,
    bodySha256Hex: sha256Hex(raw), scheme: options.scheme ?? "DPLIC1",
  });
  return new Request(`https://invoices.example.com${PATH}`, {
    method: "POST",
    body: raw,
    headers: {
      "content-type": "application/json",
      "x-signature-key-id": KEY_ID,
      "x-signature-timestamp": timestamp,
      "x-signature-nonce": nonce,
      "idempotency-key": idempotencyKey,
      "x-signature": signature,
      "x-real-ip": "203.0.113.20",
    },
  });
}

class MemoryStore implements FulfilmentStore {
  record: FulfilmentRecord | null = null;
  review: { payload: unknown; keyId: string } | null = null;
  sentBy: string | null = null;
  async findByOrder() {
    return this.record ? { ...this.record, reviewed: this.review !== null } : null;
  }
  async markAwaitingReview(_id: string, data: { payload: unknown; keyId: string }) {
    if (this.record!.status === "PROCESSING") {
      Object.assign(this.record!, { status: "FAILED", lastErrorCode: "AWAITING_APPROVAL" });
      this.review = data;
    }
  }
  async findReview(tenant: string, id: string) {
    if (!this.record || tenant !== TENANT || id !== this.record.id) return null;
    return {
      ...this.record, userId: TENANT, shopId: "1", externalOrderId: "4521", orderReference: "XKBKNABJK",
      reviewPayload: this.review?.payload ?? null, reviewKeyId: this.review?.keyId ?? null,
      reviewRequestedAt: this.review ? this.reviewRequestedAt : null, updatedAt: new Date(),
      shopNotifiedAt: null, shopNotifyResult: this.notified,
    };
  }
  notified: string | null = null;
  async clearReview() { if (this.record!.status !== "COMPLETED") this.review = null; }
  async markShopNotified(_id: string, result: string) { this.notified = result; }
  reviewRequestedAt = new Date();
  async refuseReview(_id: string, code: string, attempts: number) {
    if (this.record!.status !== "FAILED" || this.record!.attempts !== attempts) return;
    this.record!.lastErrorCode = code;
    this.review = null;
  }
  async markSentBy(_id: string, userId: string) { this.sentBy = userId; }
  async claim(input?: FulfilmentClaimInput): Promise<FulfilmentClaim> {
    if (!this.record) {
      this.record = {
        id: "dlful-1", status: "PROCESSING", idempotencyKey: "ps-1-4521", requestHash: "h", invoiceId: null,
        licenceOrderIds: [], emailTo: null, emailSubject: null, emailSentAt: null, lastErrorCode: null, attempts: 1, completedAt: null,
      };
      return { kind: "claimed", record: { ...this.record } };
    }
    if (this.record.status === "COMPLETED") return { kind: "completed", record: { ...this.record } };
    if (this.record.status === "PROCESSING") return { kind: "in_progress" };
    if (input?.holdIfReviewed && this.review) return { kind: "awaiting_review", record: { ...this.record } };
    if (input?.expectedAttempts !== undefined && input.expectedAttempts !== this.record.attempts) return { kind: "changed" };
    this.record.status = "PROCESSING";
    this.record.attempts += 1;
    return { kind: "claimed", record: { ...this.record } };
  }
  async saveProgress(_id: string, data: { licenceOrderIds?: string[]; invoiceId?: string }) {
    if (data.licenceOrderIds) this.record!.licenceOrderIds = data.licenceOrderIds;
    if (data.invoiceId) this.record!.invoiceId = data.invoiceId;
  }
  async markEmailSent(_id: string, data: { to: string; subject: string }) {
    Object.assign(this.record!, { emailTo: data.to, emailSubject: data.subject, emailSentAt: new Date() });
  }
  async markCompleted() { this.record!.status = "COMPLETED"; }
  async markFailed(_id: string, code: string) {
    if (this.record!.status === "PROCESSING") Object.assign(this.record!, { status: "FAILED", lastErrorCode: code });
  }
}

function makeDeps() {
  const store = new MemoryStore();
  const licences = new Map<string, LicenceOrderRecord>();
  const requestLicence = vi.fn<DigitalOrderDeps["requestLicence"]>(async (params) => {
    const existing = licences.get(params.idempotencyKey);
    if (existing) return { kind: "existing", order: existing };
    const order = licenceOrder(`dlord-${licences.size + 1}abcdef`, {
      productSku: params.request.sku, quantity: params.request.quantity, externalLineId: params.external?.lineId ?? null,
    });
    licences.set(params.idempotencyKey, order);
    return { kind: "created", order };
  });
  const sendEmail = vi.fn<DigitalOrderDeps["sendEmail"]>(async (input) => ({ to: input.to, subject: `Commande ${input.orderReference}` }));

  const markDelivered = vi.fn<DigitalOrderDeps["markDelivered"]>(async () => {});
  const renderInvoicePdf = vi.fn(async () => new Uint8Array(INVOICE_PDF));
  const logs: string[] = [];
  const deps: Partial<DigitalOrderDeps> = {
    auth: {
      loadConfig: () => loadLicenceApiConfig({
        DIGITAL_LICENCE_TENANT_ID: TENANT, DIGITAL_LICENCE_API_KEYS: `${KEY_ID}:${SECRET}`, NODE_ENV: "production",
      }),
      nonces: { registerNonce: async () => true, countRecentRequests: async () => 1, purgeExpiredNonces: async () => {} },
      random: () => 1,
    },
    loadInvoiceConfig: (tenant) => loadFulfilmentInvoiceConfig(tenant, { NODE_ENV: "production" }),
    invoice: {
      getInvoice: async (_tenant: string, id: string) => ({
        id, number: "FAC-2026-00042", status: "PAYEE", reference: "XKBKNABJK", issueDate: new Date("2026-11-13"),
        currency: "TND", totalTTCCents: 245_000, amountPaidCents: 245_000,
      }),
      renderPdf: renderInvoicePdf,
    } as unknown as DigitalOrderDeps["invoice"],
    store,
    requestLicence,
    renderLicencePdf: vi.fn(async ({ orderId }) => ({
      order: { ...[...licences.values()].find((order) => order.id === orderId)!, status: "GENERATED" as const },
      pdf: LICENCE_PDF,
      filename: `licence-${orderId}.pdf`,
    })),
    getCodeHints: async () => [{ codeHint: "7890" }],
    getLicenceOrder: async (_tenant, id) => [...licences.values()].find((order) => order.id === id) ?? null,
    findInvoiceForOrder: async () => "inv-existing",
    sendEmail,
    adoptLicence: vi.fn(async () => true),
    notifyShop: vi.fn(async () => ({ ok: true as const, state: "delivered" as const })),
    checkShop: vi.fn(async () => ({ ok: true as const, payable: true as const })),
    validateInvoice: vi.fn(async () => ({ kind: "ok" as const, mapped: {} as never })),
    policy: () => loadDeliveryPolicy({}),
    countReleasedCodes: vi.fn(async () => 0),
    markDelivered,
    log: (_level, event, fields) => logs.push(JSON.stringify({ event, ...fields })),
  };
  return { deps, store, requestLicence, sendEmail, markDelivered, renderInvoicePdf, logs };
}

describe("digital-order fulfilment API", () => {
  beforeEach(() => {
    processInvoice.mockReset();
    processInvoice.mockResolvedValue({
      kind: "ok", invoiceId: "inv-42", outcome: "created", payment: { recorded: true },
      expectedOrderTotalMinor: 245_000, shopTimbreMinor: null,
    });
  });

  it("allocates licences, creates the invoice, e-mails the customer once, then answers", async () => {
    const { deps, store, requestLicence, sendEmail, markDelivered, logs } = makeDeps();
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.status).toBe("delivered");
    expect(json.invoice).toMatchObject({ id: "inv-42", number: "FAC-2026-00042" });
    expect(Buffer.from(json.pdf.base64, "base64").equals(INVOICE_PDF)).toBe(true);
    expect(json.pdf.sha256).toBe(sha256Hex(INVOICE_PDF));
    expect(json.licences.map((line: { lineId: string }) => line.lineId)).toEqual(["9876", "9877"]);
    expect(json.licences[0].codes).toEqual(["•••••-•••••-•••••-•7890"]);
    expect(json.email).toMatchObject({ subject: "Commande XKBKNABJK", to: "C***@example.com" });

    // Licence lines use the licence API's keys and normalization (PDF replay compatible).
    const first = requestLicence.mock.calls[0][0];
    expect(first.idempotencyKey).toBe("api:ps-1-4521-9876");
    expect(first.external).toEqual({ source: "prestashop", orderId: "4521", lineId: "9876" });
    expect(first.request).toMatchObject({ customerName: "Amine Ben Salah", customerEmail: "client.test@example.com", orderReference: "XKBKNABJK" });

    // Invoice through the shared pipeline with the order key.
    expect(processInvoice.mock.calls[0][0]).toMatchObject({ idempotencyKey: "ps-1-4521" });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail).toMatchObject({ to: "Client.Test@example.com", orderReference: "XKBKNABJK", invoiceNumber: "FAC-2026-00042" });
    expect(mail.attachments.map((attachment) => attachment.filename)).toEqual([
      "FAC-2026-00042.pdf", "licence-dlord-1abcdef.pdf", "licence-dlord-2abcdef.pdf",
    ]);
    expect(markDelivered).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: "inv-42" }));
    expect(store.record).toMatchObject({ status: "COMPLETED", invoiceId: "inv-42" });
    expect(logs.join("\n")).not.toContain("example.com");
  });

  it("delivers a Windows 11 Pro line alongside a Kaspersky line in one order", async () => {
    const { deps, requestLicence, sendEmail } = makeDeps();
    const response = await handleDigitalOrderRequest(
      signed(body({
        licences: [
          { lineId: 9876, sku: "kaspersky-plus-3p-1y", quantity: 1 },
          { lineId: 9878, sku: "windows-11-pro", quantity: 1 },
        ],
      })),
      deps,
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.licences.map((line: { sku: string }) => line.sku)).toEqual(["kaspersky-plus-3p-1y", "windows-11-pro"]);
    expect(json.licences[1]).toMatchObject({
      product: "Windows 11 Professionnel | Licence perpétuelle | 1 PC",
      status: "DELIVERED",
      codes: ["•••••-•••••-•••••-•••••-•7890"],
    });
    expect(json.licences[0].codes).toEqual(["•••••-•••••-•••••-•7890"]);
    expect(requestLicence.mock.calls[1][0]).toMatchObject({
      idempotencyKey: "api:ps-1-4521-9878",
      request: { sku: "windows-11-pro", quantity: 1 },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].attachments).toHaveLength(3);
  });

  it("delivers IDM annual and lifetime lines alongside a Kaspersky line in one order", async () => {
    const { deps, requestLicence, sendEmail, markDelivered } = makeDeps();
    const response = await handleDigitalOrderRequest(
      signed(body({
        licences: [
          { lineId: 9876, sku: "kaspersky-plus-3p-1y", quantity: 1 },
          { lineId: 9880, sku: "idm-1p-1y", quantity: 1 },
          { lineId: 9881, sku: "idm-1p-lifetime", quantity: 1 },
        ],
      })),
      deps,
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.licences.map((line: { sku: string }) => line.sku)).toEqual([
      "kaspersky-plus-3p-1y", "idm-1p-1y", "idm-1p-lifetime",
    ]);
    expect(json.licences[1]).toMatchObject({
      product: "Internet Download Manager | 1 an | 1 PC",
      status: "DELIVERED",
      codes: ["•••••-•••••-•••••-•7890"],
    });
    expect(json.licences[2]).toMatchObject({ product: "Internet Download Manager | À vie | 1 PC", status: "DELIVERED" });
    expect(requestLicence.mock.calls[2][0]).toMatchObject({
      idempotencyKey: "api:ps-1-4521-9881",
      request: { sku: "idm-1p-lifetime", quantity: 1 },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].attachments).toHaveLength(4);
    expect(markDelivered).toHaveBeenCalled();
  });

  it("replays a fulfilled order without a second invoice or e-mail", async () => {
    const { deps, sendEmail } = makeDeps();
    expect((await handleDigitalOrderRequest(signed(body()), deps)).status).toBe(201);
    const replay = await handleDigitalOrderRequest(signed(body()), deps);
    expect(replay.status).toBe(200);
    expect((await replay.json()).status).toBe("existing");
    expect(replay.headers.get("x-idempotent-replay")).toBe("true");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(processInvoice).toHaveBeenCalledTimes(1);
  });

  it("never allocates or renders codes when a completed order is retried with other lines or unpaid", async () => {
    const { deps, requestLicence, sendEmail } = makeDeps();
    const renderLicencePdf = deps.renderLicencePdf as ReturnType<typeof vi.fn>;
    expect((await handleDigitalOrderRequest(signed(body()), deps)).status).toBe(201);
    expect(requestLicence).toHaveBeenCalledTimes(2);
    expect(renderLicencePdf).toHaveBeenCalledTimes(2);
    const base = buildPayload();
    const tampered = body({
      invoice: { ...base, order: { ...base.order, isPaid: false, paidAt: null } },
      licences: [
        { lineId: 1111, sku: "kaspersky-plus-3p-1y", quantity: 1 },
        { lineId: 2222, sku: "kaspersky-standard-1p-1y", quantity: 2 },
      ],
    });
    const replay = await handleDigitalOrderRequest(signed(tampered, { key: "ps-1-4521-other" }), deps);
    expect(replay.status).toBe(200);
    const json = await replay.json();
    expect(json.status).toBe("existing");
    expect(json.licences.map((licence: { lineId: string }) => licence.lineId)).toEqual(["9876", "9877"]);
    expect(requestLicence).toHaveBeenCalledTimes(2);
    expect(renderLicencePdf).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("fails without invoice or e-mail when stock is insufficient, then succeeds on retry", async () => {
    const { deps, requestLicence, sendEmail, store } = makeDeps();
    requestLicence.mockImplementationOnce(async () => {
      throw new InsufficientLicenceStockError("kaspersky-plus-3p-1y", 1, 0);
    });
    const failed = await handleDigitalOrderRequest(signed(body()), deps);
    expect(failed.status).toBe(409);
    expect((await failed.json()).error).toMatchObject({ code: "INSUFFICIENT_STOCK", retryable: false, details: { lineId: "9876" } });
    expect(processInvoice).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(store.record?.status).toBe("FAILED");

    const retried = await handleDigitalOrderRequest(signed(body()), deps);
    expect(retried.status).toBe(201);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("retries an SMTP failure without recreating anything, and never resends a sent e-mail", async () => {
    const { deps, sendEmail, requestLicence } = makeDeps();
    sendEmail.mockRejectedValueOnce(new OrderEmailError("EMAIL_SEND_FAILED", "SMTP down", true));
    const failed = await handleDigitalOrderRequest(signed(body()), deps);
    expect(failed.status).toBe(502);
    expect((await failed.json()).error).toMatchObject({ code: "EMAIL_SEND_FAILED", retryable: true });

    const retried = await handleDigitalOrderRequest(signed(body()), deps);
    expect(retried.status).toBe(201);
    expect(processInvoice).toHaveBeenCalledTimes(1); // invoice id kept from the first attempt
    expect(requestLicence.mock.results.slice(2).every((result) => result.type === "return")).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("reports a missing \"Commande\" template as non-retryable", async () => {
    const { deps, sendEmail } = makeDeps();
    sendEmail.mockRejectedValueOnce(new OrderEmailError("EMAIL_TEMPLATE_MISSING", "absent", false));
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatchObject({ code: "EMAIL_TEMPLATE_MISSING", retryable: false });
  });

  it("reuses an invoice generated earlier with the button", async () => {
    processInvoice.mockResolvedValueOnce({ kind: "error", status: 409, code: "ORDER_ALREADY_INVOICED", message: "x" });
    const { deps, sendEmail } = makeDeps();
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(201);
    expect((await response.json()).invoice.id).toBe("inv-existing");
    expect(sendEmail.mock.calls[0][0].invoiceId).toBe("inv-existing");
  });

  it("propagates invoice validation errors and keeps nothing half-sent", async () => {
    processInvoice.mockResolvedValueOnce({ kind: "error", status: 422, code: "TOTALS_MISMATCH", message: "totaux" });
    const { deps, sendEmail } = makeDeps();
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatchObject({ code: "TOTALS_MISMATCH", retryable: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects bad signatures, other paths' signatures and invalid payloads", async () => {
    const { deps } = makeDeps();
    expect((await handleDigitalOrderRequest(signed(body(), { scheme: "PSINV1" }), deps)).status).toBe(401);
    expect((await handleDigitalOrderRequest(signed(body(), { path: "/api/integrations/digital-products/licences" }), deps)).status).toBe(401);
    for (const invalid of [
      body({ licences: [] }),
      body({ licences: [{ lineId: 1, sku: "kaspersky-plus-2p-1y", quantity: 1 }] }),
      body({ licences: [{ lineId: 1, sku: "kaspersky-plus-1p-1y", quantity: 1 }, { lineId: "1", sku: "kaspersky-plus-1p-1y", quantity: 1 }] }),
      body({ extra: true }),
      body({ invoice: { ...buildPayload(), shop: { id: 0, name: "x" } } }),
    ]) {
      expect((await handleDigitalOrderRequest(signed(invalid), deps)).status).toBe(422);
    }
  });

  it("requires the invoice and licence tenants to be the same account", () => {
    expect(loadFulfilmentInvoiceConfig("tenant-1", { PRESTASHOP_INVOICE_TENANT_ID: "other" }).ok).toBe(false);
    expect(loadFulfilmentInvoiceConfig("tenant-1", {}).ok).toBe(true);
  });

  it("derives line requests exactly like the module's per-line licence request", () => {
    const order = buildPayload() as Parameters<typeof customerNameOf>[0];
    expect(customerNameOf(order)).toBe("Amine Ben Salah");
    expect(licenceLineKey(order, { lineId: "9876" })).toBe("api:ps-1-4521-9876");
    // Same business hash as POST /licences with the module's per-line body.
    const fromFulfilment = parseLicenceRequest({
      sku: "kaspersky-plus-3p-1y", quantity: 1, customerName: customerNameOf(order),
      customerEmail: order.customer.email, orderReference: order.order.reference,
    });
    const fromLineBody = parseLicenceRequest({
      sku: "kaspersky-plus-3p-1y", quantity: 1, customerName: "Amine Ben Salah",
      customerEmail: "Client.Test@example.com", orderReference: "XKBKNABJK",
    });
    const external = { source: "prestashop", orderId: "4521", lineId: "9876" };
    expect(hashLicenceRequest(fromFulfilment, external)).toBe(hashLicenceRequest(fromLineBody, external));
  });
});

describe("digital-order fulfilment security controls", () => {
  beforeEach(() => {
    processInvoice.mockReset();
    processInvoice.mockResolvedValue({
      kind: "ok", invoiceId: "inv-42", outcome: "created", payment: { recorded: true },
      expectedOrderTotalMinor: 245_000, shopTimbreMinor: null,
    });
  });

  function withOrder(order: Record<string, unknown>, totals: Record<string, unknown> = {}) {
    const base = buildPayload();
    return body({ invoice: { ...base, order: { ...base.order, ...order }, totals: { ...base.totals, ...totals } } });
  }

  it("refuses to deliver licences for an unpaid order, then delivers once it is paid", async () => {
    const { deps, requestLicence, sendEmail, store } = makeDeps();
    const unpaid = await handleDigitalOrderRequest(signed(withOrder({ isPaid: false, paidAt: null })), deps);
    expect(unpaid.status).toBe(409);
    expect((await unpaid.json()).error).toMatchObject({ code: "ORDER_NOT_PAID", retryable: false });
    expect(requestLicence).not.toHaveBeenCalled();
    expect(processInvoice).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(store.record?.status).toBe("FAILED");

    const paid = await handleDigitalOrderRequest(signed(body()), deps);
    expect(paid.status).toBe(201);
  });

  it("refuses a partially paid order", async () => {
    const { deps, requestLicence } = makeDeps();
    const response = await handleDigitalOrderRequest(signed(withOrder({}, { totalPaid: "100.000000" })), deps);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("ORDER_NOT_PAID");
    expect(requestLicence).not.toHaveBeenCalled();
  });

  it("refuses a 'paid' order with no captured payment amount", async () => {
    const { deps, requestLicence, sendEmail } = makeDeps();
    const response = await handleDigitalOrderRequest(signed(withOrder({}, { totalPaid: null })), deps);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("ORDER_NOT_PAID");
    expect(requestLicence).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("accepts a free order (total 0) without a payment amount", () => {
    const base = buildPayload();
    const free = { ...base, totals: { ...base.totals, totalTaxIncl: "0.000000", totalPaid: null } };
    expect(unpaidOrderReason(free as never, "0.010")).toBeNull();
    expect(unpaidOrderReason({ ...base, totals: { ...base.totals, totalPaid: null } } as never, "0.010"))
      .toBe("payment_amount_missing");
  });

  it("serves concurrent duplicate requests with exactly one delivery", async () => {
    const { deps, requestLicence, sendEmail } = makeDeps();
    const responses = await Promise.all([
      handleDigitalOrderRequest(signed(body()), deps),
      handleDigitalOrderRequest(signed(body()), deps),
      handleDigitalOrderRequest(signed(body()), deps),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409, 409]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(requestLicence).toHaveBeenCalledTimes(2); // two lines, once each
  });

  it("allows an explicit opt-out of the payment gate", async () => {
    const { deps } = makeDeps();
    const response = await handleDigitalOrderRequest(
      signed(withOrder({ isPaid: false, paidAt: null })),
      { ...deps, requirePaidOrder: () => false },
    );
    expect(response.status).toBe(201);
    expect(requirePaidOrderFromEnv({})).toBe(true);
    expect(requirePaidOrderFromEnv({ DIGITAL_ORDER_REQUIRE_PAYMENT: "false" })).toBe(false);
    expect(requirePaidOrderFromEnv({ DIGITAL_ORDER_REQUIRE_PAYMENT: "garbage" })).toBe(true);
  });

  it("never delivers more codes than the order contains", async () => {
    const { deps, requestLicence } = makeDeps();
    // Fixture order lines total 3 units.
    const response = await handleDigitalOrderRequest(
      signed(body({ licences: [{ lineId: 1, sku: "kaspersky-plus-3p-1y", quantity: 4 }] })),
      deps,
    );
    expect(response.status).toBe(422);
    expect(requestLicence).not.toHaveBeenCalled();
  });

  it("does not resend the e-mail when recording it hits a transient DB error", async () => {
    const { deps, store, sendEmail } = makeDeps();
    const original = store.markEmailSent.bind(store);
    let failures = 1;
    store.markEmailSent = async (...args) => {
      if (failures-- > 0) throw new Error("connection reset");
      return original(...args);
    };
    expect((await handleDigitalOrderRequest(signed(body()), deps)).status).toBe(201);
    expect((await handleDigitalOrderRequest(signed(body()), deps)).status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("digital-order manual review (mode: review, sent from invoice-app)", () => {
  beforeEach(() => {
    processInvoice.mockReset();
    processInvoice.mockResolvedValue({
      kind: "ok", invoiceId: "inv-42", outcome: "created", payment: { recorded: true },
      expectedOrderTotalMinor: 245_000, shopTimbreMinor: null,
    });
  });

  it("prepares licences and invoice, keeps the request, sends and renders nothing", async () => {
    const { deps, store, sendEmail, markDelivered, logs } = makeDeps();
    const renderLicencePdf = deps.renderLicencePdf as ReturnType<typeof vi.fn>;
    const response = await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("review");
    expect(json.reviewPath).toBe("/api/produits-digitaux/commandes/dlful-1/ouvrir");
    expect(json.invoice).toMatchObject({ id: "inv-42", number: "FAC-2026-00042" });
    expect(json.licences.map((line: { lineId: string }) => line.lineId)).toEqual(["9876", "9877"]);
    expect(json).not.toHaveProperty("pdf");
    expect(JSON.stringify(json)).not.toContain("base64");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(markDelivered).not.toHaveBeenCalled();
    expect(renderLicencePdf).not.toHaveBeenCalled();
    expect(store.record).toMatchObject({ status: "FAILED", lastErrorCode: "AWAITING_APPROVAL", invoiceId: "inv-42", emailSentAt: null });
    expect(store.review?.keyId).toBe(KEY_ID);
    expect((store.review?.payload as { mode?: string }).mode).toBeUndefined();
    expect(logs.join("\n")).not.toContain("example.com");
  });

  it("\"Envoyer\" in invoice-app sends the same licences and invoice once, then the shop learns it", async () => {
    const { deps, store, requestLicence, sendEmail, markDelivered } = makeDeps();
    const reviewed = await (await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps)).json();

    // Before sending: status says "awaiting", nothing changes.
    const waiting = await handleDigitalOrderRequest(signed(body({ mode: "status" })), deps);
    expect(waiting.status).toBe(409);
    expect((await waiting.json()).error).toMatchObject({ code: "AWAITING_APPROVAL", details: { reviewPath: reviewed.reviewPath } });
    expect(store.record?.status).toBe("FAILED");

    expect(await sendReviewedDigitalOrder({ tenantId: "other-tenant", fulfilmentId: "dlful-1", userId: "u1" }, deps))
      .toMatchObject({ ok: false, code: "NOT_FOUND" });
    const sent = await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "user-7" }, deps);
    expect(sent).toMatchObject({ ok: true, invoiceId: "inv-42", invoiceNumber: "FAC-2026-00042", alreadySent: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].attachments.map((file) => file.filename)).toEqual([
      "FAC-2026-00042.pdf", "licence-dlord-1abcdef.pdf", "licence-dlord-2abcdef.pdf",
    ]);
    expect(markDelivered).toHaveBeenCalledWith(expect.objectContaining({ actor: "user:user-7" }));
    expect(processInvoice).toHaveBeenCalledTimes(1);
    expect(requestLicence.mock.results.slice(2).every((result) => result.type === "return")).toBe(true);
    expect(store.record?.status).toBe("COMPLETED");
    expect(store.sentBy).toBe("user-7");

    // Second click: nothing resent.
    expect(await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "user-7" }, deps))
      .toMatchObject({ ok: true, alreadySent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // The shop's status poll now replays the delivered order (no e-mail).
    const status = await handleDigitalOrderRequest(signed(body({ mode: "status" })), deps);
    expect(status.status).toBe(200);
    const json = await status.json();
    expect(json.status).toBe("existing");
    expect(json.licences.map((line: { number: string }) => line.number)).toEqual(
      reviewed.licences.map((line: { number: string }) => line.number),
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps the order sendable from invoice-app after a failed send (SMTP)", async () => {
    const { deps, sendEmail, store } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    sendEmail.mockRejectedValueOnce(new OrderEmailError("EMAIL_SEND_FAILED", "SMTP down", true));
    expect(await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u" }, deps))
      .toMatchObject({ ok: false, code: "EMAIL_SEND_FAILED" });
    expect(store.record).toMatchObject({ status: "FAILED", lastErrorCode: "EMAIL_SEND_FAILED" });
    const status = await handleDigitalOrderRequest(signed(body({ mode: "status" })), deps);
    expect((await status.json()).error.code).toBe("AWAITING_APPROVAL");
    expect(await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u" }, deps))
      .toMatchObject({ ok: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("status is read-only: unknown order 404, never claims or allocates", async () => {
    const { deps, store, requestLicence } = makeDeps();
    const response = await handleDigitalOrderRequest(signed(body({ mode: "status" })), deps);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("FULFILMENT_NOT_FOUND");
    expect(store.record).toBeNull();
    expect(requestLicence).not.toHaveBeenCalled();
  });

  it("refuses to send an order that was never reviewed (automatic failure)", async () => {
    const { deps, requestLicence } = makeDeps();
    requestLicence.mockImplementationOnce(async () => {
      throw new InsufficientLicenceStockError("kaspersky-plus-3p-1y", 1, 0);
    });
    await handleDigitalOrderRequest(signed(body()), deps);
    expect(await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u" }, deps))
      .toMatchObject({ ok: false, code: "NOT_AWAITING_REVIEW" });
  });

  it("applies the payment gate to reviews (no licence reserved)", async () => {
    const { deps, requestLicence } = makeDeps();
    const base = buildPayload();
    const unpaid = body({ mode: "review", invoice: { ...base, order: { ...base.order, isPaid: false, paidAt: null } } });
    const response = await handleDigitalOrderRequest(signed(unpaid), deps);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("ORDER_NOT_PAID");
    expect(requestLicence).not.toHaveBeenCalled();
  });

  it("refuses to send a reviewed order the shop has since reported unpaid", async () => {
    const { deps, sendEmail } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    const base = buildPayload();
    const unpaid = body({ mode: "review", invoice: { ...base, order: { ...base.order, isPaid: false, paidAt: null } } });
    expect((await handleDigitalOrderRequest(signed(unpaid), deps)).status).toBe(409);
    expect(await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u" }, deps))
      .toMatchObject({ ok: false, code: "NOT_AWAITING_REVIEW" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the edited subject, content and attachments", async () => {
    const { deps, sendEmail, markDelivered } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    const extra = { filename: "FAC-2026-00042.pdf", content: Buffer.from("x"), contentType: "application/pdf" };
    const sent = await sendReviewedDigitalOrder({
      tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u",
      email: { subject: "Vos licences", html: "<p>Bonjour</p>", includeInvoice: true, licenceOrderIds: ["dlord-2abcdef"], extraAttachments: [extra] },
    }, deps);
    expect(sent).toMatchObject({ ok: true });
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.override).toEqual({ subject: "Vos licences", html: "<p>Bonjour</p>" });
    expect(mail.to).toBe("Client.Test@example.com");
    expect(mail.attachments.map((file) => file.filename)).toEqual(["FAC-2026-00042.pdf", "licence-dlord-2abcdef.pdf", "FAC-2026-00042-2.pdf"]);
    expect(markDelivered).toHaveBeenCalledTimes(1);
  });

  it("reuses the same codes when the shop asks again with a corrected e-mail", async () => {
    const { deps, store, requestLicence } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    const reused = licenceOrder("dlord-1abcdef", { externalLineId: "9876" });
    requestLicence.mockImplementationOnce(async () => ({ kind: "idempotency_key_reused", order: reused }));
    const base = buildPayload();
    const corrected = body({ mode: "review", invoice: { ...base, customer: { ...base.customer, email: "new@example.com" } } });
    expect((await handleDigitalOrderRequest(signed(corrected), deps)).status).toBe(200);
    expect(deps.adoptLicence).toHaveBeenCalledTimes(1);
    expect((store.review?.payload as { invoice: { customer: { email: string } } }).invoice.customer.email).toBe("new@example.com");
  });

  it("never adopts another product, an automatic delivery or a delivered licence", async () => {
    for (const [mode, overrides, adopted] of [
      ["review", { quantity: 3 }, true], ["review", { productSku: "kaspersky-premium-5p-1y" }, true],
      ["review", { externalOrderId: "999" }, true], ["review", {}, false], [undefined, {}, true],
    ] as const) {
      const { deps, requestLicence } = makeDeps();
      deps.adoptLicence = vi.fn(async () => adopted);
      requestLicence.mockImplementationOnce(async () => ({
        kind: "idempotency_key_reused", order: licenceOrder("dlord-1abcdef", { externalLineId: "9876", ...overrides }),
      }));
      const response = await handleDigitalOrderRequest(signed(body(mode ? { mode } : {})), deps);
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("LICENCE_REQUEST_CONFLICT");
    }
  });

  it("a failed new review invalidates the stored one (never sends an outdated request)", async () => {
    const { deps, requestLicence, sendEmail, store } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    requestLicence.mockImplementationOnce(async () => ({ kind: "idempotency_key_reused", order: licenceOrder("dlord-x", { quantity: 9 }) }));
    expect((await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps)).status).toBe(409);
    expect(store.review).toBeNull();
    expect(await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u" }, deps)).toMatchObject({ ok: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("tells the shop once sent, never before, and records the answer", async () => {
    const { deps, store } = makeDeps();
    const callbackUrl = "https://shop.example.com/index.php?fc=module&module=tsinvoiceapp&controller=fulfilmentnotify";
    await handleDigitalOrderRequest(signed(body({ mode: "review", callbackUrl })), deps);
    expect(await notifyShopForReview({ tenantId: TENANT, fulfilmentId: "dlful-1" }, deps)).toEqual({ ok: false, code: "NOT_SENT" });
    expect(deps.notifyShop).not.toHaveBeenCalled();
    await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u" }, deps);
    expect(await notifyShopForReview({ tenantId: "other", fulfilmentId: "dlful-1" }, deps)).toMatchObject({ ok: false });
    expect(await notifyShopForReview({ tenantId: TENANT, fulfilmentId: "dlful-1" }, deps)).toEqual({ ok: true, state: "delivered" });
    expect(deps.notifyShop).toHaveBeenCalledWith(expect.objectContaining({ url: callbackUrl, keyId: KEY_ID, orderId: 4521, orderReference: "XKBKNABJK" }));
    expect(store.notified).toBe("delivered");
    deps.notifyShop = vi.fn(async () => { throw new Error("boom"); });
    expect(await notifyShopForReview({ tenantId: TENANT, fulfilmentId: "dlful-1" }, deps)).toEqual({ ok: false, code: "SHOP_UNREACHABLE" });
  });

  it("works with a module that sends no callback URL, and rejects an unknown mode", async () => {
    const { deps } = makeDeps();
    expect((await handleDigitalOrderRequest(signed(body({ mode: "preview" })), deps)).status).toBe(422);
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    await sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u" }, deps);
    expect(await notifyShopForReview({ tenantId: TENANT, fulfilmentId: "dlful-1" }, deps)).toEqual({ ok: false, code: "CALLBACK_NOT_PROVIDED" });
  });
});

describe("security audit 3: payment, approval and fraud controls", () => {
  const callbackUrl = "https://shop.example.com/index.php?fc=module&module=tsinvoiceapp&controller=fulfilmentnotify";
  const send = (deps: Partial<DigitalOrderDeps>, extra: Record<string, unknown> = {}) =>
    sendReviewedDigitalOrder({ tenantId: TENANT, fulfilmentId: "dlful-1", userId: "u", ...extra }, deps);
  const withInvoice = (patch: (base: ReturnType<typeof buildPayload>) => Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const base = buildPayload();
    return body({ invoice: { ...base, ...patch(base) }, ...extra });
  };
  beforeEach(() => {
    processInvoice.mockReset();
    processInvoice.mockResolvedValue({
      kind: "ok", invoiceId: "inv-42", outcome: "created", payment: { recorded: true },
      expectedOrderTotalMinor: 245_000, shopTimbreMinor: null,
    });
  });

  it("asks the shop before releasing codes; a refunded or cancelled order is never sent", async () => {
    const { deps, store, sendEmail } = makeDeps();
    const renderLicencePdf = deps.renderLicencePdf as ReturnType<typeof vi.fn>;
    await handleDigitalOrderRequest(signed(body({ mode: "review", callbackUrl, paymentCheck: true })), deps);
    deps.checkShop = vi.fn(async () => ({ ok: true as const, payable: false as const, reason: "ORDER_NOT_PAID" }));
    expect(await send(deps)).toMatchObject({ ok: false, code: "ORDER_NOT_PAID" });
    expect(deps.checkShop).toHaveBeenCalledWith(expect.objectContaining({ url: callbackUrl, keyId: KEY_ID, orderId: 4521 }));
    expect(sendEmail).not.toHaveBeenCalled();
    expect(renderLicencePdf).not.toHaveBeenCalled();
    expect(store.review).toBeNull();
    // Not sendable again without a new "Traiter la commande".
    deps.checkShop = vi.fn(async () => ({ ok: true as const, payable: true as const }));
    expect(await send(deps)).toMatchObject({ ok: false, code: "NOT_AWAITING_REVIEW" });
    await handleDigitalOrderRequest(signed(body({ mode: "review", callbackUrl, paymentCheck: true })), deps);
    expect(await send(deps)).toMatchObject({ ok: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("an order edited in the shop must be prepared again", async () => {
    const { deps, sendEmail } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review", callbackUrl, paymentCheck: true })), deps);
    deps.checkShop = vi.fn(async () => ({ ok: true as const, payable: false as const, reason: "ORDER_CHANGED" }));
    expect(await send(deps)).toMatchObject({ ok: false, code: "ORDER_CHANGED" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("without an answer from the shop, the first payment proof expires", async () => {
    for (const [extra, check] of [
      [{}, null], // module < 1.7.3
      [{ callbackUrl, paymentCheck: true }, async () => ({ ok: false as const, code: "SHOP_BLOCKED" })],
      [{ callbackUrl, paymentCheck: true }, async () => { throw new Error("boom"); }],
    ] as const) {
      const { deps, store, sendEmail } = makeDeps();
      if (check) deps.checkShop = vi.fn(check);
      await handleDigitalOrderRequest(signed(body({ mode: "review", ...extra })), deps);
      store.reviewRequestedAt = new Date(Date.now() - 121 * 60_000);
      expect(await send(deps)).toMatchObject({ ok: false, code: "PAYMENT_CHECK_REQUIRED" });
      expect(sendEmail).not.toHaveBeenCalled();
      expect(store.review).not.toBeNull(); // still there: "Traiter la commande" again is enough
      store.reviewRequestedAt = new Date(Date.now() - 10 * 60_000);
      expect(await send(deps)).toMatchObject({ ok: true });
    }
  });

  it("sends only what the administrator saw (recipient changed meanwhile)", async () => {
    const { deps, sendEmail } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    const seen = reviewVersionOf((await deps.store!.findReview(TENANT, "dlful-1"))!);
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps); // unchanged: the page stays valid
    expect(reviewVersionOf((await deps.store!.findReview(TENANT, "dlful-1"))!)).toBe(seen);
    const changed = withInvoice((base) => ({ customer: { ...base.customer, email: "attacker@example.com" } }), { mode: "review" });
    await handleDigitalOrderRequest(signed(changed), deps);
    expect(await send(deps, { expectedVersion: seen })).toMatchObject({ ok: false, code: "REVIEW_CHANGED" });
    expect(sendEmail).not.toHaveBeenCalled();
    const now = reviewVersionOf((await deps.store!.findReview(TENANT, "dlful-1"))!);
    expect(await send(deps, { expectedVersion: now })).toMatchObject({ ok: true });
  });

  it("a shop request arriving between the check and the send wins", async () => {
    const { deps, store, sendEmail } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review", callbackUrl, paymentCheck: true })), deps);
    deps.checkShop = vi.fn(async () => {
      store.record!.attempts += 1; // what any claim by the shop does
      return { ok: true as const, payable: true as const };
    });
    expect(await send(deps)).toMatchObject({ ok: false, code: "REVIEW_CHANGED" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("an automatic request cannot bypass a pending review, and reporting it unpaid withdraws it", async () => {
    const { deps, store, sendEmail } = makeDeps();
    await handleDigitalOrderRequest(signed(body({ mode: "review" })), deps);
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatchObject({ code: "AWAITING_APPROVAL", retryable: false });
    expect(store.review).not.toBeNull();
    const unpaid = withInvoice((base) => ({ order: { ...base.order, isPaid: false, paidAt: null } }));
    expect((await handleDigitalOrderRequest(signed(unpaid), deps)).status).toBe(409);
    expect(store.review).toBeNull();
    expect(await send(deps)).toMatchObject({ ok: false, code: "NOT_AWAITING_REVIEW" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never re-delivers a line's codes to someone else through another shop id or key", async () => {
    for (const overrides of [
      { status: "DELIVERED" as const, customerEmail: "Client.Test@example.com" },
      { status: "GENERATED" as const, customerEmail: "victim@example.com" },
      { status: "PENDING" as const, customerEmail: null },
    ]) {
      const { deps, requestLicence, sendEmail } = makeDeps();
      requestLicence.mockImplementationOnce(async () => ({
        kind: "external_line_conflict", order: licenceOrder("dlord-1abcdef", { externalLineId: "9876", ...overrides }),
      }));
      const response = await handleDigitalOrderRequest(signed(body()), deps);
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("LICENCE_REQUEST_CONFLICT");
      expect(sendEmail).not.toHaveBeenCalled();
    }
    const { deps, requestLicence } = makeDeps();
    const same = licenceOrder("dlord-9abcdef", { status: "GENERATED", customerEmail: "client.test@example.com", externalLineId: "9876" });
    requestLicence.mockImplementationOnce(async () => ({ kind: "external_line_conflict", order: same }));
    deps.renderLicencePdf = vi.fn(async () => ({ order: same, pdf: LICENCE_PDF, filename: "l.pdf" }));
    expect((await handleDigitalOrderRequest(signed(body()), deps)).status).toBe(201);
  });

  it("an order that cannot be invoiced reserves no code", async () => {
    const { deps, requestLicence } = makeDeps();
    deps.validateInvoice = vi.fn(async () => ({ kind: "error" as const, status: 422, code: "TOTALS_MISMATCH" as const, message: "x" }));
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatchObject({ code: "TOTALS_MISMATCH", retryable: false });
    expect(requestLicence).not.toHaveBeenCalled();
  });

  it("holds free and oversized orders for a person; a review still works", async () => {
    const zero = "0.000000";
    const free = withInvoice((base) => ({ totals: { ...base.totals, totalTaxIncl: zero, totalTaxExcl: zero, totalPaid: null } }));
    const { deps, requestLicence, sendEmail } = makeDeps();
    const response = await handleDigitalOrderRequest(signed(free), deps);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatchObject({ code: "MANUAL_REVIEW_REQUIRED", retryable: false });
    expect(requestLicence).not.toHaveBeenCalled();
    expect((await handleDigitalOrderRequest(signed({ ...free, mode: "review" }), deps)).status).toBe(200);
    expect(await send(deps)).toMatchObject({ ok: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const allowed = makeDeps();
    allowed.deps.policy = () => loadDeliveryPolicy({ DIGITAL_ORDER_ALLOW_FREE: "true" });
    expect((await handleDigitalOrderRequest(signed(free), allowed.deps)).status).toBe(201);

    const big = makeDeps();
    big.deps.policy = () => loadDeliveryPolicy({ DIGITAL_ORDER_MAX_AUTO_CODES: "2" });
    expect((await (await handleDigitalOrderRequest(signed(body()), big.deps)).json()).error.code).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("stops a burst of deliveries (stolen key) and lets the shop retry later", async () => {
    const { deps, requestLicence, logs } = makeDeps();
    deps.countReleasedCodes = vi.fn(async () => 198);
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect((await response.json()).error).toMatchObject({ code: "DELIVERY_LIMIT_REACHED", retryable: true });
    expect(requestLicence).not.toHaveBeenCalled();
    expect(logs.join()).toContain("delivery_held");
    deps.countReleasedCodes = vi.fn(async () => 10);
    expect((await handleDigitalOrderRequest(signed(body()), deps)).status).toBe(201);
  });

  it("fails closed when the delivery limits cannot be read", async () => {
    const { deps, requestLicence } = makeDeps();
    deps.countReleasedCodes = vi.fn(async () => { throw new Error("db down"); });
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("db down");
    expect(requestLicence).not.toHaveBeenCalled();
  });

  it("refuses a shop that is not pinned", async () => {
    const { deps, store } = makeDeps();
    deps.loadInvoiceConfig = (tenant) => loadFulfilmentInvoiceConfig(tenant, { NODE_ENV: "production", PRESTASHOP_ALLOWED_SHOP_IDS: "7" });
    const response = await handleDigitalOrderRequest(signed(body()), deps);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("SHOP_NOT_ALLOWED");
    expect(store.record).toBeNull();
  });

  it("logs the source address of refused requests, and nothing about the customer", async () => {
    const { deps, logs } = makeDeps();
    const request = signed(body());
    request.headers.set("x-signature", `v1=${"0".repeat(64)}`);
    expect((await handleDigitalOrderRequest(request, deps)).status).toBe(401);
    expect(logs.join()).toContain("203.0.113.20");
    expect(logs.join()).not.toContain("example.com");
  });
});
