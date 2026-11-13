import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TAX_CONFIGURATION, normalizeTaxConfiguration } from "@/lib/taxes";
import { restoreDocumentLineTTC } from "@/lib/document-line-pricing";
import { createQuoteForUser, updateQuote, duplicateQuote, convertQuoteToInvoiceForUser } from "@/server/quotes";
import { createInvoiceForUser, updateInvoice, duplicateInvoice } from "@/server/invoices";

const db = vi.hoisted(() => ({
  quote: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  invoice: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  quoteLine: { deleteMany: vi.fn() }, invoiceLine: { deleteMany: vi.fn() },
  client: { findFirst: vi.fn() }, product: { count: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "tenant" }) }));
vi.mock("@/server/sequences", () => ({ nextQuoteNumber: vi.fn().mockResolvedValue("Q-1"), nextInvoiceNumber: vi.fn().mockResolvedValue("I-1"), nextInvoiceNumberWithDatabaseClient: vi.fn().mockResolvedValue("I-1") }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: vi.fn() }));
vi.mock("@/server/settings", () => ({ getSettingsDocumentDefaults: vi.fn(async () => ({
  defaultCurrency: "TND", taxConfiguration: DEFAULT_TAX_CONFIGURATION,
})) }));

const input = (ttc = 119000) => ({
  clientId: "client", issueDate: new Date(), currency: "TND", status: "BROUILLON" as const,
  lines: [{ description: "Produit TTC", quantity: 1, unit: "unité", position: 4,
    unitPriceHTCents: 999999, unitPriceTTCCents: ttc, vatRate: 19 }],
  taxes: { applyFodec: false, applyTimbre: false },
});

describe("TTC quote/invoice persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.client.findFirst.mockResolvedValue({ id: "client" });
    db.$transaction.mockImplementation(async (fn) => fn(db));
    for (const model of [db.quote, db.invoice]) {
      model.findFirst.mockResolvedValue({ id: "document" });
      for (const write of [model.create, model.update]) {
        write.mockImplementation(async ({ data }) => ({
          ...data, id: "document", lines: data.lines?.createMany.data ?? [],
        }));
      }
    }
  });

  for (const kind of ["quote", "invoice"] as const) {
    it(`creates and edits a ${kind} with exact TTC and validated HT`, async () => {
      const created = kind === "quote"
        ? await createQuoteForUser("tenant", input()) : await createInvoiceForUser("tenant", input());
      expect(created.subtotalHTCents).toBe(100000);
      expect(created.totalTVACents).toBe(19000);
      expect(created.totalTTCCents).toBe(119000);
      expect(created.lines[0].unitPriceHTCents).toBe(100000);
      expect(created.lines[0]).not.toHaveProperty("unitPriceTTCCents");
      expect(restoreDocumentLineTTC(normalizeTaxConfiguration(created.taxConfiguration), 4, "TND")).toBe(119);

      const edited = kind === "quote"
        ? await updateQuote("document", input(3)) : await updateInvoice("document", input(3));
      expect(edited.totalTTCCents).toBe(3);
      expect(edited.lines[0]).toMatchObject({ unitPriceHTCents: 3, totalHTCents: 3, totalTVACents: 0, totalTTCCents: 3 });
      const storedPrice = restoreDocumentLineTTC(normalizeTaxConfiguration(edited.taxConfiguration), 4, "TND");
      expect(storedPrice).toBe(0.003);

      const reopened = input(Math.round(storedPrice! * 1000));
      const resaved = kind === "quote"
        ? await updateQuote("document", reopened) : await updateInvoice("document", reopened);
      expect(resaved.totalTTCCents).toBe(3);
    });

    it(`duplicates a ${kind} without detaching TTC snapshots from line positions`, async () => {
      const original = kind === "quote"
        ? await createQuoteForUser("tenant", input(3)) : await createInvoiceForUser("tenant", input(3));
      db[kind].findFirst.mockResolvedValue(original);
      const copy = kind === "quote" ? await duplicateQuote("document") : await duplicateInvoice("document");
      expect(copy.lines[0].position).toBe(4);
      expect(copy.totalTTCCents).toBe(3);
      expect(restoreDocumentLineTTC(normalizeTaxConfiguration(copy.taxConfiguration), copy.lines[0].position, "TND")).toBe(0.003);
    });
  }

  it("carries TTC pricing through quote-to-invoice conversion", async () => {
    const original = await createQuoteForUser("tenant", input(3));
    db.quote.findFirst.mockResolvedValue(original);
    const invoice = await convertQuoteToInvoiceForUser("tenant", "document");
    expect(invoice.totalTTCCents).toBe(3);
    expect(db.invoice.create.mock.calls[0][0].data.lines.createMany.data[0].position).toBe(4);
    expect(restoreDocumentLineTTC(normalizeTaxConfiguration(invoice.taxConfiguration), 4, "TND")).toBe(0.003);
  });
});
