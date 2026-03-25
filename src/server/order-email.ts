import { OrderPaymentStatus, WebsiteDomainStatus, type WebsiteConfig } from "@prisma/client";
import { createConfirmationToken } from "@/lib/confirmation-token";
import { getAppBaseUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { sanitizeEmailHtml } from "@/lib/email-html";
import { fillPlaceholders } from "@/lib/messaging/placeholders";
import { DEFAULT_SAVED_RESPONSES } from "@/lib/messaging/default-responses";
import { requireUser } from "@/lib/auth";
import {
  getMessagingSettingsSummary,
  sendEmailMessageForUser,
  type MessagingSettingsSummary,
} from "@/server/messaging";
import { getSettings } from "@/server/settings";
import { getWebsiteConfig, resolveEcommerceSettingsFromWebsite } from "@/server/website";

const CONFIG_WARNING =
  "Veuillez configurer votre messagerie (SMTP/IMAP) avant d'envoyer des emails.";

const ORDER_CREATED_TEMPLATE_SLUG = "default-order-created-template";
const ORDER_PAYMENT_TEMPLATE_SLUG = "default-order-payment-template";
const ORDER_TRANSFER_PROOF_TEMPLATE_SLUG = "default-order-proof-received-template";
const QUOTE_REQUEST_TEMPLATE_SLUG = "default-quote-request-template";
const ORDER_RECAP_CTA_LABEL = "Accéder au récapitulatif";

const ORDER_CREATED_PLAIN_TEXT_TEMPLATE = `Bonjour {{customer_name}},

Merci, votre commande {{order_number}} est confirmée ({{order_date}}).

Résumé de la commande :
{{order_items_text}}

Total TTC : {{order_total}}
{{bank_transfer_block_text}}{{order_recap_block_text}}Une question ? Répondez à cet e-mail, nous vous répondrons rapidement.

Merci pour votre confiance.
{{company_name}}`;

const ORDER_PAYMENT_PLAIN_TEXT_TEMPLATE = `Bonjour {{customer_name}},

Votre paiement pour la commande {{order_number}} a été confirmé le {{payment_date}}.

Montant réglé : {{amount_paid}}
Total TTC : {{order_total}}
{{order_recap_block_text}}

Merci pour votre confiance.
{{company_name}}`;

const ORDER_TRANSFER_PROOF_PLAIN_TEXT_TEMPLATE = `Bonjour {{customer_name}},

Nous avons bien reçu votre preuve de virement pour la commande {{order_number}} le {{proof_date}}.

Notre équipe vérifie le règlement et revient vers vous rapidement.

Total TTC : {{order_total}}
{{order_recap_block_text}}

Merci pour votre confiance.
{{company_name}}`;

const QUOTE_REQUEST_PLAIN_TEXT_TEMPLATE = `Bonjour {{customer_name}},

Votre demande de devis a bien été reçue le {{request_date}}.
Produit / service : {{product_name}}

Message :
{{request_message_text}}

Merci, nous revenons vers vous rapidement.
{{company_name}}`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
      (entry) => entry.slug === slug && entry.format === "HTML",
    )?.content ?? fallbackFactory();

  return defaultTemplate;
}

async function getValidatedMessagingSummary(
  userId: string,
): Promise<MessagingSettingsSummary> {
  const summary = await getMessagingSettingsSummary(userId);
  if (!summary.smtpConfigured) {
    throw new Error(CONFIG_WARNING);
  }
  return summary;
}

function formatMoney(cents: number, currency: string) {
  return formatCurrency(fromCents(cents, currency), currency);
}

function resolveAppBaseUrl() {
  try {
    return getAppBaseUrl();
  } catch {
    return null;
  }
}

