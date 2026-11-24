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
  countCodesReleasedLastHour,
  loadDeliveryPolicy,
  type DeliveryPolicy,
} from "@/server/digital-products/delivery-policy";
import {
  AWAITING_APPROVAL_CODE,
  isAwaitingApproval,
  markLicenceOrdersDelivered,
  postgresFulfilmentStore,
  type FulfilmentRecord,
  type FulfilmentReview,
  type FulfilmentStore,
} from "@/server/digital-products/fulfilment-store";
import {
  hashLicenceRequest,
  LicenceOrderStateError,
  parseLicenceRequest,
  renderLicenceOrderPdf,
  requestLicenceDocument,
  uniqueFilenames,
} from "@/server/digital-products/licences";
import { LicenceEncryptionConfigError } from "@/server/digital-products/licence-crypto";
import type { EmailAttachment } from "@/server/messaging";
import {
  OrderEmailError,
  orderEmailSubject,
  sendDigitalOrderEmail,
} from "@/server/digital-products/order-email";
import {
  callbackUrlIssue,
  checkShopOrder,
  notifyShopOrderSent,
  type ShopCallbackResult,
} from "@/server/digital-products/shop-callback";
import {
  adoptUndeliveredLicenceRequest,
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
  validatePrestashopInvoice,
  type InvoiceCoreError,
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
 * `mode: "review"` (manual "Traiter la commande" button in PrestaShop, for
 * products whose automatic delivery is off) runs steps 1-2 only, keeps the
 * request and answers with the invoice-app page where an administrator checks
 * the e-mail and the PDFs, then clicks "Envoyer" ({@link sendReviewedDigitalOrder}
 * runs steps 3-5 with the same licences and invoice). `mode: "status"` is a
 * read-only lookup the shop uses to learn that the order was sent.
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
  adoptLicence: typeof adoptUndeliveredLicenceRequest;
  notifyShop: typeof notifyShopOrderSent;
  checkShop: typeof checkShopOrder;
  validateInvoice: typeof validatePrestashopInvoice;
  policy: () => DeliveryPolicy;
  countReleasedCodes: typeof countCodesReleasedLastHour;
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
  adoptLicence: adoptUndeliveredLicenceRequest,
  notifyShop: notifyShopOrderSent,
  checkShop: checkShopOrder,
  validateInvoice: validatePrestashopInvoice,
  policy: () => loadDeliveryPolicy(),
  countReleasedCodes: countCodesReleasedLastHour,
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

export { AWAITING_APPROVAL_CODE };

export const digitalOrderPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  /**
   * "deliver" (default): full fulfilment, customer e-mailed.
   * "review": licences + invoice only; nothing sent, the order waits for an
   *   administrator's "Envoyer" in invoice-app (answer: `reviewPath`).
   * "status": read-only; the delivered order is replayed, otherwise 409.
   */
  mode: z.enum(["deliver", "review", "status"]).optional(),
  /** Module >= 1.7.2, mode "review": shop URL told when the order is sent (see shop-callback.ts). */
  callbackUrl: z
    .string()
    .max(500)
    .refine((value) => callbackUrlIssue(value) === null, { message: "Adresse de notification refusée" })
    .optional(),
  /** Module >= 1.7.3: the callback URL also answers "order.check" (is the order still paid and unchanged?). */
  paymentCheck: z.boolean().optional(),
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
 * Opt-out for development only: DIGITAL_ORDER_REQUIRE_PAYMENT=false (ignored
 * in production).
 */
export function requirePaidOrderFromEnv(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV === "production") return true;
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

  const { allowedShopIds } = invoiceConfig.config;
  if (allowedShopIds && !allowedShopIds.has(String(order.shop.id))) {
    log("warn", "shop_not_allowed");
    return respondError({ status: 403, code: "SHOP_NOT_ALLOWED", message: "Boutique non autorisée.", retryable: false });
  }

  if (payload.mode === "status") {
    // Read-only: never claims, allocates, invoices or e-mails.
    const existing = await deps.store.findByOrder(tenantId, String(order.shop.id), String(order.order.id));
    if (!existing) {
      return respondError({ status: 404, code: "FULFILMENT_NOT_FOUND", message: "Commande inconnue d’invoice-app.", retryable: false });
    }
    if (existing.status !== "COMPLETED") {
      const awaiting = isAwaitingApproval(existing);
      return respondError({
        status: 409,
        code: awaiting ? AWAITING_APPROVAL_CODE : existing.status === "PROCESSING" ? "REQUEST_IN_PROGRESS" : "NOT_DELIVERED",
        message: awaiting ? "Commande en attente de validation dans invoice-app." : "Commande non livrée.",
        retryable: !awaiting,
        details: { reviewPath: awaiting ? reviewPathFor(existing.id) : undefined, lastErrorCode: existing.lastErrorCode },
      });
    }
  }

  const outcome = await runDigitalOrder({
    deps,
    payload,
    tenantId,
    invoiceConfig: invoiceConfig.config,
    keyId: verification.keyId,
    idempotencyKey: verification.idempotencyKey,
    actor: `api:${verification.keyId}`,
    automatic: payload.mode !== "review" && payload.mode !== "status",
    log,
  });
  if ("fail" in outcome) return respondError(outcome.fail);
  if (outcome.kind === "review") {
    return Response.json(
      {
        status: "review",
        requestId,
        order: { id: order.order.id, reference: order.order.reference },
        reviewPath: reviewPathFor(outcome.fulfilmentId),
        invoice: invoiceJson(outcome.invoice, order.order.id),
        licences: outcome.licences,
      },
      { status: 200, headers: { ...baseHeaders(requestId), "X-Invoice-Id": outcome.invoice.id, "X-Idempotent-Replay": "false" } },
    );
  }
  const result = outcome.result;
  const replay = outcome.kind === "replayed";
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
}

