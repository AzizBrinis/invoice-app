import { WINDOWS_EDITION_DETAILS, type WindowsVariant } from "@/lib/digital-products/windows-catalog";
import { formatLicenceCode, WINDOWS_CODE_FORMAT } from "@/lib/digital-products/licence-code-format";
import { TECHNO_SMART_LOGO_DATA_URI } from "@/server/digital-products/assets/techno-smart-logo";
import {
  escapeHtml,
  formatFrenchDate,
  websiteHref,
  websiteLabel,
  type LicenceSellerBranding,
} from "@/server/digital-products/kaspersky-licence-html";

/**
 * Server-side HTML for the Windows 11 Professionnel licence document (A4,
 * French). Ported from the Techno Smart reference document
 * ("licence-windows-11-professionnel-techno-smart.html"): same cover, key
 * block, activation steps, important notes and the Famille → Professionnel
 * upgrade notice with Microsoft's public generic key.
 *
 * Differences with the reference: the product key is printed (no input field,
 * no script, no toolbar) and the order details / seller contacts are injected.
 * One key page per activation code, then a single notice page.
 * Every dynamic value is HTML-escaped.
 */

export type WindowsLicenceDocumentInput = {
  variant: WindowsVariant;
  codes: string[];
  licenceNumber: string;
  orderReference?: string | null;
  customerName?: string | null;
  activationRegion?: string | null;
  /** YYYY-MM-DD */
  useBefore?: string | null;
  seller: LicenceSellerBranding;
};

/** Microsoft's public, non-activating Windows 11 Pro edition-upgrade key. */
export const WINDOWS_11_PRO_GENERIC_KEY = "VK7JG-NPHTM-C97JM-9MPGT-3V66T";

