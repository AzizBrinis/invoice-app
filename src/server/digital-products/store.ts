import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { generateId } from "@/lib/id";
import type {
  LicenceCodeStatus,
  LicenceOrderSource,
  LicenceOrderStatus,
} from "@/lib/digital-products/kaspersky-catalog";

/**
 * Postgres persistence for the digital licence inventory
 * (scripts/sql/20261110_digital_licences.sql). Raw SQL, like the other
 * integration stores, because allocation needs row locks and CTEs.
 *
 * Nothing in this module decrypts codes; ciphertext only leaves through
 * `getOrderCodeCiphertexts`, used by the PDF renderer.
 */

type SqlClient = Pick<typeof prisma, "$queryRaw" | "$executeRaw">;

export class InsufficientLicenceStockError extends Error {
  constructor(
    public readonly sku: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`Stock insuffisant pour ${sku} : ${available} disponible(s), ${requested} demandé(s).`);
    this.name = "InsufficientLicenceStockError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NewLicenceCodeRow = {
  id: string;
  ciphertext: string;
  fingerprint: string;
  hint: string;
  keyVersion: number;
};

export type LicenceCodeListItem = {
  id: string;
  productSku: string;
  codeHint: string;
  status: LicenceCodeStatus;
  batchLabel: string | null;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: Date;
  usedAt: Date | null;
  reservedAt: Date | null;
  revokedAt: Date | null;
};

export type LicenceOrderRecord = {
  id: string;
  userId: string;
  number: string;
  productSku: string;
  quantity: number;
  status: LicenceOrderStatus;
  source: LicenceOrderSource;
  idempotencyKey: string | null;
  requestHash: string | null;
  customerName: string | null;
  customerEmail: string | null;
  orderReference: string | null;
  activationRegion: string | null;
  useBefore: string | null;
  notes: string | null;
  externalSource: string | null;
  externalOrderId: string | null;
  externalLineId: string | null;
  invoiceId: string | null;
  createdById: string | null;
  createdByName: string | null;
  apiKeyId: string | null;
  generationCount: number;
  lastErrorCode: string | null;
  generatedAt: Date | null;
  lastDownloadedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LicenceOrderCodeCipher = {
  id: string;
  codeHint: string;
  codeCiphertext: string;
  keyVersion: number;
  status: LicenceCodeStatus;
};

export type LicenceEventRecord = {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  codeId: string | null;
  type: string;
  actor: string | null;
  actorName: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
};

export type CreateLicenceOrderInput = {
  tenantId: string;
  productSku: string;
  quantity: number;
  source: LicenceOrderSource;
  idempotencyKey: string;
  requestHash: string;
  customerName?: string | null;
  customerEmail?: string | null;
  orderReference?: string | null;
  activationRegion?: string | null;
  useBefore?: string | null;
  notes?: string | null;
  externalSource?: string | null;
  externalOrderId?: string | null;
  externalLineId?: string | null;
  createdById?: string | null;
  apiKeyId?: string | null;
  actor: string;
};

export type CreateLicenceOrderResult =
  | { kind: "created"; order: LicenceOrderRecord }
  | { kind: "existing"; order: LicenceOrderRecord }
  | { kind: "idempotency_key_reused"; order: LicenceOrderRecord }
  | { kind: "external_line_conflict"; order: LicenceOrderRecord };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORDER_COLUMNS = Prisma.sql`
  o."id", o."userId", o."number", o."productSku", o."quantity", o."status", o."source",
  o."idempotencyKey", o."requestHash", o."customerName", o."customerEmail",
  o."orderReference", o."activationRegion", to_char(o."useBefore", 'YYYY-MM-DD') AS "useBefore",
  o."notes", o."externalSource", o."externalOrderId", o."externalLineId", o."invoiceId",
  o."createdById", u."name" AS "createdByName", o."apiKeyId", o."generationCount",
  o."lastErrorCode", o."generatedAt", o."lastDownloadedAt", o."deliveredAt",
  o."cancelledAt", o."createdAt", o."updatedAt"
`;

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(String(value));
}