/** Page of invoice-app where an administrator reviews and sends the order. */
export function reviewPathFor(fulfilmentId: string) {
  return `/api/produits-digitaux/commandes/${encodeURIComponent(fulfilmentId)}/ouvrir`;
}

type RunOutcome =
  | { fail: Fail }
  | { kind: "delivered" | "replayed"; fulfilmentId: string; result: FulfilSuccess }
  | { kind: "review"; fulfilmentId: string; invoice: InvoiceSummary; licences: LicenceSummary[] };

/**
 * Claim → payment gate → fulfilment, shared by the signed API and the
 * administrator's "Envoyer" in invoice-app (same guarantees either way).
 */
async function runDigitalOrder(params: {
  deps: DigitalOrderDeps;
  payload: DigitalOrderPayload;
  tenantId: string;
  invoiceConfig: PrestashopIntegrationConfig;
  keyId: string;
  idempotencyKey: string;
  actor: string;
  /** Delivery nobody looks at (API, mode "deliver"): holds reviewed orders and applies the delivery policy. */
  automatic?: boolean;
  /** "Envoyer": attempt counter of the request being sent (see FulfilmentClaimInput). */
  expectedAttempts?: number;
  /** Set when an administrator sends from the review page. */
  reviewedEmail?: ReviewedEmail;
  log: (level: "info" | "warn" | "error", event: string, fields?: LogFields) => void;
}): Promise<RunOutcome> {
  const { deps, payload, tenantId, log } = params;
  const order = payload.invoice;

  // --- Claim (one fulfilment per shop order) ---------------------------------
  const claim = await deps.store.claim({
    tenantUserId: tenantId,
    shopId: String(order.shop.id),
    externalOrderId: String(order.order.id),
    orderReference: order.order.reference,
    idempotencyKey: params.idempotencyKey,
    requestHash: sha256Hex(JSON.stringify(payload)),
    holdIfReviewed: params.automatic,
    expectedAttempts: params.expectedAttempts,
  });
  if (claim.kind === "idempotency_key_reused") {
    return {
      fail: {
        status: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "Cette clé d’idempotence a déjà été utilisée pour une autre commande.",
        retryable: false,
      },
    };
  }
  if (claim.kind === "in_progress") {
    return {
      fail: {
        status: 409,
        code: "REQUEST_IN_PROGRESS",
        message: "Cette commande est en cours de traitement.",
        retryable: true,
        headers: { "Retry-After": "10" },
      },
    };
  }
  if (claim.kind === "awaiting_review") {
    // Prepared for an administrator: an automatic request may not e-mail it instead.
    log("warn", "automatic_delivery_held", { fulfilmentId: claim.record.id });
    if (deps.requirePaidOrder() && unpaidOrderReason(order, params.invoiceConfig.totalTolerance)) {
      await deps.store.refuseReview(claim.record.id, "ORDER_NOT_PAID", claim.record.attempts).catch(() => undefined);
    }
    return {
      fail: {
        status: 409,
        code: AWAITING_APPROVAL_CODE,
        message: "Commande en attente de validation dans invoice-app.",
        retryable: false,
        details: { reviewPath: reviewPathFor(claim.record.id) },
      },
    };
  }
  if (claim.kind === "changed") {
    log("warn", "review_changed");
    return { fail: REVIEW_CHANGED };
  }

  const record = claim.record;
  const replay = claim.kind === "completed";

  // --- Payment gate (new deliveries only; a completed order is just replayed) --
  if (!replay && deps.requirePaidOrder()) {
    const unpaid = unpaidOrderReason(order, params.invoiceConfig.totalTolerance);
    if (unpaid) {
      await deps.store.markFailed(record.id, "ORDER_NOT_PAID").catch(() => undefined);
      await deps.store.clearReview(record.id).catch(() => undefined);
      log("warn", "order_not_paid", { reason: unpaid });
      return {
        fail: {
          status: 409,
          code: "ORDER_NOT_PAID",
          message: "La commande n’est pas entièrement payée : aucune licence n’a été délivrée.",
          retryable: false,
        },
      };
    }
  }

  const review = payload.mode === "review" && !replay;

  // --- Anti-fraud limits (automatic deliveries whose e-mail is not out yet) ----
  if (params.automatic && !replay && !record.emailSentAt) {
    let held: Fail | null;
    try {
      held = await deliveryPolicyFailure(deps, payload, tenantId);
    } catch (error) {
      log("error", "unexpected_error", { error: safeErrorName(error) });
      held = { status: 500, code: "INTERNAL_ERROR", message: "Erreur interne.", retryable: true };
    }
    if (held) {
      await deps.store.markFailed(record.id, held.code).catch(() => undefined);
      log("error", "delivery_held", { code: held.code });
      return { fail: held };
    }
  }

  try {
    const result = await fulfil({
      deps,
      payload,
      record,
      replay,
      review,
      tenantId,
      invoiceConfig: params.invoiceConfig,
      keyId: params.keyId,
      actor: params.actor,
      reviewedEmail: params.reviewedEmail,
      idempotencyKey: params.idempotencyKey,
      log,
    });
    if ("fail" in result) {
      if (!replay) await deps.store.markFailed(record.id, result.fail.code).catch(() => undefined);
      // The shop's order changed since the last review (or cannot be prepared any
      // more): what was stored before must not be sent.
      if (review) await deps.store.clearReview(record.id).catch(() => undefined);
      log(result.fail.retryable ? "warn" : "error", "fulfilment_failed", { code: result.fail.code });
      return { fail: result.fail };
    }
    if ("review" in result) {
      // Parked as FAILED/AWAITING_APPROVAL with the request: "Envoyer" takes it
      // over like any retry and reuses the licences and invoice recorded here.
      await deps.store.markAwaitingReview(record.id, { payload: { ...payload, mode: undefined }, keyId: params.keyId });
      log("info", "fulfilment_awaiting_review", { invoiceId: result.invoice.id, licences: result.licences.length });
      return { kind: "review", fulfilmentId: record.id, invoice: result.invoice, licences: result.licences };
    }
    if (!replay) await deps.store.markCompleted(record.id);
    log("info", replay ? "fulfilment_replayed" : "fulfilment_completed", {
      invoiceId: result.invoice.id,
      licences: result.licences.length,
    });
    return { kind: replay ? "replayed" : "delivered", fulfilmentId: record.id, result };
  } catch (error) {
    log("error", "unexpected_error", { error: safeErrorName(error) });
    if (!replay) await deps.store.markFailed(record.id, "INTERNAL_ERROR").catch(() => undefined);
    return { fail: { status: 500, code: "INTERNAL_ERROR", message: "Erreur interne.", retryable: true } };
  }
}

