import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import {
  formatCurrency as formatCurrencyIntl,
  formatDate,
  formatDecimal,
} from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getDefaultCurrencyCode } from "@/lib/currency";
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

async function fetchCompanySettings(userId: string) {
  const settings = await prisma.companySettings.findUnique({
    where: { userId },
  });
  if (settings) {
    return settings;
  }
  return getSettings(userId);
}

async function getBrowser() {
  if (!browserPromise) {
    const puppeteerArgs = ["--allow-file-access-from-files"];
    if (process.env.PUPPETEER_DISABLE_SANDBOX === "true") {
      puppeteerArgs.push("--no-sandbox", "--disable-setuid-sandbox");
    }
    browserPromise = puppeteer.launch({
      headless: "new",
      args: puppeteerArgs,
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
  if (settings?.logoData) {
    return settings.logoData;
  }
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
  if (settings.matriculeFiscal) {
    lines.push(`MF : ${settings.matriculeFiscal}`);
  }
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

type ImagePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const resolveImagePosition = (value: string | null | undefined): ImagePosition => {
  if (value === "top-left" || value === "top-right" || value === "bottom-left" || value === "bottom-right") {
    return value;
  }
  return "bottom-right";
};

const STAMP_SIGNATURE_IMAGE_MAX_HEIGHT = 120;
const STAMP_SIGNATURE_TOP_MARGIN = 8;
const STAMP_SIGNATURE_CONTAINER_MAX_WIDTH_RATIO = 0.55;
const STAMP_SIGNATURE_BLOCK_MIN_WIDTH = 120;
const STAMP_SIGNATURE_BLOCK_MAX_WIDTH = 220;
const STAMP_SIGNATURE_GAP = 20;
const horizontalPriority = (position: ImagePosition) =>
  position === "top-left" || position === "bottom-left" ? 0 : 1;

function buildStampSignatureHtml(
  settings: CompanySettings | null,
): string | null {
  if (!settings) return null;
  const entries: Array<{ label: string; src: string; position: ImagePosition }> = [];
  if (settings.stampImage) {
    entries.push({
      label: "Cachet",
      src: settings.stampImage,
      position: resolveImagePosition(settings.stampPosition),
    });
  }
  if (settings.signatureImage) {
    entries.push({
      label: "Signature",
      src: settings.signatureImage,
      position: resolveImagePosition(settings.signaturePosition),
    });
  }
  if (entries.length === 0) {
    return null;
  }

  const sortedEntries = entries.sort(
    (a, b) => horizontalPriority(a.position) - horizontalPriority(b.position),
  );

  const flexBasisPercent = sortedEntries.length > 1 ? 50 : 100;
  const containerMaxWidthPercent = (STAMP_SIGNATURE_CONTAINER_MAX_WIDTH_RATIO * 100).toFixed(2);

  const blocksHtml = sortedEntries
    .map(
      (entry) => `
        <div
          style="
            flex:1 1 ${flexBasisPercent}%;
            min-width:${STAMP_SIGNATURE_BLOCK_MIN_WIDTH}px;
            max-width:${STAMP_SIGNATURE_BLOCK_MAX_WIDTH}px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:flex-end;
            text-align:center;
            gap:8px;
          "
        >
          <img
            src="${entry.src}"
            alt="${escapeHtml(entry.label)}"
            style="
              width:100%;
              height:auto;
              max-height:${STAMP_SIGNATURE_IMAGE_MAX_HEIGHT}px;
              object-fit:contain;
              display:block;
            "
          />
          <p style="font-size:11px; color:#475569; margin:0;">${escapeHtml(entry.label)}</p>
        </div>
      `,
    )
    .join("");

  const html = `
    <div
      style="
        margin-top:${STAMP_SIGNATURE_TOP_MARGIN}px;
        display:flex;
        gap:${STAMP_SIGNATURE_GAP}px;
        align-items:flex-end;
        justify-content:flex-end;
        flex-wrap:nowrap;
        width:100%;
        max-width:${containerMaxWidthPercent}%;
        margin-left:auto;
        pointer-events:none;
      "
    >
      ${blocksHtml}
    </div>
  `;

  return html;
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
      const totalHT = fromCents(line.totalHTCents ?? 0, currency);
      const totalTTC = fromCents(line.totalTTCCents ?? 0, currency);
      const unitPriceHT = fromCents(line.unitPriceHTCents ?? 0, currency);
      const vatRate = Number(line.vatRate ?? 0);
      const vatAmount = totalTTC - totalHT;
      vatTotal += vatAmount;

      return `
        <tr>
          <td class="border-b py-3 pl-3 text-xs">${index + 1}.</td>
          <td class="border-b py-3 pl-2 text-xs">${escapeHtml(line.description ?? "")}</td>
          <td class="border-b py-3 pl-2 text-right text-xs">${escapeHtml(formatCurrency(unitPriceHT, currency))}</td>
          <td class="border-b py-3 pl-2 text-center text-xs">${formatDecimal(quantity, currency)}</td>
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
  const currency = document.currency ?? settings?.defaultCurrency ?? getDefaultCurrencyCode();
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

  const subtotal = fromCents(document.subtotalHTCents ?? 0, currency);
  const totalTVA = fromCents(document.totalTVACents ?? 0, currency);
  const totalTTC = fromCents(document.totalTTCCents ?? 0, currency);
  const discount = fromCents(document.totalDiscountCents ?? 0, currency);
  const fodecAmount = fromCents(
    (document as { fodecAmountCents?: number }).fodecAmountCents ?? 0,
    currency,
  );
  const timbreAmount = fromCents(
    (document as { timbreAmountCents?: number }).timbreAmountCents ?? 0,
    currency,
  );
  const taxSummaryEntries = Array.isArray((document as { taxSummary?: unknown }).taxSummary)
    ? ((document as { taxSummary?: unknown }).taxSummary as Array<Record<string, unknown>>)
    : [];

  const { rowsHtml, vatTotal } = buildLinesHtml(document.lines, currency);

  const companyInfo = formatLines(companyLines(settings));

  const clientInfo = formatLines(clientLines(document));

  const footerText = settings?.legalFooter ?? "";
  const bankInfoLines = settings?.iban
    ? settings.iban
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [];
  if (settings?.phone) {
    bankInfoLines.push(settings.phone);
  }
  if (settings?.email) {
    bankInfoLines.push(settings.email);
  }
  const bankInfo = bankInfoLines.length ? formatLines(bankInfoLines) : "";
  const stampSignatureHtml = buildStampSignatureHtml(settings) ?? "";

  const paymentMethod = isInvoiceDoc
    ? invoiceDoc?.payments
        .map((payment) =>
          [
            payment.method ? `Mode : ${payment.method}` : null,
            `Montant : ${formatCurrency(fromCents(payment.amountCents, currency), currency)}`,
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

  const taxSummaryRows = taxSummaryEntries
    .map((entry, index) => {
      const label = typeof entry.label === "string" ? entry.label : typeof entry.type === "string" ? entry.type : `Taxe ${index + 1}`;
      const rate = typeof entry.rate === "number" ? `${entry.rate}%` : "—";
      const base = typeof entry.baseCents === "number"
        ? entry.baseCents
        : typeof (entry as { baseHTCents?: unknown }).baseHTCents === "number"
        ? (entry as { baseHTCents: number }).baseHTCents
        : 0;
      const amount = typeof entry.amountCents === "number" ? entry.amountCents : 0;
      return `
        <tr>
          <td class="px-2 py-1 text-left text-slate-600">${escapeHtml(label)}</td>
          <td class="px-2 py-1 text-right text-slate-600">${escapeHtml(formatCurrency(fromCents(base, currency), currency))}</td>
          <td class="px-2 py-1 text-center text-slate-500">${rate}</td>
          <td class="px-2 py-1 text-right text-slate-700">${escapeHtml(formatCurrency(fromCents(amount, currency), currency))}</td>
        </tr>
      `;
    })
    .join("");

  const taxSummaryHtml = taxSummaryRows.length
    ? `
        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <p class="mb-2 text-sm font-semibold uppercase tracking-wide text-main">Résumé fiscal</p>
          <table class="w-full border-collapse border-spacing-0 text-xs">
            <thead>
              <tr class="text-slate-500">
                <th class="px-2 py-1 text-left">Taxe</th>
                <th class="px-2 py-1 text-right">Base</th>
                <th class="px-2 py-1 text-center">Taux</th>
                <th class="px-2 py-1 text-right">Montant</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${taxSummaryRows}
            </tbody>
          </table>
        </div>
      `
    : "";

  const totalsTableHtml = `
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
        ${
          fodecAmount > 0
            ? `<tr>
          <td class="p-3">
            <div class="whitespace-nowrap text-slate-400">FODEC:</div>
          </td>
          <td class="p-3 text-right">
            <div class="whitespace-nowrap font-bold text-main">${escapeHtml(formatCurrency(fodecAmount, currency))}</div>
          </td>
        </tr>`
            : ""
        }
        ${
          timbreAmount > 0
            ? `<tr>
          <td class="p-3">
            <div class="whitespace-nowrap text-slate-400">Timbre fiscal:</div>
          </td>
          <td class="p-3 text-right">
            <div class="whitespace-nowrap font-bold text-main">${escapeHtml(formatCurrency(timbreAmount, currency))}</div>
          </td>
        </tr>`
            : ""
        }
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
  `;

  const totalsLayoutHtml = `
    <div class="totals-stamp-wrapper" style="position:relative;">
      <table class="w-full border-collapse border-spacing-0 pbi-a">
        <tbody>
          <tr class="align-top">
            <td class="align-top" style="${taxSummaryHtml ? "width: 45%; padding-right: 24px;" : "width: 100%;"}">
              ${taxSummaryHtml}
            </td>
            <td class="align-top" style="width: 280px;">
              <div style="margin-left: auto; width: 280px;">
                ${totalsTableHtml}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      ${stampSignatureHtml}
    </div>
  `;

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
                    ${totalsLayoutHtml}
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
  const { id: userId } = await requireUser();
  return generateQuotePdfForUser(userId, quoteId);
}

async function generateQuotePdfForUser(userId: string, quoteId: string) {
  const [quote, settings] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: quoteId, userId },
      include: {
        client: true,
        lines: { orderBy: { position: "asc" } },
      },
    }),
    fetchCompanySettings(userId),
  ]);

  if (!quote) {
    throw new Error("Devis introuvable");
  }

  const html = buildDocumentHtml("quote", quote, settings);
  return renderPdfFromHtml(html);
}

export async function generateInvoicePdf(invoiceId: string) {
  const { id: userId } = await requireUser();
  return generateInvoicePdfForUser(userId, invoiceId);
}

async function generateInvoicePdfForUser(userId: string, invoiceId: string) {
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        client: true,
        lines: { orderBy: { position: "asc" } },
        payments: true,
      },
    }),
    fetchCompanySettings(userId),
  ]);

  if (!invoice) {
    throw new Error("Facture introuvable");
  }

  const html = buildDocumentHtml("invoice", invoice, settings);
  return renderPdfFromHtml(html);
}
