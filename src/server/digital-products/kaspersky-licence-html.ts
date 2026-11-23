import {
  deviceLabel,
  KASPERSKY_TIER_DETAILS,
  type KasperskyTier,
  type KasperskyVariant,
} from "@/lib/digital-products/kaspersky-catalog";
import { formatLicenceCode } from "@/lib/digital-products/licence-code-format";

/**
 * Server-side HTML for the Kaspersky activation card (A4, French). Ported from
 * the Techno Smart reference generator: same grid (70 + 207 + 20 mm), cover,
 * activation block, 4 steps, QR code, FAQ, warnings, official links and the
 * reseller support footer. One A4 page per activation code.
 *
 * Fully static (no script), every dynamic value is HTML-escaped.
 */

export type LicenceSellerBranding = {
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
};

export type LicenceDocumentInput = {
  variant: KasperskyVariant;
  codes: string[];
  licenceNumber: string;
  orderReference?: string | null;
  customerName?: string | null;
  activationRegion?: string | null;
  /** YYYY-MM-DD */
  useBefore?: string | null;
  seller: LicenceSellerBranding;
};

export const DEFAULT_SELLER_BRANDING: LicenceSellerBranding = {
  name: "Techno Smart",
  website: "techno-smart.tn",
  email: "support@techno-smart.tn",
  phone: null,
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

export function formatFrenchDate(yyyyMmDd: string | null | undefined): string {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return "";
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/^1 /, "1er ");
}