const REVIEW_CHANGED: Fail = {
  status: 409,
  code: "REVIEW_CHANGED",
  message: "La commande a changé depuis l’ouverture de cette page. Rechargez-la et vérifiez-la avant d’envoyer.",
  retryable: false,
};

async function deliveryPolicyFailure(
  deps: DigitalOrderDeps,
  payload: DigitalOrderPayload,
  tenantId: string,
): Promise<Fail | null> {
  const policy = deps.policy();
  const needsReview = (message: string): Fail => ({ status: 409, code: "MANUAL_REVIEW_REQUIRED", message, retryable: false });
  if (!policy.allowFreeOrders && thousandths(payload.invoice.totals.totalTaxIncl) === 0) {
    return needsReview("Commande à 0 : livraison automatique refusée, à traiter manuellement.");
  }
  const requested = payload.licences.reduce((sum, line) => sum + line.quantity, 0);
  if (requested > policy.maxAutoCodesPerOrder) {
    return needsReview(`Plus de ${policy.maxAutoCodesPerOrder} licences : livraison automatique refusée, à traiter manuellement.`);
  }
  if (policy.maxCodesPerHour > 0) {
    const released = await deps.countReleasedCodes(tenantId, String(payload.invoice.order.id));
    if (released > 0 && released + requested > policy.maxCodesPerHour) {
      return {
        status: 429,
        code: "DELIVERY_LIMIT_REACHED",
        message: "Nombre de licences délivrées par heure atteint : la commande sera réessayée.",
        retryable: true,
        headers: { "Retry-After": "900" },
      };
    }
  }
  return null;
}

