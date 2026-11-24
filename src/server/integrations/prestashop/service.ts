import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { ClientSource } from "@/lib/db/prisma-server";
import {
  enforceRateLimit,
  PublicRequestSecurityError,
} from "@/lib/security/public-request";
import { resolveClientForContact, type ClientContactInput } from "@/server/clients";
import {
  createInvoiceForUser,
  previewInvoiceTotalsForUser,
  recordPaymentForUser,
  type InvoiceInput,
} from "@/server/invoices";
import { generateInvoicePdfForUser } from "@/server/pdf";
import { getSettingsDocumentDefaults } from "@/server/settings";
import { normalizeTaxConfiguration } from "@/lib/taxes";
import {
  loadPrestashopIntegrationConfig,
  type ConfigResult,
  type PrestashopIntegrationConfig,
} from "@/server/integrations/prestashop/config";
import {
  canonicalPayloadJson,
  formatMinor,
  formatZodIssues,
  mapPrestashopOrder,
  PayloadConsistencyError,
  type MappedPrestashopOrder,
  prestashopOrderPayloadSchema,
  type PrestashopOrderPayload,
  type ValidationIssue,
} from "@/server/integrations/prestashop/payload";
import { sha256Hex, verifyRequestSignature } from "@/server/integrations/prestashop/signature";
import {
  postgresPrestashopInvoiceStore,
  type PrestashopInvoiceStore,
} from "@/server/integrations/prestashop/store";

export const MAX_BODY_BYTES = 1024 * 1024;
const PRE_AUTH_LIMIT_PER_MINUTE = 120;
const NONCE_PURGE_PROBABILITY = 0.02;

export type InvoiceSummary = {
  id: string;
  number: string;
  status: string;
  reference: string | null;
  issueDate: Date;
  currency: string;
  totalTTCCents: number;
  amountPaidCents: number;
  totalTVACents?: number;
  timbreAmountCents?: number | null;
  fodecAmountCents?: number | null;
  vatBreakdown?: unknown;
};

