import { extractSignedToken, signSessionToken } from "@/lib/session-cookie";

type ConfirmationTokenPayload = {
  orderId: string;
  issuedAt: number;
};

const TOKEN_PREFIX = "order-confirmation";

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
) {
  const token = await extractSignedToken(rawValue);
  if (!token || !token.startsWith(`${TOKEN_PREFIX}:`)) {
    return null;
  }
  const encoded = token.slice(TOKEN_PREFIX.length + 1);
  return decodePayload(encoded);
}