function mapOrder(row: Record<string, unknown>): LicenceOrderRecord {
  return {
    ...(row as unknown as LicenceOrderRecord),
    quantity: Number(row.quantity),
    generationCount: Number(row.generationCount ?? 0),
    generatedAt: toDate(row.generatedAt),
    lastDownloadedAt: toDate(row.lastDownloadedAt),
    deliveredAt: toDate(row.deliveredAt),
    cancelledAt: toDate(row.cancelledAt),
    createdAt: toDate(row.createdAt) ?? new Date(0),
    updatedAt: toDate(row.updatedAt) ?? new Date(0),
  };
}

const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateLicenceOrderNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const bytes = randomBytes(6);
  const suffix = Array.from(bytes, (byte) => ORDER_NUMBER_ALPHABET[byte % 32]).join("");
  return `LIC-${date}-${suffix}`;
}

async function insertEvent(
  client: SqlClient,
  event: {
    tenantId: string;
    type: string;
    actor: string | null;
    orderId?: string | null;
    codeId?: string | null;
    details?: Record<string, unknown> | null;
  },
) {
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "DigitalLicenceEvent" ("id", "userId", "orderId", "codeId", "type", "actor", "details")
    VALUES (
      ${generateId("dlevt")}, ${event.tenantId}, ${event.orderId ?? null}, ${event.codeId ?? null},
      ${event.type}, ${event.actor}, ${event.details ? JSON.stringify(event.details) : null}::text::jsonb
    )
  `);
}

async function selectOrder(
  client: SqlClient,
  tenantId: string,
  where: Prisma.Sql,
): Promise<LicenceOrderRecord | null> {
  const rows = await client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT ${ORDER_COLUMNS}
    FROM "DigitalLicenceOrder" o
    LEFT JOIN "User" u ON u."id" = o."createdById"
    WHERE o."userId" = ${tenantId} AND ${where}
    LIMIT 1
  `);
  return rows[0] ? mapOrder(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const INSERT_CHUNK = 500;

/** Inserts codes, skipping duplicates. Returns the ids actually inserted. */
export async function insertLicenceCodes(params: {
  tenantId: string;
  productSku: string;
  rows: NewLicenceCodeRow[];
  batchLabel: string | null;
  importedById: string | null;
  actor: string;
}): Promise<Set<string>> {
  const inserted = new Set<string>();
  if (params.rows.length === 0) return inserted;

  await prisma.$transaction(async (tx) => {
    for (let offset = 0; offset < params.rows.length; offset += INSERT_CHUNK) {
      const chunk = params.rows.slice(offset, offset + INSERT_CHUNK);
      const values = chunk.map(
        (row) => Prisma.sql`(
          ${row.id}, ${params.tenantId}, ${params.productSku}, ${row.ciphertext},
          ${row.fingerprint}, ${row.hint}, ${row.keyVersion}, 'AVAILABLE',
          ${params.batchLabel}, ${params.importedById}
        )`,
      );
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        INSERT INTO "DigitalLicenceCode" (
          "id", "userId", "productSku", "codeCiphertext", "codeFingerprint", "codeHint",
          "keyVersion", "status", "batchLabel", "importedById"
        ) VALUES ${Prisma.join(values)}
        ON CONFLICT ("userId", "codeFingerprint") DO NOTHING
        RETURNING "id"
      `);
      rows.forEach((row) => inserted.add(row.id));
    }
    if (inserted.size > 0) {
      await insertEvent(tx, {
        tenantId: params.tenantId,
        type: "CODES_IMPORTED",
        actor: params.actor,
        details: {
          sku: params.productSku,
          count: inserted.size,
          skippedDuplicates: params.rows.length - inserted.size,
          batchLabel: params.batchLabel,
        },
      });
    }
  });
  return inserted;
}

export type InventoryCountRow = { productSku: string; status: LicenceCodeStatus; count: number };

export async function getLicenceInventoryCounts(tenantId: string): Promise<InventoryCountRow[]> {
  const rows = await prisma.$queryRaw<{ productSku: string; status: LicenceCodeStatus; count: number | string }[]>(
    Prisma.sql`
      SELECT "productSku", "status", COUNT(*)::int AS "count"
      FROM "DigitalLicenceCode"
      WHERE "userId" = ${tenantId}
      GROUP BY "productSku", "status"
    `,
  );
  return rows.map((row) => ({ ...row, count: Number(row.count) }));
}

export async function countAvailableLicenceCodes(tenantId: string, productSku: string) {
  const rows = await prisma.$queryRaw<{ count: number | string }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "DigitalLicenceCode"
    WHERE "userId" = ${tenantId} AND "productSku" = ${productSku} AND "status" = 'AVAILABLE'
  `);
  return Number(rows[0]?.count ?? 0);
}

/** `column IN (…skus)`; an empty list matches nothing. */
function skuInFilter(column: Prisma.Sql, skus: readonly string[]) {
  return skus.length > 0 ? Prisma.sql`${column} IN (${Prisma.join([...skus])})` : Prisma.sql`FALSE`;
}

export async function listLicenceCodes(params: {
  tenantId: string;
  productSku?: string | null;
  /** Restricts to one product family's SKUs (admin section of that family). */
  productSkus?: readonly string[] | null;
  status?: LicenceCodeStatus | null;
  hint?: string | null;
  page: number;
  pageSize: number;
}): Promise<{ items: LicenceCodeListItem[]; total: number }> {
  const filters = [Prisma.sql`c."userId" = ${params.tenantId}`];
  if (params.productSku) filters.push(Prisma.sql`c."productSku" = ${params.productSku}`);
  if (params.productSkus) filters.push(skuInFilter(Prisma.sql`c."productSku"`, params.productSkus));
  if (params.status) filters.push(Prisma.sql`c."status" = ${params.status}`);
  if (params.hint) filters.push(Prisma.sql`c."codeHint" = ${params.hint}`);
  const where = Prisma.join(filters, " AND ");
  const offset = (params.page - 1) * params.pageSize;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT c."id", c."productSku", c."codeHint", c."status", c."batchLabel", c."orderId",
             o."number" AS "orderNumber", c."createdAt", c."usedAt", c."reservedAt", c."revokedAt"
      FROM "DigitalLicenceCode" c
      LEFT JOIN "DigitalLicenceOrder" o ON o."id" = c."orderId"
      WHERE ${where}
      ORDER BY c."createdAt" DESC, c."id" DESC
      LIMIT ${params.pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ count: number | string }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count" FROM "DigitalLicenceCode" c WHERE ${where}
    `),
  ]);

  return {
    total: Number(totals[0]?.count ?? 0),
    items: rows.map((row) => ({
      ...(row as unknown as LicenceCodeListItem),
      createdAt: toDate(row.createdAt) ?? new Date(0),
      usedAt: toDate(row.usedAt),
      reservedAt: toDate(row.reservedAt),
      revokedAt: toDate(row.revokedAt),
    })),
  };
}

/** Withdraws an unused code (e.g. reported defective). Keeps its fingerprint. */
export async function revokeLicenceCode(params: {
  tenantId: string;
  codeId: string;
  actor: string;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; productSku: string }[]>(Prisma.sql`
      UPDATE "DigitalLicenceCode"
      SET "status" = 'REVOKED', "revokedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${params.codeId} AND "userId" = ${params.tenantId} AND "status" = 'AVAILABLE'
      RETURNING "id", "productSku"
    `);
    if (!rows[0]) return false;
    await insertEvent(tx, {
      tenantId: params.tenantId,
      type: "CODE_REVOKED",
      actor: params.actor,
      codeId: params.codeId,
      details: { sku: rows[0].productSku },
    });
    return true;
  });
}

// ---------------------------------------------------------------------------
// Orders (allocation)
// ---------------------------------------------------------------------------

/**
 * Creates a licence order and reserves `quantity` available codes in a single
 * transaction (all-or-nothing). Idempotent on (tenant, idempotencyKey): a
 * replay returns the existing order and its already-reserved codes, so a
 * code can never be allocated twice.
 */
export async function createLicenceOrderWithAllocation(
  input: CreateLicenceOrderInput,
): Promise<CreateLicenceOrderResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await prisma.$transaction(async (tx) => {
      const orderId = generateId("dlord");
      const inserted = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        INSERT INTO "DigitalLicenceOrder" (
          "id", "userId", "number", "productSku", "quantity", "status", "source",
          "idempotencyKey", "requestHash", "customerName", "customerEmail", "orderReference",
          "activationRegion", "useBefore", "notes", "externalSource", "externalOrderId",
          "externalLineId", "createdById", "apiKeyId"
        ) VALUES (
          ${orderId}, ${input.tenantId}, ${generateLicenceOrderNumber()}, ${input.productSku},
          ${input.quantity}, 'PENDING', ${input.source}, ${input.idempotencyKey},
          ${input.requestHash}, ${input.customerName ?? null}, ${input.customerEmail ?? null},
          ${input.orderReference ?? null}, ${input.activationRegion ?? null},
          ${input.useBefore ?? null}::date, ${input.notes ?? null}, ${input.externalSource ?? null},
          ${input.externalOrderId ?? null}, ${input.externalLineId ?? null},
          ${input.createdById ?? null}, ${input.apiKeyId ?? null}
        )
        ON CONFLICT DO NOTHING
        RETURNING "id"
      `);

      if (!inserted[0]) {
        const byKey = await selectOrder(
          tx,
          input.tenantId,
          Prisma.sql`o."idempotencyKey" = ${input.idempotencyKey}`,
        );
        if (byKey) {
          return byKey.requestHash === input.requestHash
            ? ({ kind: "existing", order: byKey } as const)
            : ({ kind: "idempotency_key_reused", order: byKey } as const);
        }
        if (input.externalSource && input.externalOrderId && input.externalLineId) {
          const byLine = await selectOrder(
            tx,
            input.tenantId,
            Prisma.sql`o."externalSource" = ${input.externalSource}
              AND o."externalOrderId" = ${input.externalOrderId}
              AND o."externalLineId" = ${input.externalLineId}`,
          );
          if (byLine) return { kind: "external_line_conflict", order: byLine } as const;
        }
        // Order-number collision (astronomically rare): retry with a new number.
        return null;
      }

      const reserved = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH picked AS (
          SELECT "id"
          FROM "DigitalLicenceCode"
          WHERE "userId" = ${input.tenantId}
            AND "productSku" = ${input.productSku}
            AND "status" = 'AVAILABLE'
          ORDER BY "createdAt", "id"
          LIMIT ${input.quantity}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "DigitalLicenceCode" c
        SET "status" = 'RESERVED', "orderId" = ${orderId}, "reservedAt" = NOW(), "updatedAt" = NOW()
        FROM picked
        WHERE c."id" = picked."id"
        RETURNING c."id"
      `);
      if (reserved.length < input.quantity) {
        // Throwing rolls back the order and every reservation made above.
        throw new InsufficientLicenceStockError(input.productSku, input.quantity, reserved.length);
      }

      await insertEvent(tx, {
        tenantId: input.tenantId,
        type: "ORDER_CREATED",
        actor: input.actor,
        orderId,
        details: { sku: input.productSku, quantity: input.quantity, source: input.source },
      });

      const order = await selectOrder(tx, input.tenantId, Prisma.sql`o."id" = ${orderId}`);
      return { kind: "created", order: order! } as const;
    });
    if (result) return result;
  }
  throw new Error("Impossible d’attribuer un numéro de licence unique.");
}

/**
 * Same order line asked again with other customer details before anything was
 * delivered (e.g. a corrected e-mail): the licence keeps its codes and takes
 * the new request. Returns false once delivered or cancelled.
 */
export async function adoptUndeliveredLicenceRequest(params: {
  tenantId: string;
  orderId: string;
  requestHash: string;
  customerName: string | null;
  customerEmail: string | null;
  orderReference: string | null;
  actor: string;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE "DigitalLicenceOrder"
      SET "requestHash" = ${params.requestHash}, "customerName" = ${params.customerName},
          "customerEmail" = ${params.customerEmail}, "orderReference" = ${params.orderReference},
          "updatedAt" = NOW()
      WHERE "userId" = ${params.tenantId} AND "id" = ${params.orderId} AND "status" IN ('PENDING', 'GENERATED')
      RETURNING "id"
    `);
    if (updated.length !== 1) return false;
    // Who receives the codes may have changed: kept in the audit trail (without the address).
    await insertEvent(tx, {
      tenantId: params.tenantId,
      type: "REQUEST_UPDATED",
      actor: params.actor,
      orderId: params.orderId,
    });
    return true;
  });
}