/**
 * Identifies what an administrator is looking at: the stored order (recipient,
 * lines, amounts), its licences and its invoice. "Envoyer" refuses to send
 * anything else.
 */
export function reviewVersionOf(review: { reviewPayload: unknown; licenceOrderIds: readonly string[]; invoiceId: string | null }) {
  return sha256Hex(JSON.stringify([review.reviewPayload ?? null, review.licenceOrderIds, review.invoiceId]));
}

export type SendReviewedOrderResult =
  | { ok: true; emailTo: string; invoiceId: string | null; invoiceNumber: string; alreadySent: boolean }
  | { ok: false; code: string; message: string };

/** What the administrator decided on the review page (all optional parts already validated by the caller). */
export type ReviewedEmail = {
  subject: string;
  html: string;
  includeInvoice: boolean;
  /** Licence documents to attach (ids of this order's licences). */
  licenceOrderIds: string[];
  extraAttachments: EmailAttachment[];
};

/**
 * Tells the shop that a reviewed order was sent, so that it becomes "Livré"
 * now. Never throws and never undoes the send; the shop's own checks (order
 * page, cron) remain the fallback.
 */
export async function notifyShopForReview(
  params: { tenantId: string; fulfilmentId: string },
  overrides: Partial<DigitalOrderDeps> = {},
): Promise<ShopCallbackResult> {
  const deps: DigitalOrderDeps = { ...defaultDeps, ...overrides };
  const startedAt = Date.now();
  let result: ShopCallbackResult;
  const review = await deps.store.findReview(params.tenantId, params.fulfilmentId);
  if (!review || review.status !== "COMPLETED") return { ok: false, code: "NOT_SENT" };
  const parsed = digitalOrderPayloadSchema.safeParse(review.reviewPayload);
  if (!parsed.success || !review.reviewKeyId || !parsed.data.callbackUrl) {
    result = { ok: false, code: "CALLBACK_NOT_PROVIDED" };
  } else {
    try {
      result = await deps.notifyShop({
        url: parsed.data.callbackUrl,
        keyId: review.reviewKeyId,
        fulfilmentId: review.id,
        shopId: parsed.data.invoice.shop.id,
        orderId: parsed.data.invoice.order.id,
        orderReference: parsed.data.invoice.order.reference,
      });
    } catch (error) {
      result = { ok: false, code: "SHOP_UNREACHABLE" };
      deps.log("error", "shop_notify_error", { fulfilmentId: review.id, error: safeErrorName(error) });
    }
  }
  await deps.store
    .markShopNotified(review.id, result.ok ? result.state : result.code, result.ok)
    .catch(() => undefined);
  deps.log(result.ok ? "info" : "warn", "shop_notified", {
    fulfilmentId: review.id,
    result: result.ok ? result.state : result.code,
    durationMs: Date.now() - startedAt,
  });
  return result;
}