async function buildOrderRecapUrl(options: {
  orderId: string;
  website: WebsiteConfig | null;
}) {
  const appBaseUrl = resolveAppBaseUrl();
  if (!appBaseUrl || !options.website) {
    return null;
  }
  try {
    const confirmationToken = await createConfirmationToken(options.orderId);
    const params = new URLSearchParams();
    params.set("orderId", options.orderId);
    params.set("token", confirmationToken);
    const confirmationPath = `/confirmation?${params.toString()}`;
    if (
      options.website.customDomain &&
      options.website.domainStatus === WebsiteDomainStatus.ACTIVE
    ) {
      return `https://${options.website.customDomain}${confirmationPath}`;
    }
    return `${appBaseUrl}/catalogue/${options.website.slug}${confirmationPath}`;
  } catch {
    return null;
  }
}

function buildOrderRecapBlocks(options: {
  orderRecapUrl: string | null;
  note?: string;
}) {
  const note = options.note?.trim() ?? "";
  const noteHtml = note
    ? `<p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">${escapeHtml(
      note,
    )}</p>`
    : "";
  const noteText = note ? `${note}\n` : "";

  if (!options.orderRecapUrl) {
    if (!note) {
      return { html: "", text: "" };
    }
    return {
      html: `
        <tr>
          <td style="padding-bottom:20px;font-size:12px;color:#64748b;">
            ${escapeHtml(note)}
          </td>
        </tr>
      `,
      text: `\n${noteText}`,
    };
  }

  const safeUrl = escapeHtml(options.orderRecapUrl);
  return {
    html: `
      <tr>
        <td style="padding-bottom:20px;">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${ORDER_RECAP_CTA_LABEL}</a>
          <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">Lien sécurisé pour consulter votre commande.</p>
          ${noteHtml}
        </td>
      </tr>
    `,
    text: `\n${ORDER_RECAP_CTA_LABEL} : ${options.orderRecapUrl}\n${noteText}`,
  };
}

function buildFallbackBankTransferInstructions(options: {
  companyName: string;
  iban: string;
  email: string;
  phone: string;
}) {
  const lines: string[] = [];
  if (options.companyName) {
    lines.push(`Bénéficiaire : ${options.companyName}`);
  }
  if (options.iban) {
    lines.push(`IBAN : ${options.iban}`);
  }
  if (options.email) {
    lines.push(`Contact : ${options.email}`);
  }
  if (options.phone) {
    lines.push(`Téléphone : ${options.phone}`);
  }
  return lines.length
    ? lines.join("\n")
    : "Coordonnées bancaires disponibles sur demande.";
}