/** Licence already created for an idempotency key, if any. */
export async function findLicenceOrderByKey(tenantId: string, idempotencyKey: string) {
  return selectOrder(prisma, tenantId, Prisma.sql`o."idempotencyKey" = ${idempotencyKey}`);
}

export async function getLicenceOrder(tenantId: string, orderId: string) {
  return selectOrder(prisma, tenantId, Prisma.sql`o."id" = ${orderId}`);
}

/** Server-only: encrypted codes of an order, in allocation order. */
export async function getOrderCodeCiphertexts(
  tenantId: string,
  orderId: string,
): Promise<LicenceOrderCodeCipher[]> {
  return prisma.$queryRaw<LicenceOrderCodeCipher[]>(Prisma.sql`
    SELECT "id", "codeHint", "codeCiphertext", "keyVersion", "status"
    FROM "DigitalLicenceCode"
    WHERE "userId" = ${tenantId} AND "orderId" = ${orderId}
    ORDER BY "reservedAt", "createdAt", "id"
  `);
}

export async function getOrderCodeHints(tenantId: string, orderId: string) {
  return prisma.$queryRaw<{ id: string; codeHint: string; status: LicenceCodeStatus }[]>(Prisma.sql`
    SELECT "id", "codeHint", "status"
    FROM "DigitalLicenceCode"
    WHERE "userId" = ${tenantId} AND "orderId" = ${orderId}
    ORDER BY "reservedAt", "createdAt", "id"
  `);
}