/**
 * "Envoyer" on the review page: the order kept by mode "review" goes through
 * the normal fulfilment (same key, same licences, same invoice) and the
 * customer is e-mailed once. Only orders still awaiting review are accepted.
 */
export async function sendReviewedDigitalOrder(
  params: {
    tenantId: string;
    fulfilmentId: string;
    userId: string;
    email?: ReviewedEmail;
    /** {@link reviewVersionOf} of the page the administrator approved. */
    expectedVersion?: string;
  },
  overrides: Partial<DigitalOrderDeps> = {},
): Promise<SendReviewedOrderResult> {
  const deps: DigitalOrderDeps = { ...defaultDeps, ...overrides };
  const startedAt = Date.now();
  const log = (level: "info" | "warn" | "error", event: string, fields: LogFields = {}) =>
    deps.log(level, event, { fulfilmentId: params.fulfilmentId, source: "review", ...fields, durationMs: Date.now() - startedAt });

  const review = await deps.store.findReview(params.tenantId, params.fulfilmentId);
  if (!review) return { ok: false, code: "NOT_FOUND", message: "Commande introuvable." };
  if (review.status === "COMPLETED") {
    return { ok: true, emailTo: review.emailTo ?? "", invoiceId: review.invoiceId, invoiceNumber: "", alreadySent: true };
  }
  if (!review.reviewPayload || !review.reviewKeyId || !isAwaitingApproval({ ...review, reviewed: true })) {
    return { ok: false, code: "NOT_AWAITING_REVIEW", message: "Cette commande n’attend pas de validation." };
  }
  if (params.expectedVersion !== undefined && params.expectedVersion !== reviewVersionOf(review)) {
    log("warn", "review_changed");
    return { ok: false, code: REVIEW_CHANGED.code, message: REVIEW_CHANGED.message };
  }
  const parsed = digitalOrderPayloadSchema.safeParse(review.reviewPayload);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION_FAILED", message: "La commande enregistrée est invalide." };
  }
  if (!review.emailSentAt) {
    const refused = await verifyReviewedPayment({ deps, review, payload: parsed.data, log });
    if (refused) return refused;
  }
  const invoiceConfig = deps.loadInvoiceConfig(params.tenantId);
  if (!invoiceConfig.ok) {
    log("error", "misconfigured", { reason: invoiceConfig.reason });
    return { ok: false, code: "SERVICE_UNAVAILABLE", message: "Service indisponible." };
  }
  const outcome = await runDigitalOrder({
    deps,
    payload: { ...parsed.data, mode: undefined },
    tenantId: params.tenantId,
    invoiceConfig: invoiceConfig.config,
    keyId: review.reviewKeyId,
    idempotencyKey: review.idempotencyKey,
    actor: `user:${params.userId}`,
    expectedAttempts: review.attempts,
    reviewedEmail: params.email,
    log,
  });
  if ("fail" in outcome) return { ok: false, code: outcome.fail.code, message: outcome.fail.message };
  if (outcome.kind === "review") return { ok: false, code: "INTERNAL_ERROR", message: "Erreur interne." };
  await deps.store.markSentBy(review.id, params.userId).catch(() => undefined);
  return {
    ok: true,
    emailTo: outcome.result.email.to,
    invoiceId: outcome.result.invoice.id,
    invoiceNumber: outcome.result.invoice.number,
    alreadySent: outcome.kind === "replayed",
  };
}

/**
 * The stored request says "paid" as of the moment "Traiter la commande" was
 * clicked. Before releasing codes the shop is asked whether the order is still
 * paid, not refunded and unchanged (module >= 1.7.3). When it cannot be asked
 * (older module, shop unreachable), that first proof is accepted for a limited
 * time only; afterwards "Traiter la commande" must be clicked again, which
 * checks the payment again and keeps the same licences and invoice.
 */
