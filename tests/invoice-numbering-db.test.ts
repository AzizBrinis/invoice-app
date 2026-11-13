import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-only modules used by the invoice service; irrelevant to numbering.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { createInvoiceForUser, type InvoiceInput } from "@/server/invoices";
import { invoiceNumberingYear, nextInvoiceNumber } from "@/server/sequences";

/**
 * Invoice numbering against a real Postgres database (TEST_DATABASE_URL).
 * Never point this at a production database: it creates and deletes a
 * temporary tenant.
 */
const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDb("invoice numbering (Postgres)", () => {
  const suffix = Date.now().toString(36);
  const year = invoiceNumberingYear();
  let userId: string;
  let clientId: string;

  const input = (overrides: Partial<InvoiceInput> = {}): InvoiceInput =>
    ({
      clientId,
      status: "ENVOYEE",
      issueDate: new Date(),
      currency: "TND",
      lines: [
        {
          productId: null,
          description: "Produit test",
          quantity: 1,
          unit: "unité",
          unitPriceHTCents: 0,
          unitPriceTTCCents: 119000,
          vatRate: 19,
          position: 0,
        },
      ],
      taxes: { applyFodec: false, applyTimbre: true },
      ...overrides,
    }) as InvoiceInput;

  const sequenceCounter = async () => {
    const rows = await prisma.$queryRaw<{ counter: number }[]>(Prisma.sql`
      SELECT "counter" FROM "NumberingSequence"
      WHERE "userId" = ${userId} AND "type" = CAST('FACTURE' AS "SequenceType") AND "year" = ${year}
    `);
    return rows[0]?.counter ?? null;
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `numbering-${suffix}@example.com`,
        passwordHash: "hashed",
        name: "Numbering test",
      },
    });
    userId = user.id;
    const client = await prisma.client.create({
      data: { userId, displayName: "Client numérotation", email: `client-${suffix}@example.com` },
    });
    clientId = client.id;
  });

  afterAll(async () => {
    if (!userId) return;
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.client.deleteMany({ where: { userId } });
    await prisma.numberingSequence.deleteMany({ where: { userId } });
    await prisma.companySettings.deleteMany({ where: { userId } });
    await prisma.messagingSettings.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("starts a new tenant at 0001", async () => {
    const invoice = await createInvoiceForUser(userId, input());
    expect(invoice.number).toBe(`FAC-${year}-0001`);
    expect(await sequenceCounter()).toBe(1);
  });

  it("continues after the highest number already issued, including typed ones", async () => {
    // A number typed manually in the editor, far ahead of the stored counter.
    await createInvoiceForUser(userId, input({ number: `FAC-${year}-0483` }));
    expect(await sequenceCounter()).toBe(1);

    const next = await createInvoiceForUser(userId, input());
    expect(next.number).toBe(`FAC-${year}-0484`);
    expect(await sequenceCounter()).toBe(484);
  });

  it("ignores numbers that do not belong to the sequence pattern", async () => {
    await createInvoiceForUser(userId, input({ number: `AVOIR-${year}-9000` }));
    await createInvoiceForUser(userId, input({ number: `FAC-${year}-12A` }));
    const next = await createInvoiceForUser(userId, input());
    expect(next.number).toBe(`FAC-${year}-0485`);
  });

  it("never issues the same number twice under concurrency", async () => {
    const created = await Promise.all(
      Array.from({ length: 12 }, () => createInvoiceForUser(userId, input())),
    );
    const numbers = created.map((invoice) => invoice.number).sort();
    expect(new Set(numbers).size).toBe(12);
    expect(numbers).toEqual(
      Array.from({ length: 12 }, (_, index) => `FAC-${year}-${String(486 + index).padStart(4, "0")}`),
    );
    expect(await sequenceCounter()).toBe(497);
  });

  it("does not consume a number when the invoice cannot be created", async () => {
    const before = await sequenceCounter();
    // Unknown client id: the invoice insert fails on the foreign key.
    await expect(
      createInvoiceForUser(userId, input({ clientId: "missing-client" })),
    ).rejects.toThrow();
    expect(await sequenceCounter()).toBe(before);
    const next = await createInvoiceForUser(userId, input());
    expect(next.number).toBe(`FAC-${year}-${String((before ?? 0) + 1).padStart(4, "0")}`);
  });

  it("rolls back the invoice and the number together when a line fails", async () => {
    const before = await sequenceCounter();
    const countBefore = await prisma.invoice.count({ where: { userId } });
    await expect(
      createInvoiceForUser(
        userId,
        input({
          lines: [
            {
              productId: "missing-product",
              description: "Produit inconnu",
              quantity: 1,
              unit: "unité",
              unitPriceHTCents: 1000,
              vatRate: 19,
              position: 0,
            },
          ],
        } as Partial<InvoiceInput>),
      ),
    ).rejects.toThrow();
    expect(await sequenceCounter()).toBe(before);
    expect(await prisma.invoice.count({ where: { userId } })).toBe(countBefore);
  });

  it("uses the same allocator for standalone reservations", async () => {
    const before = await sequenceCounter();
    const number = await nextInvoiceNumber(userId);
    expect(number).toBe(`FAC-${year}-${String((before ?? 0) + 1).padStart(4, "0")}`);
  });
});
