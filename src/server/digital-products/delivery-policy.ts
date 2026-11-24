import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";

/**
 * Anti-fraud limits of digital-order delivery. Activation codes cannot be taken
 * back, so an order that looks unusual, or a burst that looks like a stolen API
 * key, waits for a person instead of being e-mailed automatically.
 */
export type DeliveryPolicy = {
  /** Codes one order may receive without a review. */
  maxAutoCodesPerOrder: number;
  /** Codes the shop integration may release per rolling hour (0 = no limit). */
  maxCodesPerHour: number;
  /** Deliver orders whose total is 0 (100 % voucher, mispriced product) without a review. */
  allowFreeOrders: boolean;
  /** How long the payment proof of a reviewed order stays valid when the shop cannot be asked again. */
  reviewMaxAgeMinutes: number;
};

type Env = Record<string, string | undefined>;

/** An unreadable value falls back to the default: a typo must never remove a limit. */
function readInt(env: Env, name: string, fallback: number, min: number, max: number) {
  const raw = env[name]?.trim();
  if (!raw || !/^\d{1,6}$/.test(raw)) return fallback;
  const value = Number(raw);
  return value < min || value > max ? fallback : value;
}

export function loadDeliveryPolicy(env: Env = process.env): DeliveryPolicy {
  return {
    maxAutoCodesPerOrder: readInt(env, "DIGITAL_ORDER_MAX_AUTO_CODES", 100, 1, 2500),
    maxCodesPerHour: readInt(env, "DIGITAL_ORDER_MAX_CODES_PER_HOUR", 200, 0, 100_000),
    allowFreeOrders: ["1", "true", "yes", "on"].includes(env.DIGITAL_ORDER_ALLOW_FREE?.trim().toLowerCase() ?? ""),
    reviewMaxAgeMinutes: readInt(env, "DIGITAL_ORDER_REVIEW_MAX_AGE_MINUTES", 120, 5, 10_080),
  };
}

/**
 * Codes the shop integration exposed (PDF rendered) during the last hour,
 * without those of the order being processed (retries must not count twice).
 */
export async function countCodesReleasedLastHour(tenantId: string, exceptExternalOrderId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number | string }[]>(Prisma.sql`
    SELECT COALESCE(SUM("quantity"), 0)::int AS "count"
    FROM "DigitalLicenceOrder"
    WHERE "userId" = ${tenantId} AND "source" IN ('PRESTASHOP', 'API')
      AND "generatedAt" > NOW() - INTERVAL '1 hour'
      AND "externalOrderId" IS DISTINCT FROM ${exceptExternalOrderId}
  `);
  return Number(rows[0]?.count ?? 0);
}