const CSS = `
  @page { size: A4 portrait; margin: 0; }
  :root {
    --navy:#0a1230; --blue:#2f6bff; --blue-2:#5b9dff; --brand:#5170ff;
    --text:#0d1324; --text-2:#4a5470; --rule:#e3e7f0; --tint:#eef3ff;
    --sans:"Segoe UI Variable Text","Segoe UI",Inter,system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
    --display:"Segoe UI Variable Display","Segoe UI",Inter,system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
    --mono:"Cascadia Mono","Cascadia Code",Consolas,"SF Mono",Menlo,"DejaVu Sans Mono","Liberation Mono",monospace;
  }
  *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { color: var(--text); font-family: var(--sans); font-size: 9.4pt; line-height: 1.45; -webkit-font-smoothing: antialiased; }
  a { color: inherit; text-decoration: none; }
  .page {
    position: relative; width: 210mm; height: 297mm; overflow: hidden; display: flex; flex-direction: column;
    break-after: page; page-break-after: always; break-inside: avoid;
  }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .brand-logo { height: 5.2mm; width: auto; display: block; }
  .brand-text { font-family: var(--display); font-size: 13pt; font-weight: 700; letter-spacing: .02em; color: var(--navy); }

  /* ---------- Key page ---------- */
  .box {
    color: var(--text); padding: 13mm 15mm 10mm;
    background: radial-gradient(85% 50% at 85% 6%, rgba(47,107,255,.13) 0%, rgba(47,107,255,0) 62%),
      linear-gradient(180deg,#f5f8ff 0%,#ffffff 42%,#ffffff 100%);
  }
  .box__art { position: absolute; top: 0; right: 0; width: 150mm; height: 112mm; pointer-events: none; }
  .box__art svg { width: 100%; height: 100%; display: block; }
  .topbar { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 4mm; }
  .tags { display: flex; gap: 2mm; }
  .tag {
    white-space: nowrap; display: inline-flex; align-items: center; gap: 2mm; border: 1px solid #d6e0f5; border-radius: 99px;
    padding: 1.2mm 3.2mm; font-size: 7.4pt; letter-spacing: .14em; text-transform: uppercase; color: var(--text-2); background: rgba(255,255,255,.85);
  }
  .tag i { width: 1.6mm; height: 1.6mm; border-radius: 50%; background: var(--brand); display: block; }
  .hero { position: relative; margin-top: 11mm; max-width: 130mm; }
  .hero__over { font-size: 9pt; letter-spacing: .32em; text-transform: uppercase; color: var(--text-2); margin: 0 0 3mm; }
  .hero h1 { font-family: var(--display); font-weight: 600; font-size: 40pt; line-height: 1; letter-spacing: -.02em; margin: 0; color: var(--navy); }
  .hero h1 span { display: block; font-weight: 300; font-size: 25pt; letter-spacing: -.01em; margin-top: 2mm; color: var(--blue); }
  .hero__sub { display: flex; align-items: center; gap: 3mm; margin-top: 6mm; font-size: 9.5pt; color: var(--text-2); letter-spacing: .02em; }
  .hero__sub b { color: var(--text); font-weight: 600; }
  .key { position: relative; margin-top: 10mm; border: 1px solid #dbe3f3; border-radius: 4mm; background: rgba(247,249,255,.92); padding: 5.5mm 6mm 5mm; }
  .key__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; margin-bottom: 3.4mm; }
  .key__label { margin: 0; font-size: 13pt; font-weight: 600; letter-spacing: -.005em; }
  .key__hint { font-size: 7.6pt; color: var(--text-2); letter-spacing: .06em; text-transform: uppercase; }
  .key__print {
    font-family: var(--mono); font-size: 16.5pt; font-weight: 600; letter-spacing: .09em; color: var(--text); background: #fff;
    border: 1.5px solid #c9d2e6; border-radius: 2.6mm; padding: 3.2mm 4mm; white-space: nowrap; font-variant-ligatures: none;
  }
  .key__meta { display: flex; flex-wrap: wrap; gap: 1mm 5mm; margin: 2.8mm 0 0; font-size: 7.8pt; color: var(--text-2); }
  .key__meta b { color: var(--text); font-weight: 600; }
  .key__privacy { margin: 2mm 0 0; font-size: 7.4pt; color: #7a839b; }
  .cols { display: grid; grid-template-columns: 1.12fr .88fr; gap: 9mm; margin-top: 7mm; flex: 1; min-height: 0; }
  .h2 { font-size: 11pt; font-weight: 600; margin: 0 0 3.6mm; letter-spacing: -.003em; display: flex; align-items: center; gap: 2.4mm; }
  .h2 .n { font-size: 7.2pt; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--blue); }
  .steps { list-style: none; margin: 0; padding: 0; counter-reset: s; }
  .steps li { position: relative; counter-increment: s; padding: 0 0 5.2mm 9mm; }
  .steps li::before {
    content: counter(s); position: absolute; left: 0; top: -.2mm; width: 5.6mm; height: 5.6mm; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 7.8pt; font-weight: 700;
    background: var(--tint); border: 1px solid #c6d6ff; color: #1d4fe0;
  }
  .steps li::after { content: ""; position: absolute; left: 2.75mm; top: 6.2mm; bottom: .6mm; width: 1px; background: var(--rule); }
  .steps li:last-child::after { display: none; }
  .steps li > strong { display: block; font-weight: 600; font-size: 9.6pt; margin-bottom: .4mm; }
  .steps li > span { display: block; font-size: 8.7pt; color: var(--text-2); }
  .path { display: inline; white-space: nowrap; font-weight: 600; color: var(--text); }
  .path em { font-style: normal; color: var(--blue); padding: 0 .6mm; font-weight: 400; }
  .side { display: flex; flex-direction: column; gap: 7mm; }
  .dl { display: block; border: 1px solid #cfdcff; border-radius: 3mm; background: linear-gradient(135deg,#eaf1ff,#f7f9ff); padding: 4mm 4.4mm; }
  .dl__k { font-size: 7.2pt; letter-spacing: .16em; text-transform: uppercase; color: var(--blue); margin: 0 0 1.2mm; font-weight: 600; }
  .dl__t { font-weight: 600; font-size: 9.6pt; margin: 0 0 1.4mm; color: var(--text); }
  .dl__u { font-family: var(--mono); font-size: 7.3pt; color: #1d4fe0; overflow-wrap: anywhere; text-decoration: underline; text-decoration-color: rgba(29,79,224,.35); text-underline-offset: 2px; }
  .important { margin: 0 0 4mm; padding: 3mm 3.8mm 3.2mm; border-radius: 2.6mm; border: 1px solid #ffbf47; border-left: 4px solid #f0a500; background: #fff8e8; }
  .important__k { display: inline-flex; align-items: center; gap: 1.4mm; font-size: 7.2pt; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #8a5800; }
  .important p { margin: 1.2mm 0 0; font-size: 9pt; line-height: 1.4; font-weight: 600; color: var(--text); }
  .notes { list-style: none; margin: 0; padding: 0; }
  .notes li { position: relative; padding-left: 4.2mm; margin-bottom: 2.6mm; font-size: 8.5pt; color: var(--text-2); }
  .notes li::before { content: ""; position: absolute; left: 0; top: .62em; width: 1.6mm; height: 1.6mm; border-radius: 50%; border: 1.2px solid var(--blue); }
  .notes b { color: var(--text); font-weight: 600; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 4mm; border-top: 1px solid var(--rule); padding-top: 3.4mm; margin-top: 4mm; font-size: 7.6pt; color: #7a839b; }
  .foot a { color: var(--text); font-weight: 600; }
  .pg { font-variant-numeric: tabular-nums; letter-spacing: .08em; white-space: nowrap; }

  /* ---------- Notice page ---------- */
  .leaflet { background: #fff; color: var(--text); padding: 13mm 15mm 10mm; }
  .leaflet::before { content: ""; position: absolute; left: 0; top: 0; right: 0; height: 2.2mm; background: linear-gradient(90deg,#0a1230 0%,#1d4fe0 55%,#7fc0ff 100%); }
  .l-top { display: flex; align-items: center; justify-content: space-between; }
  .l-top .brand-logo { height: 4.6mm; }
  .l-top .crumb { font-size: 7.4pt; letter-spacing: .14em; text-transform: uppercase; color: var(--text-2); }
  .l-title { margin-top: 10mm; }
  .l-title .over { font-size: 7.6pt; letter-spacing: .22em; text-transform: uppercase; color: var(--blue); font-weight: 600; margin: 0 0 2.4mm; }
  .l-title h2 { font-family: var(--display); font-size: 22pt; line-height: 1.1; font-weight: 600; letter-spacing: -.015em; margin: 0; }
  .l-title h2 span { color: var(--blue); }
  .l-title p { margin: 3.4mm 0 0; font-size: 9.6pt; color: var(--text-2); max-width: 150mm; }
  .callout { display: flex; gap: 4mm; align-items: flex-start; margin-top: 6.5mm; padding: 4mm 5mm; border-radius: 3mm; background: var(--tint); border: 1px solid #d6e2ff; }
  .callout svg { flex: none; margin-top: .4mm; }
  .callout p { margin: 0; font-size: 8.9pt; color: #22304f; }
  .callout b { color: var(--text); }
  .l-steps { list-style: none; margin: 7mm 0 0; padding: 0; counter-reset: s; }
  .l-steps > li { position: relative; counter-increment: s; padding: 0 0 5mm 13mm; }
  .l-steps > li::before {
    content: counter(s); position: absolute; left: 0; top: -.6mm; width: 8mm; height: 8mm; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 10.5pt; font-weight: 700; background: #0a1230; color: #fff;
  }
  .l-steps > li::after { content: ""; position: absolute; left: 3.95mm; top: 8.6mm; bottom: .8mm; width: 1px; background: var(--rule); }
  .l-steps > li:last-child { padding-bottom: 0; }
  .l-steps > li:last-child::after { display: none; }
  .l-steps h3 { margin: 0; font-size: 10.6pt; font-weight: 600; letter-spacing: -.003em; }
  .l-steps p { margin: 1.2mm 0 0; font-size: 8.8pt; color: var(--text-2); }
  .generic { margin-top: 3mm; border-radius: 3.4mm; overflow: hidden; background: #fffaf0; color: var(--text); border: 1.5px solid #ffbf47; }
  .generic__badge { display: flex; align-items: center; gap: 2.4mm; background: #ffbf47; color: #1d1300; padding: 1.8mm 4.5mm; font-size: 8pt; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .generic__body { padding: 3.6mm 4.5mm; }
  .generic__key { font-family: var(--mono); font-size: 15.5pt; font-weight: 600; letter-spacing: .08em; white-space: nowrap; }
  .l-steps .generic__note { margin: 0; padding: 0 4.5mm 3.4mm; font-size: 8pt; color: #6b5a33; }
  .l-grid { display: grid; grid-template-columns: 1.25fr .75fr; gap: 8mm; margin-top: auto; padding-top: 6mm; }
  .panel { border-top: 1px solid var(--rule); padding-top: 3.6mm; }
  .panel h4 { margin: 0 0 2.6mm; font-size: 7.6pt; letter-spacing: .18em; text-transform: uppercase; color: var(--text-2); font-weight: 700; }
  .trouble { list-style: none; margin: 0; padding: 0; }
  .trouble li { margin-bottom: 2mm; font-size: 8pt; color: var(--text-2); }
  .trouble li b { color: var(--text); font-weight: 600; }
  .help a { display: block; margin-bottom: 2.8mm; }
  .help a span { display: block; font-size: 7.4pt; color: var(--text-2); }
  .help a strong { display: block; font-size: 8.6pt; color: var(--blue); font-weight: 600; overflow-wrap: anywhere; text-decoration: underline; text-decoration-color: rgba(47,107,255,.35); text-underline-offset: 2px; }
  .help a.mail strong { font-size: 10pt; }
  .l-foot { display: flex; justify-content: space-between; gap: 6mm; align-items: flex-end; margin-top: 5mm; padding-top: 3.2mm; border-top: 1px solid var(--rule); font-size: 6.9pt; color: #7a839b; }
`;

