import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { endOfMonth, startOfMonth, subDays } from "date-fns";

let prisma: (typeof import("@/lib/db"))["prisma"];
let createClient: typeof import("@/server/clients")["createClient"];
let deleteClient: typeof import("@/server/clients")["deleteClient"];
let createClientPayment: typeof import("@/server/client-payments")["createClientPayment"];
let createClientService: typeof import("@/server/client-payments")["createClientService"];
let getClientPaymentDashboardSummary: typeof import("@/server/client-payments")["getClientPaymentDashboardSummary"];
let getClientPayment: typeof import("@/server/client-payments")["getClientPayment"];
let getClientPaymentPeriodReport: typeof import("@/server/client-payments")["getClientPaymentPeriodReport"];
let getClientPaymentPeriodSummary: typeof import("@/server/client-payments")["getClientPaymentPeriodSummary"];
let getClientPaymentReceipt: typeof import("@/server/client-payments")["getClientPaymentReceipt"];
let listClientPayments: typeof import("@/server/client-payments")["listClientPayments"];
let listClientPaymentsPage: typeof import("@/server/client-payments")["listClientPaymentsPage"];
let listPaymentServices: typeof import("@/server/client-payments")["listPaymentServices"];
let listPaymentServicesPage: typeof import("@/server/client-payments")["listPaymentServicesPage"];
let updateClientService: typeof import("@/server/client-payments")["updateClientService"];
let generateClientPaymentsExcelForUser: typeof import("@/server/excel")["generateClientPaymentsExcelForUser"];

let userId: string;
let clientId: string;

