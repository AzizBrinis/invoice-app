import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function resolveSecret(): Buffer {
  const rawSecret =
    process.env.MESSAGING_SECRET ??
    process.env.SESSION_COOKIE_SECRET ??
    process.env.SESSION_SECRET ??
    "__development-session-secret__";

  const normalized = rawSecret.trim();
  if (!normalized) {
    throw new Error(
      "A secret must be defined via MESSAGING_SECRET or SESSION_COOKIE_SECRET to protect messaging credentials.",
    );
  }

  return createHash("sha256").update(normalized).digest();
}

const key = resolveSecret();

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