/** The tenant's VAT rules, as configured in invoice-app (Paramètres → Taxes). */
export type TenantTaxRules = { vatRates: number[] };

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type PrestashopInvoiceDeps = {
  loadConfig: () => ConfigResult;
  store: PrestashopInvoiceStore;
  resolveClient: (
    contact: ClientContactInput,
    tenantUserId: string,
    metadata: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  previewTotals: (
    tenantUserId: string,
    input: InvoiceInput,
  ) => Promise<{ totals: { totalTTCCents: number }; timbreAmountCents: number }>;
  createInvoice: (tenantUserId: string, input: InvoiceInput) => Promise<{ id: string }>;
  recordPayment: (
    tenantUserId: string,
    input: { invoiceId: string; amountCents: number; method: string; date: Date; note: string },
  ) => Promise<unknown>;
  getInvoice: (tenantUserId: string, invoiceId: string) => Promise<InvoiceSummary | null>;
  getTaxRules: (tenantUserId: string) => Promise<TenantTaxRules>;
  renderPdf: (tenantUserId: string, invoiceId: string) => Promise<Uint8Array>;
  onInvoiceChanged: (tenantUserId: string, invoiceId: string) => void;
  log: (level: "info" | "warn" | "error", event: string, fields: LogFields) => void;
  random: () => number;
};

// ---------------------------------------------------------------------------
// Default (production) dependencies
// ---------------------------------------------------------------------------

async function resolveClientWithBackfill(
  contact: ClientContactInput,
  tenantUserId: string,
  metadata: Record<string, unknown>,
) {
  const client = await resolveClientForContact(contact, tenantUserId, {
    source: ClientSource.IMPORT,
    notes: "Client importé depuis la boutique PrestaShop.",
    leadMetadata: metadata,
  });
  // Existing clients keep their data; only blank fields are completed so
  // manual edits made in invoice-app are never overwritten by the shop.
  const backfill: Record<string, string> = {};
  if (!client.address && contact.address) backfill.address = contact.address;
  if (!client.phone && contact.phone) backfill.phone = contact.phone;
  if (!client.companyName && contact.company) backfill.companyName = contact.company;
  if (!client.vatNumber && contact.vatNumber) backfill.vatNumber = contact.vatNumber;
  if (Object.keys(backfill).length > 0) {
    await prisma.client.update({ where: { id: client.id }, data: backfill });
  }
  return client;
}

export const defaultPrestashopInvoiceDeps: PrestashopInvoiceDeps = {
  loadConfig: () => loadPrestashopIntegrationConfig(),
  store: postgresPrestashopInvoiceStore,
  resolveClient: resolveClientWithBackfill,
  previewTotals: previewInvoiceTotalsForUser,
  createInvoice: createInvoiceForUser,
  recordPayment: recordPaymentForUser,
  getInvoice: (tenantUserId, invoiceId) =>
    prisma.invoice.findFirst({
      where: { id: invoiceId, userId: tenantUserId },
      select: {
        id: true,
        number: true,
        status: true,
        reference: true,
        issueDate: true,
        currency: true,
        totalTTCCents: true,
        amountPaidCents: true,
        totalTVACents: true,
        timbreAmountCents: true,
        fodecAmountCents: true,
        vatBreakdown: true,
      },
    }),
  getTaxRules: async (tenantUserId) => {
    const settings = await getSettingsDocumentDefaults(tenantUserId);
    const taxConfig = normalizeTaxConfiguration(
      (settings as { taxConfiguration?: unknown }).taxConfiguration,
    );
    return {
      vatRates: taxConfig.tva.rates
        .map((rate) => rate.rate)
        .filter((rate) => rate > 0 || taxConfig.tva.allowExemption),
    };
  },
  renderPdf: generateInvoicePdfForUser,
  onInvoiceChanged: () => {},
  log: (level, event, fields) => {
    console[level]("[prestashop-invoices]", { event, ...fields });
  },
  random: Math.random,
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "HTTPS_REQUIRED"
  | "SERVICE_UNAVAILABLE"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_JSON"
  | "VALIDATION_FAILED"
  | "TOTALS_MISMATCH"
  | "VAT_RATE_NOT_ALLOWED"
  | "TIMBRE_MISMATCH"
  | "IDEMPOTENCY_KEY_REUSED"
  | "ORDER_ALREADY_INVOICED"
  | "REQUEST_IN_PROGRESS"
  | "INVOICE_GENERATION_FAILED"
  | "PDF_GENERATION_FAILED"
  | "INVOICE_NOT_FOUND"
  | "SHOP_NOT_ALLOWED"
  | "INTERNAL_ERROR";

const RETRYABLE: ReadonlySet<ErrorCode> = new Set([
  "SERVICE_UNAVAILABLE",
  "RATE_LIMITED",
  "REQUEST_IN_PROGRESS",
  "INVOICE_GENERATION_FAILED",
  "PDF_GENERATION_FAILED",
  "INTERNAL_ERROR",
]);

function baseHeaders(requestId: string): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  };
}

function errorResponse(
  requestId: string,
  status: number,
  code: ErrorCode,
  message: string,
  extra?: { details?: unknown; headers?: Record<string, string> },
) {
  return Response.json(
    {
      error: {
        code,
        message,
        retryable: RETRYABLE.has(code),
        requestId,
        ...(extra?.details !== undefined ? { details: extra.details } : {}),
      },
    },
    { status, headers: { ...baseHeaders(requestId), ...extra?.headers } },
  );
}

export function getTrustedClientIp(headers: Headers) {
  // Platform-set headers first (Vercel overwrites these); never trust headers
  // a client can freely inject such as cf-connecting-ip on non-Cloudflare hosts.
  const candidates = [
    headers.get("x-vercel-forwarded-for")?.split(",")[0],
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return "unknown";
}

export function isHttps(request: Request) {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  return new URL(request.url).protocol === "https:";
}

export class BodyTooLargeError extends Error {}

export async function readBodyWithLimit(request: Request, limit: number): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > limit) {
    throw new BodyTooLargeError();
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function safeErrorName(error: unknown) {
  if (error instanceof Error) {
    // Database errors can echo row values ("Key (col)=(value)", "DETAIL: ..."):
    // keep the error class and context, never customer data, codes or secrets.
    return `${error.name}: ${error.message}`
      .replace(/\s+/g, " ")
      .replace(/(\([^)]*\))=\([^)]*\)/g, "$1=([redacted])")
      .replace(/DETAIL:.*$/i, "DETAIL: [redacted]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/\bv1:[A-Za-z0-9_-]{16,}/g, "[ciphertext]")
      .slice(0, 200);
  }
  return typeof error;
}

