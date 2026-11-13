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
  unpaidOrderReason,
  type DigitalOrderDeps,
} from "@/server/digital-products/fulfilment";
import type { FulfilmentClaim, FulfilmentRecord, FulfilmentStore } from "@/server/digital-products/fulfilment-store";
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
  async claim(): Promise<FulfilmentClaim> {
    if (!this.record) {
      this.record = {
        id: "dlful-1", status: "PROCESSING", idempotencyKey: "ps-1-4521", requestHash: "h", invoiceId: null,
        licenceOrderIds: [], emailTo: null, emailSubject: null, emailSentAt: null, lastErrorCode: null, attempts: 1, completedAt: null,
      };
      return { kind: "claimed", record: { ...this.record } };
    }
    if (this.record.status === "COMPLETED") return { kind: "completed", record: { ...this.record } };
    if (this.record.status === "PROCESSING") return { kind: "in_progress" };
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
      "facture-FAC-2026-00042.pdf", "licence-dlord-1abcdef.pdf", "licence-dlord-2abcdef.pdf",
    ]);
    expect(markDelivered).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: "inv-42" }));
    expect(store.record).toMatchObject({ status: "COMPLETED", invoiceId: "inv-42" });
    expect(logs.join("\n")).not.toContain("example.com");
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
