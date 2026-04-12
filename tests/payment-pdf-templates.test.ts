import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/server/settings", () => ({
  getSettings: vi.fn(),
}));

vi.mock("@/server/client-payments", () => ({
  getClientPaymentPeriodReport: vi.fn(),
  getClientPaymentReceipt: vi.fn(),
}));

const {
  buildClientPaymentReceiptHtml,
  buildClientPaymentsReportHtml,
} = await import("@/server/pdf");

describe("payment PDF templates", () => {
  it("renders a dedicated split receipt layout", () => {
    const snapshot = {
      receiptNumber: "REC-2026-0042",
      issuedAt: "2026-03-20T09:30:00.000Z",
      paymentDate: "2026-03-19T14:00:00.000Z",
      currency: "TND",
      amountCents: 245000,
      method: "Virement bancaire",
      reference: "VIR-2026-0042",
      description: "Règlement de maintenance mensuelle",
      note: "Paiement reçu et validé.",
      client: {
        id: "client-1",
        displayName: "Société Atlas",
        companyName: "Atlas SARL",
        address: "10 rue des Oliviers\nTunis",
        email: "contact@atlas.example",
        phone: "+216 70 000 000",
        vatNumber: "TN123456",
      },
      company: {
        companyName: "Studio Delta",
        logoUrl: null,
        logoData: null,
        address: "Lac 2\nTunis",
        email: "finance@delta.example",
        phone: "+216 71 111 111",
        matriculeFiscal: "MF-7788",
        tvaNumber: "TVA-7788",
        iban: "TN59 1000 6035 1835 9847 8831",
        stampImage: "data:image/svg+xml;base64,PHN2Zy8+",
        signatureImage: null,
        stampPosition: null,
        signaturePosition: null,
        legalFooter: "Document généré par Studio Delta.",
      },
      services: [
        {
          clientServiceId: "service-1",
          title: "Maintenance annuelle",
          details: "Support applicatif et suivi mensuel",
          allocatedAmountCents: 245000,
          position: 0,
        },
      ],
    } as Parameters<typeof buildClientPaymentReceiptHtml>[0];

    const html = buildClientPaymentReceiptHtml(snapshot);

    expect(html).toContain("Exemplaire client");
    expect(html).toContain("Exemplaire entreprise");
    expect(html).toContain("Reçu de paiement");
    expect(html).toContain("Prestations réglées");
    expect(html).toContain("Montant reçu");
    expect(html).toContain("height: 297mm");
    expect(html).toContain("break-inside: avoid-page");
    expect(html).toContain("max-height:120px");
    expect(html).not.toContain("Coordonnées bancaires");
    expect(html).not.toContain("Facture #");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("radial-gradient");
  });

  it("renders a dedicated payment report layout", () => {
    const params = {
      settings: {
        companyName: "Studio Delta",
        logoUrl: null,
        logoData: null,
        matriculeFiscal: "MF-7788",
        tvaNumber: "TVA-7788",
        address: "Lac 2\nTunis",
        email: "finance@delta.example",
        phone: "+216 71 111 111",
        iban: "TN59 1000 6035 1835 9847 8831",
        stampImage: null,
        signatureImage: null,
        stampPosition: null,
        signaturePosition: null,
        legalFooter: "Document généré par Studio Delta.",
        defaultCurrency: "TND",
        paymentTerms: "Paiement comptant",
        defaultConditions: "Merci pour votre confiance.",
      },
      report: {
        filters: {
          dateFrom: new Date("2026-03-01T00:00:00.000Z"),
          dateTo: new Date("2026-03-31T23:59:59.000Z"),
          currency: null,
          search: "maintenance",
        },
        totals: {
          paymentCount: 2,
          receiptCount: 1,
          clientCount: 1,
          totalsByCurrency: [
            {
              currency: "TND",
              totalAmountCents: 345000,
              paymentCount: 2,
            },
          ],
        },
        byClient: [
          {
            clientId: "client-1",
            clientName: "Société Atlas",
            totalAmountCents: 345000,
            paymentCount: 2,
            receiptCount: 1,
            lastPaymentDate: new Date("2026-03-19T14:00:00.000Z"),
            totalsByCurrency: [
              {
                currency: "TND",
                totalAmountCents: 345000,
                paymentCount: 2,
              },
            ],
          },
        ],
        items: [
          {
            id: "payment-1",
            userId: "tenant-1",
            clientId: "client-1",
            amountCents: 245000,
            currency: "TND",
            date: new Date("2026-03-19T14:00:00.000Z"),
            method: "Virement bancaire",
            reference: "VIR-2026-0042",
            description: "Règlement de maintenance mensuelle",
            note: "Paiement reçu et validé.",
            privateNote: null,
            receiptNumber: "REC-2026-0042",
            receiptIssuedAt: new Date("2026-03-20T09:30:00.000Z"),
            receiptSentAt: null,
            createdAt: new Date("2026-03-19T14:00:00.000Z"),
            updatedAt: new Date("2026-03-19T14:00:00.000Z"),
            receiptSnapshot: null,
            client: {
              id: "client-1",
              displayName: "Société Atlas",
              companyName: "Atlas SARL",
              address: "10 rue des Oliviers\nTunis",
              email: "contact@atlas.example",
              phone: "+216 70 000 000",
              vatNumber: "TN123456",
            },
            serviceLinks: [
              {
                id: "link-1",
                clientPaymentId: "payment-1",
                clientServiceId: "service-1",
                titleSnapshot: "Maintenance annuelle",
                detailsSnapshot: "Support applicatif et suivi mensuel",
                allocatedAmountCents: 245000,
                position: 0,
                paymentService: null,
              },
            ],
          },
        ],
      },
      selectedClientLabel: "Société Atlas",
    } as unknown as Parameters<typeof buildClientPaymentsReportHtml>[0];

    const html = buildClientPaymentsReportHtml(params);

    expect(html).toContain("Encaissements clients");
    expect(html).toContain("Période analysée");
    expect(html).toContain("Client : Société Atlas");
    expect(html).toContain("Liste détaillée des paiements");
    expect(html).toContain("Présentation export orientée reporting");
    expect(html).toContain("size: A4 portrait;");
    expect(html).toContain("min-height: 297mm;");
    expect(html).toContain("flex-direction: column;");
    expect(html).toContain("background: var(--paper);");
    expect(html).toContain("border: 1.5px solid var(--line-strong);");
    expect(html).not.toContain("Prix HT");
    expect(html).not.toContain("Facture #");
    expect(html).not.toContain("A4 landscape");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("radial-gradient");
    expect(html).not.toContain("--accent");
    expect(html).not.toContain("--warning");
  });
});