function wantsBinaryPdf(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return /application\/pdf/i.test(accept) && !/application\/json/i.test(accept);
}

function vatRatesOf(breakdown: unknown): string[] {
  if (!Array.isArray(breakdown)) return [];
  const rates = breakdown
    .map((entry) => Number((entry as { rate?: unknown })?.rate))
    .filter((rate) => Number.isFinite(rate));
  return [...new Set(rates)].sort((a, b) => b - a).map((rate) => rate.toFixed(3));
}

function successResponse(options: {
  request: Request;
  requestId: string;
  status: 200 | 201;
  outcome: "created" | "existing";
  invoice: InvoiceSummary;
  orderId: number;
  pdf: Uint8Array;
  payment: { recorded: boolean } | null;
  /** Order total excluding a shop-charged timbre; omitted for downloads (no order payload). */
  expectedOrderTotalMinor?: number;
  /** Timbre fiscal charged by the shop at checkout, if any. */
  shopTimbreMinor?: number | null;
}) {
  const { invoice, pdf, requestId } = options;
  const filename = `facture-${invoice.number.replace(/[^A-Za-z0-9._-]+/g, "_")}.pdf`;
  const pdfSha256 = sha256Hex(pdf);
  const commonHeaders = {
    ...baseHeaders(requestId),
    "X-Invoice-Id": invoice.id,
    "X-Invoice-Number": invoice.number,
    "X-Idempotent-Replay": options.outcome === "existing" ? "true" : "false",
  };

  if (wantsBinaryPdf(options.request)) {
    return new Response(Buffer.from(pdf), {
      status: options.status,
      headers: {
        ...commonHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "X-Content-SHA256": pdfSha256,
      },
    });
  }

  return Response.json(
    {
      status: options.outcome,
      requestId,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        orderId: options.orderId,
        orderReference: invoice.reference,
        issueDate: new Date(invoice.issueDate).toISOString(),
        currency: invoice.currency,
        totalTaxIncl: formatMinor(invoice.totalTTCCents, invoice.currency),
        totalTaxExcl: formatMinor(
          invoice.totalTTCCents -
            (invoice.totalTVACents ?? 0) -
            (invoice.timbreAmountCents ?? 0) -
            (invoice.fodecAmountCents ?? 0),
          invoice.currency,
        ),
        totalVat: formatMinor(invoice.totalTVACents ?? 0, invoice.currency),
        timbreAmount: formatMinor(invoice.timbreAmountCents ?? 0, invoice.currency),
        vatRates: vatRatesOf(invoice.vatBreakdown),
        amountPaid: formatMinor(invoice.amountPaidCents, invoice.currency),
      },
      payment: options.payment,
      // Invoice total without the timbre, compared with what the shop charged.
      // A non-zero difference is a VAT rounding residue within the tolerance.
      totalsCheck:
        options.expectedOrderTotalMinor == null
          ? null
          : {
              orderTotalTaxIncl: formatMinor(
                options.expectedOrderTotalMinor + (options.shopTimbreMinor ?? 0),
                invoice.currency,
              ),
              // true: the timbre was charged at checkout and is part of the order total.
              timbreChargedByShop: options.shopTimbreMinor != null,
              invoiceTotalWithoutTimbre: formatMinor(
                invoice.totalTTCCents - (invoice.timbreAmountCents ?? 0),
                invoice.currency,
              ),
              difference: formatMinor(
                invoice.totalTTCCents -
                  (invoice.timbreAmountCents ?? 0) -
                  options.expectedOrderTotalMinor,
                invoice.currency,
              ),
            },
      pdf: {
        filename,
        contentType: "application/pdf",
        sizeBytes: pdf.byteLength,
        sha256: pdfSha256,
        base64: Buffer.from(pdf).toString("base64"),
      },
    },
    { status: options.status, headers: commonHeaders },
  );
}

// ---------------------------------------------------------------------------
// Shared transport + authentication pipeline (POST generate, GET download)
// ---------------------------------------------------------------------------

export type RequestLog = (level: "info" | "warn" | "error", event: string, fields?: LogFields) => void;

type AuthResult =
  | { response: Response }
  | {
      config: PrestashopIntegrationConfig;
      verification: Extract<ReturnType<typeof verifyRequestSignature>, { ok: true }>;
      rawBody: Uint8Array;
    };

