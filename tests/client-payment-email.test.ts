import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMessageMock = vi.fn();
const sendEmailMessageForUserMock = vi.fn();
const getMessagingSettingsSummaryMock = vi.fn();
const generateClientPaymentReceiptPdfForUserMock = vi.fn();

vi.mock("@/server/messaging", () => ({
  sendEmailMessage: sendEmailMessageMock,
  sendEmailMessageForUser: sendEmailMessageForUserMock,
  getMessagingSettingsSummary: getMessagingSettingsSummaryMock,
}));

vi.mock("@/server/pdf", () => ({
  generateQuotePdf: vi.fn(),
  generateInvoicePdf: vi.fn(),
  generateClientPaymentReceiptPdfForUser:
    generateClientPaymentReceiptPdfForUserMock,
}));

let prisma: (typeof import("@/lib/db"))["prisma"];
let createClient: typeof import("@/server/clients")["createClient"];
let createClientPayment: typeof import("@/server/client-payments")["createClientPayment"];
let createClientService: typeof import("@/server/client-payments")["createClientService"];
let sendClientPaymentReceiptEmail: typeof import("@/server/email")["sendClientPaymentReceiptEmail"];

let userId: string;
let paymentId: string;

const describeClientPaymentEmail = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeClientPaymentEmail("client payment receipt email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMessagingSettingsSummaryMock.mockResolvedValue({
      fromEmail: "facturation@example.com",
      senderName: "Studio Paiements",
      senderLogoUrl: null,
      imapHost: "",
      imapPort: null,
      imapSecure: false,
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecure: false,
      imapConfigured: false,
      smtpConfigured: true,
      spamFilterEnabled: false,
      trackingEnabled: false,
      autoReplyEnabled: false,
      autoReplySubject: "",
      autoReplyBody: "",
      vacationModeEnabled: false,
      vacationSubject: "",
      vacationMessage: "",
      vacationStartDate: null,
      vacationEndDate: null,
      vacationBackupEmail: null,
    });
    sendEmailMessageMock.mockResolvedValue({
      messageId: "message-legacy",
    });
    sendEmailMessageForUserMock.mockResolvedValue({
      messageId: "message-tenant",
    });
    generateClientPaymentReceiptPdfForUserMock.mockResolvedValue(
      Buffer.from("%PDF-client-payment%"),
    );
  });

  beforeAll(async () => {
    const prismaModule = await import("@/lib/db");
    const clientsModule = await import("@/server/clients");
    const clientPaymentsModule = await import("@/server/client-payments");
    const emailModule = await import("@/server/email");

    prisma = prismaModule.prisma;
    createClient = clientsModule.createClient;
    createClientPayment = clientPaymentsModule.createClientPayment;
    createClientService = clientPaymentsModule.createClientService;
    sendClientPaymentReceiptEmail = emailModule.sendClientPaymentReceiptEmail;

    const user = await prisma.user.create({
      data: {
        email: `client-payment-email-${Date.now()}@example.com`,
        passwordHash: "hashed",
        name: "Client Payment Email Owner",
      },
    });
    userId = user.id;

    const billedClient = await createClient(
      {
        displayName: "Client E-mail Facture",
        companyName: "Client E-mail SARL",
        email: "client-email@example.com",
        isActive: true,
        source: "MANUAL",
      },
      userId,
    );
    const sourceClient = await createClient(
      {
        displayName: "Client Source E-mail",
        companyName: "Source E-mail SARL",
        email: "source-email@example.com",
        isActive: true,
        source: "MANUAL",
      },
      userId,
    );
    const service = await createClientService(
      {
        clientId: sourceClient.id,
        title: "Maintenance critique",
        details: "Service migré utilisé dans le reçu envoyé",
        priceCents: 26000,
        isActive: true,
      },
      userId,
    );
    const payment = await createClientPayment(
      {
        clientId: billedClient.id,
        amountCents: 26000,
        currency: "TND",
        date: new Date(),
        description: "Paiement couvert par reçu email",
        serviceLinks: [
          {
            clientServiceId: service.id,
            allocatedAmountCents: 26000,
            position: 0,
          },
        ],
      },
      userId,
    );
    paymentId = payment.id;
  });

  afterAll(async () => {
    if (!userId) {
      return;
    }

    await prisma.emailLog.deleteMany({
      where: { userId },
    });
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
    await prisma.messagingSavedResponse.deleteMany({
      where: { userId },
    });
    await prisma.user.delete({
      where: { id: userId },
    });
  });

  it("sends a receipt email from preserved payment snapshots and records delivery", async () => {
    await sendClientPaymentReceiptEmail({
      paymentId,
      to: "recipient@example.com",
      userId,
    });

    const payment = await prisma.clientPayment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        receiptNumber: true,
        receiptSentAt: true,
      },
    });
    const emailLog = await prisma.emailLog.findFirst({
      where: {
        userId,
        documentId: paymentId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        to: true,
        subject: true,
        body: true,
        status: true,
      },
    });

    expect(generateClientPaymentReceiptPdfForUserMock).toHaveBeenCalledWith(
      userId,
      paymentId,
    );
    expect(sendEmailMessageForUserMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMessageMock).not.toHaveBeenCalled();

    const [tenantId, payload] = sendEmailMessageForUserMock.mock.calls[0] ?? [];
    expect(tenantId).toBe(userId);
    expect(payload.subject).toContain(payment?.receiptNumber ?? "");
    expect(payload.text).toContain("Maintenance critique");
    expect(payload.attachments[0]).toMatchObject({
      filename: `recu-${payment?.receiptNumber}.pdf`,
      contentType: "application/pdf",
    });

    expect(emailLog).toMatchObject({
      to: "recipient@example.com",
      status: "ENVOYE",
    });
    expect(emailLog?.subject).toContain(payment?.receiptNumber ?? "");
    expect(emailLog?.body).toContain("Maintenance critique");
    expect(payment?.receiptSentAt).not.toBeNull();
  });
});
