import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { formatCurrency as formatCurrencyIntl, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type {
  Invoice,
  InvoiceLine,
  Quote,
  QuoteLine,
  CompanySettings,
  Payment,
  InvoiceStatus,
  QuoteStatus,
} from "@prisma/client";

type DocumentType = "invoice" | "quote";

type InvoiceWithRelations = Invoice & {
  client: Quote["client"];
  lines: InvoiceLine[];
  payments: Payment[];
};

type QuoteWithRelations = Quote & {
  client: Quote["client"];
  lines: QuoteLine[];
};

type DocumentWithRelations = InvoiceWithRelations | QuoteWithRelations;

let browserPromise: Promise<puppeteer.Browser> | null = null;
let cachedCss: string | null = null;

function escapeHtml(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLines(lines: string[]) {
  return lines
    .map((line) => escapeHtml(line.trim()))
    .filter((line) => line.length > 0)
    .join("<br />");
}

function formatCurrency(value: number, currency: string) {
  return formatCurrencyIntl(value, currency);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function fetchCompanySettings() {
  return prisma.companySettings.findUnique({
    where: { id: 1 },
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--allow-file-access-from-files",
      ],
    });
  }
  return browserPromise;
}

async function renderPdfFromHtml(html: string) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    },
  });
  await page.close();
  return Buffer.from(pdfBuffer);
}

function getCssContent() {
  if (cachedCss) {
    return cachedCss;
  }
  const cssPath = path.resolve(process.cwd(), "public/css/invoice.css");
  if (fs.existsSync(cssPath)) {
    cachedCss = fs.readFileSync(cssPath, "utf8");
  } else {
    cachedCss = "";
  }
  return cachedCss;
}

function resolveLogo(settings: CompanySettings | null) {
  if (settings?.logoUrl) {
    return settings.logoUrl;
  }
  const localLogoPath = path.resolve(
    process.cwd(),
    "public/images/logo.svg",
  );
  if (fs.existsSync(localLogoPath)) {
    const svgContent = fs.readFileSync(localLogoPath, "utf8");
    const base64 = Buffer.from(svgContent).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }
  return "";
}

function companyLines(settings: CompanySettings | null) {
  if (!settings) return [] as string[];
  const lines: string[] = [];
  if (settings.siren) lines.push(`SIREN : ${settings.siren}`);
  if (settings.tvaNumber) lines.push(`TVA : ${settings.tvaNumber}`);
  if (settings.address) {
    settings.address
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  }
  if (settings.phone) lines.push(settings.phone);
  if (settings.email) lines.push(settings.email);
  return lines.filter(Boolean);
}

function clientLines(document: DocumentWithRelations) {
  const lines: string[] = [];
  const client = document.client;
  lines.push(client.displayName ?? "Client");
  if (client.companyName) {
    lines.push(client.companyName);
  }
  if (client.vatNumber) {
    lines.push(`TVA : ${client.vatNumber}`);
  }
  if (client.address) {
    client.address
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  }
  if (client.phone) lines.push(client.phone);
  if (client.email) lines.push(client.email);
  return lines.filter(Boolean);
}

function translateInvoiceStatus(status: InvoiceStatus) {
  switch (status) {
    case "PAYEE":
      return "Payée";
    case "PARTIELLE":
      return "Partiellement payée";
    case "RETARD":
      return "En retard";
    case "ENVOYEE":
      return "Envoyée";
    case "ANNULEE":
      return "Annulée";
    default:
      return "Brouillon";
  }
}

function translateQuoteStatus(status: QuoteStatus) {
  switch (status) {
    case "ACCEPTE":
      return "Accepté";
    case "REFUSE":
      return "Refusé";
    case "ENVOYE":
      return "Envoyé";
    case "EXPIRE":
      return "Expiré";
    default:
      return "Brouillon";
  }
}

function buildLinesHtml(
  lines: (InvoiceLine | QuoteLine)[],
  currency: string,
) {
  let vatTotal = 0;
  const rows = lines
    .map((line, index) => {
      const quantity = Number(line.quantity ?? 0) || 1;
      const totalHT = fromCents(line.totalHTCents ?? 0);
      const totalTTC = fromCents(line.totalTTCCents ?? 0);
      const unitPriceHT = fromCents(line.unitPriceHTCents ?? 0);
      const vatRate = Number(line.vatRate ?? 0);
      const vatAmount = totalTTC - totalHT;
      vatTotal += vatAmount;

      return `
        <tr>
          <td class="border-b py-3 pl-3 text-xs">${index + 1}.</td>
          <td class="border-b py-3 pl-2 text-xs">${escapeHtml(line.description ?? "")}</td>
          <td class="border-b py-3 pl-2 text-right text-xs">${escapeHtml(formatCurrency(unitPriceHT, currency))}</td>
          <td class="border-b py-3 pl-2 text-center text-xs">${formatNumber(quantity)}</td>
          <td class="border-b py-3 pl-2 text-center text-xs">${vatRate.toFixed(2)}%</td>
          <td class="border-b py-3 pl-2 text-right text-xs">${escapeHtml(formatCurrency(totalHT, currency))}</td>
          <td class="border-b py-3 pl-2 pr-3 text-right text-xs">${escapeHtml(formatCurrency(totalTTC, currency))}</td>
        </tr>
      `;
    })
    .join("");

  return { rowsHtml: rows, vatTotal };
}

