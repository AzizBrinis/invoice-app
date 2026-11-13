import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { decryptLicenceCode } from "@/server/digital-products/licence-crypto";
import {
  getKasperskyInventory,
  importLicenceCodes,
  parseLicenceRequest,
  requestLicenceDocument,
} from "@/server/digital-products/licences";
import {
  cancelPendingLicenceOrder,
  getOrderCodeCiphertexts,
  InsufficientLicenceStockError,
  listLicenceCodes,
  listLicenceEvents,
  markLicenceOrderGenerated,
  revokeLicenceCode,
} from "@/server/digital-products/store";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const MIGRATION = path.resolve(process.cwd(), "scripts/sql/20261110_digital_licences.sql");
const SKU = "kaspersky-standard-3p-1y";

function code(index: number) {
  return `TSTA${String(index).padStart(16, "0")}`;
}

describeWithDb("digital licence store (Postgres)", () => {
  let tenantId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");
    await prisma.$executeRawUnsafe(sql);
    await prisma.$executeRawUnsafe(sql); // idempotent
    const user = await prisma.user.create({
      data: {
        email: `digital-licences-${suffix}@example.com`,
        passwordHash: "hashed",
        name: "Digital Licence Test",
      },
    });
    tenantId = user.id;
  });

  afterAll(async () => {
    if (!tenantId) return;
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceEvent" WHERE "userId" = ${tenantId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceCode" WHERE "userId" = ${tenantId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceOrder" WHERE "userId" = ${tenantId}`);
    await prisma.user.delete({ where: { id: tenantId } });
  });

  it("imports encrypted codes and prevents duplicates across variants", async () => {
    const first = await importLicenceCodes({
      tenantId,
      actorUserId: tenantId,
      sku: SKU,
      text: [code(1), code(2), code(3), code(1), "bad"].join("\n"),
      batchLabel: "lot A",
    });
    expect(first).toMatchObject({ imported: 3, alreadyStored: 0, duplicateLines: [4], invalidLines: [5] });

    // Same code under another variant is still a duplicate.
    const second = await importLicenceCodes({
      tenantId,
      actorUserId: tenantId,
      sku: "kaspersky-plus-1p-1y",
      text: `${code(2)}\n${code(4)}`,
    });
    expect(second).toMatchObject({ imported: 1, alreadyStored: 1 });

    const raw = await prisma.$queryRaw<{ codeCiphertext: string; codeHint: string }[]>(Prisma.sql`
      SELECT "codeCiphertext", "codeHint" FROM "DigitalLicenceCode" WHERE "userId" = ${tenantId}
    `);
    expect(raw).toHaveLength(4);
    for (const row of raw) {
      expect(row.codeCiphertext).not.toContain("TSTA");
      expect(row.codeHint).toHaveLength(4);
    }
  });

  it("allocates atomically under concurrency and never double-allocates", async () => {
    const request = parseLicenceRequest({ sku: SKU, quantity: 2 });
    const attempts = await Promise.allSettled([
      requestLicenceDocument({ tenantId, request, idempotencyKey: `t:${suffix}:a`, source: "MANUAL", actor: "test" }),
      requestLicenceDocument({ tenantId, request, idempotencyKey: `t:${suffix}:b`, source: "MANUAL", actor: "test" }),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    const rejected = attempts.filter((attempt) => attempt.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientLicenceStockError);

    // The failed attempt left no order and reserved nothing.
    const orders = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count" FROM "DigitalLicenceOrder" WHERE "userId" = ${tenantId}
    `);
    expect(Number(orders[0].count)).toBe(1);
    const inventory = await getKasperskyInventory(tenantId);
    const standard3 = inventory.find((row) => row.variant.sku === SKU)!;
    expect(standard3.counts).toMatchObject({ AVAILABLE: 1, RESERVED: 2, USED: 0 });
  });

  it("replays idempotent requests with the same codes and rejects key reuse", async () => {
    await importLicenceCodes({ tenantId, actorUserId: tenantId, sku: SKU, text: `${code(10)}\n${code(11)}` });
    const request = parseLicenceRequest({ sku: SKU, quantity: 1, customerName: "Client" });
    const key = `t:${suffix}:replay`;
    const created = await requestLicenceDocument({ tenantId, request, idempotencyKey: key, source: "API", actor: "test" });
    const replay = await requestLicenceDocument({ tenantId, request, idempotencyKey: key, source: "API", actor: "test" });
    expect(created.kind).toBe("created");
    expect(replay).toMatchObject({ kind: "existing", order: { id: created.order.id } });

    const changed = await requestLicenceDocument({
      tenantId,
      request: { ...request, quantity: 2 },
      idempotencyKey: key,
      source: "API",
      actor: "test",
    });
    expect(changed.kind).toBe("idempotency_key_reused");

    const ciphers = await getOrderCodeCiphertexts(tenantId, created.order.id);
    expect(ciphers).toHaveLength(1);
    const plain = decryptLicenceCode({ tenantId, codeId: ciphers[0].id, ciphertext: ciphers[0].codeCiphertext });
    expect(plain).toMatch(/^TSTA\d{16}$/);

    // Generation consumes the codes; a generated order cannot be cancelled.
    await markLicenceOrderGenerated({ tenantId, orderId: created.order.id, actor: "test", kind: "generated" });
    expect(await cancelPendingLicenceOrder({ tenantId, orderId: created.order.id, actor: "test" })).toBeNull();
    const used = await listLicenceCodes({ tenantId, status: "USED", page: 1, pageSize: 10 });
    expect(used.items.map((item) => item.orderId)).toEqual([created.order.id]);
  });

  it("enforces one licence per external order line", async () => {
    await importLicenceCodes({ tenantId, actorUserId: tenantId, sku: SKU, text: `${code(20)}\n${code(21)}` });
    const request = parseLicenceRequest({ sku: SKU, quantity: 1 });
    const external = { source: "prestashop", orderId: "42", lineId: "7" };
    const first = await requestLicenceDocument({
      tenantId, request, idempotencyKey: `t:${suffix}:ext1`, source: "PRESTASHOP", actor: "test", external,
    });
    const second = await requestLicenceDocument({
      tenantId, request, idempotencyKey: `t:${suffix}:ext2`, source: "PRESTASHOP", actor: "test", external,
    });
    expect(first.kind).toBe("created");
    expect(second).toMatchObject({ kind: "external_line_conflict", order: { id: first.order.id } });
  });

  it("cancels pending orders back to stock and revokes only available codes", async () => {
    const before = (await getKasperskyInventory(tenantId)).find((row) => row.variant.sku === SKU)!;
    const request = parseLicenceRequest({ sku: SKU, quantity: 1 });
    const pending = await requestLicenceDocument({
      tenantId, request, idempotencyKey: `t:${suffix}:cancel`, source: "MANUAL", actor: "test",
    });
    expect(await cancelPendingLicenceOrder({ tenantId, orderId: pending.order.id, actor: "test" })).toEqual({ released: 1 });
    const after = (await getKasperskyInventory(tenantId)).find((row) => row.variant.sku === SKU)!;
    expect(after.counts.AVAILABLE).toBe(before.counts.AVAILABLE);

    const available = await listLicenceCodes({ tenantId, productSku: SKU, status: "AVAILABLE", page: 1, pageSize: 1 });
    const reserved = await listLicenceCodes({ tenantId, status: "RESERVED", page: 1, pageSize: 1 });
    expect(await revokeLicenceCode({ tenantId, codeId: available.items[0].id, actor: "test" })).toBe(true);
    expect(await revokeLicenceCode({ tenantId, codeId: reserved.items[0].id, actor: "test" })).toBe(false);

    const events = await listLicenceEvents({ tenantId, limit: 100 });
    const types = new Set(events.map((event) => event.type));
    for (const type of ["CODES_IMPORTED", "ORDER_CREATED", "PDF_GENERATED", "ORDER_CANCELLED", "CODE_REVOKED"]) {
      expect(types.has(type)).toBe(true);
    }
    expect(JSON.stringify(events)).not.toContain("TSTA");
  });
});
