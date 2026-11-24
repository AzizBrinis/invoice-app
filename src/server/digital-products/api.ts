import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  enforceRateLimit,
  PublicRequestSecurityError,
} from "@/lib/security/public-request";
import { MAX_LICENCE_QUANTITY } from "@/lib/digital-products/kaspersky-catalog";
import {
  codeFormatForSku,
  DIGITAL_PRODUCT_SKUS,
  getDigitalProductVariant,
} from "@/lib/digital-products/catalog";
import { maskLicenceCode } from "@/lib/digital-products/licence-code-format";
import {
  LICENCE_API_SIGNATURE_SCHEME,
  loadLicenceApiConfig,
  type LicenceApiConfig,
  type LicenceApiConfigResult,
} from "@/server/digital-products/api-config";
import {
  LicenceOrderStateError,
  LicenceValidationError,
  parseLicenceRequest,
  renderLicenceOrderPdf,
  requestLicenceDocument,
} from "@/server/digital-products/licences";
import { LicenceEncryptionConfigError } from "@/server/digital-products/licence-crypto";
import {
  findLicenceOrderByKey,
  getOrderCodeHints,
  InsufficientLicenceStockError,
  type CreateLicenceOrderResult,
  type LicenceOrderRecord,
} from "@/server/digital-products/store";
import {
  BodyTooLargeError,
  getTrustedClientIp,
  isHttps,
  readBodyWithLimit,
  safeErrorName,
} from "@/server/integrations/prestashop/service";
import { sha256Hex, verifyRequestSignature } from "@/server/integrations/prestashop/signature";
import { postgresPrestashopInvoiceStore } from "@/server/integrations/prestashop/store";

/**
 * Signed, server-to-server licence API.
 *
 *   POST /api/integrations/digital-products/licences
 *
 * Allocates `quantity` codes of one variant atomically and returns the licence
 * PDF. Idempotent per `Idempotency-Key`: retries return the same licence (same
 * codes), so a code is never issued twice. Responses never contain codes in
 * clear outside the PDF itself; unused stock is never exposed.
 */

const MAX_BODY_BYTES = 32 * 1024;
const PRE_AUTH_LIMIT_PER_MINUTE = 120;
const NONCE_PURGE_PROBABILITY = 0.02;
/** Nonces share the integration nonce table; namespacing avoids key-id clashes. */
const NONCE_NAMESPACE = "dplic:";

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type LicenceApiDeps = {
  loadConfig: () => LicenceApiConfigResult;
  nonces: {
    registerNonce(keyId: string, nonce: string, ttlSeconds: number): Promise<boolean>;
    countRecentRequests(keyId: string, windowSeconds: number): Promise<number>;
    purgeExpiredNonces(): Promise<void>;
  };
  requestLicence: typeof requestLicenceDocument;
  renderPdf: typeof renderLicenceOrderPdf;
  getCodeHints: (tenantId: string, orderId: string) => Promise<{ codeHint: string }[]>;
  findLicence: (tenantId: string, idempotencyKey: string) => Promise<LicenceOrderRecord | null>;
  log: (level: "info" | "warn" | "error", event: string, fields: LogFields) => void;
  random: () => number;
};

const defaultDeps: LicenceApiDeps = {
  loadConfig: () => loadLicenceApiConfig(),
  nonces: postgresPrestashopInvoiceStore,
  requestLicence: requestLicenceDocument,
  renderPdf: renderLicenceOrderPdf,
  getCodeHints: getOrderCodeHints,
  findLicence: findLicenceOrderByKey,
  log: (level, event, fields) => console[level]("[digital-licence-api]", { event, ...fields }),
  random: Math.random,
};

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

const externalId = z.union([z.string().trim().min(1).max(64), z.number().int().nonnegative()])
  .transform((value) => String(value));

export const licenceApiPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    sku: z.enum(DIGITAL_PRODUCT_SKUS),
    quantity: z.number().int().min(1).max(MAX_LICENCE_QUANTITY),
    customer: z
      .object({
        name: z.string().max(120).optional().nullable(),
        email: z.string().max(254).optional().nullable(),
      })
      .strict()
      .optional()
      .nullable(),
    order: z
      .object({
        reference: z.string().max(64).optional().nullable(),
        /** Future: "prestashop". With id + lineId, guarantees one licence per order line. */
        source: z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/).optional().nullable(),
        id: externalId.optional().nullable(),
        lineId: externalId.optional().nullable(),
      })
      .strict()
      .optional()
      .nullable(),
    activationRegion: z.string().max(60).optional().nullable(),
    useBefore: z.string().optional().nullable(),
  })
  .strict();

