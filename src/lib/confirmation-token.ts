import { extractSignedToken, signSessionToken } from "@/lib/session-cookie";

type ConfirmationTokenPayload = {
  orderId: string;
  issuedAt: number;
};

const TOKEN_PREFIX = "order-confirmation";
export const CONFIRMATION_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CONFIRMATION_TOKEN_CLOCK_SKEW_MS = 5 * 60 * 1000;

function encodePayload(payload: ConfirmationTokenPayload) {
  const raw = JSON.stringify(payload);
  return Buffer.from(raw, "utf8").toString("base64url");
}

function decodePayload(encoded: string): ConfirmationTokenPayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Partial<ConfirmationTokenPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.orderId !== "string") return null;
    if (typeof parsed.issuedAt !== "number") return null;
    return {
      orderId: parsed.orderId,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

export async function createConfirmationToken(orderId: string) {
  const payload = encodePayload({
    orderId,
    issuedAt: Date.now(),
  });
  const token = `${TOKEN_PREFIX}:${payload}`;
  const signature = await signSessionToken(token);
  return `${token}.${signature}`;
}

export async function parseConfirmationToken(
  rawValue: string | null | undefined,
  options?: {
    maxAgeMs?: number;
    orderId?: string;
  },
) {
  const token = await extractSignedToken(rawValue);
  if (!token || !token.startsWith(`${TOKEN_PREFIX}:`)) {
    return null;
  }
  const encoded = token.slice(TOKEN_PREFIX.length + 1);
  const payload = decodePayload(encoded);
  if (!payload) {
    return null;
  }

  const now = Date.now();
  if (payload.issuedAt > now + CONFIRMATION_TOKEN_CLOCK_SKEW_MS) {
    return null;
  }

  const maxAgeMs = options?.maxAgeMs ?? CONFIRMATION_TOKEN_MAX_AGE_MS;
  if (maxAgeMs > 0 && now - payload.issuedAt > maxAgeMs) {
    return null;
  }

  if (options?.orderId && payload.orderId !== options.orderId) {
    return null;
  }

  return payload;
}
