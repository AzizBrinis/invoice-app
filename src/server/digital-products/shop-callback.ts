import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { loadLicenceApiConfig, type LicenceApiConfigResult } from "@/server/digital-products/api-config";
import { computeSignature, sha256Hex } from "@/server/integrations/prestashop/signature";

/**
 * Signed calls to PrestaShop's front controller `fulfilmentnotify`:
 *
 *  - "order.sent" (module >= 1.7.2): a reviewed order was sent, so that it
 *    becomes "Livré" at once. Only a trigger, it carries no status: the shop
 *    asks invoice-app itself (mode "status") before changing anything.
 *  - "order.check" (module >= 1.7.3): read-only, asked right before codes are
 *    e-mailed. Is the order still paid, not refunded and unchanged?
 *
 * The shop checks the HMAC (same key as its own requests, own label "TSNTF1" so
 * signatures can never be swapped between APIs). The URL comes from the shop's
 * signed review request.
 */

export const SHOP_CALLBACK_SCHEME = "TSNTF1";
/** Signed instead of the real path, which depends on the shop's URL rewriting. */
export const SHOP_CALLBACK_PATH = "/module/tsinvoiceapp/fulfilmentnotify";
const TIMEOUT_MS = 45_000;
const CHECK_TIMEOUT_MS = 15_000;
/** The route may run 120 s in all and has already rendered and sent the e-mail. */
const NOTIFY_BUDGET_MS = 60_000;
const MAX_RESPONSE_BYTES = 8 * 1024;
const MAX_URL_LENGTH = 500;

type Env = Record<string, string | undefined>;

/** Why a callback URL is refused, or null. Production: public HTTPS host only, optionally pinned. */
export function callbackUrlIssue(raw: string, env: Env = process.env): string | null {
  if (raw.length > MAX_URL_LENGTH) return "too_long";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "invalid";
  }
  if (url.username || url.password || url.hash) return "invalid";
  const host = url.hostname.toLowerCase();
  const pinned = (env.PRESTASHOP_CALLBACK_HOSTS ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  if (pinned.length > 0 && !pinned.includes(host)) return "host_not_allowed";
  if (env.NODE_ENV !== "production") return ["http:", "https:"].includes(url.protocol) ? null : "invalid";
  if (url.protocol !== "https:" || url.port) return "https_required";
  if (isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") || /\.(local|internal|localhost|test)$/.test(host)) {
    return "host_not_public";
  }
  return null;
}

/** Loopback, private, link-local (cloud metadata), CGNAT, multicast and reserved addresses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (isIP(mapped ?? ip) === 4) {
    const [a, b] = (mapped ?? ip).split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // Only global unicast (2000::/3) is public; ::ffff:hex forms fall outside it.
  return !/^[23][0-9a-f]{0,3}:/.test(ip);
}

export type ShopCallbackResult =
  | { ok: true; state: "delivered" | "mixed" | "unchanged" }
  | { ok: false; code: string };

export type ShopOrderCheck =
  | { ok: true; payable: true }
  | { ok: true; payable: false; reason: string }
  | { ok: false; code: string };

export type ShopTransport = (
  url: URL,
  init: { method: "POST"; body: string; headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number; text: string }>;

/**
 * Minimal POST without redirects, cookies or proxies. In production the address
 * actually connected to must be public: it is checked inside the socket lookup,
 * so a DNS answer that changes after an earlier check (rebinding) is refused
 * too. At most MAX_RESPONSE_BYTES are read, whatever the server sends.
 */
export function shopTransport(options: { publicOnly: boolean }): ShopTransport {
  const guardedLookup: LookupFunction = (hostname, lookupOptions, callback) => {
    lookup(hostname, { ...lookupOptions, all: true }).then(
      (addresses) => {
        const blocked = addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address));
        if (blocked) return callback(new Error("non_public_address"), "", 4);
        if (lookupOptions.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
      },
      (error: NodeJS.ErrnoException) => callback(error, "", 4),
    );
  };
  return (url, init) =>
    new Promise((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const request = send(
        url,
        {
          method: init.method,
          headers: { ...init.headers, "Content-Length": String(Buffer.byteLength(init.body)) },
          signal: init.signal,
          agent: false,
          ...(options.publicOnly ? { lookup: guardedLookup } : {}),
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          const done = () =>
            resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8").slice(0, MAX_RESPONSE_BYTES) });
          response.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
            size += chunk.byteLength;
            if (size > MAX_RESPONSE_BYTES) {
              done();
              response.destroy();
            }
          });
          response.on("end", done);
          response.on("error", reject);
        },
      );
      request.on("error", reject);
      request.end(init.body);
    });
}

export type ShopCallbackDeps = {
  loadConfig: () => LicenceApiConfigResult;
  transport: ShopTransport;
  resolve: (host: string) => Promise<{ address: string }[]>;
  wait: (ms: number) => Promise<void>;
  now: () => number;
  env: Env;
};

