import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import {
  postgresPrestashopInvoiceStore as store,
  type ClaimInput,
} from "@/server/integrations/prestashop/store";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const MIGRATION = path.resolve(process.cwd(), "scripts/sql/20261109_external_invoice_requests.sql");

describeWithDb("PrestaShop invoice store (Postgres)", () => {
  let userId: string;
  const suffix = Date.now().toString(36);

  const claimInput = (overrides: Partial<ClaimInput> = {}): ClaimInput => ({
    tenantUserId: userId,
    shopId: "1",
    externalOrderId: `order-${suffix}`,
    externalOrderReference: `REF${suffix}`.toUpperCase(),
    idempotencyKey: `key-${suffix}-1`,
    payloadHash: "hash-a",
    ...overrides,
  });

  beforeAll(async () => {
    // The migration is idempotent: running it twice must succeed.
    const sql = fs.readFileSync(MIGRATION, "utf8");
    await prisma.$executeRawUnsafe(sql);
    await prisma.$executeRawUnsafe(sql);
    const user = await prisma.user.create({
      data: {
        email: `prestashop-store-${suffix}@example.com`,
        passwordHash: "hashed",
        name: "PrestaShop Store Test",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "ExternalInvoiceRequest" WHERE "userId" = ${userId}`);
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "IntegrationRequestNonce" WHERE "keyId" LIKE ${`test-${suffix}%`}`);
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it("detects nonce replays and counts recent requests per key", async () => {
    const keyId = `test-${suffix}`;
    expect(await store.registerNonce(keyId, "nonce-aaaaaaaaaaaaaaaa", 600)).toBe(true);
    expect(await store.registerNonce(keyId, "nonce-aaaaaaaaaaaaaaaa", 600)).toBe(false);
    expect(await store.registerNonce(`${keyId}-other`, "nonce-aaaaaaaaaaaaaaaa", 600)).toBe(true);
    expect(await store.registerNonce(keyId, "nonce-bbbbbbbbbbbbbbbb", 600)).toBe(true);
    expect(await store.countRecentRequests(keyId, 60)).toBe(2);
    await expect(store.purgeExpiredNonces()).resolves.toBeUndefined();
  });

  it("claims an order once and reports duplicates", async () => {
    const first = await store.claimRequest(claimInput());
    expect(first.kind).toBe("claimed");

    expect((await store.claimRequest(claimInput({ idempotencyKey: `key-${suffix}-2` }))).kind).toBe("in_progress");
    expect(
      (await store.claimRequest(claimInput({ externalOrderId: `other-${suffix}` }))).kind,
    ).toBe("idempotency_key_reused");

    if (first.kind !== "claimed") throw new Error("unreachable");
    await store.markFailed(first.requestId, "INVOICE_GENERATION_FAILED");
    const retried = await store.claimRequest(claimInput({ payloadHash: "hash-b" }));
    expect(retried).toMatchObject({ kind: "claimed", reclaimed: true, requestId: first.requestId });
  });

  it("allows only one concurrent reclaim of a failed request", async () => {
    const input = claimInput({ externalOrderId: `race-${suffix}`, idempotencyKey: `race-${suffix}` });
    const first = await store.claimRequest(input);
    if (first.kind !== "claimed") throw new Error("expected claim");
    await store.markFailed(first.requestId, "INTERNAL_ERROR");
    const results = await Promise.all([store.claimRequest(input), store.claimRequest(input)]);
    expect(results.filter((result) => result.kind === "claimed")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "in_progress")).toHaveLength(1);
  });

  it("allows only one concurrent first claim", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        store.claimRequest(
          claimInput({ externalOrderId: `burst-${suffix}`, idempotencyKey: `burst-${suffix}-${index}` }),
        ),
      ),
    );
    expect(results.filter((result) => result.kind === "claimed")).toHaveLength(1);
  });

  it("checks the tenant", async () => {
    expect(await store.tenantExists(userId)).toBe(true);
    expect(await store.tenantExists(`missing-${suffix}`)).toBe(false);
  });
});
