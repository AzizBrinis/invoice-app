import { parseApiKeys } from "@/server/integrations/prestashop/config";

/**
 * Configuration of the signed licence API (POST /api/integrations/digital-products/licences).
 * Same HMAC scheme family as the PrestaShop invoice API, with its own keys and
 * scheme label ("DPLIC1") so an invoice key can never mint licences.
 */

export const LICENCE_API_SIGNATURE_SCHEME = "DPLIC1";
export const LICENCE_API_PATH = "/api/integrations/digital-products/licences";
export const LICENCE_STOCK_API_PATH = "/api/integrations/digital-products/stock";

export type LicenceApiConfig = {
  tenantUserId: string;
  keys: Map<string, Buffer>;
  maxClockSkewSeconds: number;
  rateLimitPerMinute: number;
  allowedIps: Set<string> | null;
  requireHttps: boolean;
};

export type LicenceApiConfigResult =
  | { ok: true; config: LicenceApiConfig }
  | { ok: false; reason: string };

type Env = Record<string, string | undefined>;

function readInt(env: Env, name: string, fallback: number, min: number, max: number) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) return `${name} must be an integer`;
  const value = Number(raw);
  if (value < min || value > max) return `${name} must be between ${min} and ${max}`;
  return value;
}

export function loadLicenceApiConfig(env: Env = process.env): LicenceApiConfigResult {
  const tenantUserId = env.DIGITAL_LICENCE_TENANT_ID?.trim();
  if (!tenantUserId) return { ok: false, reason: "DIGITAL_LICENCE_TENANT_ID is not set" };

  if (!env.DIGITAL_LICENCE_API_KEYS?.trim()) {
    return { ok: false, reason: "DIGITAL_LICENCE_API_KEYS is not set" };
  }
  const keys = parseApiKeys(env.DIGITAL_LICENCE_API_KEYS);
  if (typeof keys === "string") {
    return { ok: false, reason: keys.replace(/PRESTASHOP_INVOICE_API_KEYS/g, "DIGITAL_LICENCE_API_KEYS") };
  }

  const maxClockSkewSeconds = readInt(env, "DIGITAL_LICENCE_MAX_CLOCK_SKEW_SECONDS", 300, 30, 900);
  if (typeof maxClockSkewSeconds === "string") return { ok: false, reason: maxClockSkewSeconds };
  const rateLimitPerMinute = readInt(env, "DIGITAL_LICENCE_RATE_LIMIT_PER_MINUTE", 30, 1, 1000);
  if (typeof rateLimitPerMinute === "string") return { ok: false, reason: rateLimitPerMinute };

  const ips = (env.DIGITAL_LICENCE_ALLOWED_IPS ?? "")
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
      allowedIps: ips.length > 0 ? new Set(ips) : null,
      requireHttps: env.NODE_ENV === "production",
    },
  };
}