const defaultDeps: ShopCallbackDeps = {
  loadConfig: () => loadLicenceApiConfig(),
  transport: (url, init) => shopTransport({ publicOnly: process.env.NODE_ENV === "production" })(url, init),
  resolve: (host) => lookup(host, { all: true }),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  env: process.env,
};

type ShopCallParams = {
  url: string;
  keyId: string;
  fulfilmentId: string;
  shopId: number | string;
  orderId: number | string;
  orderReference: string;
};

async function callShop<T>(
  event: "order.sent" | "order.check",
  params: ShopCallParams,
  overrides: Partial<ShopCallbackDeps>,
  timing: { timeoutMs: number; budgetMs: number },
  parse: (json: Record<string, unknown>) => T | null,
): Promise<{ ok: true; value: T } | { ok: false; code: string }> {
  const deps = { ...defaultDeps, ...overrides };
  if (callbackUrlIssue(params.url, deps.env)) return { ok: false, code: "CALLBACK_URL_REFUSED" };
  const config = deps.loadConfig();
  const secret = config.ok ? config.config.keys.get(params.keyId) : undefined;
  if (!secret) return { ok: false, code: "CALLBACK_KEY_UNKNOWN" };

  const url = new URL(params.url);
  if (deps.env.NODE_ENV === "production") {
    try {
      const addresses = await deps.resolve(url.hostname);
      if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
        return { ok: false, code: "CALLBACK_URL_REFUSED" };
      }
    } catch {
      return { ok: false, code: "SHOP_UNREACHABLE" };
    }
  }

  const body = JSON.stringify({
    schemaVersion: 1,
    event,
    fulfilmentId: params.fulfilmentId,
    shopId: Number(params.shopId),
    orderId: Number(params.orderId),
    orderReference: params.orderReference,
  });

  const deadline = deps.now() + timing.budgetMs;
  let last: { ok: false; code: string } = { ok: false, code: "SHOP_UNREACHABLE" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await deps.wait(1500);
    const remaining = deadline - deps.now();
    if (remaining < 1000) break;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString("hex");
    const signature = computeSignature(secret, {
      method: "POST",
      path: SHOP_CALLBACK_PATH,
      timestamp,
      nonce,
      idempotencyKey: params.fulfilmentId,
      bodySha256Hex: sha256Hex(body),
      scheme: SHOP_CALLBACK_SCHEME,
    });
    try {
      const response = await deps.transport(url, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(Math.min(timing.timeoutMs, remaining)),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "invoice-app/1.0 (order-notify)",
          "X-Signature-Key-Id": params.keyId,
          "X-Signature-Timestamp": timestamp,
          "X-Signature-Nonce": nonce,
          "Idempotency-Key": params.fulfilmentId,
          "X-Signature": signature,
        },
      });
      let json: Record<string, unknown> | null = null;
      try {
        const value: unknown = JSON.parse(response.text);
        json = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
      } catch {
        json = null;
      }
      if (response.status === 200 && json?.ok === true) {
        const value = parse(json);
        if (value !== null) return { ok: true, value };
      }
      // A non-JSON refusal is the CDN/firewall (or an old module), not the module.
      const code = typeof json?.code === "string" && /^[A-Z_]{3,40}$/.test(json.code)
        ? `SHOP_${json.code}`
        : response.status === 403 ? "SHOP_BLOCKED" : `SHOP_HTTP_${response.status}`;
      last = { ok: false, code };
      if (response.status < 500 && response.status !== 429) return last;
    } catch {
      last = { ok: false, code: "SHOP_UNREACHABLE" };
    }
  }
  return last;
}

export async function notifyShopOrderSent(
  params: ShopCallParams,
  overrides: Partial<ShopCallbackDeps> = {},
): Promise<ShopCallbackResult> {
  const result = await callShop("order.sent", params, overrides, { timeoutMs: TIMEOUT_MS, budgetMs: NOTIFY_BUDGET_MS }, (json) =>
    json.state === "delivered" || json.state === "mixed" || json.state === "unchanged" ? json.state : null,
  );
  return result.ok ? { ok: true, state: result.value } : result;
}

/** Is the order still paid, not refunded and unchanged in the shop? Nothing changes there. */
export async function checkShopOrder(
  params: ShopCallParams,
  overrides: Partial<ShopCallbackDeps> = {},
): Promise<ShopOrderCheck> {
  const result = await callShop("order.check", params, overrides, { timeoutMs: CHECK_TIMEOUT_MS, budgetMs: 20_000 }, (json) => {
    // The answer must be about this order and explicit: anything else is not a confirmation.
    if (json.event !== "order.check" || json.orderId !== Number(params.orderId) || typeof json.payable !== "boolean") return null;
    const reason = typeof json.reason === "string" && /^[A-Z_]{3,40}$/.test(json.reason) ? json.reason : "ORDER_NOT_PAID";
    return { payable: json.payable, reason };
  });
  if (!result.ok) return result;
  return result.value.payable ? { ok: true, payable: true } : { ok: true, payable: false, reason: result.value.reason };
}
