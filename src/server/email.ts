import { DocumentType, EmailStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateQuotePdf, generateInvoicePdf } from "@/server/pdf";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { sanitizeEmailHtml } from "@/lib/email-html";
import {
  fillPlaceholders,
} from "@/lib/messaging/placeholders";
import { DEFAULT_SAVED_RESPONSES } from "@/lib/messaging/default-responses";
import {
  sendEmailMessage,
  getMessagingSettingsSummary,
  type EmailAttachment,
  type MessagingSettingsSummary,
} from "@/server/messaging";
import { getSettings } from "@/server/settings";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CONFIG_WARNING =
  "Veuillez configurer votre messagerie (SMTP/IMAP) avant d'envoyer des emails.";

const QUOTE_TEMPLATE_SLUG = "default-quote-template";
const INVOICE_TEMPLATE_SLUG = "default-invoice-template";

const QUOTE_PLAIN_TEXT_TEMPLATE = `Bonjour {{client_name}},

Veuillez trouver ci-joint le devis {{quote_number}} du {{quote_date}} pour {{project_name}}.

Montant HT : {{total_ht}}
TVA : {{total_tva}}
Montant TTC : {{total_ttc}}
Validité : {{quote_valid_until}}

Cordialement,
{{company_name}}`;

const INVOICE_PLAIN_TEXT_TEMPLATE = `Bonjour {{client_name}},

Veuillez trouver ci-joint la facture {{invoice_number}} émise le {{invoice_date}}.

Montant TTC : {{total_ttc}}
Montant payé : {{amount_paid}}
Solde restant : {{balance_due}}
Échéance : {{due_date}}

Cordialement,
{{company_name}}`;

