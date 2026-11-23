import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MAX_LICENCE_QUANTITY } from "@/lib/digital-products/kaspersky-catalog";
import {
  codeFormatForSku,
  DIGITAL_PRODUCT_SKUS,
  getDigitalProductVariant,
} from "@/lib/digital-products/catalog";
import { maskLicenceCode } from "@/lib/digital-products/licence-code-format";
import { loadLicenceApiConfig } from "@/server/digital-products/api-config";
import {
  authenticateLicenceApiRequest,
  baseHeaders,
  errorResponse as licenceErrorResponse,
  type LicenceApiDeps,
  type LogFields,
} from "@/server/digital-products/api";
import {
  markLicenceOrdersDelivered,
  postgresFulfilmentStore,
  type FulfilmentRecord,
  type FulfilmentStore,
} from "@/server/digital-products/fulfilment-store";
import {
  LicenceOrderStateError,
  parseLicenceRequest,
  renderLicenceOrderPdf,
  requestLicenceDocument,
} from "@/server/digital-products/licences";
import { LicenceEncryptionConfigError } from "@/server/digital-products/licence-crypto";
import {
  OrderEmailError,
  orderEmailSubject,
  previewDigitalOrderEmail,
  sendDigitalOrderEmail,
} from "@/server/digital-products/order-email";
import {
  getLicenceOrder,
  getOrderCodeHints,
  InsufficientLicenceStockError,
  type LicenceOrderRecord,
} from "@/server/digital-products/store";
import {
  loadPrestashopIntegrationConfig,
  type PrestashopIntegrationConfig,
} from "@/server/integrations/prestashop/config";
import {
  formatMinor,
  formatZodIssues,
  prestashopOrderPayloadSchema,
  thousandths,
  type PrestashopOrderPayload,
} from "@/server/integrations/prestashop/payload";
import {
  defaultPrestashopInvoiceDeps,
  processPrestashopInvoice,
  safeErrorName,
  type InvoiceSummary,
  type PrestashopInvoiceDeps,
} from "@/server/integrations/prestashop/service";
import { sha256Hex } from "@/server/integrations/prestashop/signature";
import { postgresPrestashopInvoiceStore } from "@/server/integrations/prestashop/store";

/**
 * POST /api/integrations/prestashop/digital-orders
 *
 * One signed request per PrestaShop order containing instant-delivery products:
 *   1. allocate one licence per order line (same keys as the licence API);
 *   2. create the invoice (same pipeline and idempotency as the invoice API);
 *   3. render the invoice and licence PDFs;
 *   4. e-mail the customer once ("Commande {référence}", saved response "Commande");
 *   5. answer 201/200 only when everything succeeded -> the shop sets "Livré".
 * Retries are safe: nothing is created twice and the e-mail is never resent.
 *
 * `mode: "preview"` (manual "Traiter la commande" button, for products whose
 * automatic delivery is off) runs steps 1-3 and answers with the e-mail and
 * every PDF instead of sending: the employee checks them, then the same order
 * is sent again without `mode` and steps 1-3 are reused (same licences, same
 * invoice) before the e-mail goes out.
 */

const MAX_BODY_BYTES = 1024 * 1024;

type Fail = {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
  headers?: Record<string, string>;
};

export type DigitalOrderDeps = {
  auth: Pick<LicenceApiDeps, "loadConfig" | "nonces" | "random">;
  loadInvoiceConfig: (tenantUserId: string) => ReturnType<typeof loadPrestashopIntegrationConfig>;
  invoice: PrestashopInvoiceDeps;
  store: FulfilmentStore;
  requestLicence: typeof requestLicenceDocument;
  renderLicencePdf: typeof renderLicenceOrderPdf;
  getCodeHints: (tenantId: string, orderId: string) => Promise<{ codeHint: string }[]>;
  getLicenceOrder: (tenantId: string, orderId: string) => Promise<LicenceOrderRecord | null>;
  findInvoiceForOrder: (tenantUserId: string, shopId: string, orderId: string) => Promise<string | null>;
  sendEmail: typeof sendDigitalOrderEmail;
  previewEmail: typeof previewDigitalOrderEmail;
  markDelivered: typeof markLicenceOrdersDelivered;
  requirePaidOrder: () => boolean;
  log: (level: "info" | "warn" | "error", event: string, fields: LogFields) => void;
};

