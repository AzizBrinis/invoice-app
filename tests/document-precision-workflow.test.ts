import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createInvoiceForUser, updateInvoice, duplicateInvoice, getInvoice } from "@/server/invoices";
import { createQuoteForUser, updateQuote, duplicateQuote, convertQuoteToInvoiceForUser, getQuote } from "@/server/quotes";
import { buildDocumentHtml, generateInvoicePdf, generateQuotePdf } from "@/server/pdf";
import { documentLinePricePayload } from "@/lib/document-line-pricing";
import { fromCents } from "@/lib/money";
import { formatCurrency } from "@/lib/formatters";
import { DEFAULT_TAX_CONFIGURATION, normalizeTaxConfiguration } from "@/lib/taxes";

let userId: string;
let clientId: string;
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(async () => ({ id: userId })) }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseTests("three-decimal document workflow (PostgreSQL)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `precision-${Date.now()}@example.test`, passwordHash: "test" } });
    userId = user.id;
    const client = await prisma.client.create({ data: { userId, displayName: "Client précision" } });
    clientId = client.id;
    await prisma.companySettings.create({ data: { userId, companyName: "Precision Test", defaultCurrency: "EUR",
      taxConfiguration: DEFAULT_TAX_CONFIGURATION } });
  });
  afterAll(async () => {
    if (!userId) return;
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.quote.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  const payload = (currency = "EUR") => ({
    clientId, currency, issueDate: new Date(), status: "BROUILLON" as const, globalDiscountRate: 1.234,
    lines: [{ description: "Service précision", unit: "unité", quantity: 3, position: 0,
      ...documentLinePricePayload({ unitPrice: "12,345", vatRate: 19 }, currency), vatRate: 19, discountRate: 12.345 }],
    taxes: { applyFodec: false, applyTimbre: false },
  });

  for (const kind of ["invoice", "quote"] as const) {
    for (const currency of ["EUR", "TND"]) {
      it(`creates, reloads, edits, duplicates and renders ${currency} ${kind} without precision loss`, async () => {
        const create = kind === "invoice" ? createInvoiceForUser : createQuoteForUser;
        const update = kind === "invoice" ? updateInvoice : updateQuote;
        const get = kind === "invoice" ? getInvoice : getQuote;
        const original = await create(userId, payload(currency));
        const reopened = await get(original.id);
        if (!reopened) throw new Error("Document not found");
        expect(reopened.lines[0].unitPriceHTCents).toBe(currency === "TND" ? 12345 : 1234.5);
        expect(typeof reopened.lines[0].unitPriceHTCents).toBe("number");
        expect(reopened.lines[0].discountRate).toBe(12.345);
        expect(reopened.globalDiscountRate).toBe(1.234);
        if (currency === "EUR") expect(reopened).toMatchObject({ totalTTCCents: 3816, totalTVACents: 609 });
        const resaved = await update(original.id, { ...payload(currency), lines: [{ ...payload(currency).lines[0],
          ...documentLinePricePayload({ unitPrice: fromCents(reopened.lines[0].unitPriceHTCents, currency), vatRate: 19 }, currency),
          discountRate: reopened.lines[0].discountRate,
        }] });
        expect(resaved.totalTTCCents).toBe(original.totalTTCCents);
        const duplicated = kind === "invoice" ? await duplicateInvoice(original.id) : await duplicateQuote(original.id);
        expect(duplicated.lines[0].unitPriceHTCents).toBe(reopened.lines[0].unitPriceHTCents);
        expect(duplicated.totalTTCCents).toBe(original.totalTTCCents);
        if (kind === "quote") {
          const converted = await convertQuoteToInvoiceForUser(userId, original.id);
          expect(converted.totalTTCCents).toBe(original.totalTTCCents);
          const invoice = await getInvoice(converted.id);
          if (!invoice) throw new Error("Invoice not found");
          expect(invoice.lines[0].unitPriceHTCents).toBe(reopened.lines[0].unitPriceHTCents);
          expect(invoice.lines[0].discountRate).toBe(12.345);
        }
        const html = buildDocumentHtml(kind, { ...reopened, payments: [] } as Parameters<typeof buildDocumentHtml>[1], { companyName: "Precision Test", defaultCurrency: currency, paymentTerms: null, defaultConditions: null });
        expect(html).toContain("12,345");
        expect(html).toContain("12,345 %");
        expect(html).toContain("1,234 %");
        expect(html).toContain(formatCurrency(fromCents(original.totalTTCCents, currency), currency));
        if (process.env.RUN_PDF_TESTS === "true") {
          const pdf = kind === "invoice" ? await generateInvoicePdf(original.id) : await generateQuotePdf(original.id);
          expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
          expect(pdf.length).toBeGreaterThan(2000);
          if (process.env.PRECISION_TEST_ARTIFACT_DIR) {
            const { mkdirSync, writeFileSync } = await import("node:fs");
            const { join } = await import("node:path");
            mkdirSync(process.env.PRECISION_TEST_ARTIFACT_DIR, { recursive: true });
            writeFileSync(join(process.env.PRECISION_TEST_ARTIFACT_DIR, `${kind}-${currency}.pdf`), pdf);
          }
        }
      }, 30000);
    }

    it(`persists fractional fixed discounts and exact TTC snapshots for ${kind}`, async () => {
      const create = kind === "invoice" ? createInvoiceForUser : createQuoteForUser;
      const get = kind === "invoice" ? getInvoice : getQuote;
      const update = kind === "invoice" ? updateInvoice : updateQuote;
      const input = { ...payload(), globalDiscountRate: null, globalDiscountAmountCents: 123.4,
        lines: [{ ...payload().lines[0], discountRate: null, discountAmountCents: 12.3, unitPriceTTCCents: 1234.5 }] };
      const created = await create(userId, input);
      const reopened = await get(created.id);
      if (!reopened) throw new Error("Document not found");
      expect(reopened.globalDiscountAmountCents).toBe(123.4);
      expect(reopened.lines[0].discountAmountCents).toBe(12.3);
      expect(normalizeTaxConfiguration(reopened.taxConfiguration).linePricing?.[0].unitPriceTTCCents).toBe(1234.5);
      expect(Number.isInteger(reopened.totalTTCCents)).toBe(true);
      const resaved = await update(created.id, input);
      expect(resaved.totalTTCCents).toBe(created.totalTTCCents);
    });
  }
});