async function verifyReviewedPayment(params: {
  deps: DigitalOrderDeps;
  review: FulfilmentReview;
  payload: DigitalOrderPayload;
  log: (level: "info" | "warn" | "error", event: string, fields?: LogFields) => void;
}): Promise<Extract<SendReviewedOrderResult, { ok: false }> | null> {
  const { deps, review, payload, log } = params;
  let unavailable = "CHECK_NOT_SUPPORTED";
  if (payload.paymentCheck && payload.callbackUrl && review.reviewKeyId) {
    try {
      const check = await deps.checkShop({
        url: payload.callbackUrl,
        keyId: review.reviewKeyId,
        fulfilmentId: review.id,
        shopId: payload.invoice.shop.id,
        orderId: payload.invoice.order.id,
        orderReference: payload.invoice.order.reference,
      });
      if (check.ok && check.payable) {
        log("info", "payment_confirmed_by_shop");
        return null;
      }
      if (check.ok) {
        const changed = check.reason === "ORDER_CHANGED";
        const code = changed ? "ORDER_CHANGED" : "ORDER_NOT_PAID";
        await deps.store.refuseReview(review.id, code, review.attempts);
        log("error", "payment_refused_by_shop", { code });
        return {
          ok: false,
          code,
          message: changed
            ? "La commande a été modifiée dans PrestaShop : cliquez de nouveau sur « Traiter la commande »."
            : "PrestaShop indique que la commande n’est plus payée (annulée, remboursée…) : rien n’a été envoyé.",
        };
      }
      unavailable = check.code;
    } catch (error) {
      unavailable = "SHOP_UNREACHABLE";
      log("error", "payment_check_error", { error: safeErrorName(error) });
    }
  }
  const age = review.reviewRequestedAt ? Date.now() - review.reviewRequestedAt.getTime() : Number.POSITIVE_INFINITY;
  if (age <= deps.policy().reviewMaxAgeMinutes * 60_000) {
    log("warn", "payment_check_skipped", { reason: unavailable });
    return null;
  }
  log("warn", "payment_check_required", { reason: unavailable });
  return {
    ok: false,
    code: "PAYMENT_CHECK_REQUIRED",
    message: "Le paiement doit être revérifié : cliquez de nouveau sur « Traiter la commande » dans PrestaShop, puis envoyez.",
  };
}

