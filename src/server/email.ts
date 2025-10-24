import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { generateQuotePdf, generateInvoicePdf } from "@/server/pdf";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "0");
  if (!host || !port) {
    throw new Error("Configuration SMTP manquante");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
  });
}

const FROM_EMAIL = process.env.SMTP_FROM ?? "facturation@example.com";

export async function sendQuoteEmail(params: {
  quoteId: string;
  to: string;
  subject?: string;
  message?: string;
}) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.quoteId },
    include: {
      client: true,
    },
  });
  if (!quote) throw new Error("Devis introuvable");

  const pdfBuffer = await generateQuotePdf(params.quoteId);
  const transport = createTransport();

  const subject =
    params.subject ??
    `Votre devis ${quote.number} — ${formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}`;
  const message =
    params.message ??
    `Bonjour ${quote.client.displayName},\n\nVeuillez trouver ci-joint le devis ${quote.number} du ${formatDate(quote.issueDate)}.\n\nMontant TTC : ${formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}.\n\nCordialement,\n${FROM_EMAIL}`;

  await transport.sendMail({
    from: FROM_EMAIL,
    to: params.to,
    subject,
    text: message,
    attachments: [
      {
        filename: `devis-${quote.number}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  await prisma.emailLog.create({
    data: {
      documentType: "DEVIS",
      documentId: quote.id,
      to: params.to,
      subject,
      body: message,
      sentAt: new Date(),
      status: "ENVOYE",
    },
  });
}

export async function sendInvoiceEmail(params: {
  invoiceId: string;
  to: string;
  subject?: string;
  message?: string;
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      client: true,
    },
  });
  if (!invoice) throw new Error("Facture introuvable");

  const pdfBuffer = await generateInvoicePdf(params.invoiceId);
  const transport = createTransport();

  const subject =
    params.subject ??
    `Votre facture ${invoice.number} — ${formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}`;
  const message =
    params.message ??
    `Bonjour ${invoice.client.displayName},\n\nVeuillez trouver ci-joint la facture ${invoice.number} du ${formatDate(invoice.issueDate)}.\n\nMontant TTC : ${formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}.\n\nCordialement,\n${FROM_EMAIL}`;

  await transport.sendMail({
    from: FROM_EMAIL,
    to: params.to,
    subject,
    text: message,
    attachments: [
      {
        filename: `facture-${invoice.number}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  await prisma.emailLog.create({
    data: {
      documentType: "FACTURE",
      documentId: invoice.id,
      to: params.to,
      subject,
      body: message,
      sentAt: new Date(),
      status: "ENVOYE",
    },
  });
}