function buildDocumentHtml(
  type: DocumentType,
  document: DocumentWithRelations,
  settings: CompanySettings | null,
) {
  const logoSrc = resolveLogo(settings);
  const currency = document.currency ?? settings?.defaultCurrency ?? "EUR";
  const title = type === "invoice" ? "Facture" : "Devis";
  const identifierLabel = type === "invoice" ? "Facture #" : "Devis #";
  const dateLabel = type === "invoice" ? "Date" : "Date d'émission";
  const dueLabel = type === "invoice" ? "Échéance" : "Validité";
  const isInvoiceDoc = type === "invoice";
  const invoiceDoc = isInvoiceDoc ? (document as InvoiceWithRelations) : null;
  const quoteDoc = !isInvoiceDoc ? (document as QuoteWithRelations) : null;

  const dueValue = isInvoiceDoc
    ? invoiceDoc?.dueDate
      ? formatDate(invoiceDoc.dueDate)
      : settings?.paymentTerms ?? ""
    : quoteDoc?.validUntil
    ? formatDate(quoteDoc.validUntil)
    : "";

  const subtotal = fromCents(document.subtotalHTCents ?? 0);
  const totalTVA = fromCents(document.totalTVACents ?? 0);
  const totalTTC = fromCents(document.totalTTCCents ?? 0);
  const discount = fromCents(document.totalDiscountCents ?? 0);

  const { rowsHtml, vatTotal } = buildLinesHtml(document.lines, currency);

  const companyInfo = formatLines(companyLines(settings));

  const clientInfo = formatLines(clientLines(document));

  const footerText = settings?.legalFooter ?? "";
  const bankInfo = settings?.iban
    ? formatLines(
        [`IBAN : ${settings.iban}`, settings.phone ?? "", settings.email ?? ""].filter(
          Boolean,
        ) as string[],
      )
    : "";

  const paymentMethod = isInvoiceDoc
    ? invoiceDoc?.payments
        .map((payment) =>
          [
            payment.method ? `Mode : ${payment.method}` : null,
            `Montant : ${formatCurrency(fromCents(payment.amountCents), currency)}`,
            payment.date ? `Date : ${formatDate(payment.date)}` : null,
          ]
            .filter(Boolean)
            .join(" – "),
        )
        .join("\n") || settings?.paymentTerms || ""
    : settings?.paymentTerms ?? "";

  const notes =
    document.notes?.trim() ||
    settings?.defaultConditions ||
    "Merci pour votre confiance.";

  const paymentInfoHtml = paymentMethod
    ? formatLines(paymentMethod.split(/\r?\n/))
    : "";

  const notesHtml = notes ? formatLines(notes.split(/\r?\n/)) : "";

  const statusLabel = isInvoiceDoc
    ? translateInvoiceStatus(invoiceDoc!.status)
    : translateQuoteStatus(quoteDoc!.status);

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(title)} ${escapeHtml(document.number)}</title>
      <style>
        ${getCssContent()}
      </style>
    </head>
    <body>
      <div class="pb-20">
        <div class="py-4">
          <div class="px-14 py-6">
            <table class="w-full border-collapse border-spacing-0">
              <tbody>
                <tr>
                  <td class="w-full align-top">
                    <div>
                      ${logoSrc ? `<img src="${logoSrc}" class="h-12" alt="Logo" />` : `<p class="text-main font-bold text-sm">${escapeHtml(settings?.companyName ?? "")}</p>`}
                    </div>
                  </td>
                  <td class="align-top">
                    <div class="text-sm">
                      <table class="border-collapse border-spacing-0">
                        <tbody>
                          <tr>
                            <td class="border-r pr-4">
                              <p class="whitespace-nowrap text-right text-slate-400">
                                ${escapeHtml(dateLabel)} :
                                <span class="font-bold text-main">${escapeHtml(formatDate(document.issueDate))}</span>
                              </p>
                            </td>
                            <td class="pl-4">
                              <p class="whitespace-nowrap text-right text-slate-400">
                                ${escapeHtml(identifierLabel)} :
                                <span class="font-bold text-main">${escapeHtml(document.number)}</span>
                              </p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="bg-slate-100 px-14 py-6 text-sm">
            <table class="w-full border-collapse border-spacing-0">
              <tbody>
                <tr>
                  <td class="w-1/2 align-top">
                    <div class="text-sm text-neutral-600">
                      <p class="font-bold">${escapeHtml(settings?.companyName ?? "")}</p>
                      ${companyInfo ? `<div>${companyInfo}</div>` : ""}
                    </div>
                  </td>
                  <td class="w-1/2 align-top">
                    <div class="text-sm text-neutral-600">
                      <p class="font-bold">Client</p>
                      ${clientInfo ? `<div>${clientInfo}</div>` : ""}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="px-14 py-10 text-sm text-neutral-700">
            <table class="w-full border-collapse border-spacing-0">
              <thead>
                <tr>
                  <td class="border-b-2 border-main pb-3 pl-3 font-bold text-main">#</td>
                  <td class="border-b-2 border-main pb-3 pl-2 font-bold text-main">Produit</td>
                  <td class="border-b-2 border-main pb-3 pl-2 text-right font-bold text-main">Prix HT</td>
                  <td class="border-b-2 border-main pb-3 pl-2 text-center font-bold text-main">Qt.</td>
                  <td class="border-b-2 border-main pb-3 pl-2 text-center font-bold text-main">TVA</td>
                  <td class="border-b-2 border-main pb-3 pl-2 text-right font-bold text-main">Total HT</td>
                  <td class="border-b-2 border-main pb-3 pl-2 pr-3 text-right font-bold text-main">Total TTC</td>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                <tr>
                  <td colspan="7">
                    <table class="w-full border-collapse border-spacing-0 pbi-a">
                      <tbody>
                        <tr>
                          <td class="w-full"></td>
                          <td>
                            <table class="w-full border-collapse border-spacing-0">
                              <tbody>
                                <tr>
                                  <td class="border-b p-3">
                                    <div class="whitespace-nowrap text-slate-400">Total HT:</div>
                                  </td>
                                  <td class="border-b p-3 text-right">
                                    <div class="whitespace-nowrap font-bold text-main">${escapeHtml(formatCurrency(subtotal, currency))}</div>
                                  </td>
                                </tr>
                                <tr>
                                  <td class="p-3">
                                    <div class="whitespace-nowrap text-slate-400">TVA:</div>
                                  </td>
                                  <td class="p-3 text-right">
                                    <div class="whitespace-nowrap font-bold text-main">${escapeHtml(formatCurrency(totalTVA || vatTotal, currency))}</div>
                                  </td>
                                </tr>
                                <tr>
                                  <td class="p-3">
                                    <div class="whitespace-nowrap text-slate-400">Remises:</div>
                                  </td>
                                  <td class="p-3 text-right">
                                    <div class="whitespace-nowrap font-bold text-main">${escapeHtml(formatCurrency(discount, currency))}</div>
                                  </td>
                                </tr>
                                <tr>
                                  <td class="bg-main p-3">
                                    <div class="whitespace-nowrap font-bold text-white">Total TTC:</div>
                                  </td>
                                  <td class="bg-main p-3 text-right">
                                    <div class="whitespace-nowrap font-bold text-white">${escapeHtml(formatCurrency(totalTTC, currency))}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          ${bankInfo ? `<div class="px-14 text-sm text-neutral-700 pbi-a"><p class="text-main font-bold">Coordonnées bancaires</p><div>${bankInfo}</div></div>` : ""}

          <div class="px-14 py-6 text-sm text-neutral-700 pbi-a">
            <p class="text-main font-bold">Informations complémentaires</p>
            ${dueValue ? `<p>${escapeHtml(dueLabel)} : ${escapeHtml(dueValue)}</p>` : ""}
            <p>Statut : ${escapeHtml(statusLabel)}</p>
            ${paymentInfoHtml ? `<div>Conditions de paiement :<br />${paymentInfoHtml}</div>` : ""}
            ${notesHtml ? `<div>${notesHtml}</div>` : ""}
          </div>
        </div>
      </div>
      ${footerText ? `<footer class="fixed bottom-0 left-0 bg-slate-100 w-full text-neutral-600 text-center text-xs py-3">${escapeHtml(footerText)}</footer>` : ""}
    </body>
    </html>
  `;

  return html;
}

export async function generateQuotePdf(quoteId: string) {
  const [quote, settings] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        client: true,
        lines: { orderBy: { position: "asc" } },
      },
    }),
    fetchCompanySettings(),
  ]);

  if (!quote) {
    throw new Error("Devis introuvable");
  }

  const html = buildDocumentHtml("quote", quote, settings);
  return renderPdfFromHtml(html);
}

export async function generateInvoicePdf(invoiceId: string) {
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        lines: { orderBy: { position: "asc" } },
        payments: true,
      },
    }),
    fetchCompanySettings(),
  ]);

  if (!invoice) {
    throw new Error("Facture introuvable");
  }

  const html = buildDocumentHtml("invoice", invoice, settings);
  return renderPdfFromHtml(html);
}