function artSvg(prefix: string) {
  const id = (name: string) => `${prefix}-${name}`;
  return `<svg viewBox="0 0 600 450" preserveAspectRatio="xMaxYMin slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="${id("g0")}" cx="66%" cy="38%" r="55%"><stop offset="0" stop-color="#5aa8ff" stop-opacity=".55"/><stop offset=".45" stop-color="#1f5cff" stop-opacity=".22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id("r1")}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0b2a9e" stop-opacity="0"/><stop offset=".35" stop-color="#1a4fff" stop-opacity=".75"/><stop offset=".75" stop-color="#5fb0ff" stop-opacity=".95"/><stop offset="1" stop-color="#d3ecff" stop-opacity=".9"/></linearGradient>
        <linearGradient id="${id("r2")}" x1="0" y1="1" x2="1" y2=".2"><stop offset="0" stop-color="#081a66" stop-opacity="0"/><stop offset=".4" stop-color="#1240d8" stop-opacity=".7"/><stop offset="1" stop-color="#3f8dff" stop-opacity=".85"/></linearGradient>
        <linearGradient id="${id("r3")}" x1="0" y1=".9" x2="1" y2="0"><stop offset="0" stop-color="#2a6bff" stop-opacity="0"/><stop offset=".5" stop-color="#7cc4ff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".75"/></linearGradient>
        <linearGradient id="${id("fade")}" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
        <linearGradient id="${id("fadeL")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".35" stop-color="#fff"/></linearGradient>
        <mask id="${id("m")}"><rect width="600" height="450" fill="url(#${id("fade")})"/></mask>
        <mask id="${id("m2")}"><rect width="600" height="450" fill="url(#${id("fadeL")})"/></mask>
        <filter id="${id("soft")}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
      </defs>
      <g mask="url(#${id("m")})"><g mask="url(#${id("m2")})">
        <rect width="600" height="450" fill="url(#${id("g0")})"/>
        <ellipse cx="430" cy="170" rx="150" ry="70" fill="#3a86ff" opacity=".35" filter="url(#${id("soft")})" transform="rotate(-24 430 170)"/>
        <path d="M40 430 C170 360 250 220 380 170 C470 136 540 150 620 112 L620 168 C540 196 476 186 392 214 C270 256 190 380 90 450 Z" fill="url(#${id("r2")})"/>
        <path d="M120 450 C220 360 300 250 410 200 C500 160 560 168 620 140 L620 178 C560 200 506 206 424 236 C320 276 250 370 190 450 Z" fill="url(#${id("r1")})" opacity=".9"/>
        <path d="M210 450 C290 370 360 290 450 250 C520 218 572 214 620 200 L620 230 C574 242 530 252 466 282 C390 318 330 390 280 450 Z" fill="url(#${id("r2")})" opacity=".8"/>
        <path d="M260 120 C340 96 430 60 520 40 C560 31 596 30 620 28 L620 48 C590 52 556 58 520 68 C440 90 360 120 290 140 Z" fill="url(#${id("r3")})" opacity=".55"/>
        <path d="M60 440 C190 352 268 218 392 178 C480 148 548 156 620 124" fill="none" stroke="#ffffff" stroke-opacity=".9" stroke-width="1.1"/>
        <path d="M140 450 C240 360 318 252 424 210 C506 178 566 182 620 160" fill="none" stroke="#bfe0ff" stroke-opacity=".5" stroke-width=".8"/>
        <path d="M230 450 C304 374 372 300 458 262 C528 232 578 228 620 216" fill="none" stroke="#9fd0ff" stroke-opacity=".4" stroke-width=".7"/>
      </g></g>
    </svg>`;
}