async function authenticateRequest(
  request: Request,
  deps: PrestashopInvoiceDeps,
  context: { requestId: string; log: RequestLog; logContext: LogFields; kind: "generate" | "download" },
): Promise<AuthResult> {
  const { requestId, log, logContext } = context;
  const fail = (response: Response) => ({ response });

  const configResult = deps.loadConfig();
  if (!configResult.ok) {
    log("error", "misconfigured", { reason: configResult.reason });
    return fail(errorResponse(requestId, 503, "SERVICE_UNAVAILABLE", "Service indisponible."));
  }
  const config = configResult.config;

  if (config.requireHttps && !isHttps(request)) {
    log("warn", "https_required");
    return fail(errorResponse(requestId, 403, "HTTPS_REQUIRED", "HTTPS est obligatoire."));
  }

  const clientIp = getTrustedClientIp(request.headers);
  if (config.allowedIps && !config.allowedIps.has(clientIp)) {
    log("warn", "ip_not_allowed", { ip: clientIp });
    return fail(errorResponse(requestId, 403, "FORBIDDEN", "Accès refusé."));
  }

  try {
    enforceRateLimit({
      key: `prestashop-invoices:ip:${clientIp}`,
      limit: PRE_AUTH_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof PublicRequestSecurityError && error.statusCode === 429) {
      log("warn", "rate_limited_ip", { ip: clientIp });
      return fail(
        errorResponse(requestId, 429, "RATE_LIMITED", "Trop de requêtes.", {
          headers: { "Retry-After": String(error.retryAfterSeconds ?? 60) },
        }),
      );
    }
    throw error;
  }

  if (context.kind === "generate") {
    const contentType = request.headers.get("content-type") ?? "";
    if (!/^application\/json\s*(;|$)/i.test(contentType)) {
      return fail(
        errorResponse(requestId, 415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type application/json requis."),
      );
    }
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readBodyWithLimit(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return fail(errorResponse(requestId, 413, "PAYLOAD_TOO_LARGE", "Requête trop volumineuse."));
    }
    throw error;
  }

  const verification = verifyRequestSignature({
    headers: request.headers,
    method: request.method,
    path: new URL(request.url).pathname,
    rawBody,
    keys: config.keys,
    maxClockSkewSeconds: config.maxClockSkewSeconds,
    requireIdempotencyKey: context.kind === "generate",
  });
  if (!verification.ok) {
    // One generic answer for every failure; the precise reason is only logged.
    log("warn", "auth_failed", { reason: verification.reason, ip: clientIp });
    return fail(errorResponse(requestId, 401, "UNAUTHORIZED", "Authentification invalide."));
  }
  logContext.keyId = verification.keyId;

  try {
    // Replay protection + distributed per-key rate limit.
    const fresh = await deps.store.registerNonce(
      verification.keyId,
      verification.nonce,
      config.maxClockSkewSeconds * 2 + 60,
    );
    if (!fresh) {
      log("warn", "auth_failed", { reason: "nonce_replayed", ip: clientIp });
      return fail(errorResponse(requestId, 401, "UNAUTHORIZED", "Authentification invalide."));
    }
    if (deps.random() < NONCE_PURGE_PROBABILITY) {
      deps.store.purgeExpiredNonces().catch((error) =>
        log("warn", "nonce_purge_failed", { error: safeErrorName(error) }),
      );
    }
    const recent = await deps.store.countRecentRequests(verification.keyId, 60);
    if (recent > config.rateLimitPerMinute) {
      log("warn", "rate_limited_key", { recent });
      return fail(
        errorResponse(requestId, 429, "RATE_LIMITED", "Trop de requêtes.", {
          headers: { "Retry-After": "60" },
        }),
      );
    }
  } catch (error) {
    log("error", "unexpected_error", { error: safeErrorName(error) });
    return fail(errorResponse(requestId, 500, "INTERNAL_ERROR", "Erreur interne."));
  }

  return { config, verification, rawBody };
}

export type InvoiceCoreError = {
  kind: "error";
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  headers?: Record<string, string>;
};

export type InvoiceCoreSuccess = {
  kind: "ok";
  invoiceId: string;
  outcome: "created" | "existing";
  payment: { recorded: boolean } | null;
  /** Order total excluding a shop-charged timbre. */
  expectedOrderTotalMinor: number;
  shopTimbreMinor: number | null;
};

/**
 * Everything that can refuse an order before anything is created: amounts,
 * VAT rate, timbre and recomputed totals. Side-effect free. Digital orders run
 * it before reserving activation codes, so that an order that can never be
 * invoiced never holds stock.
 */
export async function validatePrestashopInvoice(params: {
  deps: PrestashopInvoiceDeps;
  config: PrestashopIntegrationConfig;
  payload: PrestashopOrderPayload;
  log: RequestLog;
}): Promise<{ kind: "ok"; mapped: MappedPrestashopOrder } | InvoiceCoreError> {
  const { deps, config, payload, log } = params;
  const fail = (
    status: number,
    code: ErrorCode,
    message: string,
    extra?: { details?: unknown; headers?: Record<string, string> },
  ): InvoiceCoreError => ({ kind: "error", status, code, message, ...extra });

  let mapped;
  try {
    mapped = mapPrestashopOrder(payload, config);
  } catch (error) {
    if (error instanceof PayloadConsistencyError) {
      log("info", "validation_failed", { issues: error.issues.length });
      return fail(422, "VALIDATION_FAILED", error.message, {
        details: error.issues,
      });
    }
    throw error;
  }

  const tenantUserId = config.tenantUserId;
  if (!(await deps.store.tenantExists(tenantUserId))) {
    log("error", "misconfigured", { reason: "tenant_not_found" });
    return fail(503, "SERVICE_UNAVAILABLE", "Service indisponible.");
  }

  // --- VAT rate chosen in PrestaShop must be one configured in invoice-app --
  if (mapped.vatRateOverride != null) {
    const { vatRates } = await deps.getTaxRules(tenantUserId);
    if (!vatRates.some((rate) => Math.abs(rate - mapped.vatRateOverride!) < 0.0005)) {
      log("info", "vat_rate_not_allowed", { vatRate: mapped.vatRateOverride });
      return fail(
        422,
        "VAT_RATE_NOT_ALLOWED",
        "Ce taux de TVA n'est pas configuré dans invoice-app.",
        {
          details: [
            {
              path: "invoiceOptions.vatRate",
              message: `Taux autorisés : ${vatRates.map((rate) => `${rate} %`).join(", ") || "aucun"}`,
            } satisfies ValidationIssue,
          ],
        },
      );
    }
  }

  // --- Totals cross-check (before consuming an invoice number) ------------
  let preview;
  try {
    preview = await deps.previewTotals(tenantUserId, {
      ...mapped.invoice,
      clientId: "pending",
    } as InvoiceInput);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(422, "VALIDATION_FAILED", "Données de commande invalides.", {
        details: formatZodIssues(error),
      });
    }
    throw error;
  }
  // A timbre charged at checkout must be exactly the tenant's configured timbre.
  if (mapped.shopTimbreMinor != null && preview.timbreAmountCents !== mapped.shopTimbreMinor) {
    const currency = payload.order.currency;
    log("info", "timbre_mismatch", { shop: mapped.shopTimbreMinor, tenant: preview.timbreAmountCents });
    return fail(
      422,
      "TIMBRE_MISMATCH",
      "Le timbre fiscal facturé par la boutique ne correspond pas à celui configuré dans invoice-app.",
      {
        details: [
          {
            path: "timbreFiscal.amount",
            message: `Boutique ${formatMinor(mapped.shopTimbreMinor, currency)}, invoice-app ${
              preview.timbreAmountCents > 0 ? formatMinor(preview.timbreAmountCents, currency) : "désactivé"
            }`,
          } satisfies ValidationIssue,
        ],
      },
    );
  }
  const computedOrderTotal = preview.totals.totalTTCCents - preview.timbreAmountCents;
  if (computedOrderTotal !== mapped.expectedTotalTTCMinor) {
    // Within tolerance (checked below) but not exact: reported in the response.
    log("info", "totals_rounding_difference", {
      expected: mapped.expectedTotalTTCMinor,
      computed: computedOrderTotal,
    });
  }
  if (Math.abs(computedOrderTotal - mapped.expectedTotalTTCMinor) > mapped.toleranceMinor) {
    const currency = payload.order.currency;
    log("warn", "totals_mismatch", {
      expected: mapped.expectedTotalTTCMinor,
      computed: computedOrderTotal,
    });
    return fail(
      422,
      "TOTALS_MISMATCH",
      "Le total recalculé ne correspond pas au total de la commande.",
      {
        details: [
          {
            path: "totals.totalTaxIncl",
            message: `Attendu ${formatMinor(mapped.expectedTotalTTCMinor, currency)}, calculé ${formatMinor(computedOrderTotal, currency)}`,
          } satisfies ValidationIssue,
        ],
      },
    );
  }

  return { kind: "ok", mapped };
}

/**
 * Validated order payload -> invoice (created once per shop order, idempotent).
 * Shared by the invoice API and the digital-order fulfilment endpoint. Never
 * throws for expected failures; returns an error descriptor instead.
 */
export async function processPrestashopInvoice(params: {
  deps: PrestashopInvoiceDeps;
  config: PrestashopIntegrationConfig;
  payload: PrestashopOrderPayload;
  idempotencyKey: string;
  log: RequestLog;
}): Promise<InvoiceCoreSuccess | InvoiceCoreError> {
  const { deps, config, payload, idempotencyKey, log } = params;
  const fail = (
    status: number,
    code: ErrorCode,
    message: string,
    extra?: { details?: unknown; headers?: Record<string, string> },
  ): InvoiceCoreError => ({ kind: "error", status, code, message, ...extra });
  let claimedRequestId: string | null = null;
  let invoiceCreated = false;
  try {
    const validated = await validatePrestashopInvoice({ deps, config, payload, log });
    if (validated.kind === "error") return validated;
    const { mapped } = validated;
    const tenantUserId = config.tenantUserId;

    // --- Idempotency ---------------------------------------------------------
    const claim = await deps.store.claimRequest({
      tenantUserId,
      shopId: String(payload.shop.id),
      externalOrderId: String(payload.order.id),
      externalOrderReference: payload.order.reference,
      idempotencyKey: idempotencyKey,
      payloadHash: sha256Hex(canonicalPayloadJson(payload)),
    });

    switch (claim.kind) {
      case "idempotency_key_reused":
        log("warn", "idempotency_key_reused");
        return fail(
          422,
          "IDEMPOTENCY_KEY_REUSED",
          "Cette clé d'idempotence a déjà été utilisée avec une autre requête.",
        );
      case "order_already_invoiced": {
        const existing = await deps.getInvoice(tenantUserId, claim.invoiceId);
        log("info", "order_already_invoiced", { invoiceId: claim.invoiceId });
        return fail(
          409,
          "ORDER_ALREADY_INVOICED",
          "Une facture existe déjà pour cette commande avec des données différentes.",
          { details: existing ? { invoiceId: existing.id, invoiceNumber: existing.number } : undefined },
        );
      }
      case "in_progress":
        return fail(
          409,
          "REQUEST_IN_PROGRESS",
          "La facture de cette commande est en cours de génération.",
          { headers: { "Retry-After": "5" } },
        );
      default:
        break;
    }

    let invoiceId: string;
    let outcome: "created" | "existing";
    let paymentResult: { recorded: boolean } | null = null;

    if (claim.kind === "completed") {
      invoiceId = claim.invoiceId;
      outcome = "existing";
    } else {
      claimedRequestId = claim.requestId;
      const orphan = claim.reclaimed
        ? await deps.store.findOrphanInvoice(tenantUserId, payload.order.reference, claim.claimedSince)
        : null;
      if (orphan) {
        invoiceId = orphan;
        outcome = "existing";
        invoiceCreated = true;
        await deps.store.markCompleted(claim.requestId, invoiceId);
        log("warn", "orphan_invoice_recovered", { invoiceId });
      } else {
        try {
          const client = await deps.resolveClient(mapped.contact, tenantUserId, mapped.clientMetadata);
          const created = await deps.createInvoice(tenantUserId, {
            ...mapped.invoice,
            clientId: client.id,
          } as InvoiceInput);
          invoiceId = created.id;
          invoiceCreated = true;
        } catch (error) {
          log("error", "invoice_generation_failed", { error: safeErrorName(error) });
          await deps.store.markFailed(claim.requestId, "INVOICE_GENERATION_FAILED").catch(() => {});
          claimedRequestId = null;
          return fail(
            500,
            "INVOICE_GENERATION_FAILED",
            "La facture n'a pas pu être générée. Réessayez plus tard.",
          );
        }
        // Mark completed immediately: from now on any retry replays this invoice.
        await deps.store.markCompleted(claim.requestId, invoiceId);
        outcome = "created";

        if (mapped.payment) {
          try {
            const invoice = await deps.getInvoice(tenantUserId, invoiceId);
            // A fully paid order settles the whole invoice, timbre fiscal included,
            // so the invoice is marked PAYEE. A partly paid order records what was paid.
            const invoiceTotal = invoice?.totalTTCCents ?? 0;
            const orderFullyPaid =
              mapped.payment.amountMinor >= mapped.expectedTotalTTCMinor - mapped.toleranceMinor;
            const amount = orderFullyPaid
              ? invoiceTotal
              : Math.min(mapped.payment.amountMinor, invoiceTotal);
            if (amount > 0) {
              await deps.recordPayment(tenantUserId, {
                invoiceId,
                amountCents: amount,
                method: mapped.payment.method,
                date: mapped.payment.date,
                note: mapped.payment.note,
              });
            }
            paymentResult = { recorded: amount > 0 };
          } catch (error) {
            // The invoice is valid without the payment; it can be recorded manually.
            log("warn", "payment_record_failed", { invoiceId, error: safeErrorName(error) });
            paymentResult = { recorded: false };
          }
        }
        log("info", "invoice_created", { invoiceId });
      }
      try {
        deps.onInvoiceChanged(tenantUserId, invoiceId);
      } catch (error) {
        log("warn", "cache_revalidation_failed", { error: safeErrorName(error) });
      }
    }

    return {
      kind: "ok",
      invoiceId,
      outcome,
      payment: paymentResult,
      expectedOrderTotalMinor: mapped.expectedTotalTTCMinor,
      shopTimbreMinor: mapped.shopTimbreMinor ?? null,
    };
  } catch (error) {
    log("error", "unexpected_error", { error: safeErrorName(error) });
    if (claimedRequestId && !invoiceCreated) {
      await deps.store.markFailed(claimedRequestId, "INTERNAL_ERROR").catch(() => {});
    }
    return fail(500, "INTERNAL_ERROR", "Erreur interne.");
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handlePrestashopInvoiceRequest(
  request: Request,
  overrides: Partial<PrestashopInvoiceDeps> = {},
): Promise<Response> {
  const deps: PrestashopInvoiceDeps = { ...defaultPrestashopInvoiceDeps, ...overrides };
  const requestId = randomUUID();
  const startedAt = Date.now();
  const logContext: LogFields = { requestId };
  const log = (level: "info" | "warn" | "error", event: string, fields: LogFields = {}) =>
    deps.log(level, event, { ...logContext, ...fields, durationMs: Date.now() - startedAt });

  const auth = await authenticateRequest(request, deps, { requestId, log, logContext, kind: "generate" });
  if ("response" in auth) return auth.response;
  const { config, verification, rawBody } = auth;

  try {
    // --- Payload validation ----------------------------------------------
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    } catch {
      return errorResponse(requestId, 400, "INVALID_JSON", "Corps JSON invalide.");
    }
    const parsed = prestashopOrderPayloadSchema.safeParse(json);
    if (!parsed.success) {
      log("info", "validation_failed", { issues: parsed.error.issues.length });
      return errorResponse(requestId, 422, "VALIDATION_FAILED", "Données de commande invalides.", {
        details: formatZodIssues(parsed.error),
      });
    }
    const payload = parsed.data;
    logContext.shopId = payload.shop.id;
    logContext.orderId = payload.order.id;
    if (config.allowedShopIds && !config.allowedShopIds.has(String(payload.shop.id))) {
      log("warn", "shop_not_allowed");
      return errorResponse(requestId, 403, "SHOP_NOT_ALLOWED", "Boutique non autorisée.");
    }

    const core = await processPrestashopInvoice({
      deps,
      config,
      payload,
      idempotencyKey: verification.idempotencyKey,
      log,
    });
    if (core.kind === "error") {
      return errorResponse(requestId, core.status, core.code, core.message, {
        details: core.details,
        headers: core.headers,
      });
    }
    const { invoiceId, outcome, payment: paymentResult } = core;
    const tenantUserId = config.tenantUserId;

    const invoice = await deps.getInvoice(tenantUserId, invoiceId);
    if (!invoice) {
      throw new Error("Invoice disappeared after creation");
    }

    let pdf: Uint8Array;
    try {
      pdf = await deps.renderPdf(tenantUserId, invoiceId);
    } catch (error) {
      log("error", "pdf_generation_failed", { invoiceId, error: safeErrorName(error) });
      return errorResponse(
        requestId,
        500,
        "PDF_GENERATION_FAILED",
        "La facture a été créée mais le PDF n'a pas pu être généré. Réessayez avec la même clé d'idempotence.",
        { details: { invoiceId: invoice.id, invoiceNumber: invoice.number } },
      );
    }

    log("info", "request_completed", { invoiceId, outcome });
    return successResponse({
      request,
      requestId,
      status: outcome === "created" ? 201 : 200,
      outcome,
      invoice,
      orderId: payload.order.id,
      pdf,
      payment: paymentResult,
      expectedOrderTotalMinor: core.expectedOrderTotalMinor,
      shopTimbreMinor: core.shopTimbreMinor,
    });
  } catch (error) {
    log("error", "unexpected_error", { error: safeErrorName(error) });
    return errorResponse(requestId, 500, "INTERNAL_ERROR", "Erreur interne.");
  }
}

// ---------------------------------------------------------------------------
// Download handler: re-renders an already generated invoice
// ---------------------------------------------------------------------------

const ID_SEGMENT = /^[1-9][0-9]{0,17}$/;

/**
 * GET /api/integrations/prestashop/invoices/{shopId}/{orderId}
 *
 * Never creates anything and never consumes a number. The PDF is rendered on
 * every call from the stored invoice and the CURRENT company settings
 * (Paramètres généraux), so the shop should download through this endpoint
 * instead of keeping its own copy of the PDF.
 */
export async function handlePrestashopInvoiceDownload(
  request: Request,
  params: { shopId: string; orderId: string },
  overrides: Partial<PrestashopInvoiceDeps> = {},
): Promise<Response> {
  const deps: PrestashopInvoiceDeps = { ...defaultPrestashopInvoiceDeps, ...overrides };
  const requestId = randomUUID();
  const startedAt = Date.now();
  const logContext: LogFields = { requestId, operation: "download" };
  const log: RequestLog = (level, event, fields = {}) =>
    deps.log(level, event, { ...logContext, ...fields, durationMs: Date.now() - startedAt });

  const auth = await authenticateRequest(request, deps, { requestId, log, logContext, kind: "download" });
  if ("response" in auth) return auth.response;
  if (auth.rawBody.byteLength > 0) {
    return errorResponse(requestId, 400, "VALIDATION_FAILED", "Une requête GET ne doit pas avoir de corps.");
  }
  if (
    !ID_SEGMENT.test(params.shopId) ||
    !ID_SEGMENT.test(params.orderId) ||
    (auth.config.allowedShopIds && !auth.config.allowedShopIds.has(params.shopId))
  ) {
    return errorResponse(requestId, 404, "INVOICE_NOT_FOUND", "Aucune facture pour cette commande.");
  }
  logContext.shopId = params.shopId;
  logContext.orderId = params.orderId;
  const tenantUserId = auth.config.tenantUserId;

  try {
    const invoiceId = await deps.store.findInvoiceForOrder(tenantUserId, params.shopId, params.orderId);
    const invoice = invoiceId ? await deps.getInvoice(tenantUserId, invoiceId) : null;
    if (!invoice) {
      log("info", "invoice_not_found");
      return errorResponse(requestId, 404, "INVOICE_NOT_FOUND", "Aucune facture pour cette commande.");
    }

    let pdf: Uint8Array;
    try {
      pdf = await deps.renderPdf(tenantUserId, invoice.id);
    } catch (error) {
      log("error", "pdf_generation_failed", { invoiceId: invoice.id, error: safeErrorName(error) });
      return errorResponse(
        requestId,
        500,
        "PDF_GENERATION_FAILED",
        "Le PDF n'a pas pu être généré. Réessayez plus tard.",
        { details: { invoiceId: invoice.id, invoiceNumber: invoice.number } },
      );
    }

    log("info", "invoice_downloaded", { invoiceId: invoice.id });
    return successResponse({
      request,
      requestId,
      status: 200,
      outcome: "existing",
      invoice,
      orderId: Number(params.orderId),
      pdf,
      payment: null,
    });
  } catch (error) {
    log("error", "unexpected_error", { error: safeErrorName(error) });
    return errorResponse(requestId, 500, "INTERNAL_ERROR", "Erreur interne.");
  }
}
