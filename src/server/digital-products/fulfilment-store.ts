import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { generateId } from "@/lib/id";

/**
 * Per-order fulfilment tracking (scripts/sql/20261113_digital_order_fulfilment.sql).
 * Guarantees one invoice and one customer e-mail per shop order across retries
 * and concurrent requests (PROCESSING claim with stale takeover).
 */

export const FULFILMENT_SOURCE = "prestashop";
/** A PROCESSING claim older than this is considered abandoned (crashed instance). */
export const STALE_FULFILMENT_SECONDS = 300;

export type FulfilmentRecord = {
  id: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  idempotencyKey: string;
  requestHash: string;
  invoiceId: string | null;
  licenceOrderIds: string[];
  emailTo: string | null;
  emailSubject: string | null;
  emailSentAt: Date | null;
  lastErrorCode: string | null;
  attempts: number;
  completedAt: Date | null;
};

export type FulfilmentClaimInput = {
  tenantUserId: string;
  shopId: string;
  externalOrderId: string;
  orderReference: string;
  idempotencyKey: string;
  requestHash: string;
};

export type FulfilmentClaim =
  | { kind: "claimed"; record: FulfilmentRecord }
  | { kind: "completed"; record: FulfilmentRecord }
  | { kind: "in_progress" }
  | { kind: "idempotency_key_reused" };

/** A fulfilment as shown on the review page (mode "review"). */
export type FulfilmentReview = FulfilmentRecord & {
  userId: string;
  shopId: string;
  externalOrderId: string;
  orderReference: string;
  reviewPayload: unknown;
  reviewKeyId: string | null;
  reviewRequestedAt: Date | null;
  updatedAt: Date | null;
};

/** Error code of a fulfilment parked after mode "review", waiting for "Envoyer". */
export const AWAITING_APPROVAL_CODE = "AWAITING_APPROVAL";

/**
 * Kept for review and not sent yet: parked by mode "review", or a send from the
 * review page that failed (SMTP…) and can be retried from there. Never an order
 * the shop has since reported unpaid: its stored request still says "paid".
 */
export function isAwaitingApproval(record: Pick<FulfilmentRecord, "status" | "lastErrorCode"> & { reviewed?: boolean }) {
  if (record.status !== "FAILED" || record.lastErrorCode === "ORDER_NOT_PAID") return false;
  return (record.lastErrorCode === AWAITING_APPROVAL_CODE || record.reviewed === true);
}

export interface FulfilmentStore {
  claim(input: FulfilmentClaimInput): Promise<FulfilmentClaim>;
  /** Read-only lookup by shop order (mode "status"). */
  findByOrder(tenantUserId: string, shopId: string, externalOrderId: string): Promise<(FulfilmentRecord & { reviewed: boolean }) | null>;
  /** Parks the order for review: keeps the request so invoice-app can send it later. */
  markAwaitingReview(id: string, data: { payload: unknown; keyId: string }): Promise<void>;
  findReview(tenantUserId: string, id: string): Promise<FulfilmentReview | null>;
  markSentBy(id: string, userId: string): Promise<void>;
  saveProgress(id: string, data: { licenceOrderIds?: string[]; invoiceId?: string }): Promise<void>;
  markEmailSent(id: string, data: { to: string; subject: string }): Promise<void>;
  markCompleted(id: string): Promise<void>;
  markFailed(id: string, errorCode: string): Promise<void>;
}

type Row = Record<string, unknown>;

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(String(value));
}

