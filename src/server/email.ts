import { prisma } from "@/lib/prisma";
import { generateQuotePdf, generateInvoicePdf } from "@/server/pdf";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import {
  sendEmailMessage,
  getMessagingSettingsSummary,
  type EmailAttachment,
  type MessagingSettingsSummary,
} from "@/server/messaging";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function convertTextToHtml(value: string): string {
  return value
    .split("\n")
    .map((line) => escapeHtml(line))
    .join("<br />");
}

const CONFIG_WARNING =
  "Veuillez configurer votre messagerie (SMTP/IMAP) avant d'envoyer des emails.";

async function getValidatedMessagingSummary(): Promise<MessagingSettingsSummary> {
  const summary = await getMessagingSettingsSummary();
  if (!summary.smtpConfigured) {
    throw new Error(CONFIG_WARNING);
  }
  return summary;
}

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
  const messagingSummary = await getValidatedMessagingSummary();

  const subject =
    params.subject ??
    `Votre devis ${quote.number} — ${formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}`;
  const message =
    params.message ??
    `Bonjour ${quote.client.displayName},\n\nVeuillez trouver ci-joint le devis ${quote.number} du ${formatDate(quote.issueDate)}.\n\nMontant TTC : ${formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}.\n\nCordialement,\n${messagingSummary.senderName || messagingSummary.fromEmail || "Votre équipe"}`;

  const attachments: EmailAttachment[] = [
    {
      filename: `devis-${quote.number}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ];

  await sendEmailMessage({
    to: [params.to],
    subject,
    text: message,
    html: convertTextToHtml(message),
    attachments,
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
  const messagingSummary = await getValidatedMessagingSummary();

  const subject =
    params.subject ??
    `Votre facture ${invoice.number} — ${formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}`;
  const message =
    params.message ??
    `Bonjour ${invoice.client.displayName},\n\nVeuillez trouver ci-joint la facture ${invoice.number} du ${formatDate(invoice.issueDate)}.\n\nMontant TTC : ${formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency)}.\n\nCordialement,\n${messagingSummary.senderName || messagingSummary.fromEmail || "Votre équipe"}`;

  const attachments: EmailAttachment[] = [
    {
      filename: `facture-${invoice.number}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ];

  await sendEmailMessage({
    to: [params.to],
    subject,
    text: message,
    html: convertTextToHtml(message),
    attachments,
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