/**
 * Called after a PDF was rendered: the codes are now exposed to a customer,
 * so they become USED (never available again). Idempotent.
 */
export async function markLicenceOrderGenerated(params: {
  tenantId: string;
  orderId: string;
  actor: string;
  kind: "generated" | "downloaded";
}) {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: LicenceOrderStatus }[]>(Prisma.sql`
      UPDATE "DigitalLicenceOrder"
      SET "status" = CASE WHEN "status" = 'PENDING' THEN 'GENERATED' ELSE "status" END,
          "generatedAt" = COALESCE("generatedAt", NOW()),
          "generationCount" = "generationCount" + 1,
          "lastDownloadedAt" = NOW(),
          "lastErrorCode" = NULL,
          "updatedAt" = NOW()
      WHERE "id" = ${params.orderId} AND "userId" = ${params.tenantId}
        AND "status" IN ('PENDING', 'GENERATED', 'DELIVERED')
      RETURNING "status"
    `);
    if (!rows[0]) throw new Error("Licence order cannot be generated");
    await tx.$executeRaw(Prisma.sql`
      UPDATE "DigitalLicenceCode"
      SET "status" = 'USED', "usedAt" = NOW(), "updatedAt" = NOW()
      WHERE "orderId" = ${params.orderId} AND "userId" = ${params.tenantId} AND "status" = 'RESERVED'
    `);
    await insertEvent(tx, {
      tenantId: params.tenantId,
      type: params.kind === "generated" ? "PDF_GENERATED" : "PDF_DOWNLOADED",
      actor: params.actor,
      orderId: params.orderId,
    });
  });
}