export type LicenceApiPayload = z.infer<typeof licenceApiPayloadSchema>;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export type LicenceApiErrorCode =
  | "HTTPS_REQUIRED"
  | "SERVICE_UNAVAILABLE"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_JSON"
  | "VALIDATION_FAILED"
  | "INSUFFICIENT_STOCK"
  | "IDEMPOTENCY_KEY_REUSED"
  | "ORDER_LINE_ALREADY_FULFILLED"
  | "LICENCE_CANCELLED"
  | "LICENCE_NOT_DELIVERED"
  | "ALLOCATION_DISABLED"
  | "PDF_GENERATION_FAILED"
  | "INTERNAL_ERROR";

const RETRYABLE: ReadonlySet<LicenceApiErrorCode> = new Set([
  "SERVICE_UNAVAILABLE",
  "RATE_LIMITED",
  "PDF_GENERATION_FAILED",
  "INTERNAL_ERROR",
]);

export function baseHeaders(requestId: string): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
  };
}

export function errorResponse(
  requestId: string,
  status: number,
  code: LicenceApiErrorCode,
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

function wantsBinaryPdf(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return /application\/pdf/i.test(accept) && !/application\/json/i.test(accept);
}

function licenceSummary(order: LicenceOrderRecord, hints: { codeHint: string }[]) {
  const variant = getDigitalProductVariant(order.productSku);
  const format = codeFormatForSku(order.productSku);
  return {
    id: order.id,
    number: order.number,
    sku: order.productSku,
    product: variant?.label ?? order.productSku,
    devices: variant?.devices ?? null,
    quantity: order.quantity,
    status: order.status,
    orderReference: order.orderReference,
    createdAt: order.createdAt.toISOString(),
    generatedAt: order.generatedAt ? order.generatedAt.toISOString() : null,
    // Masked only: the PDF is the single place where codes appear in clear.
    codes: hints.map((hint) => maskLicenceCode(hint.codeHint, format)),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export type LicenceAuthSuccess = {
  config: LicenceApiConfig;
  verification: Extract<ReturnType<typeof verifyRequestSignature>, { ok: true }>;
  rawBody: Uint8Array;
};

/**
 * Transport + authentication shared by every DPLIC1-signed endpoint (licence
 * API, digital-order fulfilment): HTTPS, IP allowlist, pre-auth rate limit,
 * JSON content type, body size, HMAC signature, nonce replay, per-key limit.
 */
export async function authenticateLicenceApiRequest(
  request: Request,
  deps: Pick<LicenceApiDeps, "loadConfig" | "nonces" | "random">,
  context: {
    requestId: string;
    log: (level: "info" | "warn" | "error", event: string, fields?: LogFields) => void;
    logContext: LogFields;
    maxBodyBytes?: number;
    /** Separate per-key rate limit (shop page views must not starve order deliveries). */
    rateBucket?: string;
  },
): Promise<{ response: Response } | LicenceAuthSuccess> {
  const { requestId, log } = context;
  const fail = (response: Response) => ({ response });
  const configResult = deps.loadConfig();
  if (!configResult.ok) {
    log("error", "misconfigured", { reason: configResult.reason });
    return fail(errorResponse(requestId, 503, "SERVICE_UNAVAILABLE", "Service indisponible."));
  }
  const config = configResult.config;

  if (config.requireHttps && !isHttps(request)) {
    return fail(errorResponse(requestId, 403, "HTTPS_REQUIRED", "HTTPS est obligatoire."));
  }
  const clientIp = getTrustedClientIp(request.headers);
  if (config.allowedIps && !config.allowedIps.has(clientIp)) {
    log("warn", "ip_not_allowed", { ip: clientIp });
    return fail(errorResponse(requestId, 403, "FORBIDDEN", "Accès refusé."));
  }
  try {
    enforceRateLimit({
      key: `digital-licences:ip:${clientIp}`,
      limit: PRE_AUTH_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof PublicRequestSecurityError && error.statusCode === 429) {
      log("warn", "rate_limited_ip", { ip: clientIp });
      return fail(errorResponse(requestId, 429, "RATE_LIMITED", "Trop de requêtes.", {
        headers: { "Retry-After": String(error.retryAfterSeconds ?? 60) },
      }));
    }
    throw error;
  }

  if (!/^application\/json\s*(;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return fail(errorResponse(requestId, 415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type application/json requis."));
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readBodyWithLimit(request, context.maxBodyBytes ?? MAX_BODY_BYTES);
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
    requireIdempotencyKey: true,
    scheme: LICENCE_API_SIGNATURE_SCHEME,
  });
  if (!verification.ok) {
    log("warn", "auth_failed", { reason: verification.reason, ip: clientIp });
    return fail(errorResponse(requestId, 401, "UNAUTHORIZED", "Authentification invalide."));
  }
  context.logContext.keyId = verification.keyId;
  const nonceKey = `${NONCE_NAMESPACE}${context.rateBucket ? `${context.rateBucket}:` : ""}${verification.keyId}`;

  try {
    const fresh = await deps.nonces.registerNonce(
      nonceKey,
      verification.nonce,
      config.maxClockSkewSeconds * 2 + 60,
    );
    if (!fresh) {
      log("warn", "auth_failed", { reason: "nonce_replayed", ip: clientIp });
      return fail(errorResponse(requestId, 401, "UNAUTHORIZED", "Authentification invalide."));
    }
    if (deps.random() < NONCE_PURGE_PROBABILITY) {
      deps.nonces.purgeExpiredNonces().catch(() => undefined);
    }
    const recent = await deps.nonces.countRecentRequests(nonceKey, 60);
    if (recent > config.rateLimitPerMinute) {
      log("warn", "rate_limited_key", { recent, ip: clientIp });
      return fail(errorResponse(requestId, 429, "RATE_LIMITED", "Trop de requêtes.", {
        headers: { "Retry-After": "60" },
      }));
    }
  } catch (error) {
    log("error", "unexpected_error", { error: safeErrorName(error) });
    return fail(errorResponse(requestId, 500, "INTERNAL_ERROR", "Erreur interne."));
  }


  return { config, verification, rawBody };
}

export async function handleLicenceApiRequest(
  request: Request,
  overrides: Partial<LicenceApiDeps> = {},
): Promise<Response> {
  const deps: LicenceApiDeps = { ...defaultDeps, ...overrides };
  const requestId = randomUUID();
  const startedAt = Date.now();
  const logContext: LogFields = { requestId };
  const log = (level: "info" | "warn" | "error", event: string, fields: LogFields = {}) =>
    deps.log(level, event, { ...logContext, ...fields, durationMs: Date.now() - startedAt });

  const auth = await authenticateLicenceApiRequest(request, deps, { requestId, log, logContext });
  if ("response" in auth) return auth.response;
  const { config, verification, rawBody } = auth;
  // --- Payload ---------------------------------------------------------------
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return errorResponse(requestId, 400, "INVALID_JSON", "Corps JSON invalide.");
  }
  const parsed = licenceApiPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(requestId, 422, "VALIDATION_FAILED", "Données invalides.", {
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  const payload = parsed.data;

  let licenceRequest;
  try {
    licenceRequest = parseLicenceRequest({
      sku: payload.sku,
      quantity: payload.quantity,
      customerName: payload.customer?.name ?? null,
      customerEmail: payload.customer?.email || null,
      orderReference: payload.order?.reference ?? null,
      activationRegion: payload.activationRegion ?? null,
      useBefore: payload.useBefore || null,
    });
  } catch (error) {
    if (error instanceof LicenceValidationError) {
      return errorResponse(requestId, 422, "VALIDATION_FAILED", "Données invalides.", {
        details: error.issues,
      });
    }
    throw error;
  }

  const external =
    payload.order?.source && payload.order.id && payload.order.lineId
      ? { source: payload.order.source, orderId: payload.order.id, lineId: payload.order.lineId }
      : null;
  logContext.sku = licenceRequest.sku;
  logContext.quantity = licenceRequest.quantity;

  // --- Allocation (atomic, idempotent) --------------------------------------
  let allocation: CreateLicenceOrderResult;
  try {
    if (!config.allowAllocation) {
      // Replay only: the licence must exist and its codes must already be out
      // (never those of an order still waiting for its review).
      const known = await deps.findLicence(config.tenantUserId, `api:${verification.idempotencyKey}`);
      if (!known) {
        log("warn", "allocation_refused");
        return errorResponse(requestId, 403, "ALLOCATION_DISABLED", "Création de licence refusée : utilisez la commande numérique.");
      }
      if (known.status === "PENDING") {
        log("warn", "licence_not_delivered", { licenceId: known.id });
        return errorResponse(requestId, 409, "LICENCE_NOT_DELIVERED", "Cette licence n’est pas encore délivrée.");
      }
    }
    allocation = await deps.requestLicence({
      tenantId: config.tenantUserId,
      request: licenceRequest,
      idempotencyKey: `api:${verification.idempotencyKey}`,
      source: external?.source === "prestashop" ? "PRESTASHOP" : "API",
      actor: `api:${verification.keyId}`,
      apiKeyId: verification.keyId,
      external,
    });
  } catch (error) {
    if (error instanceof InsufficientLicenceStockError) {
      log("warn", "insufficient_stock", { available: error.available });
      return errorResponse(requestId, 409, "INSUFFICIENT_STOCK", "Stock de codes insuffisant.", {
        details: { sku: error.sku, requested: error.requested, available: error.available },
      });
    }
    if (error instanceof LicenceEncryptionConfigError) {
      log("error", "misconfigured", { reason: "encryption_key" });
      return errorResponse(requestId, 503, "SERVICE_UNAVAILABLE", "Service indisponible.");
    }
    log("error", "allocation_failed", { error: safeErrorName(error) });
    return errorResponse(requestId, 500, "INTERNAL_ERROR", "Erreur interne.");
  }

  logContext.licenceId = allocation.order.id;
  if (allocation.kind === "idempotency_key_reused") {
    return errorResponse(
      requestId,
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "Cette clé d’idempotence a déjà été utilisée pour une autre demande.",
    );
  }
  if (allocation.kind === "external_line_conflict") {
    return errorResponse(
      requestId,
      409,
      "ORDER_LINE_ALREADY_FULFILLED",
      "Une licence existe déjà pour cette ligne de commande.",
      { details: { licenceNumber: allocation.order.number } },
    );
  }
  if (allocation.order.status === "CANCELLED") {
    return errorResponse(requestId, 409, "LICENCE_CANCELLED", "Cette licence a été annulée.");
  }

  // --- PDF -------------------------------------------------------------------
  let rendered;
  try {
    rendered = await deps.renderPdf({
      tenantId: config.tenantUserId,
      orderId: allocation.order.id,
      actor: `api:${verification.keyId}`,
    });
  } catch (error) {
    if (error instanceof LicenceOrderStateError) {
      return errorResponse(requestId, 409, "LICENCE_CANCELLED", error.message);
    }
    log("error", "pdf_failed", { error: safeErrorName(error) });
    // Retrying with the same Idempotency-Key re-renders the same codes.
    return errorResponse(requestId, 500, "PDF_GENERATION_FAILED", "Échec de génération du PDF.");
  }

  const hints = await deps.getCodeHints(config.tenantUserId, rendered.order.id);
  const status = allocation.kind === "created" ? 201 : 200;
  const pdfSha256 = sha256Hex(rendered.pdf);
  const headers = {
    ...baseHeaders(requestId),
    "X-Licence-Id": rendered.order.id,
    "X-Licence-Number": rendered.order.number,
    "X-Idempotent-Replay": allocation.kind === "existing" ? "true" : "false",
  };
  log("info", allocation.kind === "created" ? "licence_created" : "licence_replayed");

  if (wantsBinaryPdf(request)) {
    return new Response(new Uint8Array(rendered.pdf), {
      status,
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${rendered.filename}"`,
        "Content-Length": String(rendered.pdf.byteLength),
        "X-Content-SHA256": pdfSha256,
      },
    });
  }
  return Response.json(
    {
      status: allocation.kind === "created" ? "created" : "existing",
      requestId,
      licence: licenceSummary(rendered.order, hints),
      pdf: {
        filename: rendered.filename,
        contentType: "application/pdf",
        sizeBytes: rendered.pdf.byteLength,
        sha256: pdfSha256,
        base64: rendered.pdf.toString("base64"),
      },
    },
    { status, headers },
  );
}
