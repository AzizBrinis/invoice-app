import fs from "fs";
import path from "path";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page, type Viewport } from "puppeteer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import {
  getClientPaymentPeriodReport,
  getClientPaymentReceipt,
} from "@/server/client-payments";
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
  Client,
} from "@/lib/db/prisma";

type DocumentType = "invoice" | "quote";
type ReceiptSnapshot = Awaited<
  ReturnType<typeof getClientPaymentReceipt>
>["snapshot"];

type CompanyBrandSettings = {
  companyName?: string | null;
  logoUrl?: string | null;
  logoData?: string | null;
  matriculeFiscal?: string | null;
  tvaNumber?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  stampImage?: string | null;
  signatureImage?: string | null;
  stampPosition?: string | null;
  signaturePosition?: string | null;
  legalFooter?: string | null;
};

type CompanyDocumentSettings = CompanyBrandSettings &
  Pick<
    CompanySettings,
    | "defaultCurrency"
    | "paymentTerms"
    | "defaultConditions"
  >;

type InvoiceWithRelations = Invoice & {
  client: Client;
  lines: InvoiceLine[];
  payments: Payment[];
};

type QuoteWithRelations = Quote & {
  client: Client;
  lines: QuoteLine[];
};

type DocumentWithRelations = InvoiceWithRelations | QuoteWithRelations;

let browserPromise: Promise<Browser> | null = null;
let cachedCss: string | null = null;

const basePuppeteerArgs = ["--allow-file-access-from-files"];
const PDF_CONTENT_TIMEOUT_MS = 15_000;
const PDF_ASSET_SETTLE_TIMEOUT_MS = 5_000;
const PDF_PRINT_TIMEOUT_MS = 45_000;
const serverlessViewport: Viewport = {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  isLandscape: true,
};
const isServerlessEnvironment =
  Boolean(process.env.AWS_REGION) ||
  Boolean(process.env.AWS_EXECUTION_ENV) ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.LAMBDA_TASK_ROOT);

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

async function fetchCompanySettings(userId: string): Promise<CompanyDocumentSettings> {
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
    browserPromise = isServerlessEnvironment
      ? launchServerlessBrowser()
      : launchLocalBrowser();
  }
  return browserPromise;
}

async function launchLocalBrowser() {
  const args = [...basePuppeteerArgs];
  if (process.env.PUPPETEER_DISABLE_SANDBOX === "true") {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }
  return puppeteer.launch({
    headless: true,
    args,
  });
}

async function launchServerlessBrowser() {
  const executablePath = await chromium.executablePath();
  if (!executablePath) {
    throw new Error("Chromium executable path not found for serverless PDF generation.");
  }
  const args = Array.from(new Set([...chromium.args, ...basePuppeteerArgs]));
  return puppeteer.launch({
    args,
    defaultViewport: serverlessViewport,
    executablePath,
    headless: "shell",
  });
}

type RenderPdfOptions = {
  landscape?: boolean;
};

async function renderPdfFromHtml(
  html: string,
  options: RenderPdfOptions = {},
) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(PDF_CONTENT_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(PDF_CONTENT_TIMEOUT_MS);
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: PDF_CONTENT_TIMEOUT_MS,
    });
    await settlePdfAssets(page);
    const pdfBuffer = await withTimeout(
      page.pdf({
        format: "A4",
        landscape: options.landscape ?? false,
        printBackground: true,
        margin: {
          top: "0",
          right: "0",
          bottom: "0",
          left: "0",
        },
      }),
      PDF_PRINT_TIMEOUT_MS,
      "PDF rendering timed out",
    );
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function settlePdfAssets(page: Page) {
  await page.evaluate(async (timeoutMs) => {
    const waitForTimeout = () =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, timeoutMs);
      });

    const imageElements = Array.from(document.images);
    await Promise.race([
      Promise.all(
        imageElements.map((image) => {
          if (image.complete) {
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      ),
      waitForTimeout(),
    ]);

    for (const image of imageElements) {
      if (!image.complete) {
        image.removeAttribute("src");
      }
    }

    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready.then(() => undefined), waitForTimeout()]);
    }
  }, PDF_ASSET_SETTLE_TIMEOUT_MS);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
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

function formatDocumentTimestamp(date: Date) {
  return new Intl.DateTimeFormat("fr-TN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Tunis",
  }).format(date);
}

function formatReportPeriodLabel(dateFrom?: Date | null, dateTo?: Date | null) {
  if (!dateFrom && !dateTo) {
    return "Toutes les périodes";
  }

  const startLabel = dateFrom ? formatDate(dateFrom) : "Début";
  const endLabel = dateTo ? formatDate(dateTo) : "Aujourd'hui";
  return `Du ${startLabel} au ${endLabel}`;
}

