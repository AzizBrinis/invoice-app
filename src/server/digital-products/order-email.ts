import { DocumentType } from "@/lib/db/prisma";
import { prisma } from "@/lib/db";
import { sanitizeEmailHtml } from "@/lib/email-html";
import { fillPlaceholders } from "@/lib/messaging/placeholders";
import { recordEmailLogEntry } from "@/server/email";
import {
  getMessagingCredentials,
  sendEmailMessageForUser,
  type EmailAttachment,
  type MessagingCredentials,
} from "@/server/messaging";
import { getSettings } from "@/server/settings";

/**
 * Customer e-mail of a fulfilled digital order: subject "Commande {référence}",
 * body = the saved response named "Commande" (Messagerie → Réponses enregistrées),
 * invoice + licence PDFs attached. Sent through the tenant's own SMTP, so it is
 * wrapped with the sender header and appears in Messagerie → Envoyés.
 */

export const DEFAULT_ORDER_EMAIL_TEMPLATE = "Commande";

export class OrderEmailError extends Error {
  constructor(
    public readonly code: "EMAIL_TEMPLATE_MISSING" | "EMAIL_NOT_CONFIGURED" | "EMAIL_DISABLED" | "EMAIL_SEND_FAILED",
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "OrderEmailError";
  }
}

type Env = Record<string, string | undefined>;

export function orderEmailSubject(orderReference: string) {
  return `Commande ${orderReference}`;
}

function normalizeTitle(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export async function loadOrderEmailTemplate(tenantId: string, env: Env = process.env) {
  const wanted = normalizeTitle(env.DIGITAL_ORDER_EMAIL_TEMPLATE?.trim() || DEFAULT_ORDER_EMAIL_TEMPLATE);
  const responses = await prisma.messagingSavedResponse.findMany({
    where: { userId: tenantId },
    select: { id: true, title: true, content: true, format: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const match = responses.find((response) => normalizeTitle(response.title) === wanted);
  if (!match || !match.content.trim()) {
    throw new OrderEmailError(
      "EMAIL_TEMPLATE_MISSING",
      `Réponse enregistrée « ${env.DIGITAL_ORDER_EMAIL_TEMPLATE?.trim() || DEFAULT_ORDER_EMAIL_TEMPLATE} » introuvable dans Messagerie.`,
      false,
    );
  }
  return { content: match.content, isHtml: match.format === "HTML" };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

/**
 * Fills the saved response. Placeholder values come partly from the shop
 * order (customer name, reference): in an HTML template they are escaped so a
 * customer cannot inject links or markup into an e-mail sent with the
 * merchant's identity. Only the template itself (written by an admin) is HTML.
 */
export function renderOrderEmailBody(
  template: { content: string; isHtml: boolean },
  values: Record<string, string>,
) {
  if (template.isHtml) {
    const escaped = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, escapeHtml(value)]),
    );
    const html = sanitizeEmailHtml(fillPlaceholders(template.content, escaped));
    return { html, text: htmlToText(html) };
  }
  const text = fillPlaceholders(template.content, values);
  return { html: sanitizeEmailHtml(escapeHtml(text).replace(/\r?\n/g, "<br />")), text };
}

export function htmlToText(html: string) {
  return html
    .replace(/\s*\n\s*/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n")
    .trim();
}

/**
 * Outside production every order e-mail goes to a local SMTP catcher
 * (DIGITAL_ORDER_DEV_SMTP_URL, e.g. Mailpit smtp://127.0.0.1:1025) and is never
 * appended to the real IMAP mailbox. Without it, sending is refused: local
 * databases are copies of production and contain real customer addresses.
 */
export function resolveDevSmtpOverride(env: Env = process.env) {
  if (env.NODE_ENV === "production") return null;
  const raw = env.DIGITAL_ORDER_DEV_SMTP_URL?.trim();
  if (!raw) {
    throw new OrderEmailError(
      "EMAIL_DISABLED",
      "Envoi d’e-mails désactivé hors production : définissez DIGITAL_ORDER_DEV_SMTP_URL (ex. Mailpit smtp://127.0.0.1:1025).",
      false,
    );
  }
  const url = new URL(raw);
  if (!["smtp:", "smtps:"].includes(url.protocol)) {
    throw new OrderEmailError("EMAIL_DISABLED", "DIGITAL_ORDER_DEV_SMTP_URL doit commencer par smtp://", false);
  }
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "smtps:" ? 465 : 1025)),
    secure: url.protocol === "smtps:",
    user: decodeURIComponent(url.username || "dev"),
    password: decodeURIComponent(url.password || "dev"),
  };
}