function fallbackQuoteHtmlTemplate(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif;color:#0f172a;">
      <tr>
        <td style="padding-bottom:16px;font-size:20px;font-weight:600;">
          Devis {{quote_number}}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:12px;color:#334155;font-size:15px;line-height:1.6;">
          Bonjour {{client_name}},
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;color:#334155;font-size:15px;line-height:1.6;">
          Veuillez trouver ci-joint le devis {{quote_number}} pour {{project_name}}.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;background-color:#f9fbff;">
            <tr>
              <td style="padding:16px;font-size:14px;color:#334155;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td colspan="2" style="font-size:15px;font-weight:600;color:#1d4ed8;padding-bottom:12px;">
                      Récapitulatif du devis
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-bottom:1px solid #e2e8f0;">
                      Montant HT :
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#1d4ed8;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                      {{total_ht}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-bottom:1px solid #e2e8f0;">
                      TVA :
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                      {{total_tva}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-bottom:1px solid #e2e8f0;">
                      Montant TTC :
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                      {{total_ttc}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-top:1px solid #e2e8f0;">
                      Validité :
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">
                      {{quote_valid_until}}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;color:#334155;font-size:15px;line-height:1.6;">
          Nous restons à votre disposition pour toute question.
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#64748b;line-height:1.5;">
          {{company_name}}<br />
          {{company_email}} &middot; {{company_phone}}<br />
          {{company_address}}
        </td>
      </tr>
    </table>
  `;
}

function fallbackInvoiceHtmlTemplate(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif;color:#0f172a;">
      <tr>
        <td style="padding-bottom:16px;font-size:20px;font-weight:600;">
          Facture {{invoice_number}}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:12px;color:#334155;font-size:15px;line-height:1.6;">
          Bonjour {{client_name}},
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;color:#334155;font-size:15px;line-height:1.6;">
          Veuillez trouver ci-joint la facture {{invoice_number}} du {{invoice_date}}.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;background-color:#f9fbff;">
            <tr>
              <td style="padding:16px;font-size:14px;color:#334155;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-bottom:1px solid #e2e8f0;">
                      <strong>Montant TTC :</strong>
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#1d4ed8;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                      {{total_ttc}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-bottom:1px solid #e2e8f0;">
                      <strong>Montant payé :</strong>
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                      {{amount_paid}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-bottom:1px solid #e2e8f0;">
                      <strong>Solde restant :</strong>
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#dc2626;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                      {{balance_due}}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-size:14px;color:#334155;border-bottom:0;border-top:1px solid #e2e8f0;">
                      <strong>Échéance :</strong>
                    </td>
                    <td style="padding:12px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;border-bottom:0;border-top:1px solid #e2e8f0;">
                      {{due_date}}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;color:#334155;font-size:15px;line-height:1.6;">
          Merci pour votre confiance.
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#64748b;line-height:1.5;">
          {{company_name}}<br />
          {{company_email}} &middot; {{company_phone}}<br />
          {{company_address}}
        </td>
      </tr>
    </table>
  `;
}

async function loadHtmlTemplate(
  userId: string,
  slug: string,
  fallbackFactory: () => string,
): Promise<string> {
  const savedTemplate = await prisma.messagingSavedResponse.findFirst({
    where: {
      userId,
      slug,
    },
  });

  if (
    savedTemplate &&
    savedTemplate.format === "HTML" &&
    savedTemplate.content.trim().length > 0
  ) {
    return savedTemplate.content;
  }

  const defaultTemplate =
    DEFAULT_SAVED_RESPONSES.find(
      (entry) =>
        entry.slug === slug && entry.format === "HTML",
    )?.content ?? fallbackFactory();

  return defaultTemplate;
}

async function loadQuoteHtmlTemplate(userId: string): Promise<string> {
  return loadHtmlTemplate(userId, QUOTE_TEMPLATE_SLUG, fallbackQuoteHtmlTemplate);
}

async function loadInvoiceHtmlTemplate(userId: string): Promise<string> {
  return loadHtmlTemplate(userId, INVOICE_TEMPLATE_SLUG, fallbackInvoiceHtmlTemplate);
}

async function getValidatedMessagingSummary(userId?: string): Promise<MessagingSettingsSummary> {
  const summary = await getMessagingSettingsSummary(userId);
  if (!summary.smtpConfigured) {
    throw new Error(CONFIG_WARNING);
  }
  return summary;
}

export async function sendQuoteEmail(params: {
  quoteId: string;
  to: string;
  subject?: string;
  userId?: string;
  emailLogId?: string | null;
}) {
  const userId = params.userId ?? (await requireUser()).id;
  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, userId },
    include: {
      client: true,
    },
  });
  if (!quote) throw new Error("Devis introuvable");

  const [pdfBuffer, messagingSummary, companySettings, templateSource] =
    await Promise.all([
      generateQuotePdf(params.quoteId),
      getValidatedMessagingSummary(userId),
      getSettings(userId),
      loadQuoteHtmlTemplate(userId),
    ]);

  const subject =
    params.subject ??
    `Votre devis ${quote.number} — ${formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency)}`;

  const quoteSubtotal = formatCurrency(
    fromCents(quote.subtotalHTCents, quote.currency),
    quote.currency,
  );
  const quoteVat = formatCurrency(
    fromCents(quote.totalTVACents, quote.currency),
    quote.currency,
  );
  const quoteTotal = formatCurrency(
    fromCents(quote.totalTTCCents, quote.currency),
    quote.currency,
  );
  const projectName =
    quote.reference?.trim() ??
    quote.client.companyName?.trim() ??
    quote.client.displayName;

  const placeholderValues: Record<string, string> = {
    quote_number: quote.number,
    quote_date: formatDate(quote.issueDate),
    quote_valid_until: quote.validUntil ? formatDate(quote.validUntil) : "",
    client_name: quote.client.displayName,
    project_name: projectName ?? "",
    total_ht: quoteSubtotal,
    total_tva: quoteVat,
    total_ttc: quoteTotal,
    company_name: companySettings.companyName?.trim() ?? "",
    company_email:
      companySettings.email?.trim() ??
      messagingSummary.fromEmail ??
      "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
    sender_name: messagingSummary.senderName?.trim() ?? "",
  };

  const filledHtml = fillPlaceholders(templateSource, placeholderValues);
  const sanitizedHtml = sanitizeEmailHtml(filledHtml);
  const textBody = fillPlaceholders(
    QUOTE_PLAIN_TEXT_TEMPLATE,
    placeholderValues,
  );

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
    text: textBody,
    html: sanitizedHtml,
    attachments,
  });

  await recordEmailLogEntry({
    emailLogId: params.emailLogId,
    userId,
    documentType: DocumentType.DEVIS,
    documentId: quote.id,
    to: params.to,
    subject,
    body: sanitizedHtml,
  });
}