export function loadFulfilmentInvoiceConfig(tenantUserId: string, env: Record<string, string | undefined> = process.env) {
  const invoiceTenant = env.PRESTASHOP_INVOICE_TENANT_ID?.trim();
  if (invoiceTenant && invoiceTenant !== tenantUserId) {
    return {
      ok: false as const,
      reason: "PRESTASHOP_INVOICE_TENANT_ID and DIGITAL_LICENCE_TENANT_ID must be the same account",
    };
  }
  return loadPrestashopIntegrationConfig(
    { ...env, PRESTASHOP_INVOICE_TENANT_ID: tenantUserId },
    { requireKeys: false },
  );
}

const defaultDeps: DigitalOrderDeps = {
  auth: {
    loadConfig: () => loadLicenceApiConfig(),
    nonces: postgresPrestashopInvoiceStore,
    random: Math.random,
  },
  loadInvoiceConfig: (tenantUserId) => loadFulfilmentInvoiceConfig(tenantUserId),
  invoice: defaultPrestashopInvoiceDeps,
  store: postgresFulfilmentStore,
  requestLicence: requestLicenceDocument,
  renderLicencePdf: renderLicenceOrderPdf,
  getCodeHints: getOrderCodeHints,
  getLicenceOrder,
  findInvoiceForOrder: (tenant, shop, order) =>
    postgresPrestashopInvoiceStore.findInvoiceForOrder(tenant, shop, order),
  sendEmail: sendDigitalOrderEmail,
  previewEmail: previewDigitalOrderEmail,
  markDelivered: markLicenceOrdersDelivered,
  requirePaidOrder: () => requirePaidOrderFromEnv(),
  log: (level, event, fields) => console[level]("[digital-orders]", { event, ...fields }),
};

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

const lineId = z
  .union([z.int().positive(), z.string().regex(/^[1-9][0-9]{0,17}$/)])
  .transform((value) => String(value));

/** Fulfilment parked after a preview, waiting for the employee's "Envoyer". */
export const AWAITING_APPROVAL_CODE = "AWAITING_APPROVAL";

export const digitalOrderPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  /**
   * "deliver" (default): full fulfilment, customer e-mailed.
   * "preview": licences + invoice + PDFs only; the e-mail is rendered and
   * returned, never sent, and the order is not marked delivered.
   */
  mode: z.enum(["deliver", "preview"]).optional(),
  /** Same order payload as POST /api/integrations/prestashop/invoices. */
  invoice: prestashopOrderPayloadSchema,
  /** Instant-delivery lines of the order (PrestaShop id_order_detail). */
  licences: z
    .array(
      z.strictObject({
        lineId,
        sku: z.enum(DIGITAL_PRODUCT_SKUS),
        quantity: z.int().min(1).max(MAX_LICENCE_QUANTITY),
      }),
    )
    .min(1)
    .max(50)
    .refine((lines) => new Set(lines.map((line) => line.lineId)).size === lines.length, {
      message: "lineId en double",
    }),
}).superRefine((payload, ctx) => {
  // Never deliver more activation codes than the customer ordered: the codes
  // are irreversible value, so a buggy or compromised caller must not be able
  // to attach extra licences to a small order.
  const ordered = payload.invoice.lines.reduce((sum, line) => sum + line.quantity, 0);
  const requested = payload.licences.reduce((sum, line) => sum + line.quantity, 0);
  if (requested > ordered) {
    ctx.addIssue({
      code: "custom",
      path: ["licences"],
      message: "La quantité de licences dépasse la quantité commandée",
    });
  }
});

export type DigitalOrderPayload = z.infer<typeof digitalOrderPayloadSchema>;

