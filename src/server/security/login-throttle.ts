import { createHash, randomUUID } from "node:crypto";
import { enforceRateLimit } from "@/lib/security/public-request";
import { getTrustedClientIp, safeErrorName } from "@/server/integrations/prestashop/service";
import { postgresPrestashopInvoiceStore, type PrestashopInvoiceStore } from "@/server/integrations/prestashop/store";

/**
 * Brute-force protection of the administrator login. Attempts are counted in
 * Postgres (the same expiring counters as the signed APIs), so the limit holds
 * across serverless instances; each instance also keeps a memory counter, which
 * still works if the database counter does not.
 */

const WINDOW_SECONDS = 15 * 60;
/** Same person mistyping; a guesser from one place. */
const PER_ACCOUNT_AND_IP = 10;
/** One source trying many accounts. */
const PER_IP = 40;
/** One account attacked from many sources: high enough not to lock the owner out easily. */
const PER_ACCOUNT = 60;

type Counter = Pick<PrestashopInvoiceStore, "registerNonce" | "countRecentRequests">;

/** Counter keys never contain the address or the e-mail themselves. */
function counterKey(scope: string, value: string) {
  return `login:${scope}:${createHash("sha256").update(value).digest("hex").slice(0, 40)}`;
}

/** Records one attempt. False when the caller must be refused without checking the password. */
export async function allowLoginAttempt(
  headers: Headers,
  email: string,
  options: { counter?: Counter; now?: number } = {},
): Promise<boolean> {
  const counter = options.counter ?? postgresPrestashopInvoiceStore;
  const ip = getTrustedClientIp(headers);
  const account = email.trim().toLowerCase();
  const limits = [
    { key: counterKey("account-ip", `${account}|${ip}`), limit: PER_ACCOUNT_AND_IP },
    { key: counterKey("account", account), limit: PER_ACCOUNT },
    // Without a known address every visitor would share one counter.
    ...(ip === "unknown" ? [] : [{ key: counterKey("ip", ip), limit: PER_IP }]),
  ];

  for (const { key, limit } of limits) {
    try {
      enforceRateLimit({ key, limit, windowMs: WINDOW_SECONDS * 1000, now: options.now });
    } catch {
      console.warn("[auth] login_throttled", { scope: key.split(":")[1] });
      return false;
    }
  }
  try {
    const counts = await Promise.all(
      limits.map(async ({ key }) => {
        await counter.registerNonce(key, randomUUID(), WINDOW_SECONDS + 60);
        return counter.countRecentRequests(key, WINDOW_SECONDS);
      }),
    );
    const exceeded = limits.findIndex(({ limit }, index) => counts[index] > limit);
    if (exceeded >= 0) {
      console.warn("[auth] login_throttled", { scope: limits[exceeded].key.split(":")[1] });
      return false;
    }
  } catch (error) {
    // Counter table missing or database busy: the memory counter above still applies.
    console.error("[auth] login_counter_unavailable", { error: safeErrorName(error) });
  }
  return true;
}
