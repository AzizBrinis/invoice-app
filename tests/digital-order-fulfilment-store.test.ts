import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import {
  markLicenceOrdersDelivered,
  postgresFulfilmentStore as store,
  type FulfilmentClaimInput,
} from "@/server/digital-products/fulfilment-store";
import {
  importLicenceCodes,
  parseLicenceRequest,
  requestLicenceDocument,
} from "@/server/digital-products/licences";
import { markLicenceOrderGenerated } from "@/server/digital-products/store";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const MIGRATIONS = [
  "scripts/sql/20261109_external_invoice_requests.sql",
  "scripts/sql/20261110_digital_licences.sql",
  "scripts/sql/20261113_digital_order_fulfilment.sql",
].map((file) => path.resolve(process.cwd(), file));

describeWithDb("digital-order fulfilment store (Postgres)", () => {
  let tenantId: string;
  const suffix = Date.now().toString(36);
  const input = (overrides: Partial<FulfilmentClaimInput> = {}): FulfilmentClaimInput => ({
    tenantUserId: tenantId,
    shopId: "1",
    externalOrderId: `o-${suffix}`,
    orderReference: "REFTEST",
    idempotencyKey: `ps-1-${suffix}`,
    requestHash: "hash-a",
    ...overrides,
  });

  beforeAll(async () => {
    for (const file of MIGRATIONS) {
      const sql = fs.readFileSync(file, "utf8");
      await prisma.$executeRawUnsafe(sql);
      await prisma.$executeRawUnsafe(sql); // idempotent
    }
    const user = await prisma.user.create({
      data: { email: `fulfilment-${suffix}@example.com`, passwordHash: "x", name: "Fulfilment Test" },
    });
    tenantId = user.id;
  });

  afterAll(async () => {
    if (!tenantId) return;
    for (const table of ["DigitalOrderFulfilment", "DigitalLicenceEvent", "DigitalLicenceCode", "DigitalLicenceOrder"]) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${table}"`)} WHERE "userId" = ${tenantId}`);
    }
    await prisma.user.delete({ where: { id: tenantId } });
  });

  it("claims once, blocks concurrent work, reclaims after failure, replays when completed", async () => {
    const first = await store.claim(input());
    expect(first.kind).toBe("claimed");
    const id = first.kind === "claimed" ? first.record.id : "";
    expect((await store.claim(input())).kind).toBe("in_progress");

    await store.markFailed(id, "EMAIL_SEND_FAILED");
    const again = await store.claim(input({ requestHash: "hash-b" }));
    expect(again).toMatchObject({ kind: "claimed", record: { id, attempts: 2 } });

    await store.saveProgress(id, { licenceOrderIds: ["a", "b"] });
    await store.markEmailSent(id, { to: "client@example.com", subject: "Commande REFTEST" });
    await store.markCompleted(id);
    const done = await store.claim(input({ requestHash: "hash-c" }));
    expect(done).toMatchObject({
      kind: "completed",
      record: { licenceOrderIds: ["a", "b"], emailSubject: "Commande REFTEST", status: "COMPLETED" },
    });
    expect(done.kind === "completed" && done.record.emailSentAt instanceof Date).toBe(true);
    const stored = await prisma.$queryRaw<{ kind: string }[]>(Prisma.sql`
      SELECT jsonb_typeof("licenceOrderIds") AS "kind" FROM "DigitalOrderFulfilment" WHERE "id" = ${id}
    `);
    expect(stored[0].kind).toBe("array");

    // The same key for another order is refused.
    expect((await store.claim(input({ externalOrderId: `other-${suffix}` }))).kind).toBe("idempotency_key_reused");
  });

  it("marks licence orders delivered and links the invoice, once", async () => {
    await importLicenceCodes({
      tenantId, actorUserId: tenantId, sku: "kaspersky-plus-1p-1y", text: `FULF${suffix.toUpperCase().padEnd(16, "0")}`.slice(0, 20),
    });
    const created = await requestLicenceDocument({
      tenantId,
      request: parseLicenceRequest({ sku: "kaspersky-plus-1p-1y", quantity: 1 }),
      idempotencyKey: `api:ps-1-${suffix}-1`,
      source: "PRESTASHOP",
      actor: "test",
    });
    await markLicenceOrderGenerated({ tenantId, orderId: created.order.id, actor: "test", kind: "generated" });
    const invoice = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "Invoice" LIMIT 1`);
    if (!invoice[0]) return; // no invoice in this database: the link itself cannot be asserted
    await markLicenceOrdersDelivered({ tenantId, orderIds: [created.order.id], invoiceId: invoice[0].id, actor: "test" });
    await markLicenceOrdersDelivered({ tenantId, orderIds: [created.order.id], invoiceId: invoice[0].id, actor: "test" });
    const rows = await prisma.$queryRaw<{ status: string; invoiceId: string; deliveredAt: Date | null; events: number }[]>(Prisma.sql`
      SELECT o."status", o."invoiceId", o."deliveredAt",
        (SELECT COUNT(*)::int FROM "DigitalLicenceEvent" e WHERE e."orderId" = o."id" AND e."type" = 'DELIVERED') AS "events"
      FROM "DigitalLicenceOrder" o WHERE o."id" = ${created.order.id}
    `);
    expect(rows[0]).toMatchObject({ status: "DELIVERED", invoiceId: invoice[0].id, events: 1 });
    // jsonb columns hold real JSON objects/arrays (not JSON-encoded strings).
    const kinds = await prisma.$queryRaw<{ kind: string }[]>(Prisma.sql`
      SELECT DISTINCT jsonb_typeof("details") AS "kind" FROM "DigitalLicenceEvent"
      WHERE "userId" = ${tenantId} AND "details" IS NOT NULL
    `);
    expect(kinds.map((row) => row.kind)).toEqual(["object"]);
    expect(rows[0].deliveredAt).not.toBeNull();
  });
});