export function websiteHref(website: string) {
  const trimmed = website.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function websiteLabel(website: string) {
  return website.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

const QR_SVG = `<svg class="qr-svg" viewBox="0 0 37 37" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code QR vers my.kaspersky.com" shape-rendering="crispEdges"><rect width="37" height="37" fill="#fff"/><path fill="#112a28" d="M4 4h7v1h-7zM14 4h1v1h-1zM16 4h1v1h-1zM23 4h2v1h-2zM26 4h7v1h-7zM4 5h1v1h-1zM10 5h1v1h-1zM12 5h3v1h-3zM17 5h2v1h-2zM21 5h1v1h-1zM23 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM4 6h1v1h-1zM6 6h3v1h-3zM10 6h1v1h-1zM14 6h2v1h-2zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h2v1h-2zM26 6h1v1h-1zM28 6h3v1h-3zM32 6h1v1h-1zM4 7h1v1h-1zM6 7h3v1h-3zM10 7h1v1h-1zM12 7h1v1h-1zM15 7h4v1h-4zM21 7h1v1h-1zM24 7h1v1h-1zM26 7h1v1h-1zM28 7h3v1h-3zM32 7h1v1h-1zM4 8h1v1h-1zM6 8h3v1h-3zM10 8h1v1h-1zM12 8h3v1h-3zM16 8h1v1h-1zM18 8h3v1h-3zM22 8h3v1h-3zM26 8h1v1h-1zM28 8h3v1h-3zM32 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM14 9h1v1h-1zM18 9h1v1h-1zM20 9h1v1h-1zM24 9h1v1h-1zM26 9h1v1h-1zM32 9h1v1h-1zM4 10h7v1h-7zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM26 10h7v1h-7zM12 11h1v1h-1zM15 11h1v1h-1zM20 11h5v1h-5zM5 12h1v1h-1zM7 12h4v1h-4zM12 12h1v1h-1zM19 12h1v1h-1zM25 12h2v1h-2zM28 12h2v1h-2zM31 12h1v1h-1zM6 13h1v1h-1zM8 13h1v1h-1zM13 13h2v1h-2zM17 13h2v1h-2zM21 13h2v1h-2zM27 13h2v1h-2zM30 13h2v1h-2zM10 14h4v1h-4zM15 14h2v1h-2zM22 14h5v1h-5zM29 14h1v1h-1zM4 15h1v1h-1zM7 15h3v1h-3zM14 15h3v1h-3zM19 15h1v1h-1zM21 15h1v1h-1zM23 15h2v1h-2zM27 15h3v1h-3zM32 15h1v1h-1zM5 16h1v1h-1zM8 16h3v1h-3zM12 16h1v1h-1zM16 16h2v1h-2zM19 16h2v1h-2zM25 16h2v1h-2zM29 16h1v1h-1zM31 16h1v1h-1zM4 17h2v1h-2zM8 17h1v1h-1zM12 17h5v1h-5zM18 17h1v1h-1zM22 17h1v1h-1zM26 17h1v1h-1zM28 17h1v1h-1zM30 17h3v1h-3zM4 18h2v1h-2zM9 18h4v1h-4zM16 18h4v1h-4zM22 18h3v1h-3zM27 18h1v1h-1zM29 18h1v1h-1zM32 18h1v1h-1zM7 19h1v1h-1zM9 19h1v1h-1zM12 19h1v1h-1zM14 19h3v1h-3zM19 19h2v1h-2zM25 19h1v1h-1zM28 19h3v1h-3zM4 20h1v1h-1zM7 20h2v1h-2zM10 20h2v1h-2zM15 20h1v1h-1zM18 20h1v1h-1zM21 20h4v1h-4zM27 20h1v1h-1zM29 20h1v1h-1zM31 20h1v1h-1zM4 21h2v1h-2zM7 21h2v1h-2zM13 21h5v1h-5zM21 21h1v1h-1zM28 21h1v1h-1zM30 21h1v1h-1zM4 22h3v1h-3zM9 22h5v1h-5zM15 22h2v1h-2zM18 22h1v1h-1zM20 22h4v1h-4zM27 22h1v1h-1zM32 22h1v1h-1zM4 23h6v1h-6zM11 23h3v1h-3zM15 23h1v1h-1zM18 23h3v1h-3zM25 23h3v1h-3zM30 23h2v1h-2zM4 24h2v1h-2zM7 24h1v1h-1zM10 24h2v1h-2zM14 24h1v1h-1zM17 24h2v1h-2zM20 24h2v1h-2zM24 24h5v1h-5zM30 24h2v1h-2zM12 25h1v1h-1zM15 25h1v1h-1zM17 25h3v1h-3zM21 25h1v1h-1zM24 25h1v1h-1zM28 25h4v1h-4zM4 26h7v1h-7zM19 26h1v1h-1zM23 26h2v1h-2zM26 26h1v1h-1zM28 26h1v1h-1zM30 26h1v1h-1zM4 27h1v1h-1zM10 27h1v1h-1zM12 27h4v1h-4zM20 27h1v1h-1zM22 27h3v1h-3zM28 27h2v1h-2zM31 27h2v1h-2zM4 28h1v1h-1zM6 28h3v1h-3zM10 28h1v1h-1zM12 28h1v1h-1zM14 28h1v1h-1zM19 28h1v1h-1zM21 28h1v1h-1zM23 28h6v1h-6zM32 28h1v1h-1zM4 29h1v1h-1zM6 29h3v1h-3zM10 29h1v1h-1zM12 29h1v1h-1zM15 29h1v1h-1zM17 29h2v1h-2zM22 29h1v1h-1zM27 29h1v1h-1zM29 29h1v1h-1zM31 29h1v1h-1zM4 30h1v1h-1zM6 30h3v1h-3zM10 30h1v1h-1zM13 30h3v1h-3zM18 30h2v1h-2zM21 30h2v1h-2zM24 30h2v1h-2zM27 30h2v1h-2zM31 30h2v1h-2zM4 31h1v1h-1zM10 31h1v1h-1zM12 31h2v1h-2zM20 31h1v1h-1zM25 31h1v1h-1zM28 31h1v1h-1zM30 31h1v1h-1zM32 31h1v1h-1zM4 32h7v1h-7zM14 32h2v1h-2zM17 32h1v1h-1zM19 32h2v1h-2zM24 32h1v1h-1zM27 32h2v1h-2z"/></svg>`;

const THEMES: Record<KasperskyTier, string> = {
  standard: `--cover:#d6eee5; --hero-ink:#16302c; --band:#1e6a5f; --mint:#a1e3d1; --accent:#167567;
    --accent-soft:#e8f5f0; --emblem:#2b8b7b; --emblem-inner:#83d0bc;`,
  plus: `--cover:#79ccb5; --hero-ink:#18312e; --band:#58368a; --mint:#a1e3d1; --accent:#127d72;
    --accent-soft:#e7f6f1; --emblem:#603f92; --emblem-inner:#9b7fce;`,
  premium: `--cover:#342050; --hero-ink:#fff; --band:#66439b; --mint:#a6ead6; --accent:#65419d;
    --accent-soft:#f2ecfb; --emblem:#9770d7; --emblem-inner:#d4baf8;`,
};

const CSS = `
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet {
    width: 210mm; height: 297mm; background: #fff; color: #202e32; display: flex; flex-direction: column;
    overflow: hidden; line-height: 1.3; font-synthesis: none; page-break-after: always; break-after: page;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  ${(Object.keys(THEMES) as KasperskyTier[]).map((tier) => `.sheet[data-tier="${tier}"] { ${THEMES[tier]} }`).join("\n  ")}
  .sheet a { text-decoration: none; color: inherit; }
  .cover { height: 70mm; flex: 0 0 70mm; position: relative; background: var(--cover); color: var(--hero-ink); overflow: hidden; }
  .cover::before { content: ""; position: absolute; top: -32mm; right: -44mm; width: 103mm; height: 103mm; border: 1px solid currentColor; opacity: .09; border-radius: 50%; }
  .cover::after { content: ""; position: absolute; top: -18mm; right: -34mm; width: 80mm; height: 80mm; border: 1px solid currentColor; opacity: .085; border-radius: 50%; }
  .cover-content { position: relative; z-index: 1; padding: 7mm 11mm 0; height: 55mm; }
  .doc-kind { font-size: 7.6pt; font-weight: 780; letter-spacing: .21em; text-transform: uppercase; opacity: .81; }
  .wordmark { margin-top: 2mm; font-family: Arial, Helvetica, sans-serif; font-size: 36pt; letter-spacing: -.07em; font-weight: 600; line-height: .98; }
  .product-tier { margin-top: 1.2mm; font-size: 15pt; font-weight: 750; letter-spacing: .52em; line-height: 1; }
  .product-tagline { margin: 2.5mm 0 0; font-size: 9.25pt; line-height: 1.32; max-width: 121mm; font-weight: 550; }
  .license-pill { display: flex; align-items: center; width: max-content; height: 10.4mm; background: #132724; border-radius: 99px; gap: 1mm; margin-top: 2.3mm; padding: 1.1mm 1.4mm; color: #fff; font-size: 13pt; line-height: 1; letter-spacing: -.02em; }
  .license-pill .device-amount { background: var(--mint); color: #172d2a; border-radius: 99px; padding: 2mm 5mm; font-weight: 650; white-space: nowrap; }
  .license-pill .duration { padding: 0 5.1mm 0 3.2mm; font-weight: 600; }
  .protection-badge { position: absolute; z-index: 1; width: 40mm; height: 45mm; right: 11mm; top: 7mm; }
  .emblem-outer { fill: var(--emblem); } .emblem-mid { fill: var(--emblem-inner); } .emblem-inner { fill: var(--mint); } .emblem-k { fill: #172c29; }
  .benefits-strip { height: 15mm; width: 100%; position: absolute; bottom: 0; left: 0; background: var(--band); color: #fff; padding: 2.2mm 11mm 1.6mm; }
  .benefits-heading { font-size: 6.6pt; font-weight: 800; letter-spacing: .14em; opacity: .75; margin-bottom: 1mm; }
  .benefits-list { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 3mm; row-gap: 1.1mm; margin: 0; padding: 0; list-style: none; font-size: 7.5pt; font-weight: 550; line-height: 1.25; }
  .benefits-list li { position: relative; padding-left: 4mm; white-space: nowrap; }
  .benefits-list li::before { content: "✓"; position: absolute; left: 0; color: #b3f0da; font-size: 8pt; font-weight: 800; }
  .document-body { height: 207mm; flex: 0 0 207mm; padding: 4mm 11mm; display: grid; grid-template-rows: 35mm 52mm 44mm 40mm 16mm; row-gap: 3mm; }
  .section-heading { color: var(--accent); font-size: 11.5pt; margin: 0; font-weight: 780; letter-spacing: -.028em; line-height: 1.24; }
  .tiny-label { font-size: 7.4pt; letter-spacing: .13em; font-weight: 800; }
  .activation-section { min-height: 0; background: var(--accent-soft); border: .38mm solid var(--accent); border-radius: 3mm; text-align: center; padding: 3mm 4mm 1.3mm; position: relative; }
  .activation-section::before, .activation-section::after { content: ""; position: absolute; width: 5.5mm; height: 5.5mm; border-color: var(--accent); border-style: solid; opacity: .2; }
  .activation-section::before { top: 2mm; left: 2mm; border-width: .45mm 0 0 .45mm; border-radius: 1mm 0 0 0; }
  .activation-section::after { right: 2mm; bottom: 2mm; border-width: 0 .45mm .45mm 0; border-radius: 0 0 1mm 0; }
  .code-label { color: var(--accent); margin: 0; }
  .activation-code { font-family: "Consolas", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace; font-size: 20.8pt; font-weight: 800; color: #142d30; letter-spacing: .025em; white-space: nowrap; margin-top: 2.1mm; line-height: 1.2; font-variant-ligatures: none; }
  .code-subtitle { margin-top: 1.6mm; font-size: 8.1pt; font-weight: 650; color: #46645f; }
  .code-meta { display: flex; justify-content: center; gap: 1.2mm 4mm; flex-wrap: wrap; font-size: 7pt; line-height: 1.15; margin-top: 1.5mm; color: #355c55; }
  .meta-item { max-width: 100%; overflow-wrap: anywhere; } .meta-item b { font-weight: 750; }
  .steps-section, .faq-section, .important-section, .links-section { min-height: 0; }
  .section-rule { display: flex; align-items: center; gap: 3mm; margin: 0 0 3mm; }
  .section-rule::after { content: ""; border-top: .25mm solid #dce7e5; flex: 1; }
  .step-layout { display: grid; grid-template-columns: minmax(0, 1fr) 36mm; gap: 6mm; }
  .timeline { margin: 0; padding: 0 0 0 .6mm; list-style: none; }
  .timeline li { display: grid; grid-template-columns: 7.2mm minmax(0, 1fr); gap: 2.3mm; position: relative; min-height: 10mm; }
  .timeline li:nth-child(3) { min-height: 11.4mm; } .timeline li:nth-child(4) { min-height: 14mm; }
  .timeline li:not(:last-child)::before { content: ""; position: absolute; left: 3.15mm; top: 5.6mm; bottom: -.2mm; width: .33mm; background: #a6cfc5; }
  .step-number { display: grid; place-items: center; border: .36mm solid var(--accent); width: 6.8mm; height: 6.8mm; border-radius: 50%; color: var(--accent); background: #fff; font-size: 10pt; font-weight: 850; line-height: 1; position: relative; z-index: 1; }
  .step-copy { font-size: 8.8pt; line-height: 1.29; padding-top: .8mm; color: #29393b; }
  .step-copy a { font-weight: 750; color: var(--accent); border-bottom: .22mm solid currentColor; }
  .qr-panel { align-self: start; border: .3mm solid #e0e9e7; background: #fbfdfc; border-radius: 3mm; padding: 2mm 2mm 2.6mm; text-align: center; }
  .qr-link { display: block; width: 29mm; height: 29mm; margin: 0 auto; }
  .qr-svg { display: block; width: 100%; height: 100%; }
  .qr-caption { font-size: 7.6pt; font-weight: 730; color: var(--accent); line-height: 1.22; margin: 1.8mm 0 0; }
  .qr-url { font-size: 6.7pt; color: #56706b; margin-top: 1mm; }
  .faq-rows { display: grid; grid-template-rows: 10.2mm 14.2mm 11.2mm; }
  .faq-row { display: grid; grid-template-columns: 62mm 1fr; gap: 5mm; padding: 1.55mm .4mm; border-bottom: .23mm solid #e4ebea; align-items: start; }
  .faq-row:last-child { border-bottom: 0; }
  .faq-question { font-size: 8.5pt; font-weight: 770; color: #2a393d; line-height: 1.25; }
  .faq-answer { font-size: 8.25pt; line-height: 1.29; color: #536367; }
  .faq-answer strong { color: #324f4c; font-weight: 750; }
  .important-section { background: #f8faf9; border: .23mm solid #e5ecea; border-radius: 2.3mm; padding: 2.5mm 3.3mm; }
  .important-section .section-heading { font-size: 10.5pt; margin-bottom: 1.7mm; }
  .warnings { margin: 0; padding: 0; list-style: none; }
  .warnings li { position: relative; margin: 0 0 1.05mm; padding-left: 4mm; font-size: 8.05pt; line-height: 1.23; color: #566468; }
  .warnings li::before { content: "•"; position: absolute; color: var(--accent); left: 1mm; font-size: 12pt; line-height: .9; font-weight: 800; }
  .warnings li:last-child { margin-bottom: 0; }
  .links-section { padding: .4mm 0 0; }
  .links-section .section-heading { font-size: 9.6pt; margin-bottom: 1.7mm; }
  .official-links { display: flex; flex-wrap: wrap; gap: 1.5mm 4mm; align-items: center; }
  .official-links a { font-size: 8pt; font-weight: 750; color: var(--accent); text-decoration: underline; text-decoration-thickness: .2mm; text-underline-offset: .7mm; }
  .official-links a:not(:last-child)::after { content: "↗"; display: inline; margin-left: 1mm; font-size: 8.5pt; }
  .support-footer { background: var(--band); color: #fff; flex: 0 0 20mm; height: 20mm; padding: 3.1mm 11mm; display: flex; align-items: center; justify-content: space-between; gap: 5mm; }
  .support-brand { font-size: 12pt; font-weight: 850; letter-spacing: .012em; white-space: nowrap; text-transform: uppercase; }
  .support-by { font-size: 7pt; opacity: .72; font-weight: 500; margin-top: 1.1mm; }
  .support-content { text-align: right; font-size: 8pt; line-height: 1.45; }
  .support-title { font-weight: 700; font-size: 8.4pt; margin-bottom: .8mm; }
  .support-contacts { display: flex; justify-content: flex-end; gap: 4mm; flex-wrap: wrap; }
  .support-contacts a { text-decoration: underline; text-underline-offset: 1mm; font-weight: 650; }
`;

function buildMeta(input: LicenceDocumentInput, index: number) {
  const items: Array<[string, string]> = [];
  if (input.codes.length > 1) items.push(["Licence", `${index + 1} / ${input.codes.length}`]);
  items.push(["N° :", input.licenceNumber]);
  if (input.orderReference) items.push(["Commande :", input.orderReference]);
  if (input.customerName) items.push(["Client :", input.customerName]);
  if (input.activationRegion) items.push(["Zone d’activation :", input.activationRegion]);
  const date = formatFrenchDate(input.useBefore);
  if (date) items.push(["Code à utiliser avant le", date]);
  return items
    .map(
      ([label, value]) =>
        `<span class="meta-item"><b>${escapeHtml(label)}</b> ${escapeHtml(value)}</span>`,
    )
    .join("");
}

function buildSheet(input: LicenceDocumentInput, code: string, index: number) {
  const { variant, seller } = input;
  const details = KASPERSKY_TIER_DETAILS[variant.tier];
  const devices = deviceLabel(variant.devices);
  const productName = `Kaspersky ${details.display}`;
  const contacts: string[] = [];
  if (seller.email) {
    contacts.push(`<a href="mailto:${escapeHtml(seller.email)}">${escapeHtml(seller.email)}</a>`);
  }
  if (seller.phone) {
    contacts.push(`<a href="tel:${escapeHtml(seller.phone.replace(/[^+\d]/g, ""))}">${escapeHtml(seller.phone)}</a>`);
  }
  if (seller.website) {
    contacts.push(
      `<a href="${escapeHtml(websiteHref(seller.website))}">${escapeHtml(websiteLabel(seller.website))}</a>`,
    );
  }
  const sellerBy = seller.website
    ? `Votre revendeur · ${escapeHtml(websiteLabel(seller.website))}`
    : "Votre revendeur";

  return `
  <article class="sheet" data-tier="${variant.tier}" aria-label="Carte d’activation ${escapeHtml(productName)}">
    <header class="cover">
      <div class="cover-content">
        <div class="doc-kind">Licence numérique · Carte d’activation</div>
        <div class="wordmark">kaspersky</div>
        <div class="product-tier">${escapeHtml(details.display.toUpperCase())}</div>
        <p class="product-tagline">${escapeHtml(details.tagline)}</p>
        <div class="license-pill"><span class="device-amount">${escapeHtml(devices)}</span><span class="duration">1 an</span></div>
        <svg class="protection-badge" viewBox="0 0 160 174" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path class="emblem-outer" d="M80 4 150 44v86L80 170 10 130V44Z"/>
          <path class="emblem-mid" d="M80 30 127 57v60l-47 27-47-27V57Z" opacity=".39"/>
          <path d="M80 49 112 67v43l-32 18-32-18V67Z" fill="#132b28"/>
          <path class="emblem-inner" d="M80 55 106 70v37l-26 15-26-15V70Z"/>
          <path class="emblem-k" d="M72 73v32h7v-10l4-4 9 14h8L88 85l11-12h-9L79 86V73Z"/>
        </svg>
      </div>
      <div class="benefits-strip">
        <div class="benefits-heading">VOTRE PROTECTION EN UN COUP D’ŒIL</div>
        <ul class="benefits-list">${details.benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join("")}</ul>
      </div>
    </header>
    <div class="document-body">
      <section class="activation-section">
        <h2 class="tiny-label code-label">VOTRE CODE D’ACTIVATION</h2>
        <div class="activation-code">${escapeHtml(formatLicenceCode(code))}</div>
        <div class="code-subtitle">Code personnel et confidentiel</div>
        <div class="code-meta">${buildMeta(input, index)}</div>
      </section>
      <section class="steps-section">
        <div class="section-rule"><h2 class="section-heading">Activez votre protection en 4 étapes</h2></div>
        <div class="step-layout">
          <ol class="timeline">
            <li><span class="step-number">1</span><div class="step-copy">Créez un compte sur <a href="https://my.kaspersky.com/">my.kaspersky.com</a> ou connectez-vous.</div></li>
            <li><span class="step-number">2</span><div class="step-copy">Ajoutez votre code d’activation à votre compte.</div></li>
            <li><span class="step-number">3</span><div class="step-copy">Téléchargez et installez votre application Kaspersky depuis votre compte.</div></li>
            <li><span class="step-number">4</span><div class="step-copy">C’est terminé ! Votre protection s’active automatiquement une fois l’installation terminée et votre compte connecté.</div></li>
          </ol>
          <aside class="qr-panel">
            <a class="qr-link" href="https://my.kaspersky.com/" aria-label="Ouvrir My Kaspersky">${QR_SVG}</a>
            <div class="qr-caption">Scannez pour activer votre protection</div>
            <div class="qr-url">my.kaspersky.com</div>
          </aside>
        </div>
      </section>
      <section class="faq-section">
        <div class="section-rule"><h2 class="section-heading">Questions fréquentes</h2></div>
        <div class="faq-rows">
          <div class="faq-row"><div class="faq-question">Sur combien d’appareils puis-je installer ma protection ?</div>
            <div class="faq-answer">Cette licence protège jusqu’à <strong>${escapeHtml(devices)}</strong>, selon les conditions de votre abonnement.</div></div>
          <div class="faq-row"><div class="faq-question">Comment transférer ma protection vers un nouvel appareil ?</div>
            <div class="faq-answer">Si nécessaire, retirez l’ancien appareil de votre compte My Kaspersky, puis connectez-vous au même compte et installez l’application sur le nouvel appareil.</div></div>
          <div class="faq-row"><div class="faq-question">À quoi sert My Kaspersky ?</div>
            <div class="faq-answer">À gérer vos abonnements, appareils, téléchargements et activations au même endroit.</div></div>
        </div>
      </section>
      <section class="important-section">
        <h2 class="section-heading">Informations importantes</h2>
        <ul class="warnings">
          <li>Une connexion Internet est nécessaire pour l’activation.</li>
          <li>Utilisez uniquement une version officielle et compatible de ${escapeHtml(productName)} ; évitez les logiciels modifiés ou piratés.</li>
          <li>La licence couvre uniquement le nombre d’appareils indiqué. Les activations supplémentaires peuvent être refusées par Kaspersky.</li>
          <li>Conservez votre code confidentiel et activez votre protection rapidement après réception.</li>
          <li>Des restrictions géographiques ou une date limite d’utilisation peuvent s’appliquer selon la licence.</li>
        </ul>
      </section>
      <nav class="links-section">
        <h2 class="section-heading">Liens officiels Kaspersky</h2>
        <div class="official-links">
          <a href="https://my.kaspersky.com/">Activation</a>
          <a href="${escapeHtml(details.downloadUrl)}">Télécharger ${escapeHtml(productName)}</a>
          <a href="https://www.kaspersky.com/activation-guide">Guide d’activation</a>
          <a href="https://support.kaspersky.com/">Assistance officielle</a>
        </div>
      </nav>
    </div>
    <footer class="support-footer">
      <div><div class="support-brand">${escapeHtml(seller.name)}</div><div class="support-by">${sellerBy}</div></div>
      <div class="support-content">
        <div class="support-title">Besoin d’aide ? Notre équipe est à votre disposition.</div>
        <div class="support-contacts">${contacts.join("")}</div>
      </div>
    </footer>
  </article>`;
}

export function buildKasperskyLicenceHtml(input: LicenceDocumentInput): string {
  if (input.codes.length === 0) {
    throw new Error("A licence document needs at least one code");
  }
  const title = `Licence ${input.variant.label} — ${input.licenceNumber}`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
</head>
<body>${input.codes.map((code, index) => buildSheet(input, code, index)).join("")}
</body>
</html>`;
}
