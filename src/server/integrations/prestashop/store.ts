import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { generateId } from "@/lib/id";

/**
 * Persistence for replay protection, distributed rate limiting and per-order
 * idempotency. Backed by Postgres (see scripts/sql/20261109_external_invoice_requests.sql)
 * so guarantees hold across serverless instances.
 */

export const EXTERNAL_INVOICE_SOURCE = "prestashop";
/** A PROCESSING claim older than this is considered abandoned (crashed instance). */
export const STALE_PROCESSING_SECONDS = 180;

export type ClaimInput = {
  tenantUserId: string;
  shopId: string;
  externalOrderId: string;
  externalOrderReference: string;
  idempotencyKey: string;
  payloadHash: string;
};

export type ClaimResult =
  | { kind: "claimed"; requestId: string; reclaimed: boolean; claimedSince: Date }
  | { kind: "completed"; requestId: string; invoiceId: string }
  | { kind: "idempotency_key_reused" }
  | { kind: "order_already_invoiced"; invoiceId: string }
  | { kind: "in_progress" };

export interface PrestashopInvoiceStore {
  /** Returns false when the (keyId, nonce) pair was already seen (replay). */
  registerNonce(keyId: string, nonce: string, ttlSeconds: number): Promise<boolean>;
  countRecentRequests(keyId: string, windowSeconds: number): Promise<number>;
  purgeExpiredNonces(): Promise<void>;
  claimRequest(input: ClaimInput): Promise<ClaimResult>;
  markCompleted(requestId: string, invoiceId: string): Promise<void>;
  markFailed(requestId: string, errorCode: string): Promise<void>;
  /** Invoice generated for a shop order, if any (COMPLETED request only). */
  findInvoiceForOrder(tenantUserId: string, shopId: string, externalOrderId: string): Promise<string | null>;
  /** Finds an invoice created by a claim that crashed before being marked completed. */
  findOrphanInvoice(tenantUserId: string, orderReference: string, since: Date): Promise<string | null>;
  tenantExists(tenantUserId: string): Promise<boolean>;
}

type RequestRow = {
  id: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  idempotencyKey: string;
  payloadHash: string;
  invoiceId: string | null;
  isStale: boolean;
  attempts: number;
};