export async function sendInvoiceEmail(params: {
  invoiceId: string;
  to: string;
  subject?: string;
  userId?: string;
  emailLogId?: string | null;
}) {
  const userId = params.userId ?? (await requireUser()).id;
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, userId },
    include: {
      client: true,
      quote: true,
    },
  });
  if (!invoice) throw new Error("Facture introuvable");

  const [pdfBuffer, messagingSummary, companySettings, templateSource] =
    await Promise.all([
      generateInvoicePdf(params.invoiceId),
      getValidatedMessagingSummary(userId),
      getSettings(userId),
      loadInvoiceHtmlTemplate(userId),
    ]);

  const subject =
    params.subject ??
    `Votre facture ${invoice.number} — ${formatCurrency(
      fromCents(invoice.totalTTCCents, invoice.currency),
      invoice.currency,
    )}`;

  const invoiceTotal = formatCurrency(
    fromCents(invoice.totalTTCCents, invoice.currency),
    invoice.currency,
  );
  const paidAmount = formatCurrency(
    fromCents(invoice.amountPaidCents, invoice.currency),
    invoice.currency,
  );
  const balanceDueCents = Math.max(
    invoice.totalTTCCents - invoice.amountPaidCents,
    0,
  );
  const balanceDue = formatCurrency(
    fromCents(balanceDueCents, invoice.currency),
    invoice.currency,
  );
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate) : "";
  const projectName =
    invoice.reference?.trim() ??
    invoice.quote?.reference?.trim() ??
    invoice.client.companyName?.trim() ??
    invoice.client.displayName;

  const placeholderValues: Record<string, string> = {
    invoice_number: invoice.number,
    invoice_date: formatDate(invoice.issueDate),
    client_name: invoice.client.displayName,
    project_name: projectName ?? "",
    total_ttc: invoiceTotal,
    amount_paid: paidAmount,
    balance_due: balanceDue,
    due_date: dueDate,
    company_name: companySettings.companyName?.trim() ?? "",
    company_email:
      companySettings.email?.trim() ??
      messagingSummary.fromEmail ??
      "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
    sender_name: messagingSummary.senderName?.trim() ?? "",
  };

  const filledHtml = fillPlaceholders(templateSource, placeholderValues);
  const sanitizedHtml = sanitizeEmailHtml(filledHtml);
  const textBody = fillPlaceholders(
    INVOICE_PLAIN_TEXT_TEMPLATE,
    placeholderValues,
  );

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
    text: textBody,
    html: sanitizedHtml,
    attachments,
  });

  await recordEmailLogEntry({
    emailLogId: params.emailLogId,
    userId,
    documentType: DocumentType.FACTURE,
    documentId: invoice.id,
    to: params.to,
    subject,
    body: sanitizedHtml,
  });
}

async function recordEmailLogEntry(options: {
  emailLogId?: string | null;
  userId: string;
  documentType: DocumentType;
  documentId: string;
  to: string;
  subject: string;
  body: string;
}) {
  const sentAt = new Date();
  const updateData = {
    to: options.to,
    subject: options.subject,
    body: options.body,
    sentAt,
    status: EmailStatus.ENVOYE,
    error: null,
  };

  if (options.emailLogId) {
    await prisma.emailLog
      .update({
        where: { id: options.emailLogId },
        data: updateData,
      })
      .catch(() =>
        prisma.emailLog.create({
          data: {
            ...updateData,
            userId: options.userId,
            documentType: options.documentType,
            documentId: options.documentId,
          },
        }),
      );
    return;
  }

  await prisma.emailLog.create({
    data: {
      ...updateData,
      userId: options.userId,
      documentType: options.documentType,
      documentId: options.documentId,
    },
  });
}
