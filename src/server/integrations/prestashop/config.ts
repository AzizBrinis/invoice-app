/**
 * Runtime configuration for the PrestaShop → invoice-app integration.
 * Everything comes from environment variables; secrets never leave this module
 * except as Buffers handed to the HMAC verifier.
 */

export const MIN_SECRET_LENGTH = 32;
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;

export type PrestashopIntegrationConfig = {
  tenantUserId: string;
  /** keyId -> shared secret bytes. Several keys allow zero-downtime rotation. */
  keys: Map<string, Buffer>;
  maxClockSkewSeconds: number;
  rateLimitPerMinute: number;
  allowedIps: Set<string> | null;
  requireHttps: boolean;
  /** Accepted difference between PrestaShop's total and the computed total, in currency units. */
  totalTolerance: string;
  applyTimbre: boolean;
  recordPayments: boolean;
};

export type ConfigResult =
  | { ok: true; config: PrestashopIntegrationConfig }
  | { ok: false; reason: string };

type Env = Record<string, string | undefined>;

function readInt(
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number | string {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) return `${name} must be an integer`;
  const value = Number(raw);
  if (value < min || value > max) return `${name} must be between ${min} and ${max}`;
  return value;
}

function readBool(env: Env, name: string, fallback: boolean): boolean | string {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return `${name} must be a boolean`;
}

export function parseApiKeys(raw: string | undefined): Map<string, Buffer> | string {
  const keys = new Map<string, Buffer>();
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return "PRESTASHOP_INVOICE_API_KEYS is not set";
  for (const entry of entries) {
    const separator = entry.indexOf(":");
    if (separator <= 0) return "PRESTASHOP_INVOICE_API_KEYS entries must be keyId:secret";
    const keyId = entry.slice(0, separator).trim();
    const secret = entry.slice(separator + 1).trim();
    if (!KEY_ID_PATTERN.test(keyId)) {
      return "PRESTASHOP_INVOICE_API_KEYS contains an invalid key id";
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      return `PRESTASHOP_INVOICE_API_KEYS secret for "${keyId}" must be at least ${MIN_SECRET_LENGTH} characters`;
    }
    if (keys.has(keyId)) {
      return `PRESTASHOP_INVOICE_API_KEYS contains duplicate key id "${keyId}"`;
    }
    keys.set(keyId, Buffer.from(secret, "utf8"));
  }
  return keys;
}

export function loadPrestashopIntegrationConfig(
  env: Env = process.env,
  options: { requireKeys?: boolean } = {},
): ConfigResult {
  const tenantUserId = env.PRESTASHOP_INVOICE_TENANT_ID?.trim();
  if (!tenantUserId) {
    return { ok: false, reason: "PRESTASHOP_INVOICE_TENANT_ID is not set" };
  }

  // Callers that authenticate with other keys (digital-order fulfilment) only
  // need the invoice options, not the invoice API keys.
  const keys =
    options.requireKeys === false && !env.PRESTASHOP_INVOICE_API_KEYS?.trim()
      ? new Map<string, Buffer>()
      : parseApiKeys(env.PRESTASHOP_INVOICE_API_KEYS);
  if (typeof keys === "string") return { ok: false, reason: keys };

  const maxClockSkewSeconds = readInt(env, "PRESTASHOP_INVOICE_MAX_CLOCK_SKEW_SECONDS", 300, 30, 900);
  if (typeof maxClockSkewSeconds === "string") return { ok: false, reason: maxClockSkewSeconds };

  const rateLimitPerMinute = readInt(env, "PRESTASHOP_INVOICE_RATE_LIMIT_PER_MINUTE", 30, 1, 1000);
  if (typeof rateLimitPerMinute === "string") return { ok: false, reason: rateLimitPerMinute };

  // On by default: the timbre is then added according to the tenant's tax
  // settings (enabled flag and amount). Set to false to opt out entirely.
  const applyTimbre = readBool(env, "PRESTASHOP_INVOICE_APPLY_TIMBRE", true);
  if (typeof applyTimbre === "string") return { ok: false, reason: applyTimbre };

  const recordPayments = readBool(env, "PRESTASHOP_INVOICE_RECORD_PAYMENTS", true);
  if (typeof recordPayments === "string") return { ok: false, reason: recordPayments };

  const totalTolerance = env.PRESTASHOP_INVOICE_TOTAL_TOLERANCE?.trim() || "0.010";
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(totalTolerance)) {
    return { ok: false, reason: "PRESTASHOP_INVOICE_TOTAL_TOLERANCE must be a decimal such as 0.010" };
  }

  const ipList = (env.PRESTASHOP_INVOICE_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  return {
    ok: true,
    config: {
      tenantUserId,
      keys,
      maxClockSkewSeconds,
      rateLimitPerMinute,
      allowedIps: ipList.length > 0 ? new Set(ipList) : null,
      requireHttps: env.NODE_ENV === "production",
      totalTolerance,
      applyTimbre,
      recordPayments,
    },
  };
}
