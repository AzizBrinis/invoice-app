import {
  createCipheriv,
  createHash,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Encryption for activation codes at rest.
 *
 * - AES-256-GCM, random 96-bit IV, with additional authenticated data binding
 *   each ciphertext to its tenant and row id (a ciphertext copied to another
 *   row or tenant fails to decrypt).
 * - A separate keyed HMAC-SHA256 fingerprint gives tenant-wide duplicate
 *   detection without storing or comparing plaintext.
 * - Both keys are derived (HKDF-SHA256) from DIGITAL_LICENCE_ENCRYPTION_KEY,
 *   32 random bytes encoded as base64 or hex (`openssl rand -base64 32`).
 *
 * Ciphertext format: "v1:" + base64url(iv | tag | ciphertext).
 * Losing the master key makes every stored code unrecoverable: back it up.
 */

export const LICENCE_KEY_VERSION = 1;
const CIPHER_PREFIX = `v${LICENCE_KEY_VERSION}:`;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class LicenceEncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenceEncryptionConfigError";
  }
}

type DerivedKeys = { encryption: Buffer; fingerprint: Buffer };

let cachedKeys: { source: string; keys: DerivedKeys } | null = null;

function decodeMasterKey(raw: string): Buffer | null {
  const value = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, "hex");
  if (/^[A-Za-z0-9+/_-]{43,44}={0,2}$/.test(value)) {
    const decoded = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (decoded.length === 32) return decoded;
  }
  return null;
}

function resolveMasterKey(env: Record<string, string | undefined>): { source: string; key: Buffer } {
  const configured = env.DIGITAL_LICENCE_ENCRYPTION_KEY?.trim();
  if (configured) {
    const key = decodeMasterKey(configured);
    if (!key) {
      throw new LicenceEncryptionConfigError(
        "DIGITAL_LICENCE_ENCRYPTION_KEY doit contenir 32 octets encodés en base64 ou hexadécimal.",
      );
    }
    return { source: createHash("sha256").update(`env:${configured}`).digest("hex"), key };
  }
  if (env.NODE_ENV === "production") {
    throw new LicenceEncryptionConfigError(
      "DIGITAL_LICENCE_ENCRYPTION_KEY n’est pas configurée : le stockage des codes est désactivé.",
    );
  }
  // Development / test only: derive a stable key from the session secret so
  // local databases keep working without extra setup.
  const fallback =
    env.SESSION_COOKIE_SECRET ?? env.SESSION_SECRET ?? "__development-digital-licence-secret__";
  return {
    source: createHash("sha256").update(`dev:${fallback}`).digest("hex"),
    key: Buffer.from(fallback, "utf8"),
  };
}

function deriveKeys(env: Record<string, string | undefined> = process.env): DerivedKeys {
  const { source, key } = resolveMasterKey(env);
  if (cachedKeys?.source === source) return cachedKeys.keys;
  const salt = Buffer.from("invoices-app/digital-licences", "utf8");
  const keys = {
    encryption: Buffer.from(hkdfSync("sha256", key, salt, "licence-code-encryption-v1", 32)),
    fingerprint: Buffer.from(hkdfSync("sha256", key, salt, "licence-code-fingerprint-v1", 32)),
  };
  cachedKeys = { source, keys };
  return keys;
}

/** Throws LicenceEncryptionConfigError when the key is missing/invalid. */
export function assertLicenceEncryptionConfigured(env: Record<string, string | undefined> = process.env) {
  deriveKeys(env);
}

export function isLicenceEncryptionConfigured(env: Record<string, string | undefined> = process.env) {
  try {
    deriveKeys(env);
    return true;
  } catch {
    return false;
  }
}

function aad(tenantId: string, codeId: string) {
  return Buffer.from(`digital-licence-code|${tenantId}|${codeId}`, "utf8");
}

export function encryptLicenceCode(params: {
  tenantId: string;
  codeId: string;
  code: string;
}): string {
  const { encryption } = deriveKeys();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryption, iv);
  cipher.setAAD(aad(params.tenantId, params.codeId));
  const ciphertext = Buffer.concat([cipher.update(params.code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return CIPHER_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptLicenceCode(params: {
  tenantId: string;
  codeId: string;
  ciphertext: string;
}): string {
  if (!params.ciphertext.startsWith(CIPHER_PREFIX)) {
    throw new Error("Unsupported licence ciphertext version");
  }
  const { encryption } = deriveKeys();
  const payload = Buffer.from(params.ciphertext.slice(CIPHER_PREFIX.length), "base64url");
  if (payload.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("Malformed licence ciphertext");
  }
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", encryption, iv);
  decipher.setAAD(aad(params.tenantId, params.codeId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** Deterministic keyed fingerprint of a normalized code (per tenant). */
export function fingerprintLicenceCode(tenantId: string, normalizedCode: string): string {
  const { fingerprint } = deriveKeys();
  return createHmac("sha256", fingerprint)
    .update(`${tenantId}|${normalizedCode}`, "utf8")
    .digest("hex");
}

/** Test helper: forget derived keys (env changes between tests). */
export function resetLicenceKeyCacheForTests() {
  cachedKeys = null;
}