/** Same normalization as the module's per-line licence request (hash-compatible). */
export function customerNameOf(payload: PrestashopOrderPayload) {
  return `${payload.customer.firstName} ${payload.customer.lastName}`.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function licenceLineKey(payload: PrestashopOrderPayload, line: { lineId: string }) {
  return `api:ps-${payload.shop.id}-${payload.order.id}-${line.lineId}`;
}

/**
 * Payment gate for instant delivery. Activation codes cannot be taken back,
 * so they are only released for an order PrestaShop reports as paid in full.
 * Opt-out (not recommended): DIGITAL_ORDER_REQUIRE_PAYMENT=false.
 */
export function requirePaidOrderFromEnv(env: Record<string, string | undefined> = process.env) {
  const raw = env.DIGITAL_ORDER_REQUIRE_PAYMENT?.trim().toLowerCase();
  return !(raw && ["0", "false", "no", "off"].includes(raw));
}

export function unpaidOrderReason(payload: PrestashopOrderPayload, totalTolerance: string): string | null {
  if (!payload.order.isPaid) return "order_not_paid";
  const { totalPaid, totalTaxIncl } = payload.totals;
  // PrestaShop records a payment (total_paid_real) whenever an order enters a
  // paid state; a paid flag on a non-free order with no captured amount is
  // inconsistent and must not release irreversible codes.
  if (totalPaid == null) {
    return thousandths(totalTaxIncl) > 0 ? "payment_amount_missing" : null;
  }
  if (thousandths(totalPaid) + thousandths(totalTolerance) < thousandths(totalTaxIncl)) {
    return "partial_payment";
  }
  return null;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleDigitalOrderRequest(
  request: Request,
  overrides: Partial<DigitalOrderDeps> = {},
): Promise<Response> {
  const deps: DigitalOrderDeps = { ...defaultDeps, ...overrides };
  const requestId = randomUUID();
  const startedAt = Date.now();
  const logContext: LogFields = { requestId };
  const log = (level: "info" | "warn" | "error", event: string, fields: LogFields = {}) =>
    deps.log(level, event, { ...logContext, ...fields, durationMs: Date.now() - startedAt });

  const respondError = (fail: Fail) =>
    Response.json(
      {
        error: {
          code: fail.code,
          message: fail.message,
          retryable: fail.retryable,
          requestId,
          ...(fail.details !== undefined ? { details: fail.details } : {}),
        },
      },
      { status: fail.status, headers: { ...baseHeaders(requestId), ...fail.headers } },
    );

  const auth = await authenticateLicenceApiRequest(request, deps.auth, {
    requestId,
    log,
    logContext,
    maxBodyBytes: MAX_BODY_BYTES,
  });
  if ("response" in auth) return auth.response;
  const { config, verification, rawBody } = auth;
  const tenantId = config.tenantUserId;

  const invoiceConfig = deps.loadInvoiceConfig(tenantId);
  if (!invoiceConfig.ok) {
    log("error", "misconfigured", { reason: invoiceConfig.reason });
    return licenceErrorResponse(requestId, 503, "SERVICE_UNAVAILABLE", "Service indisponible.");
  }

  // --- Payload ---------------------------------------------------------------
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return licenceErrorResponse(requestId, 400, "INVALID_JSON", "Corps JSON invalide.");
  }
  const parsed = digitalOrderPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return licenceErrorResponse(requestId, 422, "VALIDATION_FAILED", "Données de commande invalides.", {
      details: formatZodIssues(parsed.error),
    });
  }
  const payload = parsed.data;
  const order = payload.invoice;
  logContext.shopId = order.shop.id;
  logContext.orderId = order.order.id;

  // --- Claim (one fulfilment per shop order) ---------------------------------
  const claim = await deps.store.claim({
    tenantUserId: tenantId,
    shopId: String(order.shop.id),
    externalOrderId: String(order.order.id),
    orderReference: order.order.reference,
    idempotencyKey: verification.idempotencyKey,
    requestHash: sha256Hex(JSON.stringify(payload)),
  });
  if (claim.kind === "idempotency_key_reused") {
    return licenceErrorResponse(
      requestId,
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "Cette clé d’idempotence a déjà été utilisée pour une autre commande.",
    );
  }
  if (claim.kind === "in_progress") {
    return respondError({
      status: 409,
      code: "REQUEST_IN_PROGRESS",
      message: "Cette commande est en cours de traitement.",
      retryable: true,
      headers: { "Retry-After": "10" },
    });
  }

  const record = claim.record;
  const replay = claim.kind === "completed";

  // --- Payment gate (new deliveries only; a completed order is just replayed) --
  if (!replay && deps.requirePaidOrder()) {
    const unpaid = unpaidOrderReason(order, invoiceConfig.config.totalTolerance);
    if (unpaid) {
      await deps.store.markFailed(record.id, "ORDER_NOT_PAID").catch(() => undefined);
      log("warn", "order_not_paid", { reason: unpaid });
      return respondError({
        status: 409,
        code: "ORDER_NOT_PAID",
        message: "La commande n’est pas entièrement payée : aucune licence n’a été délivrée.",
        retryable: false,
      });
    }
  }

  const preview = payload.mode === "preview" && !replay;

  try {
    const result = await fulfil({
      deps,
      payload,
      record,
      replay,
      preview,
      tenantId,
      invoiceConfig: invoiceConfig.config,
      keyId: verification.keyId,
      idempotencyKey: verification.idempotencyKey,
      log,
    });
    if ("fail" in result) {
      if (!replay) await deps.store.markFailed(record.id, result.fail.code).catch(() => undefined);
      log(result.fail.retryable ? "warn" : "error", "fulfilment_failed", { code: result.fail.code });
      return respondError(result.fail);
    }
    if ("preview" in result) {
      // Parked as FAILED/AWAITING_APPROVAL: the approved send takes it over
      // like any retry and reuses the licences and invoice recorded here.
      await deps.store.markFailed(record.id, AWAITING_APPROVAL_CODE);
      log("info", "fulfilment_previewed", { invoiceId: result.invoice.id, licences: result.licences.length });
      return Response.json(
        {
          status: "preview",
          requestId,
          order: { id: order.order.id, reference: order.order.reference },
          invoice: invoiceJson(result.invoice, order.order.id),
          pdf: pdfJson(invoiceFilename(result.invoice.number), result.invoicePdf),
          licences: result.licences,
          email: result.email,
        },
        { status: 200, headers: { ...baseHeaders(requestId), "X-Invoice-Id": result.invoice.id, "X-Idempotent-Replay": "false" } },
      );
    }
    if (!replay) await deps.store.markCompleted(record.id);
    log("info", replay ? "fulfilment_replayed" : "fulfilment_completed", {
      invoiceId: result.invoice.id,
      licences: result.licences.length,
    });

    return Response.json(
      {
        status: replay ? "existing" : "delivered",
        requestId,
        order: { id: order.order.id, reference: order.order.reference },
        invoice: invoiceJson(result.invoice, order.order.id),
        pdf: pdfJson(invoiceFilename(result.invoice.number), result.invoicePdf),
        licences: result.licences,
        email: {
          to: maskEmail(result.email.to),
          subject: result.email.subject,
          sentAt: result.email.sentAt.toISOString(),
        },
      },
      {
        status: replay ? 200 : 201,
        headers: {
          ...baseHeaders(requestId),
          "X-Invoice-Id": result.invoice.id,
          "X-Invoice-Number": result.invoice.number,
          "X-Idempotent-Replay": replay ? "true" : "false",
        },
      },
    );
  } catch (error) {
    log("error", "unexpected_error", { error: safeErrorName(error) });
    if (!replay) await deps.store.markFailed(record.id, "INTERNAL_ERROR").catch(() => undefined);
    return respondError({ status: 500, code: "INTERNAL_ERROR", message: "Erreur interne.", retryable: true });
  }
}

