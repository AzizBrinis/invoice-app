const rawSecret =
  process.env.SESSION_COOKIE_SECRET ?? process.env.SESSION_SECRET;

const devGlobal = globalThis as typeof globalThis & {
  __sessionFallbackSecret?: string;
};

const SESSION_COOKIE_SECRET =
  rawSecret && rawSecret.trim().length > 0
    ? rawSecret
    : (() => {
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            "SESSION_COOKIE_SECRET (or SESSION_SECRET) must be defined in production to sign session cookies.",
          );
        }
        if (!devGlobal.__sessionFallbackSecret) {
          devGlobal.__sessionFallbackSecret = "__development-session-secret__";
          if (process.env.NODE_ENV !== "test") {
            console.warn(
              "[session-cookie] SESSION_COOKIE_SECRET is not set. Using an insecure development fallback. Configure SESSION_COOKIE_SECRET for consistent sessions.",
            );
          }
        }
        return devGlobal.__sessionFallbackSecret;
      })();

const encoder = new TextEncoder();

function ensureSecret() {
  if (!SESSION_COOKIE_SECRET) {
    throw new Error(
      "SESSION_COOKIE_SECRET (or SESSION_SECRET) must be defined",
    );
  }
  return SESSION_COOKIE_SECRET;
}

async function getSubtleCrypto(): Promise<SubtleCrypto> {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }

  throw new Error(
    "Web Crypto API is not available in this runtime. Update to Node.js 18+ or enable a compatible runtime with globalThis.crypto.",
  );
}

let cachedKeyPromise: Promise<CryptoKey> | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      const subtle = await getSubtleCrypto();
      const secret = ensureSecret();
      const secretBytes = encoder.encode(secret);
      return subtle.importKey(
        "raw",
        secretBytes,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
      );
    })();
  }
  return cachedKeyPromise;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }

  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function signSessionToken(token: string): Promise<string> {
  const key = await getSigningKey();
  const subtle = await getSubtleCrypto();
  const signature = await subtle.sign("HMAC", key, encoder.encode(token));
  return toBase64Url(signature);
}

export async function extractSignedToken(
  rawValue: string | null | undefined,
): Promise<string | null> {
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [token, signaturePart] = parts;
  if (!token || !signaturePart) {
    return null;
  }

  const signatureBytes = base64UrlToUint8Array(signaturePart);
  const key = await getSigningKey();
  const subtle = await getSubtleCrypto();
  const isValid = await subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(token),
  );

  return isValid ? token : null;
}
