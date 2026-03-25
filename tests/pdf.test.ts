import { describe, it, expect } from "vitest";

const shouldSkipPdfTests =
  !process.env.TEST_DATABASE_URL ||
  process.env.RUN_PDF_TESTS !== "true" ||
  process.env.SKIP_PDF_TESTS === "1" ||
  process.env.CI === "true" ||
  process.env.CI === "1";

const describePdf = shouldSkipPdfTests ? describe.skip : describe;

describePdf("PDF generation", () => {
  it("produces a PDF buffer for an invoice", async () => {
    const [{ generateInvoicePdf }, { prisma }] = await Promise.all([
      import("@/server/pdf"),
      import("@/lib/prisma"),
    ]);
    const client = await prisma.client.findFirst();
    if (!client) {
      throw new Error("Client requis pour le test PDF");
    }
    const invoice = await prisma.invoice.create({
      data: {
        number: `TEST-${Date.now()}`,
        userId: client.userId,
        clientId: client.id,
        status: "ENVOYEE",
        issueDate: new Date(),
        dueDate: new Date(),
        currency: "TND",
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

  it("produces a PDF buffer for a client payment receipt linked to a global service", async () => {
    const [
      {
        generateClientPaymentReceiptPdfForUser,
        generateClientPaymentsReportPdfForUser,
      },
      { prisma },
      { createClient },
      { createClientPayment, createClientService },
    ] = await Promise.all([
      import("@/server/pdf"),
      import("@/lib/prisma"),
      import("@/server/clients"),
      import("@/server/client-payments"),
    ]);
    const user = await prisma.user.create({
      data: {
        email: `pdf-client-payment-${Date.now()}@example.com`,
        passwordHash: "hashed",
        name: "PDF Client Payment",
      },
    });

    try {
      const billedClient = await createClient(
        {
          displayName: "Client PDF Facture",
          companyName: "Client PDF SARL",
          email: "pdf-client@example.com",
          isActive: true,
          source: "MANUAL",
        },
        user.id,
      );
      const sourceClient = await createClient(
        {
          displayName: "Client Source PDF",
          companyName: "Source PDF SARL",
          email: "pdf-source@example.com",
          isActive: true,
          source: "MANUAL",
        },
        user.id,
      );
      const service = await createClientService(
        {
          clientId: sourceClient.id,
          title: "Support PDF global",
          details: "Service global lie a un recu PDF",
          priceCents: 14000,
          isActive: true,
        },
        user.id,
      );
      const payment = await createClientPayment(
        {
          clientId: billedClient.id,
          amountCents: 14000,
          currency: "TND",
          date: new Date(),
          description: "Paiement couvert par un recu PDF",
          serviceLinks: [
            {
              clientServiceId: service.id,
              allocatedAmountCents: 14000,
              position: 0,
            },
          ],
        },
        user.id,
      );

      const buffer = await generateClientPaymentReceiptPdfForUser(
        user.id,
        payment.id,
      );
      expect(buffer.length).toBeGreaterThan(2000);

      const reportBuffer = await generateClientPaymentsReportPdfForUser(
        user.id,
        {
          clientId: billedClient.id,
        },
      );
      expect(reportBuffer.length).toBeGreaterThan(2000);
    } finally {
      await prisma.clientPayment.deleteMany({
        where: { userId: user.id },
      });
      await prisma.paymentService.deleteMany({
        where: { userId: user.id },
      });
      await prisma.client.deleteMany({
        where: { userId: user.id },
      });
      await prisma.numberingSequence.deleteMany({
        where: { userId: user.id },
      });
      await prisma.companySettings.deleteMany({
        where: { userId: user.id },
      });
      await prisma.messagingSettings.deleteMany({
        where: { userId: user.id },
      });
      await prisma.user.delete({
        where: { id: user.id },
      });
    }
  });
});