function invoiceFilename(number: string) {
  return `facture-${number.replace(/[^A-Za-z0-9._-]+/g, "_")}.pdf`;
}

function invoiceJson(invoice: InvoiceSummary, orderId: number | string) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    orderId,
    orderReference: invoice.reference,
    issueDate: new Date(invoice.issueDate).toISOString(),
    currency: invoice.currency,
    totalTaxIncl: formatMinor(invoice.totalTTCCents, invoice.currency),
    amountPaid: formatMinor(invoice.amountPaidCents, invoice.currency),
  };
}

function pdfJson(filename: string, bytes: Uint8Array) {
  return {
    filename,
    contentType: "application/pdf",
    sizeBytes: bytes.byteLength,
    sha256: sha256Hex(bytes),
    base64: Buffer.from(bytes).toString("base64"),
  };
}

type LicenceSummary = {
  lineId: string;
  id: string;
  number: string;
  sku: string;
  product: string;
  quantity: number;
  status: string;
  codes: string[];
};

type FulfilSuccess = {
  invoice: InvoiceSummary;
  invoicePdf: Uint8Array;
  licences: LicenceSummary[];
  email: { to: string; subject: string; sentAt: Date };
};

type FulfilPreview = {
  preview: true;
  invoice: InvoiceSummary;
  invoicePdf: Uint8Array;
  licences: Array<LicenceSummary & { pdf: ReturnType<typeof pdfJson> }>;
  email: {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments: Array<{ filename: string; sizeBytes: number }>;
    /** Why the send would currently fail (SMTP not configured…), or null. */
    sendIssue: string | null;
  };
};