const describeClientPayments = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeClientPayments("client payment domain", () => {
  beforeAll(async () => {
    const prismaModule = await import("@/lib/db");
    const clientsModule = await import("@/server/clients");
    const clientPaymentsModule = await import("@/server/client-payments");
    const excelModule = await import("@/server/excel");

    prisma = prismaModule.prisma;
    createClient = clientsModule.createClient;
    deleteClient = clientsModule.deleteClient;
    createClientPayment = clientPaymentsModule.createClientPayment;
    createClientService = clientPaymentsModule.createClientService;
    getClientPayment = clientPaymentsModule.getClientPayment;
    getClientPaymentDashboardSummary =
      clientPaymentsModule.getClientPaymentDashboardSummary;
    getClientPaymentPeriodReport =
      clientPaymentsModule.getClientPaymentPeriodReport;
    getClientPaymentPeriodSummary =
      clientPaymentsModule.getClientPaymentPeriodSummary;
    getClientPaymentReceipt = clientPaymentsModule.getClientPaymentReceipt;
    listClientPayments = clientPaymentsModule.listClientPayments;
    listClientPaymentsPage = clientPaymentsModule.listClientPaymentsPage;
    listPaymentServices = clientPaymentsModule.listPaymentServices;
    listPaymentServicesPage = clientPaymentsModule.listPaymentServicesPage;
    updateClientService = clientPaymentsModule.updateClientService;
    generateClientPaymentsExcelForUser =
      excelModule.generateClientPaymentsExcelForUser;

    const timestamp = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `client-payments-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Client Payments Owner",
      },
    });

    userId = user.id;

    const client = await createClient(
      {
        displayName: "Client Paiement",
        companyName: "Client Paiement SARL",
        email: "client-paiement@example.com",
        phone: "+21670000000",
        isActive: true,
        source: "MANUAL",
      },
      userId,
    );

    clientId = client.id;
  });

  afterAll(async () => {
    if (!userId) {
      return;
    }

    await prisma.clientPayment.deleteMany({
      where: { userId },
    });
    await prisma.paymentService.deleteMany({
      where: { userId },
    });
    await prisma.client.deleteMany({
      where: { userId },
    });
    await prisma.numberingSequence.deleteMany({
      where: { userId },
    });
    await prisma.companySettings.deleteMany({
      where: { userId },
    });
    await prisma.messagingSettings.deleteMany({
      where: { userId },
    });
    await prisma.user.delete({
      where: { id: userId },
    });
  });

  it("stores receipt snapshots and builds period summaries from standalone client payments", async () => {
    const service = await createClientService(
      {
        clientId,
        title: "Accompagnement mensuel",
        details: "Suivi et coordination hebdomadaire",
        priceCents: 32000,
        notes: "Visible dans l'espace client paiement",
        privateNotes: "Note privée interne",
        isActive: true,
      },
      userId,
    );
    expect(service.priceCents).toBe(32000);

    const firstPayment = await createClientPayment(
      {
        clientId,
        amountCents: 15000,
        currency: "TND",
        date: subDays(new Date(), 2),
        method: "Virement bancaire",
        reference: "VIR-2026-001",
        description: "Règlement mensuel",
        note: "Merci pour votre confiance",
        serviceLinks: [
          {
            clientServiceId: service.id,
            allocatedAmountCents: 15000,
            position: 0,
          },
        ],
      },
      userId,
    );

    const updatedService = await updateClientService(
      service.id,
      {
        clientId,
        title: "Accompagnement premium",
        details: "Cette modification ne doit pas altérer le reçu historique",
        priceCents: 47000,
        notes: "Toujours actif",
        privateNotes: "Toujours privé",
        isActive: true,
      },
      userId,
    );
    expect(updatedService.priceCents).toBe(47000);

    const { payment: receiptPayment, snapshot } = await getClientPaymentReceipt(
      firstPayment.id,
      userId,
    );

    expect(receiptPayment.receiptNumber).toMatch(/^REC-/);
    expect(snapshot.amountCents).toBe(15000);
    expect(snapshot.services).toHaveLength(1);
    expect(snapshot.services[0]?.title).toBe("Accompagnement mensuel");
    expect(snapshot.services[0]?.details).toBe(
      "Suivi et coordination hebdomadaire",
    );

    const secondPayment = await createClientPayment(
      {
        clientId,
        amountCents: 8000,
        currency: "TND",
        date: new Date(),
        method: "Espèces",
        description: "Acompte complémentaire",
        note: "Paiement avec service lié",
        serviceLinks: [
          {
            clientServiceId: service.id,
            allocatedAmountCents: 8000,
            position: 0,
          },
        ],
      },
      userId,
    );

    const report = await getClientPaymentPeriodReport(
      {
        clientId,
        dateFrom: startOfMonth(new Date()),
        dateTo: endOfMonth(new Date()),
        currency: "TND",
      },
      userId,
    );

    expect(report.totals.paymentCount).toBe(2);
    expect(report.totals.receiptCount).toBe(1);
    expect(report.totals.clientCount).toBe(1);
    expect(report.totals.totalsByCurrency).toEqual([
      expect.objectContaining({
        currency: "TND",
        totalAmountCents: 23000,
        paymentCount: 2,
      }),
    ]);
    expect(report.byClient[0]).toMatchObject({
      clientId,
      totalAmountCents: 23000,
      paymentCount: 2,
      receiptCount: 1,
    });
    expect(report.items).toHaveLength(2);

    const summary = await getClientPaymentPeriodSummary(
      {
        clientId,
        dateFrom: startOfMonth(new Date()),
        dateTo: endOfMonth(new Date()),
        currency: "TND",
        includeByClient: false,
      },
      userId,
    );

    expect(summary.totals).toMatchObject({
      paymentCount: 2,
      receiptCount: 1,
      clientCount: 1,
    });
    expect(summary.byClient).toEqual([]);

    const dashboard = await getClientPaymentDashboardSummary(
      {
        months: 1,
        currency: "TND",
      },
      userId,
    );

    expect(dashboard.metrics.totalCollectedCents).toBe(23000);
    expect(dashboard.metrics.paymentCount).toBe(2);
    expect(dashboard.metrics.receiptsIssuedCount).toBe(1);
    expect(dashboard.recentPayments.map((payment) => payment.id)).toEqual(
      expect.arrayContaining([firstPayment.id, secondPayment.id]),
    );

    const searchResults = await listClientPayments(
      {
        search: "VIR-2026-001",
      },
      userId,
    );

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.id).toBe(firstPayment.id);

    const paginatedPayments = await listClientPaymentsPage(
      {
        clientId,
        page: 1,
        pageSize: 1,
      },
      userId,
    );

    expect(paginatedPayments.total).toBe(2);
    expect(paginatedPayments.pageCount).toBe(2);
    expect(paginatedPayments.items).toHaveLength(1);
    expect(paginatedPayments.items[0]?.id).toBe(secondPayment.id);

    const paginatedServices = await listPaymentServicesPage(
      {
        search: "Accompagnement",
        page: 1,
        pageSize: 1,
      },
      userId,
    );

    expect(paginatedServices.total).toBeGreaterThanOrEqual(1);
    expect(paginatedServices.pageCount).toBeGreaterThanOrEqual(1);
    expect(paginatedServices.items).toHaveLength(1);
    expect(paginatedServices.items[0]?.id).toBe(service.id);

    const paymentDetail = await getClientPayment(firstPayment.id, userId);
    expect(paymentDetail.client.id).toBe(clientId);
    expect(paymentDetail.serviceLinks[0]?.titleSnapshot).toBe(
      "Accompagnement mensuel",
    );

    const excelBuffer = await generateClientPaymentsExcelForUser(
      userId,
      {
        clientId,
      },
    );
    const excelContent = excelBuffer.toString("utf8");
    expect(excelContent).toContain("Accompagnement mensuel");
    expect(excelContent).not.toContain("Accompagnement premium");
    expect(excelContent).toContain(receiptPayment.receiptNumber ?? "");
    expect(excelContent).toContain('<Column ss:AutoFitWidth="0" ss:Width="');
  });

  it("keeps migrated services global when deleting a client that only sourced them", async () => {
    const orphanClient = await createClient(
      {
        displayName: "Client Source Temporaire",
        companyName: "Source Temporaire SARL",
        email: "source-temporaire@example.com",
        isActive: true,
        source: "MANUAL",
      },
      userId,
    );

    const service = await createClientService(
      {
        clientId: orphanClient.id,
        title: "Atelier cadrage",
        details: "Service conservé après suppression du client source",
        priceCents: 12000,
        isActive: true,
      },
      userId,
    );

    await deleteClient(orphanClient.id, userId);

    const preservedService = await prisma.paymentService.findUnique({
      where: { id: service.id },
      select: {
        id: true,
        sourceClientId: true,
        title: true,
      },
    });

    expect(preservedService).toMatchObject({
      id: service.id,
      sourceClientId: null,
      title: "Atelier cadrage",
    });
  });

  it("reuses the same global service across multiple clients", async () => {
    const secondaryClient = await createClient(
      {
        displayName: "Client Secondaire",
        companyName: "Secondaire SARL",
        email: "client-secondaire@example.com",
        isActive: true,
        source: "MANUAL",
      },
      userId,
    );

    const sharedService = await createClientService(
      {
        clientId: secondaryClient.id,
        title: "Abonnement support",
        details: "Service réutilisable dans tout le compte",
        priceCents: 18000,
        isActive: true,
      },
      userId,
    );

    const accountServices = await listPaymentServices({}, userId);
    expect(accountServices.map((service) => service.id)).toContain(sharedService.id);

    const crossClientPayment = await createClientPayment(
      {
        clientId,
        amountCents: 18000,
        currency: "TND",
        date: new Date(),
        description: "Paiement sur service global",
        serviceLinks: [
          {
            clientServiceId: sharedService.id,
            allocatedAmountCents: 18000,
            position: 0,
          },
        ],
      },
      userId,
    );

    expect(crossClientPayment.clientId).toBe(clientId);
    expect(crossClientPayment.serviceLinks[0]?.clientServiceId).toBe(sharedService.id);
    expect(crossClientPayment.serviceLinks[0]?.titleSnapshot).toBe(
      "Abonnement support",
    );

    const sourceClientPayment = await createClientPayment(
      {
        clientId: secondaryClient.id,
        amountCents: 9000,
        currency: "TND",
        date: new Date(),
        description: "Paiement client source sur le meme service global",
        serviceLinks: [
          {
            clientServiceId: sharedService.id,
            allocatedAmountCents: 9000,
            position: 0,
          },
        ],
      },
      userId,
    );

    expect(sourceClientPayment.clientId).toBe(secondaryClient.id);
    expect(sourceClientPayment.serviceLinks[0]?.clientServiceId).toBe(
      sharedService.id,
    );
  });

  it("preserves migrated payment links and exports after removing a source client", async () => {
    const sourceClient = await createClient(
      {
        displayName: "Client Migration Source",
        companyName: "Migration Source SARL",
        email: "migration-source@example.com",
        isActive: true,
        source: "MANUAL",
      },
      userId,
    );

    const migratedService = await createClientService(
      {
        clientId: sourceClient.id,
        title: "Migration support",
        details: "Service migré conservé pour les historiques",
        priceCents: 21000,
        isActive: true,
      },
      userId,
    );

    const migratedPayment = await createClientPayment(
      {
        clientId,
        amountCents: 21000,
        currency: "TND",
        date: new Date(),
        description: "Paiement rattache a un service migre",
        serviceLinks: [
          {
            clientServiceId: migratedService.id,
            allocatedAmountCents: 21000,
            position: 0,
          },
        ],
      },
      userId,
    );

    const beforeDeleteReceipt = await getClientPaymentReceipt(
      migratedPayment.id,
      userId,
    );

    await deleteClient(sourceClient.id, userId);

    const preservedService = await prisma.paymentService.findUnique({
      where: { id: migratedService.id },
      select: {
        id: true,
        sourceClientId: true,
      },
    });
    const preservedPayment = await getClientPayment(migratedPayment.id, userId);
    const afterDeleteReceipt = await getClientPaymentReceipt(
      migratedPayment.id,
      userId,
    );
    const excelBuffer = await generateClientPaymentsExcelForUser(
      userId,
      {
        search: "Migration support",
      },
    );
    const excelContent = excelBuffer.toString("utf8");

    expect(preservedService).toMatchObject({
      id: migratedService.id,
      sourceClientId: null,
    });
    expect(preservedPayment.serviceLinks[0]?.clientServiceId).toBe(
      migratedService.id,
    );
    expect(preservedPayment.serviceLinks[0]?.titleSnapshot).toBe(
      "Migration support",
    );
    expect(beforeDeleteReceipt.snapshot.receiptNumber).toBe(
      afterDeleteReceipt.snapshot.receiptNumber,
    );
    expect(afterDeleteReceipt.snapshot.services[0]).toMatchObject({
      clientServiceId: migratedService.id,
      title: "Migration support",
      details: "Service migré conservé pour les historiques",
    });
    expect(excelContent).toContain("Migration support");
  });

  it("keeps multi-currency period summaries separated on totals and client report rows", async () => {
    const mixedCurrencyClient = await createClient(
      {
        displayName: "Client Multi Devise",
        companyName: "Multi Devise SARL",
        email: "multi-devise@example.com",
        isActive: true,
        source: "MANUAL",
      },
      userId,
    );
    const mixedCurrencyService = await createClientService(
      {
        clientId: mixedCurrencyClient.id,
        title: "Service multi-devise",
        details: "Support de test pour les totaux par devise",
        priceCents: 12500,
        isActive: true,
      },
      userId,
    );

    await createClientPayment(
      {
        clientId: mixedCurrencyClient.id,
        amountCents: 12500,
        currency: "TND",
        date: new Date(),
        description: "Paiement TND",
        serviceLinks: [
          {
            clientServiceId: mixedCurrencyService.id,
            allocatedAmountCents: 12500,
            position: 0,
          },
        ],
      },
      userId,
    );

    await createClientPayment(
      {
        clientId: mixedCurrencyClient.id,
        amountCents: 9000,
        currency: "EUR",
        date: new Date(),
        description: "Paiement EUR",
        serviceLinks: [
          {
            clientServiceId: mixedCurrencyService.id,
            allocatedAmountCents: 9000,
            position: 0,
          },
        ],
      },
      userId,
    );

    const summary = await getClientPaymentPeriodSummary(
      {
        clientId: mixedCurrencyClient.id,
        dateFrom: startOfMonth(new Date()),
        dateTo: endOfMonth(new Date()),
      },
      userId,
    );

    expect(summary.totals.totalsByCurrency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: "TND",
          totalAmountCents: 12500,
          paymentCount: 1,
        }),
        expect.objectContaining({
          currency: "EUR",
          totalAmountCents: 9000,
          paymentCount: 1,
        }),
      ]),
    );
    expect(summary.byClient[0]).toMatchObject({
      clientId: mixedCurrencyClient.id,
      paymentCount: 2,
    });
    expect(summary.byClient[0]?.totalsByCurrency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: "TND",
          totalAmountCents: 12500,
          paymentCount: 1,
        }),
        expect.objectContaining({
          currency: "EUR",
          totalAmountCents: 9000,
          paymentCount: 1,
        }),
      ]),
    );
  });
});