databaseTests("document precision migration", () => {
  it("preserves legacy values, supports fractions, and can be reapplied", async () => {
    const postgres = (await import("postgres")).default;
    const { readFileSync } = await import("node:fs");
    const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
    const schema = `precision_${Date.now()}`;
    const tables = {
      InvoiceLine: ["unitPriceHTCents", "discountAmountCents"],
      QuoteLine: ["unitPriceHTCents", "discountAmountCents"],
      Invoice: ["globalDiscountAmountCents"], Quote: ["globalDiscountAmountCents"],
    };
    try {
      await sql.unsafe(`CREATE SCHEMA "${schema}"`);
      for (const [table, fields] of Object.entries(tables)) {
        await sql.unsafe(`CREATE TABLE "${schema}"."${table}" (id integer PRIMARY KEY, ${fields.map(field => `"${field}" integer`).join(", ")}, "totalTTCCents" integer)`);
        for (const [id, value] of [null, 0, 1234, 2147483647].entries()) {
          await sql.unsafe(`INSERT INTO "${schema}"."${table}" VALUES (${id}, ${fields.map(() => value ?? "NULL").join(", ")}, 1200)`);
        }
      }
      const migration = readFileSync("scripts/sql/20261106_document_input_precision.sql", "utf8")
        .replaceAll('public."', `"${schema}"."`);
      await sql.unsafe(migration);
      await sql.unsafe(migration);
      for (const [table, fields] of Object.entries(tables)) {
        const rows = await sql.unsafe(`SELECT * FROM "${schema}"."${table}" ORDER BY id`);
        for (const field of fields) {
          expect(rows.map(row => row[field] == null ? null : Number(row[field]))).toEqual([null, 0, 1234, 2147483647]);
        }
        await sql.unsafe(`INSERT INTO "${schema}"."${table}" VALUES (4, ${fields.map(() => 1234.5).join(", ")}, 1200)`);
        const [fraction] = await sql.unsafe(`SELECT * FROM "${schema}"."${table}" WHERE id = 4`);
        expect(Number(fraction[fields[0]])).toBe(1234.5);
        expect(fraction.totalTTCCents).toBe(1200);
      }
    } finally {
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
  });
});