const WARNING_ICON = (size: number, stroke: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" aria-hidden="true"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17v.1"/></svg>`;

function isTechnoSmart(seller: LicenceSellerBranding) {
  return seller.name.trim().toLowerCase().replace(/[\s_-]+/g, " ") === "techno smart";
}

function brandMark(seller: LicenceSellerBranding) {
  return isTechnoSmart(seller)
    ? `<img class="brand-logo" src="${TECHNO_SMART_LOGO_DATA_URI}" alt="${escapeHtml(seller.name)}" width="760" height="76">`
    : `<span class="brand-text">${escapeHtml(seller.name)}</span>`;
}

function sellerContacts(seller: LicenceSellerBranding) {
  const parts: string[] = [];
  if (seller.email) {
    parts.push(`<a href="mailto:${escapeHtml(seller.email)}">${escapeHtml(seller.email)}</a>`);
  }
  if (seller.phone) {
    parts.push(`<a href="tel:${escapeHtml(seller.phone.replace(/[^+\d]/g, ""))}">${escapeHtml(seller.phone)}</a>`);
  }
  if (seller.website) {
    parts.push(`<a href="${escapeHtml(websiteHref(seller.website))}">${escapeHtml(websiteLabel(seller.website))}</a>`);
  }
  return parts.join(" · ");
}

function buildMeta(input: WindowsLicenceDocumentInput, index: number) {
  const items: Array<[string, string]> = [];
  if (input.codes.length > 1) items.push(["Clé", `${index + 1} / ${input.codes.length}`]);
  items.push(["N° de licence :", input.licenceNumber]);
  if (input.orderReference) items.push(["Commande :", input.orderReference]);
  if (input.customerName) items.push(["Client :", input.customerName]);
  if (input.activationRegion) items.push(["Zone d’activation :", input.activationRegion]);
  const date = formatFrenchDate(input.useBefore);
  if (date) items.push(["À activer avant le", date]);
  return items.map(([label, value]) => `<span><b>${escapeHtml(label)}</b> ${escapeHtml(value)}</span>`).join("");
}

function buildKeyPage(input: WindowsLicenceDocumentInput, code: string, index: number, pageCount: number) {
  const { seller } = input;
  const details = WINDOWS_EDITION_DETAILS[input.variant.edition];
  const productName = `${details.product}&nbsp;${escapeHtml(details.display)}`;
  return `
<section class="page box" aria-label="Licence ${escapeHtml(input.variant.label)}">
  <div class="box__art" aria-hidden="true">${artSvg(`art${index}`)}</div>
  <header class="topbar">
    ${brandMark(seller)}
    <span class="tags"><span class="tag"><i></i>Licence numérique</span></span>
  </header>
  <div class="hero">
    <p class="hero__over">Microsoft</p>
    <h1>${escapeHtml(details.product)}<span>${escapeHtml(details.display)}</span></h1>
    <div class="hero__sub">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f6bff" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>
      <span><b>Téléchargement numérique</b> · Livraison électronique de la clé</span>
    </div>
  </div>
  <div class="key">
    <div class="key__head">
      <h2 class="key__label">Votre clé de produit</h2>
      <span class="key__hint">Clé privée · ${WINDOWS_CODE_FORMAT.length} caractères</span>
    </div>
    <div class="key__print">${escapeHtml(formatLicenceCode(code, WINDOWS_CODE_FORMAT))}</div>
    <p class="key__meta">${buildMeta(input, index)}</p>
    <p class="key__privacy">Confidentiel — conservez cette clé en lieu sûr et ne la communiquez à personne.</p>
  </div>
  <div class="cols">
    <div>
      <h2 class="h2"><span class="n">Activation</span> Activer ${productName}</h2>
      <ol class="steps">
        <li><strong>Connectez l’ordinateur à Internet</strong><span>Wi-Fi ou câble Ethernet.</span></li>
        <li><strong>Vérifiez l’édition installée</strong><span>Dans <span class="path">Paramètres <em>→</em> Système <em>→</em> Informations système</span>, l’édition doit être <b>${productName}</b>. Si Windows&nbsp;11 Famille est installé, suivez d’abord la page&nbsp;${pageCount}.</span></li>
        <li><strong>Ouvrez la page Activation</strong><span><span class="path">Paramètres <em>→</em> Système <em>→</em> Activation</span> (raccourci&nbsp;: touche Windows&nbsp;+&nbsp;I).</span></li>
        <li><strong>Sélectionnez «&nbsp;Modifier la clé de produit&nbsp;»</strong><span>Cliquez sur <b>Modifier</b> en regard de cette option.</span></li>
        <li><strong>Saisissez votre clé de produit</strong><span>Entrez la clé ci-dessus, puis <b>Suivant</b> et <b>Activer</b>.</span></li>
        <li><strong>Vérifiez l’activation</strong><span>La page Activation doit indiquer <b>État d’activation&nbsp;: Actif</b>.</span></li>
      </ol>
    </div>
    <div class="side">
      <a class="dl" href="${escapeHtml(details.downloadUrl)}">
        <p class="dl__k">Installation officielle</p>
        <p class="dl__t">Télécharger ${escapeHtml(details.product).replace(" ", "&nbsp;")} depuis Microsoft</p>
        <span class="dl__u">${escapeHtml(details.downloadUrl.replace(/^https:\/\//, ""))}</span>
      </a>
      <div>
        <h2 class="h2"><span class="n">À lire</span> Remarques importantes</h2>
        <div class="important" role="note">
          <span class="important__k">${WARNING_ICON(12, 2.6)} Important</span>
          <p>Vous devez utiliser le code d’activation dès le moment de réception pour des raisons de sécurité.</p>
        </div>
        <ul class="notes">
          <li><b>Windows authentique.</b> Utilisez une version de Windows&nbsp;11 officielle et non modifiée, téléchargée depuis le site de Microsoft.</li>
          <li><b>Aucun prérequis Windows&nbsp;10.</b> La clé s’utilise directement sur Windows&nbsp;11.</li>
          <li><b>Clé confidentielle.</b> Ne la partagez pas et ne la publiez pas.</li>
          <li><b>Un seul appareil.</b> Ce code est valide pour un seul appareil. Il est strictement interdit de l’utiliser plus d’une fois, sinon il sera bloqué par l’équipe Microsoft.</li>
        </ul>
      </div>
    </div>
  </div>
  <footer class="foot">
    <span>Assistance ${escapeHtml(seller.name)}&nbsp;: ${sellerContacts(seller)}</span>
    <span class="pg">${index + 1} / ${pageCount}</span>
  </footer>
</section>`;
}

function buildNoticePage(input: WindowsLicenceDocumentInput, pageCount: number) {
  const { seller } = input;
  const help: string[] = [
    `<a href="https://support.microsoft.com/fr-fr/windows/activation/activate-windows"><span>Aide Microsoft — activation</span><strong>support.microsoft.com/fr-fr/windows/activation/activate-windows</strong></a>`,
  ];
  if (seller.email) {
    help.push(
      `<a class="mail" href="mailto:${escapeHtml(seller.email)}"><span>Service client ${escapeHtml(seller.name)}</span><strong>${escapeHtml(seller.email)}</strong></a>`,
    );
  }
  if (seller.phone) {
    help.push(
      `<a href="tel:${escapeHtml(seller.phone.replace(/[^+\d]/g, ""))}"><span>Téléphone</span><strong>${escapeHtml(seller.phone)}</strong></a>`,
    );
  }
  const provider = seller.website
    ? `${escapeHtml(seller.name)} — ${escapeHtml(websiteLabel(seller.website))}`
    : escapeHtml(seller.name);
  return `
<section class="page leaflet" aria-label="Notice de mise à niveau">
  <header class="l-top">
    ${brandMark(seller)}
    <span class="crumb">Windows 11 Professionnel · Notice</span>
  </header>
  <div class="l-title">
    <p class="over">Mise à niveau d’édition</p>
    <h2>Passer de Windows&nbsp;11 Famille<br>à <span>Windows&nbsp;11 Professionnel</span></h2>
    <p>Votre ordinateur fonctionne sous Windows&nbsp;11 Famille&nbsp;? Changez d’abord d’édition à l’aide de la clé générique publique, puis activez Windows avec votre clé privée.</p>
  </div>
  <div class="callout">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f6bff" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.2v.1"/></svg>
    <p><b>La clé générique change uniquement l’édition de Windows&nbsp;: elle n’active jamais Windows.</b> Après le changement d’édition, Windows reste non activé tant que vous n’avez pas saisi votre clé privée achetée (page${input.codes.length > 1 ? "s" : ""}&nbsp;1${input.codes.length > 1 ? `&nbsp;à&nbsp;${input.codes.length}` : ""}). Sauvegardez vos travaux en cours avant de commencer.</p>
  </div>
  <ol class="l-steps">
    <li><h3>Déconnectez temporairement Internet</h3><p>Désactivez le Wi-Fi ou débranchez le câble Ethernet.</p></li>
    <li><h3>Ouvrez «&nbsp;Modifier la clé de produit&nbsp;»</h3><p><span class="path">Paramètres <em>→</em> Système <em>→</em> Activation <em>→</em> Modifier la clé de produit</span>, puis cliquez sur <b>Modifier</b>.</p></li>
    <li>
      <h3>Saisissez la clé générique publique</h3>
      <div class="generic" role="group" aria-label="Clé générique publique non activante">
        <div class="generic__badge">${WARNING_ICON(14, 2.4)} Clé générique publique — non activante</div>
        <div class="generic__body"><span class="generic__key">${WINDOWS_11_PRO_GENERIC_KEY}</span></div>
        <p class="generic__note">Sert uniquement à passer à l’édition Professionnel. Ce n’est pas votre clé de produit.</p>
      </div>
    </li>
    <li><h3>Terminez le changement d’édition et redémarrez</h3><p>Cliquez sur <b>Suivant</b> et confirmez le passage à Windows&nbsp;11 Professionnel. Laissez l’opération se terminer sans éteindre l’ordinateur. Windows redémarre, éventuellement plusieurs fois.</p></li>
    <li><h3>Reconnectez Internet et activez avec votre clé privée</h3><p>Retournez dans <span class="path">Paramètres <em>→</em> Système <em>→</em> Activation <em>→</em> Modifier la clé de produit</span>, saisissez votre clé achetée, puis <b>Suivant</b> et <b>Activer</b>. Vérifiez&nbsp;: <b>État d’activation&nbsp;: Actif</b>.</p></li>
  </ol>
  <div class="l-grid">
    <div class="panel">
      <h4>Dépannage</h4>
      <ul class="trouble">
        <li><b>Clé refusée&nbsp;:</b> vérifiez chaque caractère (confusions fréquentes&nbsp;: B/8, G/6). Les clés Windows ne contiennent ni O ni 0.</li>
        <li><b>Édition inchangée après l’étape&nbsp;4&nbsp;:</b> vérifiez qu’Internet est bien déconnecté, redémarrez, puis recommencez à l’étape&nbsp;2.</li>
        <li><b>Activation non aboutie&nbsp;:</b> vérifiez la connexion Internet et l’édition installée, puis utilisez <b>Résoudre les problèmes</b> sur la page Activation.</li>
      </ul>
    </div>
    <div class="panel help">
      <h4>Aide &amp; assistance</h4>
      ${help.join("\n      ")}
    </div>
  </div>
  <footer class="l-foot">
    <span>Microsoft, Windows et Windows&nbsp;11 sont des marques du groupe de sociétés Microsoft. Document de licence numérique fourni par ${provider}. Conservez-le avec votre clé de produit.</span>
    <span class="pg">${pageCount} / ${pageCount}</span>
  </footer>
</section>`;
}

export function buildWindowsLicenceHtml(input: WindowsLicenceDocumentInput): string {
  if (input.codes.length === 0) {
    throw new Error("A licence document needs at least one code");
  }
  const pageCount = input.codes.length + 1;
  const title = `Licence ${input.variant.label} — ${input.licenceNumber}`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
</head>
<body>${input.codes.map((code, index) => buildKeyPage(input, code, index, pageCount)).join("")}${buildNoticePage(input, pageCount)}
</body>
</html>`;
}
