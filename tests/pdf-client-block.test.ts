import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "@/server/pdf";

type InvoiceDoc = Parameters<typeof buildDocumentHtml>[1];

function invoice(client: Record<string, unknown>): InvoiceDoc {
  return {
    id: "inv-1",
    number: "FAC-2026-0484",
    status: "PAYEE",
    reference: "034250",
    issueDate: new Date("2026-11-09T10:00:00Z"),
    dueDate: null,
    currency: "TND",
    globalDiscountRate: null,
    globalDiscountAmountCents: 0,
    vatBreakdown: [{ rate: 19, baseHT: 57983, totalTVA: 11017 }],
    taxSummary: null,
    taxConfiguration: null,
    notes: "Référence de commande : 034250 du 22/09/2026.",
    terms: null,
    lateFeeRate: null,
    subtotalHTCents: 57983,
    totalDiscountCents: 0,
    totalTVACents: 11017,
    totalTTCCents: 70000,
    amountPaidCents: 70000,
    fodecAmountCents: 0,
    timbreAmountCents: 1000,
    client: {
      id: "client-1",
      displayName: "Amine Ben Salah",
      companyName: null,
      vatNumber: null,
      address: "12 Rue de Marseille\n1000 Tunis\nTunisie",
      email: "client@example.com",
      phone: "+21620000000",
      ...client,
    },
    lines: [],
    payments: [],
  } as unknown as InvoiceDoc;
}

const settings = { companyName: "Techno Smart", defaultCurrency: "TND", paymentTerms: null, defaultConditions: null };

describe("invoice PDF client block", () => {
  it("billing layout with a company: company, VAT number and address only", () => {
    const html = buildDocumentHtml(
      "invoice",
      invoice({ companyName: "ACME SARL", vatNumber: "1234567/A/M/000" }),
      settings,
      { clientLayout: "billing" },
    );
    expect(html).toContain("ACME SARL");
    expect(html).toContain("Numéro de TVA : 1234567/A/M/000");
    expect(html).toContain("12 Rue de Marseille");
    expect(html).toContain("1000 Tunis");
    expect(html).not.toContain("Amine Ben Salah");
    expect(html).not.toContain("client@example.com");
    expect(html).not.toContain("+21620000000");
  });

  it("billing layout without a company: full name, then address", () => {
    const html = buildDocumentHtml("invoice", invoice({}), settings, { clientLayout: "billing" });
    expect(html).toContain("Amine Ben Salah");
    expect(html).not.toContain("Numéro de TVA");
    expect(html).not.toContain("client@example.com");
    expect(html).not.toContain("+21620000000");
  });

  it("keeps the existing layout for invoices created in the app", () => {
    const html = buildDocumentHtml("invoice", invoice({ companyName: "ACME SARL" }), settings);
    expect(html).toContain("Amine Ben Salah");
    expect(html).toContain("client@example.com");
    expect(html).toContain("+21620000000");
  });
});
