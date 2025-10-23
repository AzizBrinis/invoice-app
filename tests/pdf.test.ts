import { describe, it, expect } from "vitest";
import { generateInvoicePdf } from "@/server/pdf";
import { prisma } from "@/lib/prisma";

const shouldSkipPdfTests =
  process.env.RUN_PDF_TESTS !== "true" ||
  process.env.SKIP_PDF_TESTS === "1" ||
  process.env.CI === "true" ||
  process.env.CI === "1";

const describePdf = shouldSkipPdfTests ? describe.skip : describe;

describePdf("PDF generation", () => {
  it("produces a PDF buffer for an invoice", async () => {
    const client = await prisma.client.findFirst();
    if (!client) {
      throw new Error("Client requis pour le test PDF");
    }
    const invoice = await prisma.invoice.create({
      data: {
        number: `TEST-${Date.now()}`,
        clientId: client.id,
        status: "ENVOYEE",
        issueDate: new Date(),
        dueDate: new Date(),
        currency: "EUR",
        subtotalHTCents: 10000,
        totalDiscountCents: 0,
        totalTVACents: 2000,
        totalTTCCents: 12000,
        amountPaidCents: 0,
        lines: {
          create: [
            {
              description: "Service test",
              quantity: 1,
              unit: "unité",
              unitPriceHTCents: 10000,
              vatRate: 20,
              discountRate: null,
              discountAmountCents: null,
              totalHTCents: 10000,
              totalTVACents: 2000,
              totalTTCCents: 12000,
              position: 0,
            },
          ],
        },
      },
    });

    const buffer = await generateInvoicePdf(invoice.id);
    expect(buffer.length).toBeGreaterThan(2000);

    await prisma.invoice.delete({ where: { id: invoice.id } });
  });
});