function resolveLogo(settings: CompanyBrandSettings | null) {
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

function companyLines(settings: CompanyBrandSettings | null) {
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
  settings: CompanyBrandSettings | null,
  options: {
    imageMaxHeight?: number;
    topMargin?: number;
    containerMaxWidthRatio?: number;
    blockMinWidth?: number;
    blockMaxWidth?: number;
    gap?: number;
  } = {},
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

  const imageMaxHeight =
    options.imageMaxHeight ?? STAMP_SIGNATURE_IMAGE_MAX_HEIGHT;
  const topMargin = options.topMargin ?? STAMP_SIGNATURE_TOP_MARGIN;
  const containerMaxWidthRatio =
    options.containerMaxWidthRatio ?? STAMP_SIGNATURE_CONTAINER_MAX_WIDTH_RATIO;
  const blockMinWidth =
    options.blockMinWidth ?? STAMP_SIGNATURE_BLOCK_MIN_WIDTH;
  const blockMaxWidth =
    options.blockMaxWidth ?? STAMP_SIGNATURE_BLOCK_MAX_WIDTH;
  const gap = options.gap ?? STAMP_SIGNATURE_GAP;
  const flexBasisPercent = sortedEntries.length > 1 ? 50 : 100;
  const containerMaxWidthPercent = (containerMaxWidthRatio * 100).toFixed(2);

  const blocksHtml = sortedEntries
    .map(
      (entry) => `
        <div
          style="
            flex:1 1 ${flexBasisPercent}%;
            min-width:${blockMinWidth}px;
            max-width:${blockMaxWidth}px;
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
              max-height:${imageMaxHeight}px;
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
        margin-top:${topMargin}px;
        display:flex;
        gap:${gap}px;
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
  settings: CompanyDocumentSettings | null,
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

function receiptClientLines(snapshot: ReceiptSnapshot) {
  const lines: string[] = [];
  lines.push(snapshot.client.displayName);
  if (snapshot.client.companyName) {
    lines.push(snapshot.client.companyName);
  }
  if (snapshot.client.vatNumber) {
    lines.push(`TVA : ${snapshot.client.vatNumber}`);
  }
  if (snapshot.client.address) {
    snapshot.client.address
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  }
  if (snapshot.client.phone) lines.push(snapshot.client.phone);
  if (snapshot.client.email) lines.push(snapshot.client.email);
  return lines.filter(Boolean);
}

function getClientPaymentReceiptCss() {
  return `
    :root {
      color-scheme: light;
      --ink: #111111;
      --ink-soft: #262626;
      --muted: #4b4b4b;
      --muted-light: #6a6a6a;
      --line: #9a9a9a;
      --line-soft: #d1d1d1;
      --paper: #ffffff;
    }

    * {
      box-sizing: border-box;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
    }

    body {
      font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background: var(--paper);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt-page {
      width: 210mm;
      height: 297mm;
      padding: 7mm 8mm 6.5mm;
      display: flex;
      flex-direction: column;
      gap: 2.8mm;
      background: var(--paper);
      break-after: avoid-page;
      page-break-after: avoid;
    }

    .receipt-copy {
      flex: 1 1 0;
      min-height: 0;
      padding: 4.4mm 5mm 4mm;
      border: 1.25px solid var(--ink);
      border-radius: 0;
      background: var(--paper);
      display: flex;
      flex-direction: column;
      gap: 2.2mm;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid-page;
    }

    .cut-line {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 2mm;
      margin: 0 0.6mm;
      color: var(--muted);
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      break-after: avoid-page;
    }

    .cut-line::before,
    .cut-line::after {
      content: "";
      flex: 1 1 auto;
      border-top: 1px dashed var(--line);
    }

    .copy-top,
    .copy-hero,
    .info-grid,
    .copy-footer {
      display: flex;
      justify-content: space-between;
      gap: 3mm;
    }

    .copy-top {
      align-items: flex-start;
    }

    .brand-block {
      display: flex;
      gap: 3mm;
      align-items: flex-start;
      max-width: 69%;
      min-width: 0;
    }

    .brand-logo {
      max-width: 25mm;
      max-height: 10mm;
      object-fit: contain;
      filter: grayscale(1);
    }

    .brand-name {
      margin: 0 0 0.7mm;
      font-size: 11px;
      line-height: 1.1;
      font-weight: 700;
      letter-spacing: 0.03em;
      color: var(--ink);
    }

    .brand-lines {
      margin: 0;
      font-size: 8.1px;
      line-height: 1.35;
      color: var(--muted);
    }

    .copy-badge {
      min-width: 37mm;
      padding: 2.1mm 2.7mm;
      border-radius: 0;
      text-align: right;
      background: var(--paper);
      border: 1px solid var(--ink);
    }

    .copy-label {
      display: block;
      margin: 0 0 0.6mm;
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink);
    }

    .copy-note {
      margin: 0;
      font-size: 7.8px;
      line-height: 1.28;
      color: var(--muted);
    }

    .eyebrow {
      display: inline-block;
      margin: 0 0 0.6mm;
      font-size: 7.3px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .receipt-title {
      margin: 0;
      font-size: 18px;
      line-height: 1;
      font-weight: 800;
      color: var(--ink);
    }

    .receipt-subtitle {
      margin: 0.8mm 0 0;
      font-size: 8.5px;
      line-height: 1.28;
      color: var(--muted);
      max-width: 94mm;
    }

    .amount-card {
      min-width: 39mm;
      padding: 2.3mm 2.8mm;
      border-radius: 0;
      text-align: right;
      color: var(--ink);
      background: var(--paper);
      border: 1.25px solid var(--ink);
    }

    .amount-label {
      display: block;
      margin: 0 0 0.5mm;
      font-size: 7.2px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .amount-value {
      margin: 0;
      font-size: 15px;
      line-height: 1.1;
      font-weight: 800;
    }

    .info-grid {
      align-items: stretch;
    }

    .info-card,
    .purpose-card,
    .services-card,
    .note-card {
      border-radius: 0;
      border: 1px solid var(--line);
      background: var(--paper);
      page-break-inside: avoid;
      break-inside: avoid-page;
    }

    .info-card {
      flex: 1 1 0;
      min-width: 0;
      padding: 2.6mm 2.9mm;
    }

    .section-label {
      margin: 0 0 0.9mm;
      font-size: 7.1px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .section-copy {
      margin: 0;
      font-size: 8.4px;
      line-height: 1.3;
      color: var(--ink);
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.5mm;
    }

    .meta-item {
      padding: 1.8mm 2.1mm;
      border-radius: 0;
      background: var(--paper);
      border: 1px solid var(--line-soft);
    }

    .meta-item-label {
      margin: 0 0 0.5mm;
      font-size: 6.9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted-light);
    }

    .meta-item-value {
      margin: 0;
      font-size: 8px;
      line-height: 1.22;
      font-weight: 600;
      color: var(--ink-soft);
      word-break: break-word;
    }

    .purpose-card,
    .services-card,
    .note-card {
      padding: 2.6mm 2.9mm;
    }

    .purpose-text,
    .note-text {
      margin: 0;
      font-size: 8.1px;
      line-height: 1.32;
      color: var(--muted);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead th {
      padding: 1.4mm 1.5mm;
      border-bottom: 1px solid var(--ink);
      font-size: 6.9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-align: left;
      color: var(--muted);
    }

    tbody td {
      padding: 1.55mm 1.5mm;
      border-top: 1px solid var(--line-soft);
      vertical-align: top;
      font-size: 7.8px;
      line-height: 1.22;
      color: var(--ink);
    }

    .service-title {
      margin: 0;
      font-size: 8px;
      line-height: 1.18;
      font-weight: 700;
      color: var(--ink);
    }

    .service-details {
      margin: 0.45mm 0 0;
      color: var(--muted);
      font-size: 7.2px;
      line-height: 1.18;
    }

    .service-amount {
      text-align: right;
      font-weight: 800;
      white-space: nowrap;
      font-size: 7.9px;
    }

    .copy-footer {
      align-items: flex-end;
      margin-top: auto;
    }

    .footer-copy {
      flex: 1 1 auto;
    }

    .receipt-disclaimer,
    .legal-note {
      margin: 0;
      font-size: 7.1px;
      line-height: 1.25;
      color: var(--muted);
    }

    .legal-note {
      margin-top: 0.8mm;
    }

    .signature-shell {
      min-width: 40mm;
      text-align: right;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
    }

    .signature-shell img {
      filter: grayscale(1);
    }

    .signature-shell .signature-line {
      margin-top: 3.2mm;
      padding-top: 1mm;
      border-top: 1px solid var(--ink);
      font-size: 7px;
      color: var(--muted);
    }
  `;
}

function buildClientPaymentReceiptCopyHtml(params: {
  snapshot: ReceiptSnapshot;
  copyLabel: string;
  copyNote: string;
  logoSrc: string;
  companyInfo: string;
  clientInfo: string;
  amountLabel: string;
  servicesRows: string;
  purposeLabel: string;
  noteHtml: string;
  footerText: string;
  stampSignatureHtml: string;
}) {
  const {
    snapshot,
    copyLabel,
    copyNote,
    logoSrc,
    companyInfo,
    clientInfo,
    amountLabel,
    servicesRows,
    purposeLabel,
    noteHtml,
    footerText,
    stampSignatureHtml,
  } = params;

  return `
    <section class="receipt-copy">
      <div class="copy-top">
        <div class="brand-block">
          ${
            logoSrc
              ? `<img src="${logoSrc}" alt="Logo" class="brand-logo" />`
              : ""
          }
          <div>
            <p class="brand-name">${escapeHtml(snapshot.company.companyName ?? "Reçu de paiement")}</p>
            ${
              companyInfo
                ? `<p class="brand-lines">${companyInfo}</p>`
                : ""
            }
          </div>
        </div>
        <div class="copy-badge">
          <span class="copy-label">${escapeHtml(copyLabel)}</span>
          <p class="copy-note">${escapeHtml(copyNote)}</p>
        </div>
      </div>

      <div class="copy-hero">
        <div>
          <span class="eyebrow">Reçu de paiement</span>
          <h1 class="receipt-title">${escapeHtml(snapshot.receiptNumber)}</h1>
          <p class="receipt-subtitle">
            Document d'encaissement émis le ${escapeHtml(
              formatDate(new Date(snapshot.issuedAt)),
            )} pour un paiement enregistré le ${escapeHtml(
              formatDate(new Date(snapshot.paymentDate)),
            )}.
          </p>
        </div>
        <div class="amount-card">
          <span class="amount-label">Montant reçu</span>
          <p class="amount-value">${escapeHtml(amountLabel)}</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <p class="section-label">Client</p>
          <p class="section-copy">${clientInfo || escapeHtml(snapshot.client.displayName)}</p>
        </div>

        <div class="info-card">
          <p class="section-label">Informations de paiement</p>
          <div class="meta-grid">
            <div class="meta-item">
              <p class="meta-item-label">Date de paiement</p>
              <p class="meta-item-value">${escapeHtml(
                formatDate(new Date(snapshot.paymentDate)),
              )}</p>
            </div>
            <div class="meta-item">
              <p class="meta-item-label">Date d'émission</p>
              <p class="meta-item-value">${escapeHtml(
                formatDate(new Date(snapshot.issuedAt)),
              )}</p>
            </div>
            <div class="meta-item">
              <p class="meta-item-label">Mode</p>
              <p class="meta-item-value">${escapeHtml(
                snapshot.method?.trim() || "Non précisé",
              )}</p>
            </div>
            <div class="meta-item">
              <p class="meta-item-label">Référence</p>
              <p class="meta-item-value">${escapeHtml(
                snapshot.reference?.trim() || "Non renseignée",
              )}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="purpose-card">
        <p class="section-label">Motif</p>
        <p class="purpose-text">${escapeHtml(purposeLabel)}</p>
      </div>

      <div class="services-card">
        <p class="section-label">Prestations réglées</p>
        <table>
          <thead>
            <tr>
              <th>Prestation</th>
              <th style="text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${servicesRows}
          </tbody>
        </table>
      </div>

      ${noteHtml}

      <div class="copy-footer">
        <div class="footer-copy">
          <p class="receipt-disclaimer">
            Ce reçu atteste l'encaissement du montant indiqué au titre du règlement enregistré.
          </p>
          ${
            footerText
              ? `<p class="legal-note">${escapeHtml(footerText)}</p>`
              : ""
          }
        </div>

        <div class="signature-shell">
          ${
            stampSignatureHtml ||
            `<div class="signature-line">Cachet / signature</div>`
          }
        </div>
      </div>
    </section>
  `;
}

export function buildClientPaymentReceiptHtml(snapshot: ReceiptSnapshot) {
  const logoSrc = resolveLogo(snapshot.company);
  const currency = snapshot.currency || getDefaultCurrencyCode();
  const companyInfo = formatLines(companyLines(snapshot.company));
  const clientInfo = formatLines(receiptClientLines(snapshot));
  const stampSignatureHtml =
    buildStampSignatureHtml(snapshot.company, {
      topMargin: 0,
    }) ?? "";
  const footerText = snapshot.company.legalFooter ?? "";

  const serviceEntries = snapshot.services.length
    ? snapshot.services
    : [
        {
          clientServiceId: null,
          title: snapshot.description || "Paiement reçu",
          details: snapshot.note,
          allocatedAmountCents: snapshot.amountCents,
          position: 0,
        },
      ];

  const servicesRows = serviceEntries
    .map((service) => {
      const amountCents =
        typeof service.allocatedAmountCents === "number"
          ? service.allocatedAmountCents
          : null;
      const serviceAmountLabel =
        typeof amountCents === "number"
          ? formatCurrency(fromCents(amountCents, currency), currency)
          : "Montant non détaillé";
      return `
        <tr>
          <td>
            <p class="service-title">${escapeHtml(service.title)}</p>
            ${
              service.details
                ? `<p class="service-details">${escapeHtml(service.details)}</p>`
                : ""
            }
          </td>
          <td class="service-amount">${escapeHtml(serviceAmountLabel)}</td>
        </tr>
      `;
    })
    .join("");

  const amountLabel = formatCurrency(
    fromCents(snapshot.amountCents, currency),
    currency,
  );
  const purposeLabel =
    snapshot.description?.trim() ||
    serviceEntries.map((service) => service.title).join(" • ") ||
    "Paiement client";
  const noteHtml = snapshot.note
    ? `
        <div class="note-card">
          <p class="section-label">Note</p>
          <p class="note-text">${formatLines(snapshot.note.split(/\r?\n/))}</p>
        </div>
      `
    : "";

  const clientCopyHtml = buildClientPaymentReceiptCopyHtml({
    snapshot,
    copyLabel: "Exemplaire client",
    copyNote: "Copie à remettre au client",
    logoSrc,
    companyInfo,
    clientInfo,
    amountLabel,
    servicesRows,
    purposeLabel,
    noteHtml,
    footerText,
    stampSignatureHtml,
  });
  const businessCopyHtml = buildClientPaymentReceiptCopyHtml({
    snapshot,
    copyLabel: "Exemplaire entreprise",
    copyNote: "Copie à conserver par l'entreprise",
    logoSrc,
    companyInfo,
    clientInfo,
    amountLabel,
    servicesRows,
    purposeLabel,
    noteHtml,
    footerText,
    stampSignatureHtml,
  });

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Reçu ${escapeHtml(snapshot.receiptNumber)}</title>
      <style>
        ${getClientPaymentReceiptCss()}
      </style>
    </head>
    <body>
      <main class="receipt-page">
        ${clientCopyHtml}
        <div class="cut-line">Découper ici</div>
        ${businessCopyHtml}
      </main>
    </body>
    </html>
  `;
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

export async function generateClientPaymentReceiptPdf(paymentId: string) {
  const user = await requireUser();
  const userId = user.activeTenantId ?? user.tenantId ?? user.id;
  return generateClientPaymentReceiptPdfForUser(userId, paymentId);
}

export async function generateClientPaymentReceiptPdfForUser(
  userId: string,
  paymentId: string,
) {
  const { snapshot } = await getClientPaymentReceipt(paymentId, userId);
  const html = buildClientPaymentReceiptHtml(snapshot);
  return renderPdfFromHtml(html);
}

function getClientPaymentsReportCss() {
  return `
    :root {
      color-scheme: light;
      --ink: #111111;
      --ink-soft: #242424;
      --muted: #535353;
      --muted-light: #767676;
      --line: #b3b3b3;
      --line-soft: #d8d8d8;
      --line-strong: #4d4d4d;
      --paper: #ffffff;
      --panel-muted: #f3f3f3;
      --panel-soft: #fafafa;
    }

    * {
      box-sizing: border-box;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      width: 210mm;
    }

    body {
      font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background: var(--paper);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-page {
      min-height: 297mm;
      padding: 10mm 10.5mm 11mm;
      background: var(--paper);
    }

    .hero {
      padding: 6.2mm 6.8mm;
      border: 1.5px solid var(--line-strong);
      border-radius: 0;
      background: var(--paper);
      color: var(--ink);
    }

    .hero-top,
    .hero-bottom,
    .metrics-grid,
    .summary-grid,
    .totals-grid {
      display: flex;
      gap: 3.4mm;
    }

    .hero-top,
    .hero-bottom {
      justify-content: space-between;
      align-items: stretch;
    }

    .hero-top {
      margin-bottom: 4.4mm;
    }

    .hero-bottom {
      flex-direction: column;
      align-items: flex-start;
      gap: 3mm;
    }

    .brand-card,
    .stamp-card,
    .metric-card,
    .summary-card,
    .table-card {
      border-radius: 0;
      page-break-inside: avoid;
    }

    .brand-card {
      display: flex;
      align-items: flex-start;
      gap: 3.2mm;
      max-width: 100%;
      padding: 3.2mm 3.6mm;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    .brand-logo {
      max-width: 34mm;
      max-height: 16mm;
      object-fit: contain;
      filter: grayscale(1);
    }

    .brand-name {
      margin: 0 0 1mm;
      font-size: 13px;
      font-weight: 800;
      color: var(--ink);
    }

    .brand-lines {
      margin: 0;
      font-size: 9.8px;
      line-height: 1.42;
      color: var(--muted);
    }

    .stamp-card {
      min-width: 47mm;
      padding: 3.2mm 3.6mm;
      text-align: right;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    .stamp-label,
    .eyebrow {
      display: inline-block;
      margin: 0 0 1mm;
      font-size: 8.8px;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .stamp-label {
      color: var(--muted);
    }

    .stamp-value {
      margin: 0;
      font-size: 10.5px;
      line-height: 1.35;
      font-weight: 700;
      color: var(--ink);
    }

    .hero-title {
      margin: 0;
      font-size: 23px;
      line-height: 1.08;
      font-weight: 800;
      color: var(--ink);
    }

    .hero-copy {
      margin: 1.8mm 0 0;
      max-width: 100%;
      font-size: 10.6px;
      line-height: 1.48;
      color: var(--muted);
    }

    .period-card {
      min-width: 100%;
      width: 100%;
      padding: 3.2mm 3.8mm;
      border-radius: 0;
      background: var(--panel-muted);
      border: 1px solid var(--line-strong);
    }

    .period-label {
      display: block;
      margin: 0 0 0.8mm;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .period-value {
      margin: 0;
      font-size: 14px;
      line-height: 1.3;
      font-weight: 800;
      color: var(--ink);
    }

    .filter-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 1.8mm;
      margin-top: 3.2mm;
    }

    .filter-pill {
      padding: 1.4mm 2.1mm;
      border-radius: 0;
      font-size: 8.7px;
      line-height: 1.2;
      color: var(--ink-soft);
      background: var(--panel-soft);
      border: 1px solid var(--line);
    }

    .metrics-grid,
    .summary-grid {
      margin-top: 4mm;
    }

    .metrics-grid {
      gap: 2.6mm;
    }

    .summary-grid {
      flex-direction: column;
      gap: 3.2mm;
    }

    .metric-card,
    .summary-card,
    .table-card {
      background: var(--paper);
      border: 1px solid var(--line-strong);
    }

    .metric-card {
      flex: 1 1 0;
      padding: 3.5mm 3.8mm;
    }

    .metric-label {
      margin: 0;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .metric-value {
      margin: 1.8mm 0 0.5mm;
      font-size: 21px;
      line-height: 1;
      font-weight: 800;
      color: var(--ink);
    }

    .metric-note {
      margin: 0;
      font-size: 9px;
      line-height: 1.35;
      color: var(--muted);
    }

    .summary-card {
      padding: 3.8mm 4mm;
    }

    .card-title {
      margin: 0;
      font-size: 13.5px;
      font-weight: 800;
      color: var(--ink);
    }

    .card-copy {
      margin: 1.2mm 0 0;
      font-size: 9.6px;
      line-height: 1.45;
      color: var(--muted);
    }

    .totals-grid {
      flex-wrap: wrap;
      gap: 2.4mm;
      margin-top: 3mm;
    }

    .total-chip {
      flex: 1 1 calc(50% - 1.2mm);
      min-width: 0;
      padding: 3mm 3.3mm;
      border-radius: 0;
      background: var(--panel-soft);
      border: 1px solid var(--line);
    }

    .total-chip-code {
      margin: 0;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .total-chip-amount {
      margin: 1.4mm 0 0.8mm;
      font-size: 14px;
      line-height: 1.2;
      font-weight: 800;
      color: var(--ink);
    }

    .total-chip-meta {
      margin: 0;
      font-size: 9px;
      color: var(--muted);
    }

    .client-list {
      margin: 3mm 0 0;
      padding: 0;
      list-style: none;
    }

    .client-item {
      display: flex;
      justify-content: space-between;
      gap: 3mm;
      padding: 2.6mm 0;
      border-top: 1px solid var(--line);
    }

    .client-item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .client-name {
      margin: 0;
      font-size: 10px;
      font-weight: 800;
      color: var(--ink);
    }

    .client-meta {
      margin: 0.7mm 0 0;
      font-size: 8.7px;
      line-height: 1.38;
      color: var(--muted);
    }

    .client-amounts {
      text-align: right;
    }

    .client-amounts p {
      margin: 0;
      font-size: 8.7px;
      line-height: 1.4;
      color: var(--ink-soft);
    }

    .table-card {
      margin-top: 4mm;
      padding: 3.8mm 4mm 4.2mm;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      gap: 3mm;
      align-items: flex-end;
      margin-bottom: 3.2mm;
    }

    .table-note {
      margin: 1mm 0 0;
      font-size: 9.4px;
      line-height: 1.42;
      color: var(--muted);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: var(--paper);
      overflow: hidden;
      border-radius: 0;
      border: 1px solid var(--line-strong);
    }

    thead th {
      padding: 2.2mm 2.4mm;
      background: var(--panel-muted);
      border-bottom: 1px solid var(--line-strong);
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: left;
      color: var(--ink);
    }

    tbody td {
      padding: 2.4mm 2.4mm;
      border-top: 1px solid var(--line);
      vertical-align: top;
      font-size: 8.8px;
      line-height: 1.32;
      color: var(--ink);
    }

    tbody tr:nth-child(even) td {
      background: var(--panel-soft);
    }

    .cell-title {
      margin: 0;
      font-size: 9px;
      font-weight: 800;
      line-height: 1.28;
      color: var(--ink);
      word-break: break-word;
    }

    .cell-subtitle {
      margin: 0.8mm 0 0;
      font-size: 8px;
      line-height: 1.3;
      color: var(--muted);
      word-break: break-word;
    }

    .receipt-badge {
      display: inline-block;
      padding: 1mm 1.4mm;
      border-radius: 0;
      font-size: 7.6px;
      font-weight: 800;
      white-space: nowrap;
    }

    .receipt-badge.issued {
      color: var(--ink);
      background: var(--paper);
      border: 1px solid var(--line-strong);
    }

    .receipt-badge.pending {
      color: var(--muted);
      background: var(--panel-soft);
      border: 1px dashed var(--line-strong);
    }

    .amount-cell {
      text-align: right;
      font-size: 9px;
      font-weight: 800;
      white-space: nowrap;
    }

    .empty-state {
      padding: 8mm 6mm;
      text-align: center;
      border-radius: 0;
      border: 1px dashed var(--line-strong);
      background: var(--paper);
      color: var(--muted);
      font-size: 10px;
      line-height: 1.6;
    }

    .page-footer {
      margin-top: 3mm;
      text-align: center;
      font-size: 8.4px;
      line-height: 1.4;
      color: var(--muted);
    }
  `;
}

export function buildClientPaymentsReportHtml(params: {
  settings: CompanyDocumentSettings;
  report: Awaited<ReturnType<typeof getClientPaymentPeriodReport>>;
  selectedClientLabel?: string | null;
}) {
  const { settings, report, selectedClientLabel } = params;
  const logoSrc = resolveLogo(settings);
  const companyInfo = formatLines(companyLines(settings));
  const footerText = settings.legalFooter ?? "";
  const filters = report.filters;
  const periodLabel = formatReportPeriodLabel(filters.dateFrom, filters.dateTo);
  const clientLabel = selectedClientLabel?.trim() || "Tous les clients";
  const searchLabel = filters.search?.trim() || "Aucune recherche";
  const generatedAt = formatDocumentTimestamp(new Date());

  const filterPills = [
    `Client : ${clientLabel}`,
    `Recherche : ${searchLabel}`,
    filters.currency ? `Devise : ${filters.currency}` : null,
  ]
    .filter(Boolean)
    .map(
      (label) => `<span class="filter-pill">${escapeHtml(label)}</span>`,
    )
    .join("");

  const totalsCards = report.totals.totalsByCurrency.length
    ? report.totals.totalsByCurrency
        .map(
          (entry) => `
            <article class="total-chip">
              <p class="total-chip-code">${escapeHtml(entry.currency)}</p>
              <p class="total-chip-amount">${escapeHtml(
                formatCurrency(
                  fromCents(entry.totalAmountCents, entry.currency),
                  entry.currency,
                ),
              )}</p>
              <p class="total-chip-meta">${entry.paymentCount} paiement${
                entry.paymentCount > 1 ? "s" : ""
              }</p>
            </article>
          `,
        )
        .join("")
    : `
        <article class="total-chip">
          <p class="total-chip-code">Aucune devise</p>
          <p class="total-chip-amount">Aucun encaissement</p>
          <p class="total-chip-meta">Aucun paiement sur la période</p>
        </article>
      `;

  const clientHighlights = report.byClient.length
    ? report.byClient
        .slice(0, 6)
        .map((entry) => {
          const totalsByCurrency = entry.totalsByCurrency.length
            ? entry.totalsByCurrency
                .map((total) =>
                  formatCurrency(
                    fromCents(total.totalAmountCents, total.currency),
                    total.currency,
                  ),
                )
                .join(" • ")
            : "Aucun montant";

          return `
            <li class="client-item">
              <div>
                <p class="client-name">${escapeHtml(entry.clientName)}</p>
                <p class="client-meta">
                  ${entry.paymentCount} paiement${entry.paymentCount > 1 ? "s" : ""} •
                  ${entry.receiptCount} reçu${entry.receiptCount > 1 ? "s" : ""} •
                  Dernier mouvement le ${escapeHtml(formatDate(entry.lastPaymentDate))}
                </p>
              </div>
              <div class="client-amounts">
                <p>${escapeHtml(totalsByCurrency)}</p>
              </div>
            </li>
          `;
        })
        .join("")
    : `
        <li class="client-item">
          <div>
            <p class="client-name">Aucun client sur la période</p>
            <p class="client-meta">Les filtres appliqués ne renvoient aucun paiement.</p>
          </div>
        </li>
      `;

  const paymentRows = report.items.length
    ? report.items
        .map((payment) => {
          const paymentTitle =
            payment.description?.trim() ||
            payment.serviceLinks[0]?.titleSnapshot ||
            payment.method?.trim() ||
            "Paiement client";
          const servicesSummary = payment.serviceLinks.length
            ? payment.serviceLinks.map((link) => link.titleSnapshot).join(" • ")
            : "Paiement sans service lié";
          const paymentMeta = [
            payment.method?.trim() || null,
            payment.reference?.trim()
              ? `Réf. ${payment.reference.trim()}`
              : null,
          ]
            .filter(Boolean)
            .join(" • ");

          return `
            <tr>
              <td style="width: 13%;">
                <p class="cell-title">${escapeHtml(formatDate(payment.date))}</p>
              </td>
              <td style="width: 21%;">
                <p class="cell-title">${escapeHtml(payment.client.displayName)}</p>
                ${
                  payment.client.companyName
                    ? `<p class="cell-subtitle">${escapeHtml(payment.client.companyName)}</p>`
                    : ""
                }
              </td>
              <td style="width: 26%;">
                <p class="cell-title">${escapeHtml(paymentTitle)}</p>
                <p class="cell-subtitle">${escapeHtml(servicesSummary)}</p>
              </td>
              <td style="width: 18%;">
                <p class="cell-title">${escapeHtml(
                  paymentMeta || "Informations non précisées",
                )}</p>
              </td>
              <td style="width: 10%;">
                <span class="receipt-badge ${payment.receiptNumber ? "issued" : "pending"}">
                  ${escapeHtml(payment.receiptNumber ?? "En attente")}
                </span>
              </td>
              <td class="amount-cell" style="width: 12%;">
                ${escapeHtml(
                  formatCurrency(
                    fromCents(payment.amountCents, payment.currency),
                    payment.currency,
                  ),
                )}
              </td>
            </tr>
          `;
        })
        .join("")
    : "";

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Rapport des paiements clients</title>
      <style>
        ${getClientPaymentsReportCss()}
      </style>
    </head>
    <body>
      <main class="report-page">
        <section class="hero">
          <div class="hero-top">
            <div class="brand-card">
              ${
                logoSrc
                  ? `<img src="${logoSrc}" alt="Logo" class="brand-logo" />`
                  : ""
              }
              <div>
                <p class="brand-name">${escapeHtml(settings.companyName ?? "Rapport paiements")}</p>
                ${
                  companyInfo
                    ? `<p class="brand-lines">${companyInfo}</p>`
                    : ""
                }
              </div>
            </div>
            <div class="stamp-card">
              <p class="stamp-label">Généré le</p>
              <p class="stamp-value">${escapeHtml(generatedAt)}</p>
            </div>
          </div>

          <div class="hero-bottom">
            <div>
              <p class="eyebrow">Rapport des paiements</p>
              <h1 class="hero-title">Encaissements clients</h1>
              <p class="hero-copy">
                Export PDF dédié au suivi des règlements enregistrés sur la période sélectionnée.
              </p>
            </div>
            <div class="period-card">
              <span class="period-label">Période analysée</span>
              <p class="period-value">${escapeHtml(periodLabel)}</p>
            </div>
          </div>

          <div class="filter-strip">
            ${filterPills}
          </div>
        </section>

        <section class="metrics-grid">
          <article class="metric-card">
            <p class="metric-label">Paiements</p>
            <p class="metric-value">${report.totals.paymentCount}</p>
            <p class="metric-note">${report.items.length} ligne${
              report.items.length > 1 ? "s" : ""
            } exportée${report.items.length > 1 ? "s" : ""}</p>
          </article>
          <article class="metric-card">
            <p class="metric-label">Reçus émis</p>
            <p class="metric-value">${report.totals.receiptCount}</p>
            <p class="metric-note">Documents de reçu générés pour la sélection</p>
          </article>
          <article class="metric-card">
            <p class="metric-label">Clients concernés</p>
            <p class="metric-value">${report.totals.clientCount}</p>
            <p class="metric-note">Dossiers clients représentés dans le rapport</p>
          </article>
        </section>

        <section class="summary-grid">
          <article class="summary-card wide">
            <p class="card-title">Totaux encaissés</p>
            <p class="card-copy">
              Synthèse des montants collectés par devise sur la période exportée.
            </p>
            <div class="totals-grid">
              ${totalsCards}
            </div>
          </article>

          <article class="summary-card narrow">
            <p class="card-title">Clients inclus</p>
            <p class="card-copy">
              Aperçu rapide des clients concernés par les paiements du rapport.
            </p>
            <ul class="client-list">
              ${clientHighlights}
            </ul>
          </article>
        </section>

        <section class="table-card">
          <div class="table-header">
            <div>
              <p class="card-title">Liste détaillée des paiements</p>
              <p class="table-note">
                Présentation export orientée reporting, distincte des modèles de facture.
              </p>
            </div>
          </div>

          ${
            report.items.length
              ? `
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Objet / services</th>
                      <th>Mode / référence</th>
                      <th>Reçu</th>
                      <th style="text-align: right;">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paymentRows}
                  </tbody>
                </table>
              `
              : `
                <div class="empty-state">
                  Aucun paiement ne correspond aux filtres sélectionnés.<br />
                  Le rapport a bien été généré avec la période et les critères demandés.
                </div>
              `
          }
        </section>

        ${
          footerText
            ? `<p class="page-footer">${escapeHtml(footerText)}</p>`
            : ""
        }
      </main>
    </body>
    </html>
  `;
}

export async function generateClientPaymentsReportPdf(filters: {
  clientId?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  search?: string | null;
  currency?: string | null;
}) {
  const user = await requireUser();
  const userId = user.activeTenantId ?? user.tenantId ?? user.id;
  return generateClientPaymentsReportPdfForUser(userId, filters);
}

export async function generateClientPaymentsReportPdfForUser(
  userId: string,
  filters: {
    clientId?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
    search?: string | null;
    currency?: string | null;
  },
) {
  const [settings, report, selectedClient] = await Promise.all([
    fetchCompanySettings(userId),
    getClientPaymentPeriodReport(filters, userId),
    filters.clientId
      ? prisma.client.findFirst({
          where: {
            id: filters.clientId,
            userId,
          },
          select: {
            displayName: true,
            companyName: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const selectedClientLabel = selectedClient
    ? [selectedClient.displayName, selectedClient.companyName]
        .filter(Boolean)
        .join(" • ")
    : null;

  const html = buildClientPaymentsReportHtml({
    settings,
    report,
    selectedClientLabel,
  });

  return renderPdfFromHtml(html);
}
