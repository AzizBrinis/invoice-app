import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Request signing scheme shared with the PrestaShop module ("v1").
 *
 * canonical = "PSINV1\n" + METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n"
 *           + NONCE + "\n" + IDEMPOTENCY_KEY + "\n" + hex(sha256(raw body))
 * signature = "v1=" + hex(hmac_sha256(secret, canonical))
 */

export const SIGNATURE_SCHEME = "PSINV1";

export const HEADER_KEY_ID = "x-signature-key-id";
export const HEADER_TIMESTAMP = "x-signature-timestamp";
export const HEADER_NONCE = "x-signature-nonce";
export const HEADER_SIGNATURE = "x-signature";
export const HEADER_IDEMPOTENCY_KEY = "idempotency-key";

export const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const TIMESTAMP_PATTERN = /^\d{9,11}$/;
const SIGNATURE_PATTERN = /^v1=([0-9a-f]{64})$/;

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export type CanonicalRequest = {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  idempotencyKey: string;
  bodySha256Hex: string;
  /** Signing scheme label (first canonical line). Defaults to "PSINV1". */
  scheme?: string;
};

export function buildCanonicalString(request: CanonicalRequest): string {
  return [
    request.scheme ?? SIGNATURE_SCHEME,
    request.method.toUpperCase(),
    request.path,
    request.timestamp,
    request.nonce,
    request.idempotencyKey,
    request.bodySha256Hex,
  ].join("\n");
}

export function computeSignature(secret: Buffer | string, request: CanonicalRequest): string {
  const digest = createHmac("sha256", secret)
    .update(buildCanonicalString(request))
    .digest("hex");
  return `v1=${digest}`;
}

export type SignatureFailureReason =
  | "missing_headers"
  | "malformed_headers"
  | "unknown_key"
  | "timestamp_out_of_window"
  | "bad_signature";

export type SignatureVerification =
  | { ok: true; keyId: string; nonce: string; timestamp: number; idempotencyKey: string }
  | { ok: false; reason: SignatureFailureReason };

type HeadersLike = { get(name: string): string | null };

export function verifyRequestSignature(options: {
  headers: HeadersLike;
  method: string;
  path: string;
  rawBody: Uint8Array;
  keys: Map<string, Buffer>;
  maxClockSkewSeconds: number;
  nowMs?: number;
  /** Read-only requests (GET) may omit Idempotency-Key; it is then signed as "". */
  requireIdempotencyKey?: boolean;
  /** Canonical scheme label; other integrations use their own (e.g. "DPLIC1"). */
  scheme?: string;
}): SignatureVerification {
  const { headers } = options;
  const keyId = headers.get(HEADER_KEY_ID)?.trim();
  const timestamp = headers.get(HEADER_TIMESTAMP)?.trim();
  const nonce = headers.get(HEADER_NONCE)?.trim();
  const signature = headers.get(HEADER_SIGNATURE)?.trim().toLowerCase();
  const idempotencyKey = headers.get(HEADER_IDEMPOTENCY_KEY)?.trim() ?? "";
  const requireIdempotencyKey = options.requireIdempotencyKey ?? true;

  if (!keyId || !timestamp || !nonce || !signature || (requireIdempotencyKey && !idempotencyKey)) {
    return { ok: false, reason: "missing_headers" };
  }
  const signatureMatch = SIGNATURE_PATTERN.exec(signature);
  if (
    !TIMESTAMP_PATTERN.test(timestamp) ||
    !NONCE_PATTERN.test(nonce) ||
    (idempotencyKey !== "" && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) ||
    !signatureMatch
  ) {
    return { ok: false, reason: "malformed_headers" };
  }

  const secret = options.keys.get(keyId);
  if (!secret) {
    return { ok: false, reason: "unknown_key" };
  }

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > options.maxClockSkewSeconds) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  const expected = computeSignature(secret, {
    method: options.method,
    path: options.path,
    timestamp,
    nonce,
    idempotencyKey,
    bodySha256Hex: sha256Hex(options.rawBody),
    scheme: options.scheme,
  });
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(`v1=${signatureMatch[1]}`, "utf8");
  if (
    expectedBytes.length !== suppliedBytes.length ||
    !timingSafeEqual(expectedBytes, suppliedBytes)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  return { ok: true, keyId, nonce, timestamp: timestampSeconds, idempotencyKey };
}