export type OrderEmailInput = {
  tenantId: string;
  to: string;
  orderReference: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  licenceNumbers: string[];
  attachments: EmailAttachment[];
};

export type OrderEmailContentInput = Omit<OrderEmailInput, "attachments" | "invoiceId">;

export type OrderEmailContent = { to: string; subject: string; html: string; text: string };

/** Subject and body exactly as {@link sendDigitalOrderEmail} sends them. */
async function buildOrderEmail(
  input: OrderEmailContentInput,
  credentials: MessagingCredentials,
  env: Env,
): Promise<OrderEmailContent> {
  const [template, settings] = await Promise.all([
    loadOrderEmailTemplate(input.tenantId, env),
    getSettings(input.tenantId),
  ]);
  const values: Record<string, string> = {
    order_number: input.orderReference,
    order_reference: input.orderReference,
    client_name: input.customerName,
    invoice_number: input.invoiceNumber,
    licence_numbers: input.licenceNumbers.join(", "),
    company_name: settings.companyName?.trim() ?? "",
    company_email: settings.email?.trim() ?? credentials.fromEmail ?? "",
    company_phone: settings.phone?.trim() ?? "",
    company_address: settings.address?.trim() ?? "",
    sender_name: credentials.senderName?.trim() ?? "",
  };
  const { html, text } = renderOrderEmailBody(template, values);
  return { to: input.to, subject: orderEmailSubject(input.orderReference), html, text };
}

/**
 * Preview of the customer e-mail (manual "Traiter la commande" flow): same
 * template, values and sanitization as the real send, nothing sent. A missing
 * template still throws (nothing sensible to show); a transport that would
 * refuse the send is reported as `sendIssue` so the employee sees it up front.
 */
export async function previewDigitalOrderEmail(
  input: OrderEmailContentInput,
  env: Env = process.env,
): Promise<OrderEmailContent & { sendIssue: string | null }> {
  let sendIssue: string | null = null;
  let devSmtp: ReturnType<typeof resolveDevSmtpOverride> = null;
  try {
    devSmtp = resolveDevSmtpOverride(env);
  } catch (error) {
    sendIssue = error instanceof OrderEmailError ? error.message : "Envoi d’e-mails indisponible.";
  }
  const credentials = await getMessagingCredentials(input.tenantId);
  if (!sendIssue && !devSmtp && !credentials.smtp) {
    sendIssue = "Le serveur SMTP n’est pas configuré dans Messagerie → Paramètres.";
  }
  const content = await buildOrderEmail(input, credentials, env);
  return { ...content, sendIssue };
}

export async function sendDigitalOrderEmail(
  input: OrderEmailInput,
  env: Env = process.env,
): Promise<{ subject: string; to: string }> {
  const devSmtp = resolveDevSmtpOverride(env);
  const credentials = await getMessagingCredentials(input.tenantId);

  let effective: MessagingCredentials = credentials;
  if (devSmtp) {
    const fromEmail = credentials.fromEmail ?? credentials.smtp?.fromEmail ?? "dev@localhost";
    effective = {
      ...credentials,
      smtp: { ...devSmtp, fromEmail },
      imap: null,
      trackingEnabled: false,
    };
  } else if (!credentials.smtp) {
    throw new OrderEmailError(
      "EMAIL_NOT_CONFIGURED",
      "Le serveur SMTP n’est pas configuré dans Messagerie → Paramètres.",
      false,
    );
  }

  const { html, text, subject } = await buildOrderEmail(input, credentials, env);

  try {
    await sendEmailMessageForUser(
      input.tenantId,
      { to: [input.to], subject, text, html, attachments: input.attachments },
      { credentials: effective },
    );
  } catch (error) {
    console.error("[digital-orders] email_send_failed", {
      error: error instanceof Error ? error.message.slice(0, 160) : typeof error,
    });
    throw new OrderEmailError("EMAIL_SEND_FAILED", "L’e-mail au client n’a pas pu être envoyé.", true);
  }

  // Shown on the invoice like a manual "Envoyer par e-mail".
  await recordEmailLogEntry({
    userId: input.tenantId,
    documentType: DocumentType.FACTURE,
    documentId: input.invoiceId,
    to: input.to,
    subject,
    body: html,
  }).catch(() => undefined);

  return { subject, to: input.to };
}