async function fulfil(params: {
  deps: DigitalOrderDeps;
  payload: DigitalOrderPayload;
  record: FulfilmentRecord;
  replay: boolean;
  /** Stop before the e-mail and return everything for review (never on a replay). */
  preview?: boolean;
  tenantId: string;
  invoiceConfig: PrestashopIntegrationConfig;
  keyId: string;
  idempotencyKey: string;
  log: (level: "info" | "warn" | "error", event: string, fields?: LogFields) => void;
}): Promise<FulfilSuccess | FulfilPreview | { fail: Fail }> {
  const { deps, payload, record, tenantId, log } = params;
  const order = payload.invoice;
  const actor = `api:${params.keyId}`;
  const customerName = customerNameOf(order);

  // 1. Licences, one per line (idempotent; compatible with the licence API).
  //    A completed order is answered from what was delivered: a retry carrying
  //    other lines (or no longer paid) must never allocate or burn more codes.
  const licenceOrders: Array<{ lineId: string; order: LicenceOrderRecord }> = [];
  if (params.replay) {
    for (const id of record.licenceOrderIds) {
      const delivered = await deps.getLicenceOrder(tenantId, id);
      if (delivered) licenceOrders.push({ lineId: delivered.externalLineId ?? "", order: delivered });
    }
  }
  for (const line of params.replay ? [] : payload.licences) {
    let allocation;
    try {
      allocation = await deps.requestLicence({
        tenantId,
        request: parseLicenceRequest({
          sku: line.sku,
          quantity: line.quantity,
          customerName,
          customerEmail: order.customer.email,
          orderReference: order.order.reference,
        }),
        idempotencyKey: licenceLineKey(order, line),
        source: "PRESTASHOP",
        actor,
        apiKeyId: params.keyId,
        external: { source: "prestashop", orderId: String(order.order.id), lineId: line.lineId },
      });
    } catch (error) {
      if (error instanceof InsufficientLicenceStockError) {
        return {
          fail: {
            status: 409,
            code: "INSUFFICIENT_STOCK",
            message: "Stock de codes insuffisant.",
            retryable: false,
            details: { lineId: line.lineId, sku: error.sku, requested: error.requested, available: error.available },
          },
        };
      }
      if (error instanceof LicenceEncryptionConfigError) {
        return { fail: { status: 503, code: "SERVICE_UNAVAILABLE", message: "Service indisponible.", retryable: true } };
      }
      throw error;
    }
    if (allocation.kind === "idempotency_key_reused") {
      return {
        fail: {
          status: 409,
          code: "LICENCE_REQUEST_CONFLICT",
          message: "Une licence différente existe déjà pour cette ligne de commande.",
          retryable: false,
          details: { lineId: line.lineId, licenceNumber: allocation.order.number },
        },
      };
    }
    const existing = allocation.order;
    if (
      allocation.kind === "external_line_conflict" &&
      (existing.productSku !== line.sku || existing.quantity !== line.quantity)
    ) {
      return {
        fail: {
          status: 409,
          code: "LICENCE_REQUEST_CONFLICT",
          message: "Une licence différente existe déjà pour cette ligne de commande.",
          retryable: false,
          details: { lineId: line.lineId, licenceNumber: existing.number },
        },
      };
    }
    if (existing.status === "CANCELLED") {
      return {
        fail: {
          status: 409,
          code: "LICENCE_CANCELLED",
          message: `La licence ${existing.number} a été annulée.`,
          retryable: false,
          details: { lineId: line.lineId },
        },
      };
    }
    licenceOrders.push({ lineId: line.lineId, order: existing });
  }
  if (!params.replay) {
    await deps.store.saveProgress(record.id, { licenceOrderIds: licenceOrders.map((entry) => entry.order.id) });
  }

  // 2. Invoice (same pipeline and idempotency as the invoice API).
  let invoiceId = record.invoiceId;
  if (!invoiceId) {
    const core = await processPrestashopInvoice({
      deps: deps.invoice,
      config: params.invoiceConfig,
      payload: order,
      idempotencyKey: params.idempotencyKey,
      log,
    });
    if (core.kind === "ok") {
      invoiceId = core.invoiceId;
    } else if (core.code === "ORDER_ALREADY_INVOICED" || core.code === "IDEMPOTENCY_KEY_REUSED") {
      // Invoiced earlier ("Générer la facture" button): reuse that invoice.
      invoiceId = await deps.findInvoiceForOrder(tenantId, String(order.shop.id), String(order.order.id));
      if (!invoiceId) {
        return { fail: { status: core.status, code: core.code, message: core.message, retryable: false, details: core.details } };
      }
      log("info", "existing_invoice_reused", { invoiceId });
    } else {
      return {
        fail: {
          status: core.status,
          code: core.code,
          message: core.message,
          retryable: ["SERVICE_UNAVAILABLE", "RATE_LIMITED", "REQUEST_IN_PROGRESS", "INVOICE_GENERATION_FAILED", "PDF_GENERATION_FAILED", "INTERNAL_ERROR"].includes(core.code),
          details: core.details,
          headers: core.headers,
        },
      };
    }
    await deps.store.saveProgress(record.id, { invoiceId });
  }
  const invoice = await deps.invoice.getInvoice(tenantId, invoiceId);
  if (!invoice) {
    return { fail: { status: 409, code: "INVOICE_NOT_FOUND", message: "La facture de cette commande a été supprimée.", retryable: false } };
  }

  // 3. PDFs (the licence render marks codes USED on first success).
  let invoicePdf: Uint8Array;
  const licencePdfs: Array<{ filename: string; content: Buffer }> = [];
  try {
    invoicePdf = await deps.invoice.renderPdf(tenantId, invoice.id);
    // Licence PDFs only travel with the e-mail, which a replay never resends.
    for (const entry of params.replay ? [] : licenceOrders) {
      const rendered = await deps.renderLicencePdf({ tenantId, orderId: entry.order.id, actor });
      entry.order = rendered.order;
      licencePdfs.push({ filename: rendered.filename, content: rendered.pdf });
    }
  } catch (error) {
    if (error instanceof LicenceOrderStateError) {
      return { fail: { status: 409, code: "LICENCE_CANCELLED", message: error.message, retryable: false } };
    }
    log("error", "pdf_failed", { error: safeErrorName(error) });
    return { fail: { status: 500, code: "PDF_GENERATION_FAILED", message: "Échec de génération des PDF.", retryable: true } };
  }

  const summarize = async () => {
    const licences: LicenceSummary[] = [];
    for (const entry of licenceOrders) {
      const hints = await deps.getCodeHints(tenantId, entry.order.id);
      const variant = getDigitalProductVariant(entry.order.productSku);
      const format = codeFormatForSku(entry.order.productSku);
      licences.push({
        lineId: entry.lineId,
        id: entry.order.id,
        number: entry.order.number,
        sku: entry.order.productSku,
        product: variant?.label ?? entry.order.productSku,
        quantity: entry.order.quantity,
        status: params.preview ? entry.order.status : "DELIVERED",
        codes: hints.map((hint) => maskLicenceCode(hint.codeHint, format)),
      });
    }
    return licences;
  };
  const invoiceAttachment = {
    filename: invoiceFilename(invoice.number),
    content: Buffer.from(invoicePdf),
    contentType: "application/pdf",
  };

  // 3b. Preview: everything the customer would receive, nothing sent. An
  //     e-mail already sent by an earlier attempt is never previewed again:
  //     the order just completes below.
  if (params.preview && !record.emailSentAt) {
    let content;
    try {
      content = await deps.previewEmail({
        tenantId,
        to: order.customer.email,
        orderReference: order.order.reference,
        customerName,
        invoiceNumber: invoice.number,
        licenceNumbers: licenceOrders.map((entry) => entry.order.number),
      });
    } catch (error) {
      if (error instanceof OrderEmailError) {
        return { fail: { status: 503, code: error.code, message: error.message, retryable: error.retryable } };
      }
      throw error;
    }
    const summaries = await summarize();
    return {
      preview: true,
      invoice,
      invoicePdf,
      licences: summaries.map((summary, index) => ({
        ...summary,
        pdf: pdfJson(licencePdfs[index].filename, licencePdfs[index].content),
      })),
      email: {
        to: content.to,
        subject: content.subject,
        html: content.html,
        text: content.text,
        attachments: [invoiceAttachment, ...licencePdfs].map((file) => ({
          filename: file.filename,
          sizeBytes: file.content.byteLength,
        })),
        sendIssue: content.sendIssue,
      },
    };
  }

  // 4. Customer e-mail, exactly once per order.
  let email = record.emailSentAt
    ? { to: record.emailTo ?? order.customer.email, subject: record.emailSubject ?? orderEmailSubject(order.order.reference), sentAt: record.emailSentAt }
    : null;
  if (!email) {
    if (params.replay) {
      return { fail: { status: 409, code: "EMAIL_NOT_SENT", message: "Commande sans e-mail enregistré.", retryable: false } };
    }
    try {
      const sent = await deps.sendEmail({
        tenantId,
        to: order.customer.email,
        orderReference: order.order.reference,
        customerName,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        licenceNumbers: licenceOrders.map((entry) => entry.order.number),
        attachments: [
          invoiceAttachment,
          ...licencePdfs.map((pdf) => ({ ...pdf, contentType: "application/pdf" })),
        ],
      });
      // The e-mail is out: recording it must not be lost to a transient DB
      // error, otherwise the next retry would e-mail the customer again.
      for (let attempt = 1; ; attempt += 1) {
        try {
          await deps.store.markEmailSent(record.id, sent);
          break;
        } catch (error) {
          if (attempt >= 3) {
            log("error", "email_sent_not_recorded", { error: safeErrorName(error) });
            throw error;
          }
        }
      }
      email = { ...sent, sentAt: new Date() };
    } catch (error) {
      if (error instanceof OrderEmailError) {
        return {
          fail: {
            status: error.retryable ? 502 : 503,
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          },
        };
      }
      throw error;
    }
  }

  // 5. Delivered.
  await deps.markDelivered({
    tenantId,
    orderIds: licenceOrders.map((entry) => entry.order.id),
    invoiceId: invoice.id,
    actor,
  });

  return { invoice, invoicePdf, licences: await summarize(), email };
}