async function selectRequestByOrder(input: ClaimInput) {
  const rows = await prisma.$queryRaw<RequestRow[]>(Prisma.sql`
    SELECT "id", "status", "idempotencyKey", "payloadHash", "invoiceId", "attempts",
      ("updatedAt" < NOW() - make_interval(secs => ${STALE_PROCESSING_SECONDS})) AS "isStale"
    FROM "ExternalInvoiceRequest"
    WHERE "userId" = ${input.tenantUserId}
      AND "source" = ${EXTERNAL_INVOICE_SOURCE}
      AND "shopId" = ${input.shopId}
      AND "externalOrderId" = ${input.externalOrderId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export const postgresPrestashopInvoiceStore: PrestashopInvoiceStore = {
  async registerNonce(keyId, nonce, ttlSeconds) {
    const rows = await prisma.$queryRaw<{ nonce: string }[]>(Prisma.sql`
      INSERT INTO "IntegrationRequestNonce" ("keyId", "nonce", "expiresAt")
      VALUES (${keyId}, ${nonce}, NOW() + make_interval(secs => ${ttlSeconds}))
      ON CONFLICT ("keyId", "nonce") DO NOTHING
      RETURNING "nonce"
    `);
    return rows.length === 1;
  },

  async countRecentRequests(keyId, windowSeconds) {
    const rows = await prisma.$queryRaw<{ count: number | string }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "IntegrationRequestNonce"
      WHERE "keyId" = ${keyId}
        AND "createdAt" > NOW() - make_interval(secs => ${windowSeconds})
    `);
    return Number(rows[0]?.count ?? 0);
  },

  async purgeExpiredNonces() {
    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "IntegrationRequestNonce" WHERE "expiresAt" < NOW()
    `);
  },

  async claimRequest(input) {
    const id = generateId("extinv");
    const inserted = await prisma.$queryRaw<{ id: string; createdAt: Date }[]>(Prisma.sql`
      INSERT INTO "ExternalInvoiceRequest" (
        "id", "userId", "source", "shopId", "externalOrderId", "externalOrderReference",
        "idempotencyKey", "payloadHash", "status"
      ) VALUES (
        ${id}, ${input.tenantUserId}, ${EXTERNAL_INVOICE_SOURCE}, ${input.shopId},
        ${input.externalOrderId}, ${input.externalOrderReference},
        ${input.idempotencyKey}, ${input.payloadHash}, 'PROCESSING'
      )
      ON CONFLICT DO NOTHING
      RETURNING "id", "createdAt"
    `);
    if (inserted[0]) {
      return {
        kind: "claimed",
        requestId: inserted[0].id,
        reclaimed: false,
        claimedSince: new Date(inserted[0].createdAt),
      };
    }

    const existing = await selectRequestByOrder(input);
    if (!existing) {
      // The conflict came from the (userId, source, idempotencyKey) constraint:
      // this key was already used for a different order.
      return { kind: "idempotency_key_reused" };
    }

    if (existing.status === "COMPLETED" && existing.invoiceId) {
      if (existing.payloadHash === input.payloadHash) {
        return { kind: "completed", requestId: existing.id, invoiceId: existing.invoiceId };
      }
      return existing.idempotencyKey === input.idempotencyKey
        ? { kind: "idempotency_key_reused" }
        : { kind: "order_already_invoiced", invoiceId: existing.invoiceId };
    }

    if (existing.status === "PROCESSING" && !existing.isStale) {
      return { kind: "in_progress" };
    }

    // FAILED, abandoned PROCESSING, or COMPLETED whose invoice was deleted:
    // take over atomically (optimistic concurrency on status + attempts).
    const reclaimed = await prisma.$queryRaw<{ id: string; createdAt: Date }[]>(Prisma.sql`
      UPDATE "ExternalInvoiceRequest"
      SET "status" = 'PROCESSING',
          "payloadHash" = ${input.payloadHash},
          "externalOrderReference" = ${input.externalOrderReference},
          "attempts" = "attempts" + 1,
          "lastErrorCode" = NULL,
          "updatedAt" = NOW()
      WHERE "id" = ${existing.id}
        AND "status" = ${existing.status}
        AND "attempts" = ${existing.attempts}
      RETURNING "id", "createdAt"
    `);
    if (!reclaimed[0]) {
      return { kind: "in_progress" };
    }
    return {
      kind: "claimed",
      requestId: reclaimed[0].id,
      reclaimed: true,
      claimedSince: new Date(reclaimed[0].createdAt),
    };
  },

  async markCompleted(requestId, invoiceId) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "ExternalInvoiceRequest"
      SET "status" = 'COMPLETED', "invoiceId" = ${invoiceId}, "lastErrorCode" = NULL,
          "completedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${requestId}
    `);
  },

  async markFailed(requestId, errorCode) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "ExternalInvoiceRequest"
      SET "status" = 'FAILED', "lastErrorCode" = ${errorCode.slice(0, 64)}, "updatedAt" = NOW()
      WHERE "id" = ${requestId} AND "status" = 'PROCESSING'
    `);
  },

  async findInvoiceForOrder(tenantUserId, shopId, externalOrderId) {
    const rows = await prisma.$queryRaw<{ invoiceId: string | null }[]>(Prisma.sql`
      SELECT "invoiceId"
      FROM "ExternalInvoiceRequest"
      WHERE "userId" = ${tenantUserId}
        AND "source" = ${EXTERNAL_INVOICE_SOURCE}
        AND "shopId" = ${shopId}
        AND "externalOrderId" = ${externalOrderId}
        AND "status" = 'COMPLETED'
      LIMIT 1
    `);
    return rows[0]?.invoiceId ?? null;
  },

  async findOrphanInvoice(tenantUserId, orderReference, since) {
    const invoice = await prisma.invoice.findFirst({
      where: {
        userId: tenantUserId,
        reference: orderReference,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return invoice?.id ?? null;
  },

  async tenantExists(tenantUserId) {
    const user = await prisma.user.findUnique({
      where: { id: tenantUserId },
      select: { id: true },
    });
    return Boolean(user);
  },
};
