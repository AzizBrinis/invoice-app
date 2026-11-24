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
import { adoptUndeliveredLicenceRequest, findLicenceOrderByKey, markLicenceOrderGenerated } from "@/server/digital-products/store";
import { countCodesReleasedLastHour } from "@/server/digital-products/delivery-policy";
import { allowLoginAttempt } from "@/server/security/login-throttle";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const MIGRATIONS = [
  "scripts/sql/20261109_external_invoice_requests.sql",
  "scripts/sql/20261110_digital_licences.sql",
  "scripts/sql/20261113_digital_order_fulfilment.sql",
  "scripts/sql/20261123_digital_order_review.sql",
  "scripts/sql/20261124_digital_order_shop_callback.sql",
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

  it("holds a reviewed order, binds \"Envoyer\" to the request that was read, and can withdraw it", async () => {
    const order = input({ externalOrderId: `rev-${suffix}`, idempotencyKey: `ps-1-rev-${suffix}` });
    const first = await store.claim(order);
    const id = first.kind === "claimed" ? first.record.id : "";
    await store.markAwaitingReview(id, { payload: { a: 1 }, keyId: "k" });

    // Automatic delivery is held; the row is untouched.
    expect(await store.claim({ ...order, holdIfReviewed: true })).toMatchObject({ kind: "awaiting_review", record: { id, attempts: 1 } });
    const read = (await store.findReview(tenantId, id))!;
    expect(read.reviewPayload).toEqual({ a: 1 });

    // The shop sends the order again between the read and the send.
    expect((await store.claim(order)).kind).toBe("claimed");
    await store.markAwaitingReview(id, { payload: { a: 2 }, keyId: "k" });
    expect((await store.claim({ ...order, expectedAttempts: read.attempts })).kind).toBe("changed");
    // Withdrawing a version that is no longer the stored one does nothing.
    await store.refuseReview(id, "ORDER_NOT_PAID", read.attempts);
    expect((await store.findReview(tenantId, id))!.reviewPayload).toEqual({ a: 2 });

    // Ten simultaneous sends of the current version: exactly one goes through.
    const current = (await store.findReview(tenantId, id))!;
    const claims = await Promise.all(Array.from({ length: 10 }, () => store.claim({ ...order, expectedAttempts: current.attempts })));
    expect(claims.filter((claim) => claim.kind === "claimed")).toHaveLength(1);

    await store.markFailed(id, "EMAIL_SEND_FAILED");
    const latest = (await store.findReview(tenantId, id))!;
    await store.refuseReview(id, "ORDER_NOT_PAID", latest.attempts);
    expect(await store.findReview(tenantId, id)).toMatchObject({ reviewPayload: null, reviewKeyId: null, lastErrorCode: "ORDER_NOT_PAID" });
    expect((await store.claim({ ...order, holdIfReviewed: true })).kind).toBe("claimed"); // paid again later: not blocked
  });

  it("counts exposed codes, audits a changed recipient and finds a licence by key", async () => {
    await importLicenceCodes({
      tenantId, actorUserId: tenantId, sku: "kaspersky-plus-5p-1y", text: `AUD3${suffix.toUpperCase().padEnd(16, "1")}`.slice(0, 20),
    });
    const before = await countCodesReleasedLastHour(tenantId, "none");
    const created = await requestLicenceDocument({
      tenantId,
      request: parseLicenceRequest({ sku: "kaspersky-plus-5p-1y", quantity: 1, customerEmail: "a@example.com" }),
      idempotencyKey: `api:ps-1-aud3-${suffix}`,
      source: "PRESTASHOP",
      actor: "test",
      external: { source: "prestashop", orderId: `aud3-${suffix}`, lineId: "1" },
    });
    expect(await countCodesReleasedLastHour(tenantId, "none")).toBe(before); // reserved only
    expect(await adoptUndeliveredLicenceRequest({
      tenantId, orderId: created.order.id, requestHash: "h", customerName: "B", customerEmail: "b@example.com", orderReference: "R", actor: "api:k",
    })).toBe(true);
    const events = await prisma.$queryRaw<{ actor: string; details: unknown }[]>(Prisma.sql`
      SELECT "actor", "details" FROM "DigitalLicenceEvent" WHERE "orderId" = ${created.order.id} AND "type" = 'REQUEST_UPDATED'
    `);
    expect(events).toEqual([{ actor: "api:k", details: null }]);
    await markLicenceOrderGenerated({ tenantId, orderId: created.order.id, actor: "test", kind: "generated" });
    expect(await countCodesReleasedLastHour(tenantId, "none")).toBe(before + 1);
    expect(await countCodesReleasedLastHour(tenantId, `aud3-${suffix}`)).toBe(before); // its own retry
    expect(await countCodesReleasedLastHour("other-tenant", "none")).toBe(0);
    expect((await findLicenceOrderByKey(tenantId, `api:ps-1-aud3-${suffix}`))?.id).toBe(created.order.id);
    expect(await findLicenceOrderByKey("other-tenant", `api:ps-1-aud3-${suffix}`)).toBeNull();
  });

  it("throttles logins through Postgres, whatever the instance", async () => {
    const headers = new Headers({ "x-real-ip": "192.0.2.77" });
    let allowed = 0;
    for (let i = 0; i < 13; i += 1) {
      delete (globalThis as Record<string, unknown>).__publicRouteRateLimitStore; // another instance
      if (await allowLoginAttempt(headers, `login-${suffix}@example.com`)) allowed += 1;
    }
    expect(allowed).toBe(10);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "IntegrationRequestNonce" WHERE "keyId" LIKE 'login:%'`);
  });
});