function buildBankTransferBlocks(options: {
  instructionsText: string;
  orderNumber: string;
  orderRecapUrl: string | null;
}) {
  const instructionsText = options.instructionsText.trim();
  const instructionsHtml = instructionsText
    ? escapeHtml(instructionsText).replace(/\n/g, "<br />")
    : "";
  const recapLinkHtml = options.orderRecapUrl
    ? `<a href="${escapeHtml(
      options.orderRecapUrl,
    )}" style="color:#0f172a;font-weight:600;text-decoration:none;">récapitulatif de commande</a>`
    : "récapitulatif de commande";
  const proofStepText = options.orderRecapUrl
    ? `Déposez la preuve via votre récapitulatif : ${options.orderRecapUrl}.`
    : "Déposez la preuve via votre récapitulatif de commande.";
  const stepsText = [
    "Étapes :",
    "1. Effectuez le virement du montant TTC.",
    `2. Indiquez la référence ${options.orderNumber}.`,
    `3. ${proofStepText}`,
  ].join("\n");
  const stepsHtml = `Étapes :<br />1. Effectuez le virement du montant TTC.<br />2. Indiquez la référence <strong>${escapeHtml(
    options.orderNumber,
  )}</strong>.<br />3. ${
    options.orderRecapUrl
      ? `Déposez la preuve via votre ${recapLinkHtml}.`
      : "Déposez la preuve via votre récapitulatif de commande."
  }`;

  const blockHtml = `
      <tr>
        <td style="padding-bottom:20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:12px;background-color:#f8fafc;">
            <tr>
              <td style="padding:16px;">
                <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;font-weight:600;">Virement bancaire</p>
                ${instructionsHtml ? `<p style="margin:0 0 10px 0;font-size:14px;color:#334155;line-height:1.6;">${instructionsHtml}</p>` : ""}
                <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">${stepsHtml}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  const blockTextParts = ["Virement bancaire"];
  if (instructionsText) {
    blockTextParts.push(instructionsText);
  }
  blockTextParts.push(stepsText);
  const blockText = `\n${blockTextParts.join("\n")}\n`;

  return {
    instructionsHtml,
    instructionsText,
    blockHtml,
    blockText,
  };
}

function buildOrderItemsHtml(
  items: Array<{
    description: string;
    quantity: number;
    totalTTCCents: number;
  }>,
  currency: string,
) {
  if (!items.length) {
    return "";
  }
  return items
    .map((item) => {
      const total = formatMoney(item.totalTTCCents, currency);
      return `<tr>
  <td style="padding:8px 0;font-size:14px;color:#334155;">${escapeHtml(
    item.description,
  )} x ${item.quantity}</td>
  <td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">${total}</td>
</tr>`;
    })
    .join("");
}

function buildOrderItemsText(
  items: Array<{
    description: string;
    quantity: number;
    totalTTCCents: number;
  }>,
  currency: string,
) {
  if (!items.length) {
    return "-";
  }
  return items
    .map((item) => {
      const total = formatMoney(item.totalTTCCents, currency);
      return `- ${item.description} x ${item.quantity} : ${total}`;
    })
    .join("\n");
}

function fallbackOrderCreatedHtmlTemplate() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif;color:#0f172a;">
      <tr>
        <td style="padding-bottom:12px;">
          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#e0f2fe;color:#0369a1;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Commande confirmée</span>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:10px;font-size:20px;font-weight:600;">
          Merci {{customer_name}}, votre commande est confirmée
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Référence : <strong>{{order_number}}</strong> &middot; {{order_date}}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Nous préparons votre prestation avec le plus grand soin.
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            {{order_items}}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:16px;font-weight:600;">
          Total TTC : {{order_total}}
        </td>
      </tr>
      {{bank_transfer_block}}
      {{order_recap_block}}
      <tr>
        <td style="padding-bottom:12px;font-size:13px;color:#64748b;line-height:1.5;">
          Une question ? Répondez à cet e-mail, nous vous répondrons rapidement.
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

function fallbackOrderPaymentHtmlTemplate() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif;color:#0f172a;">
      <tr>
        <td style="padding-bottom:12px;">
          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#dcfce7;color:#166534;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Paiement confirmé</span>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:10px;font-size:20px;font-weight:600;">
          Votre paiement est bien confirmé
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Commande <strong>{{order_number}}</strong> &middot; Réglé le {{payment_date}}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Montant réglé : <strong>{{amount_paid}}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Total TTC : {{order_total}}
        </td>
      </tr>
      {{order_recap_block}}
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

function fallbackOrderTransferProofHtmlTemplate() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif;color:#0f172a;">
      <tr>
        <td style="padding-bottom:12px;">
          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#fef9c3;color:#854d0e;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Preuve reçue</span>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:10px;font-size:20px;font-weight:600;">
          Votre preuve de virement est bien reçue
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Commande : <strong>{{order_number}}</strong> &middot; {{proof_date}}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Total TTC : {{order_total}}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;">
          Nous vérifions le règlement et revenons vers vous rapidement.
        </td>
      </tr>
      {{order_recap_block}}
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

function fallbackQuoteRequestHtmlTemplate() {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif;color:#0f172a;">
      <tr>
        <td style="padding-bottom:12px;">
          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#ede9fe;color:#6d28d9;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Demande de devis</span>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:10px;font-size:20px;font-weight:600;">
          Merci {{customer_name}}, votre demande est bien reçue
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:12px;font-size:14px;color:#334155;">
          Service : <strong>{{product_name}}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:12px;font-size:14px;color:#334155;">
          Date : {{request_date}}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:16px;font-size:14px;color:#334155;white-space:pre-line;">
          {{request_message}}
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

export async function sendOrderCreatedEmail(params: {
  orderId: string;
  to: string;
  subject?: string;
  userId?: string;
}) {
  const userId = params.userId ?? (await requireUser()).id;
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, userId },
    include: {
      items: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { method: true },
      },
    },
  });
  if (!order) {
    throw new Error("Commande introuvable");
  }

  const [messagingSummary, companySettings, templateSource, website] = await Promise.all([
    getValidatedMessagingSummary(userId),
    getSettings(userId),
    loadHtmlTemplate(userId, ORDER_CREATED_TEMPLATE_SLUG, fallbackOrderCreatedHtmlTemplate),
    getWebsiteConfig(userId),
  ]);

  const orderTotal = formatMoney(order.totalTTCCents, order.currency);
  const orderedItems = [...order.items].sort((a, b) => a.position - b.position);
  const orderItemsHtml = buildOrderItemsHtml(
    orderedItems,
    order.currency,
  );
  const orderItemsText = buildOrderItemsText(orderedItems, order.currency);
  const orderRecapUrl = await buildOrderRecapUrl({
    orderId: order.id,
    website,
  });
  const orderRecapBlocks = buildOrderRecapBlocks({
    orderRecapUrl,
  });
  const ecommerceSettings = resolveEcommerceSettingsFromWebsite(website);
  const bankTransferInstructions =
    ecommerceSettings.payments?.bankTransfer?.instructions?.trim() ?? "";
  const fallbackInstructions = buildFallbackBankTransferInstructions({
    companyName: companySettings.companyName?.trim() ?? "",
    iban: companySettings.iban?.trim() ?? "",
    email: companySettings.email?.trim() ?? messagingSummary.fromEmail ?? "",
    phone: companySettings.phone?.trim() ?? "",
  });
  const resolvedInstructions = bankTransferInstructions || fallbackInstructions;
  const isBankTransfer = order.payments[0]?.method === "bank_transfer";
  const bankTransferBlocks = isBankTransfer
    ? buildBankTransferBlocks({
        instructionsText: resolvedInstructions,
        orderNumber: order.orderNumber,
        orderRecapUrl,
      })
    : {
        instructionsHtml: "",
        instructionsText: "",
        blockHtml: "",
        blockText: "",
      };

  const placeholderValues: Record<string, string> = {
    order_number: order.orderNumber,
    order_date: formatDate(order.createdAt),
    order_total: orderTotal,
    order_items: orderItemsHtml,
    order_items_text: orderItemsText,
    customer_name: order.customerName,
    company_name: companySettings.companyName?.trim() ?? "",
    company_email:
      companySettings.email?.trim() ?? messagingSummary.fromEmail ?? "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
    sender_name: messagingSummary.senderName?.trim() ?? "",
    order_recap_url: orderRecapUrl ?? "",
    order_recap_block: orderRecapBlocks.html,
    order_recap_block_text: orderRecapBlocks.text,
    bank_transfer_instructions: bankTransferBlocks.instructionsHtml,
    bank_transfer_instructions_text: bankTransferBlocks.instructionsText,
    bank_transfer_block: bankTransferBlocks.blockHtml,
    bank_transfer_block_text: bankTransferBlocks.blockText,
  };

  const subject =
    params.subject ??
    `Votre commande ${order.orderNumber} - ${orderTotal}`;

  const filledHtml = fillPlaceholders(templateSource, placeholderValues);
  const sanitizedHtml = sanitizeEmailHtml(filledHtml);
  const textBody = fillPlaceholders(
    ORDER_CREATED_PLAIN_TEXT_TEMPLATE,
    placeholderValues,
  );

  await sendEmailMessageForUser(userId, {
    to: [params.to],
    subject,
    text: textBody,
    html: sanitizedHtml,
  });
}

export async function sendOrderPaymentReceivedEmail(params: {
  orderId: string;
  to: string;
  subject?: string;
  userId?: string;
}) {
  const userId = params.userId ?? (await requireUser()).id;
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, userId },
    include: {
      payments: {
        where: { status: OrderPaymentStatus.SUCCEEDED },
        orderBy: { paidAt: "desc" },
        take: 1,
      },
    },
  });
  if (!order) {
    throw new Error("Commande introuvable");
  }

  const [messagingSummary, companySettings, templateSource, website] = await Promise.all([
    getValidatedMessagingSummary(userId),
    getSettings(userId),
    loadHtmlTemplate(userId, ORDER_PAYMENT_TEMPLATE_SLUG, fallbackOrderPaymentHtmlTemplate),
    getWebsiteConfig(userId),
  ]);

  const paymentDate =
    order.payments[0]?.paidAt ??
    order.updatedAt ??
    new Date();
  const amountPaid = formatMoney(
    Math.max(order.amountPaidCents, 0),
    order.currency,
  );
  const orderTotal = formatMoney(order.totalTTCCents, order.currency);
  const orderRecapUrl = await buildOrderRecapUrl({
    orderId: order.id,
    website,
  });
  const orderRecapBlocks = buildOrderRecapBlocks({
    orderRecapUrl,
    note:
      "Prochaine étape : nous lançons la prestation et revenons vers vous pour la mise en route.",
  });

  const placeholderValues: Record<string, string> = {
    order_number: order.orderNumber,
    payment_date: formatDate(paymentDate),
    amount_paid: amountPaid,
    order_total: orderTotal,
    customer_name: order.customerName,
    company_name: companySettings.companyName?.trim() ?? "",
    company_email:
      companySettings.email?.trim() ?? messagingSummary.fromEmail ?? "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
    sender_name: messagingSummary.senderName?.trim() ?? "",
    order_recap_url: orderRecapUrl ?? "",
    order_recap_block: orderRecapBlocks.html,
    order_recap_block_text: orderRecapBlocks.text,
    bank_transfer_instructions: "",
    bank_transfer_instructions_text: "",
    bank_transfer_block: "",
    bank_transfer_block_text: "",
  };

  const subject =
    params.subject ??
    `Paiement reçu pour la commande ${order.orderNumber}`;

  const filledHtml = fillPlaceholders(templateSource, placeholderValues);
  const sanitizedHtml = sanitizeEmailHtml(filledHtml);
  const textBody = fillPlaceholders(
    ORDER_PAYMENT_PLAIN_TEXT_TEMPLATE,
    placeholderValues,
  );

  await sendEmailMessageForUser(userId, {
    to: [params.to],
    subject,
    text: textBody,
    html: sanitizedHtml,
  });
}

export async function sendOrderTransferProofReceivedEmail(params: {
  orderId: string;
  to: string;
  subject?: string;
  userId?: string;
}) {
  const userId = params.userId ?? (await requireUser()).id;
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, userId },
    include: {
      payments: {
        where: {
          method: "bank_transfer",
          proofUploadedAt: { not: null },
        },
        orderBy: { proofUploadedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!order) {
    throw new Error("Commande introuvable");
  }

  const [messagingSummary, companySettings, templateSource, website] = await Promise.all([
    getValidatedMessagingSummary(userId),
    getSettings(userId),
    loadHtmlTemplate(
      userId,
      ORDER_TRANSFER_PROOF_TEMPLATE_SLUG,
      fallbackOrderTransferProofHtmlTemplate,
    ),
    getWebsiteConfig(userId),
  ]);

  const proofDate =
    order.payments[0]?.proofUploadedAt ??
    order.updatedAt ??
    new Date();
  const orderTotal = formatMoney(order.totalTTCCents, order.currency);
  const orderRecapUrl = await buildOrderRecapUrl({
    orderId: order.id,
    website,
  });
  const orderRecapBlocks = buildOrderRecapBlocks({
    orderRecapUrl,
    note:
      "Prochaine étape : validation de votre preuve, puis confirmation du paiement par e-mail.",
  });
  const ecommerceSettings = resolveEcommerceSettingsFromWebsite(website);
  const bankTransferInstructions =
    ecommerceSettings.payments?.bankTransfer?.instructions?.trim() ?? "";
  const fallbackInstructions = buildFallbackBankTransferInstructions({
    companyName: companySettings.companyName?.trim() ?? "",
    iban: companySettings.iban?.trim() ?? "",
    email: companySettings.email?.trim() ?? messagingSummary.fromEmail ?? "",
    phone: companySettings.phone?.trim() ?? "",
  });
  const resolvedInstructions = bankTransferInstructions || fallbackInstructions;
  const bankTransferBlocks = buildBankTransferBlocks({
    instructionsText: resolvedInstructions,
    orderNumber: order.orderNumber,
    orderRecapUrl,
  });

  const placeholderValues: Record<string, string> = {
    order_number: order.orderNumber,
    proof_date: formatDate(proofDate),
    order_total: orderTotal,
    customer_name: order.customerName,
    company_name: companySettings.companyName?.trim() ?? "",
    company_email:
      companySettings.email?.trim() ?? messagingSummary.fromEmail ?? "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
    sender_name: messagingSummary.senderName?.trim() ?? "",
    order_recap_url: orderRecapUrl ?? "",
    order_recap_block: orderRecapBlocks.html,
    order_recap_block_text: orderRecapBlocks.text,
    bank_transfer_instructions: bankTransferBlocks.instructionsHtml,
    bank_transfer_instructions_text: bankTransferBlocks.instructionsText,
    bank_transfer_block: bankTransferBlocks.blockHtml,
    bank_transfer_block_text: bankTransferBlocks.blockText,
  };

  const subject =
    params.subject ??
    `Preuve de virement reçue pour la commande ${order.orderNumber}`;

  const filledHtml = fillPlaceholders(templateSource, placeholderValues);
  const sanitizedHtml = sanitizeEmailHtml(filledHtml);
  const textBody = fillPlaceholders(
    ORDER_TRANSFER_PROOF_PLAIN_TEXT_TEMPLATE,
    placeholderValues,
  );

  await sendEmailMessageForUser(userId, {
    to: [params.to],
    subject,
    text: textBody,
    html: sanitizedHtml,
  });
}

export async function sendQuoteRequestEmail(params: {
  quoteRequestId: string;
  to: string;
  subject?: string;
  userId?: string;
}) {
  const userId = params.userId ?? (await requireUser()).id;
  const quoteRequest = await prisma.quoteRequest.findFirst({
    where: { id: params.quoteRequestId, userId },
    include: { product: true },
  });
  if (!quoteRequest) {
    throw new Error("Demande de devis introuvable");
  }

  const [messagingSummary, companySettings, templateSource] = await Promise.all([
    getValidatedMessagingSummary(userId),
    getSettings(userId),
    loadHtmlTemplate(userId, QUOTE_REQUEST_TEMPLATE_SLUG, fallbackQuoteRequestHtmlTemplate),
  ]);

  const productName =
    quoteRequest.product?.name?.trim() ?? "Service";
  const messageText = quoteRequest.message?.trim() ?? "";
  const messageHtml = messageText
    ? escapeHtml(messageText).replace(/\n/g, "<br />")
    : "Nous avons bien reçu votre message.";

  const placeholderValues: Record<string, string> = {
    request_date: formatDate(quoteRequest.createdAt),
    customer_name: quoteRequest.customerName,
    product_name: productName,
    request_message: messageHtml,
    request_message_text: messageText || "-",
    company_name: companySettings.companyName?.trim() ?? "",
    company_email:
      companySettings.email?.trim() ?? messagingSummary.fromEmail ?? "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
    sender_name: messagingSummary.senderName?.trim() ?? "",
  };

  const subject =
    params.subject ??
    `Votre demande de devis - ${productName}`;

  const filledHtml = fillPlaceholders(templateSource, placeholderValues);
  const sanitizedHtml = sanitizeEmailHtml(filledHtml);
  const textBody = fillPlaceholders(
    QUOTE_REQUEST_PLAIN_TEXT_TEMPLATE,
    placeholderValues,
  );

  await sendEmailMessageForUser(userId, {
    to: [params.to],
    subject,
    text: textBody,
    html: sanitizedHtml,
  });
}