export function invoiceFilename(number: string) {
  return `${number.replace(/[^A-Za-z0-9._-]+/g, "_")}.pdf`;
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

type FulfilReview = {
  review: true;
  invoice: InvoiceSummary;
  licences: LicenceSummary[];
};

function invoiceFailure(error: InvoiceCoreError): Fail {
  return {
    status: error.status,
    code: error.code,
    message: error.message,
    retryable: ["SERVICE_UNAVAILABLE", "RATE_LIMITED", "REQUEST_IN_PROGRESS", "INVOICE_GENERATION_FAILED", "PDF_GENERATION_FAILED", "INTERNAL_ERROR"].includes(error.code),
    details: error.details,
    headers: error.headers,
  };
}

async function fulfil(params: {
  deps: DigitalOrderDeps;
  payload: DigitalOrderPayload;
  record: FulfilmentRecord;
  replay: boolean;
  /** Stop after licences + invoice: nothing rendered or sent (never on a replay). */
  review?: boolean;
  /** Who acts (events, PDF renders): `api:<keyId>` or `user:<id>`. */
  actor?: string;
  reviewedEmail?: ReviewedEmail;
  tenantId: string;
  invoiceConfig: PrestashopIntegrationConfig;
  keyId: string;
  idempotencyKey: string;
  log: (level: "info" | "warn" | "error", event: string, fields?: LogFields) => void;
}): Promise<FulfilSuccess | FulfilReview | { fail: Fail }> {
  const { deps, payload, record, tenantId, log } = params;
  const order = payload.invoice;
  const actor = params.actor ?? `api:${params.keyId}`;
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
  // An order that cannot be invoiced must not hold activation codes.
  if (!params.replay && !record.invoiceId) {
    const validated = await deps.validateInvoice({ deps: deps.invoice, config: params.invoiceConfig, payload: order, log });
    if (validated.kind === "error") return { fail: invoiceFailure(validated) };
  }
  for (const line of params.replay ? [] : payload.licences) {
    let allocation;
    const request = parseLicenceRequest({
      sku: line.sku,
      quantity: line.quantity,
      customerName,
      customerEmail: order.customer.email,
      orderReference: order.order.reference,
    });
    const external = { source: "prestashop", orderId: String(order.order.id), lineId: line.lineId };
    try {
      allocation = await deps.requestLicence({
        tenantId,
        request,
        idempotencyKey: licenceLineKey(order, line),
        source: "PRESTASHOP",
        actor,
        apiKeyId: params.keyId,
        external,
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
    // Asked again for review with other customer details (corrected e-mail…):
    // same line, product and quantity, nothing delivered -> same codes.
    if (
      allocation.kind === "idempotency_key_reused" &&
      params.review &&
      allocation.order.externalOrderId === external.orderId &&
      allocation.order.externalLineId === external.lineId &&
      allocation.order.productSku === line.sku &&
      allocation.order.quantity === line.quantity &&
      (await deps.adoptLicence({
        tenantId,
        orderId: allocation.order.id,
        requestHash: hashLicenceRequest(request, external),
        customerName: request.customerName ?? null,
        customerEmail: request.customerEmail ?? null,
        orderReference: request.orderReference ?? null,
        actor,
      }))
    ) {
      log("info", "licence_request_adopted", { licenceOrderId: allocation.order.id });
      allocation = { kind: "existing" as const, order: allocation.order };
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
    // Same PrestaShop line reached through another key (other shop id, licence
    // API…): its codes may only go to the customer they were reserved for, and
    // never once delivered.
    if (
      allocation.kind === "external_line_conflict" &&
      (existing.productSku !== line.sku ||
        existing.quantity !== line.quantity ||
        existing.status === "DELIVERED" ||
        existing.customerEmail?.toLowerCase() !== order.customer.email.toLowerCase())
    ) {
      log("warn", "licence_line_conflict", { licenceOrderId: existing.id });
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
      return { fail: invoiceFailure(core) };
    }
    await deps.store.saveProgress(record.id, { invoiceId });
  }
  const invoice = await deps.invoice.getInvoice(tenantId, invoiceId);
  if (!invoice) {
    return { fail: { status: 409, code: "INVOICE_NOT_FOUND", message: "La facture de cette commande a été supprimée.", retryable: false } };
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
        status: params.review ? entry.order.status : "DELIVERED",
        codes: hints.map((hint) => maskLicenceCode(hint.codeHint, format)),
      });
    }
    return licences;
  };
  // 2b. Review: stop here (an e-mail already sent by an earlier attempt is
  //     never reviewed again: the order just completes below).
  if (params.review && !record.emailSentAt) {
    return { review: true, invoice, licences: await summarize() };
  }

  // 3. PDFs (the licence render marks codes USED on first success).
  let invoicePdf: Uint8Array;
  let licencePdfs: Array<{ id: string; filename: string; content: Buffer }> = [];
  try {
    invoicePdf = await deps.invoice.renderPdf(tenantId, invoice.id);
    // Licence PDFs only travel with the e-mail, which a replay never resends.
    for (const entry of params.replay ? [] : licenceOrders) {
      const rendered = await deps.renderLicencePdf({ tenantId, orderId: entry.order.id, actor });
      entry.order = rendered.order;
      licencePdfs.push({ id: entry.order.id, filename: rendered.filename, content: rendered.pdf });
    }
    licencePdfs = uniqueFilenames(licencePdfs);
  } catch (error) {
    if (error instanceof LicenceOrderStateError) {
      return { fail: { status: 409, code: "LICENCE_CANCELLED", message: error.message, retryable: false } };
    }
    log("error", "pdf_failed", { error: safeErrorName(error) });
    return { fail: { status: 500, code: "PDF_GENERATION_FAILED", message: "Échec de génération des PDF.", retryable: true } };
  }

  const invoiceAttachment = {
    filename: invoiceFilename(invoice.number),
    content: Buffer.from(invoicePdf),
    contentType: "application/pdf",
  };

  // 4. Customer e-mail, exactly once per order.
  const reviewed = params.reviewedEmail;
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
        attachments: uniqueFilenames([
          ...(reviewed && !reviewed.includeInvoice ? [] : [invoiceAttachment]),
          ...licencePdfs
            .filter((pdf) => !reviewed || reviewed.licenceOrderIds.includes(pdf.id))
            .map((pdf) => ({ filename: pdf.filename, content: pdf.content, contentType: "application/pdf" })),
          ...(reviewed?.extraAttachments ?? []),
        ]),
        override: reviewed ? { subject: reviewed.subject, html: reviewed.html } : null,
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