function mapRecord(row: Row): FulfilmentRecord {
  const ids = typeof row.licenceOrderIds === "string" ? JSON.parse(row.licenceOrderIds) : row.licenceOrderIds;
  return {
    id: String(row.id),
    status: row.status as FulfilmentRecord["status"],
    idempotencyKey: String(row.idempotencyKey),
    requestHash: String(row.requestHash),
    invoiceId: (row.invoiceId as string | null) ?? null,
    licenceOrderIds: Array.isArray(ids) ? ids.map(String) : [],
    emailTo: (row.emailTo as string | null) ?? null,
    emailSubject: (row.emailSubject as string | null) ?? null,
    emailSentAt: toDate(row.emailSentAt),
    lastErrorCode: (row.lastErrorCode as string | null) ?? null,
    attempts: Number(row.attempts ?? 1),
    completedAt: toDate(row.completedAt),
  };
}

const COLUMNS = Prisma.sql`"id", "status", "idempotencyKey", "requestHash", "invoiceId", "licenceOrderIds",
  "emailTo", "emailSubject", "emailSentAt", "lastErrorCode", "attempts", "completedAt"`;

export const postgresFulfilmentStore: FulfilmentStore = {
  async claim(input) {
    const id = generateId("dlful");
    const inserted = await prisma.$queryRaw<Row[]>(Prisma.sql`
      INSERT INTO "DigitalOrderFulfilment" (
        "id", "userId", "source", "shopId", "externalOrderId", "orderReference",
        "idempotencyKey", "requestHash", "status"
      ) VALUES (
        ${id}, ${input.tenantUserId}, ${FULFILMENT_SOURCE}, ${input.shopId}, ${input.externalOrderId},
        ${input.orderReference}, ${input.idempotencyKey}, ${input.requestHash}, 'PROCESSING'
      )
      ON CONFLICT DO NOTHING
      RETURNING ${COLUMNS}
    `);
    if (inserted[0]) return { kind: "claimed", record: mapRecord(inserted[0]) };

    const existingRows = await prisma.$queryRaw<(Row & { isStale: boolean })[]>(Prisma.sql`
      SELECT ${COLUMNS},
        ("updatedAt" < NOW() - make_interval(secs => ${STALE_FULFILMENT_SECONDS})) AS "isStale"
      FROM "DigitalOrderFulfilment"
      WHERE "userId" = ${input.tenantUserId} AND "source" = ${FULFILMENT_SOURCE}
        AND "shopId" = ${input.shopId} AND "externalOrderId" = ${input.externalOrderId}
      LIMIT 1
    `);
    const existing = existingRows[0];
    if (!existing) {
      // Conflict on the idempotency key: it was used for another order.
      return { kind: "idempotency_key_reused" };
    }
    const record = mapRecord(existing);
    // An order is fulfilled once: a completed order is replayed whatever the
    // retry carries (the customer already received the documents).
    if (record.status === "COMPLETED") return { kind: "completed", record };
    if (record.status === "PROCESSING" && !existing.isStale) return { kind: "in_progress" };

    // FAILED or abandoned: take over atomically (optimistic concurrency).
    const reclaimed = await prisma.$queryRaw<Row[]>(Prisma.sql`
      UPDATE "DigitalOrderFulfilment"
      SET "status" = 'PROCESSING', "attempts" = "attempts" + 1, "lastErrorCode" = NULL,
          "requestHash" = ${input.requestHash}, "orderReference" = ${input.orderReference},
          "updatedAt" = NOW()
      WHERE "id" = ${record.id} AND "status" = ${record.status} AND "attempts" = ${record.attempts}
      RETURNING ${COLUMNS}
    `);
    return reclaimed[0] ? { kind: "claimed", record: mapRecord(reclaimed[0]) } : { kind: "in_progress" };
  },

  async findByOrder(tenantUserId, shopId, externalOrderId) {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${COLUMNS}, ("reviewPayload" IS NOT NULL) AS "reviewed" FROM "DigitalOrderFulfilment"
      WHERE "userId" = ${tenantUserId} AND "source" = ${FULFILMENT_SOURCE}
        AND "shopId" = ${shopId} AND "externalOrderId" = ${externalOrderId}
      LIMIT 1
    `);
    return rows[0] ? { ...mapRecord(rows[0]), reviewed: rows[0].reviewed === true } : null;
  },

  async markAwaitingReview(id, data) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "DigitalOrderFulfilment"
      SET "status" = 'FAILED', "lastErrorCode" = ${AWAITING_APPROVAL_CODE},
          "reviewPayload" = ${JSON.stringify(data.payload)}::text::jsonb, "reviewKeyId" = ${data.keyId},
          "reviewRequestedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${id} AND "status" = 'PROCESSING'
    `);
  },

  async findReview(tenantUserId, id) {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT ${COLUMNS}, "userId", "shopId", "externalOrderId", "orderReference",
             "reviewPayload", "reviewKeyId", "reviewRequestedAt", "updatedAt"
      FROM "DigitalOrderFulfilment"
      WHERE "id" = ${id} AND "userId" = ${tenantUserId} AND "source" = ${FULFILMENT_SOURCE}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    const payload = typeof row.reviewPayload === "string" ? JSON.parse(row.reviewPayload) : row.reviewPayload;
    return {
      ...mapRecord(row),
      userId: String(row.userId),
      shopId: String(row.shopId),
      externalOrderId: String(row.externalOrderId),
      orderReference: String(row.orderReference),
      reviewPayload: payload ?? null,
      reviewKeyId: (row.reviewKeyId as string | null) ?? null,
      reviewRequestedAt: toDate(row.reviewRequestedAt),
      updatedAt: toDate(row.updatedAt),
    };
  },

  async markSentBy(id, userId) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "DigitalOrderFulfilment" SET "sentById" = ${userId}, "updatedAt" = NOW() WHERE "id" = ${id}
    `);
  },

  async saveProgress(id, data) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "DigitalOrderFulfilment"
      SET "licenceOrderIds" = COALESCE(${data.licenceOrderIds ? JSON.stringify(data.licenceOrderIds) : null}::text::jsonb, "licenceOrderIds"),
          "invoiceId" = COALESCE(${data.invoiceId ?? null}, "invoiceId"),
          "updatedAt" = NOW()
      WHERE "id" = ${id}
    `);
  },

  async markEmailSent(id, data) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "DigitalOrderFulfilment"
      SET "emailSentAt" = NOW(), "emailTo" = ${data.to}, "emailSubject" = ${data.subject}, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `);
  },

  async markCompleted(id) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "DigitalOrderFulfilment"
      SET "status" = 'COMPLETED', "lastErrorCode" = NULL, "completedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${id}
    `);
  },

  async markFailed(id, errorCode) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "DigitalOrderFulfilment"
      SET "status" = 'FAILED', "lastErrorCode" = ${errorCode.slice(0, 64)}, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "status" = 'PROCESSING'
    `);
  },
};

/** Licence orders reached the customer: DELIVERED + link to the invoice. */
export async function markLicenceOrdersDelivered(params: {
  tenantId: string;
  orderIds: string[];
  invoiceId: string;
  actor: string;
}) {
  if (params.orderIds.length === 0) return;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE "DigitalLicenceOrder"
      SET "status" = 'DELIVERED', "deliveredAt" = COALESCE("deliveredAt", NOW()),
          "invoiceId" = ${params.invoiceId}, "updatedAt" = NOW()
      WHERE "userId" = ${params.tenantId} AND "id" IN (${Prisma.join(params.orderIds)})
        AND "status" IN ('GENERATED', 'DELIVERED')
      RETURNING "id"
    `);
    for (const row of updated) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DigitalLicenceEvent" ("id", "userId", "orderId", "type", "actor", "details")
        SELECT ${generateId("dlevt")}, ${params.tenantId}, ${row.id}, 'DELIVERED', ${params.actor},
               ${JSON.stringify({ invoiceId: params.invoiceId })}::text::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM "DigitalLicenceEvent" WHERE "orderId" = ${row.id} AND "type" = 'DELIVERED'
        )
      `);
    }
  });
}