export async function recordLicenceOrderFailure(params: {
  tenantId: string;
  orderId: string;
  errorCode: string;
  actor: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "DigitalLicenceOrder"
      SET "lastErrorCode" = ${params.errorCode.slice(0, 64)}, "updatedAt" = NOW()
      WHERE "id" = ${params.orderId} AND "userId" = ${params.tenantId}
    `);
    await insertEvent(tx, {
      tenantId: params.tenantId,
      type: "PDF_FAILED",
      actor: params.actor,
      orderId: params.orderId,
      details: { errorCode: params.errorCode.slice(0, 64) },
    });
  });
}

/**
 * Cancels an order whose PDF was never produced and returns its codes to the
 * stock. Orders with a generated PDF cannot be cancelled here: their codes
 * were exposed and must not be resold.
 */
export async function cancelPendingLicenceOrder(params: {
  tenantId: string;
  orderId: string;
  actor: string;
}): Promise<{ released: number } | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE "DigitalLicenceOrder"
      SET "status" = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = ${params.orderId} AND "userId" = ${params.tenantId}
        AND "status" = 'PENDING' AND "generationCount" = 0
      RETURNING "id"
    `);
    if (!rows[0]) return null;
    const released = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE "DigitalLicenceCode"
      SET "status" = 'AVAILABLE', "orderId" = NULL, "reservedAt" = NULL, "updatedAt" = NOW()
      WHERE "orderId" = ${params.orderId} AND "userId" = ${params.tenantId} AND "status" = 'RESERVED'
      RETURNING "id"
    `);
    await insertEvent(tx, {
      tenantId: params.tenantId,
      type: "ORDER_CANCELLED",
      actor: params.actor,
      orderId: params.orderId,
      details: { releasedCodes: released.length },
    });
    return { released: released.length };
  });
}

export async function listLicenceOrders(params: {
  tenantId: string;
  productSku?: string | null;
  /** Restricts to one product family's SKUs (admin section of that family). */
  productSkus?: readonly string[] | null;
  status?: LicenceOrderStatus | null;
  search?: string | null;
  page: number;
  pageSize: number;
}): Promise<{ items: LicenceOrderRecord[]; total: number }> {
  const filters = [Prisma.sql`o."userId" = ${params.tenantId}`];
  if (params.productSku) filters.push(Prisma.sql`o."productSku" = ${params.productSku}`);
  if (params.productSkus) filters.push(skuInFilter(Prisma.sql`o."productSku"`, params.productSkus));
  if (params.status) filters.push(Prisma.sql`o."status" = ${params.status}`);
  if (params.search) {
    const pattern = `%${params.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    filters.push(Prisma.sql`(
      o."number" ILIKE ${pattern} OR o."customerName" ILIKE ${pattern}
      OR o."customerEmail" ILIKE ${pattern} OR o."orderReference" ILIKE ${pattern}
    )`);
  }
  const where = Prisma.join(filters, " AND ");
  const offset = (params.page - 1) * params.pageSize;
  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT ${ORDER_COLUMNS}
      FROM "DigitalLicenceOrder" o
      LEFT JOIN "User" u ON u."id" = o."createdById"
      WHERE ${where}
      ORDER BY o."createdAt" DESC, o."id" DESC
      LIMIT ${params.pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ count: number | string }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count" FROM "DigitalLicenceOrder" o WHERE ${where}
    `),
  ]);
  return { items: rows.map(mapOrder), total: Number(totals[0]?.count ?? 0) };
}

export async function listLicenceEvents(params: {
  tenantId: string;
  orderId?: string | null;
  /** Events of these SKUs only (through the order, else the event's details.sku). */
  productSkus?: readonly string[] | null;
  limit: number;
}): Promise<LicenceEventRecord[]> {
  const filters = [Prisma.sql`e."userId" = ${params.tenantId}`];
  if (params.orderId) filters.push(Prisma.sql`e."orderId" = ${params.orderId}`);
  if (params.productSkus) {
    filters.push(skuInFilter(Prisma.sql`COALESCE(o."productSku", e."details"->>'sku')`, params.productSkus));
  }
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT e."id", e."orderId", o."number" AS "orderNumber", e."codeId", e."type", e."actor",
           au."name" AS "actorName", e."details", e."createdAt"
    FROM "DigitalLicenceEvent" e
    LEFT JOIN "DigitalLicenceOrder" o ON o."id" = e."orderId"
    LEFT JOIN "User" au ON e."actor" = 'user:' || au."id"
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY e."createdAt" DESC, e."id" DESC
    LIMIT ${params.limit}
  `);
  return rows.map((row) => ({
    ...(row as unknown as LicenceEventRecord),
    details:
      typeof row.details === "string"
        ? (JSON.parse(row.details) as Record<string, unknown>)
        : ((row.details as Record<string, unknown> | null) ?? null),
    createdAt: toDate(row.createdAt) ?? new Date(0),
  }));
}

/** True once scripts/sql/20261110_digital_licences.sql has been applied. */
export async function isDigitalLicenceSchemaReady(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ready: boolean }[]>(Prisma.sql`
    SELECT (
      to_regclass('"DigitalLicenceCode"') IS NOT NULL
      AND to_regclass('"DigitalLicenceOrder"') IS NOT NULL
      AND to_regclass('"DigitalLicenceEvent"') IS NOT NULL
    ) AS "ready"
  `);
  return Boolean(rows[0]?.ready);
}
