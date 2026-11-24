import {
  IDM_DOWNLOAD_URL,
  IDM_PLAN_DETAILS,
  IDM_PRODUCT_NAME,
  IDM_REGISTRATION_HELP_URL,
  IDM_RETRIEVE_URL,
  type IdmVariant,
} from "@/lib/digital-products/idm-catalog";
import { formatLicenceCode, IDM_CODE_FORMAT } from "@/lib/digital-products/licence-code-format";
import { TECHNO_SMART_LOGO_LIGHT_DATA_URI } from "@/server/digital-products/assets/techno-smart-logo";
import {
  escapeHtml,
  formatFrenchDate,
  websiteHref,
  websiteLabel,
  type LicenceSellerBranding,
} from "@/server/digital-products/kaspersky-licence-html";

/**
 * Server-side HTML for the Internet Download Manager licence certificate (A4,
 * French). Ported from the Techno Smart reference document
 * ("Techno_Smart_Certificat_IDM_Logo_Harmonise.html"): same dark hero with the
 * IDM globe mark, serial panel, validity terms, 4 activation steps, practical
 * notes, official links and help banner.
 *
 * Differences with the reference: no toolbar, input fields or script; the
 * serial number, plan, licence number and order details are printed, and the
 * seller contacts come from the company settings. One page per serial number.
 * Every dynamic value is HTML-escaped.
 */

export type IdmLicenceDocumentInput = {
  variant: IdmVariant;
  codes: string[];
  activationRegion?: string | null;
  /** YYYY-MM-DD */
  useBefore?: string | null;
  seller: LicenceSellerBranding;
};

const CSS = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #172644; }
  a { color: inherit; }
  .certificate {
    width: 210mm; height: 297mm; background: white; overflow: hidden; display: flex; flex-direction: column;
    position: relative; isolation: isolate; color: #172644; font-size: 9.5pt; line-height: 1.38;
    break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid;
  }
  .certificate:last-child { break-after: auto; page-break-after: auto; }
  .hero {
    position: relative; flex: 0 0 70mm; padding: 9.5mm 12.5mm 14mm; overflow: hidden; color: white;
    background: linear-gradient(128deg, #04102a 1%, #071d4a 35%, #123c93 74%, #195cc8 100%);
  }
  .hero-lines { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .5; pointer-events: none; }
  .hero::after { content: ""; position: absolute; inset: auto 0 0; height: 1.5mm; background: linear-gradient(90deg, #143ea3, #267ff4 70%, #65baf6); }
  .mast { position: relative; z-index: 3; display: flex; justify-content: space-between; align-items: center; min-height: 12mm; gap: 5mm; }
  .shop-brand { display: flex; align-items: center; max-width: 86mm; min-height: 10mm; }
  .brand-logo { display: block; width: 76mm; max-width: 100%; height: auto; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 7, 25, .18)); }
  .brand-text { font-size: 17pt; font-weight: 900; letter-spacing: -.01em; color: #fff; }
  .site { font-size: 8pt; letter-spacing: .035em; color: #c4daf9; text-decoration: none; }
  .hero-mid { position: relative; z-index: 2; display: flex; gap: 3mm; align-items: flex-start; margin-top: 1.8mm; }
  .hero-copy { width: 119mm; }
  .kicker { margin: 0 0 2.2mm; font-size: 8pt; letter-spacing: .21em; color: #7fc9fe; font-weight: 800; }
  .hero h1 { font-size: 22.5pt; font-weight: 900; line-height: 1.02; letter-spacing: -.036em; margin: 0; max-width: 111mm; }
  .hero h1 span { display: block; }
  .mark-disc { position: absolute; z-index: 2; width: 57mm; height: 57mm; right: 8mm; top: 13mm; filter: drop-shadow(0 6px 8px #000a27aa); }
  .key-panel {
    z-index: 3; position: relative; flex: 0 0 auto; margin: -10mm 12.5mm 0; background: #fff; border: 1.2px solid #cad7e7;
    border-top: 1.5mm solid #146bd8; box-shadow: 0 7px 22px #173a671d; padding: 5mm 7mm 4.5mm;
  }
  .key-head { display: flex; justify-content: space-between; gap: 10mm; align-items: center; }
  .label-upper { font-size: 8pt; letter-spacing: .17em; font-weight: 900; color: #174c98; }
  .plan-pill {
    display: inline-flex; align-items: center; white-space: nowrap; gap: 2mm; padding: 2.1mm 3.4mm; background: #e9f3ff;
    color: #1455ac; font-weight: 900; font-size: 9pt; border-radius: 4mm;
  }
  .plan-pill::before { content: ""; display: block; width: 1.9mm; height: 1.9mm; background: #087ae8; border-radius: 50%; }
  .key {
    font-family: Consolas, "Liberation Mono", "Courier New", monospace; font-weight: 800; font-size: 18.7pt; line-height: 1.18;
    letter-spacing: .026em; min-height: 8.3mm; margin: 3mm 0 2.3mm; overflow-wrap: anywhere; color: #092b66; white-space: pre-wrap;
    font-variant-ligatures: none;
  }
  .meta {
    display: flex; flex-wrap: wrap; column-gap: 5mm; row-gap: .8mm; border-top: 1px solid #e0e7f1; padding-top: 2.8mm;
    margin-top: 1mm; color: #65728a; font-size: 8pt;
  }
  .meta > span { max-width: 100%; min-width: 0; overflow-wrap: anywhere; }
  .meta b { color: #2c4567; }
  .paper-body { padding: 5mm 12.5mm 5mm; display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 3mm; }
  .welcome { font-size: 9.3pt; margin: 0; color: #485772; line-height: 1.5; }
  .welcome b { color: #183c76; }
  .terms { flex: none; display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #d9e5f4; background: #f6f9fd; border-radius: 1.7mm; overflow: hidden; }
  .term { padding: 3.4mm 4mm; }
  .term + .term { border-left: 1px solid #d9e5f4; }
  .term b { font-size: 8.7pt; color: #0c438f; display: block; margin-bottom: 1mm; }
  .term p { font-size: 8.4pt; line-height: 1.45; margin: 0; color: #4d5c73; }
  .section-name { display: flex; align-items: center; gap: 3mm; margin: 0 0 2mm; color: #0b2b62; font-size: 12pt; font-weight: 900; letter-spacing: -.024em; }
  .section-name::before { content: ""; height: 4.5mm; width: 1mm; display: block; background: #0d71d4; border-radius: 2px; }
  .steps { display: grid; gap: 0; }
  .step { display: grid; grid-template-columns: 10mm 1fr; column-gap: 3mm; border-bottom: 1px solid #e4ebf3; padding: 2.2mm 0; align-items: start; break-inside: avoid; }
  .step:last-child { border-bottom: 0; }
  .step-number {
    height: 7.2mm; width: 7.2mm; display: grid; place-items: center; font-weight: 900; font-size: 10pt; border-radius: 2mm;
    background: #135fc0; color: white; margin-top: .3mm;
  }
  .step h3 { display: inline; margin: 0 2.2mm 0 0; font-size: 9.5pt; color: #102e67; font-weight: 900; }
  .step p { display: inline; margin: 0; font-size: 8.8pt; line-height: 1.4; color: #485974; }
  .step a { color: #055bb4; text-decoration: underline; text-underline-offset: 1px; font-weight: 700; }
  .instructions, .practical, .resources { flex: none; }
  .practical, .resources { border-top: 1px solid #d9e3ef; padding-top: 2.8mm; }
  .facts { display: grid; grid-template-columns: 1fr 1fr; column-gap: 6mm; row-gap: 2.3mm; }
  .fact { display: flex; gap: 2.1mm; color: #465671; font-size: 8.35pt; line-height: 1.42; }
  .fact::before { content: ""; flex: none; margin-top: 1.45mm; width: 1.7mm; height: 1.7mm; border-radius: 50%; background: #1978d9; }
  .fact strong { color: #183b78; }
  .links { display: flex; gap: 3mm; flex-wrap: wrap; font-size: 8.3pt; font-weight: 800; color: #0e5bac; }
  .links a { white-space: nowrap; text-decoration: underline; text-underline-offset: 2px; }
  .links a + a:before { content: "·"; display: inline-block; margin-right: 3mm; color: #9eb2c9; text-decoration: none; }
  .recovery { font-size: 8pt; color: #64728a; margin: 1.7mm 0 0; line-height: 1.4; }
  .recovery strong { color: #344f74; }
  .bottom { margin-top: auto; padding-top: 1mm; }
  .help {
    background: linear-gradient(105deg, #071d4b, #0d3e93 76%, #145bc4); color: #fff; padding: 3.8mm 5mm; display: flex;
    align-items: center; justify-content: space-between; gap: 4mm; border-radius: 1.8mm;
  }
  .help-copy { font-size: 10pt; font-weight: 800; line-height: 1.3; }
  .help-copy span { display: block; font-size: 8pt; font-weight: 500; color: #c6dffc; margin-top: 1mm; }
  .contacts { text-align: right; font-size: 9pt; white-space: nowrap; }
  .contacts a { display: block; color: #fff; text-decoration: none; font-weight: 800; }
  .contacts a + a { font-size: 8pt; font-weight: 500; color: #acd4ff; margin-top: 1mm; }
  .legal { display: flex; justify-content: space-between; gap: 4mm; font-size: 7.2pt; color: #7d899d; margin: 2.5mm 1mm 0; line-height: 1.3; }
  .pg { font-variant-numeric: tabular-nums; letter-spacing: .08em; white-space: nowrap; }
  .footstripe { height: 1.2mm; flex: none; background: linear-gradient(90deg, #051632, #0f4295 62%, #28a3f1); }
  .certificate.compact .paper-body { gap: 2.5mm; }
  .certificate.compact .step { padding-top: 1.55mm; padding-bottom: 1.6mm; }
  .certificate.compact .facts { row-gap: 1.4mm; }
  .certificate.compact .key-panel { padding-top: 3.5mm; padding-bottom: 3mm; }
  .certificate.compact .hero { flex-basis: 72mm; }
`;

const HERO_LINES = `<svg class="hero-lines" viewBox="0 0 794 285" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="#b9d9ff" stroke-width=".75">
        <path d="M-60 -10 270 301M60 -50 425 305M180 -80 560 302M330 -30 695 325M510 -70 830 260M-50 160 250 -35M-40 291 435 -28M155 304 660 -20M395 322 815 -10M650 320 915 70"/>
        <path d="M-20 80 790 310M-30 275 780 15" stroke-opacity=".40"/>
      </g>
      <path d="M485 0 794 0 794 285 710 285" fill="#1f69dc" fill-opacity=".09"/>
    </svg>`;

/** IDM globe / ring / arrow mark. Gradient ids are prefixed per page (one document, several pages). */
function markSvg(prefix: string) {
  const id = (name: string) => `${prefix}-${name}`;
  return `<svg class="mark-disc" role="img" aria-label="Logo visuel Internet Download Manager" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${id("globeB")}" x1=".16" y1=".08" x2=".88" y2=".9"><stop offset="0" stop-color="#43d4ff"/><stop offset=".3" stop-color="#07aff4"/><stop offset=".7" stop-color="#1065ce"/><stop offset="1" stop-color="#052f92"/></linearGradient>
        <radialGradient id="${id("globeShine")}" cx="25%" cy="8%" r="98%"><stop offset="0" stop-color="#c5f6ff" stop-opacity=".87"/><stop offset=".31" stop-color="#a3efff" stop-opacity=".17"/><stop offset="1" stop-color="#0a358a" stop-opacity=".45"/></radialGradient>
        <linearGradient id="${id("redRing")}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff3a15"/><stop offset=".45" stop-color="#e91b21"/><stop offset="1" stop-color="#932d38"/></linearGradient>
        <linearGradient id="${id("yellowRing")}" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#ffe943"/><stop offset="1" stop-color="#f4a421"/></linearGradient>
        <linearGradient id="${id("greenRing")}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#62ec2b"/><stop offset="1" stop-color="#05a549"/></linearGradient>
        <linearGradient id="${id("blueRing")}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#31b1ff"/><stop offset="1" stop-color="#064a9c"/></linearGradient>
        <linearGradient id="${id("arrowFront")}" x1=".15" y1="0" x2=".85" y2=".95"><stop stop-color="#60ff37"/><stop offset=".45" stop-color="#24ca2a"/><stop offset="1" stop-color="#059b2b"/></linearGradient>
        <linearGradient id="${id("arrowSide")}" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#077c20"/><stop offset="1" stop-color="#003d15"/></linearGradient>
        <clipPath id="${id("sphereClip")}"><circle cx="305" cy="203" r="145"/></clipPath>
      </defs>
      <path d="M243 155C148 107 53 161 65 267c12 104 113 152 251 125" stroke="#073d85" stroke-width="48" fill="none" opacity=".67"/>
      <path d="M245 148C125 109 56 175 73 258c20 110 136 152 253 106" stroke="url(#${id("blueRing")})" stroke-width="37" fill="none"/>
      <path d="M250 137C132 111 63 175 91 251c30 82 114 116 239 82" stroke="url(#${id("greenRing")})" stroke-width="30" fill="none"/>
      <path d="M254 126C139 118 92 181 116 236c26 63 107 89 219 62" stroke="url(#${id("yellowRing")})" stroke-width="24" fill="none"/>
      <path d="M270 117C158 112 126 185 144 224c23 47 96 65 187 45" stroke="url(#${id("redRing")})" stroke-width="22" fill="none"/>
      <circle cx="305" cy="203" r="145" fill="url(#${id("globeB")})"/>
      <g clip-path="url(#${id("sphereClip")})">
        <path d="M222 63c44-12 84-3 94 26 7 19-18 23-7 42 14 25 49 17 58 45 9 28-17 39-41 29-19-7-29-3-42 15-20 31-57 40-82 18-24-20-19-52-44-58-30-8-45-29-27-60 17-27 51-46 91-57Z" fill="#abecff" opacity=".74"/>
        <path d="M261 213c21-16 49-22 64-9 13 13 28 10 47-1 28-18 66-9 92 15l-5 85-66 78-124-9-36-84Z" fill="#0051a7" opacity=".25"/>
        <path d="M184 319c53-42 119-15 154-39 27-19 54-8 92 2l6 62-72 51-154-36Z" fill="#60c8ff" opacity=".35"/>
        <circle cx="305" cy="203" r="145" fill="url(#${id("globeShine")})"/>
      </g>
      <path d="M226 272 257 455 306 392 459 316Z" fill="url(#${id("arrowSide")})"/>
      <path d="M226 272 463 309 306 366Z" fill="url(#${id("arrowFront")})"/>
      <path d="M226 272 306 366 257 455Z" fill="#075e1a"/>
      <path d="M306 366 463 309 257 455Z" fill="#169027"/>
      <path d="M226 272 463 309 306 366Z" fill="#9cff65" opacity=".12"/>
    </svg>`;
}

function isTechnoSmart(seller: LicenceSellerBranding) {
  return seller.name.trim().toLowerCase().replace(/[\s_-]+/g, " ") === "techno smart";
}

function brandMark(seller: LicenceSellerBranding) {
  return isTechnoSmart(seller)
    ? `<img class="brand-logo" src="${TECHNO_SMART_LOGO_LIGHT_DATA_URI}" alt="${escapeHtml(seller.name)}" width="760" height="88">`
    : `<span class="brand-text">${escapeHtml(seller.name)}</span>`;
}

function buildMeta(input: IdmLicenceDocumentInput, index: number) {
  const items: Array<[string, string]> = [["Produit :", IDM_PRODUCT_NAME]];
  if (input.codes.length > 1) items.push(["Numéro :", `${index + 1} / ${input.codes.length}`]);
  if (input.activationRegion) items.push(["Zone d’activation :", input.activationRegion]);
  const date = formatFrenchDate(input.useBefore);
  if (date) items.push(["À activer avant le", date]);
  return items.map(([label, value]) => `<span><b>${escapeHtml(label)}</b> ${escapeHtml(value)}</span>`).join("");
}

function buildHelp(seller: LicenceSellerBranding) {
  const contacts: string[] = [];
  if (seller.email) {
    contacts.push(`<a href="mailto:${escapeHtml(seller.email)}">${escapeHtml(seller.email)}</a>`);
  }
  if (seller.phone) {
    contacts.push(`<a href="tel:${escapeHtml(seller.phone.replace(/[^+\d]/g, ""))}">${escapeHtml(seller.phone)}</a>`);
  }
  if (seller.website) {
    contacts.push(`<a href="${escapeHtml(websiteHref(seller.website))}">${escapeHtml(websiteLabel(seller.website))} ↗</a>`);
  }
  return contacts.join("");
}

function buildPage(input: IdmLicenceDocumentInput, code: string, index: number) {
  const { seller } = input;
  const plan = IDM_PLAN_DETAILS[input.variant.plan];
  const compact =
    Boolean(input.activationRegion && input.useBefore);
  const site = seller.website
    ? `<a class="site" href="${escapeHtml(websiteHref(seller.website))}">${escapeHtml(websiteLabel(seller.website))}</a>`
    : "";
  return `
<main class="certificate${compact ? " compact" : ""}" aria-label="Certificat de licence ${escapeHtml(input.variant.label)}">
  <header class="hero">
    ${HERO_LINES}
    <div class="mast">
      <div class="shop-brand">${brandMark(seller)}</div>
      ${site}
    </div>
    <div class="hero-mid">
      <div class="hero-copy">
        <p class="kicker">VOTRE CERTIFICAT NUMÉRIQUE</p>
        <h1>Votre licence <span>Internet Download</span><span>Manager</span></h1>
      </div>
    </div>
    ${markSvg(`idm${index}`)}
  </header>
  <section class="key-panel" aria-label="Informations de licence">
    <div class="key-head">
      <span class="label-upper">VOTRE NUMÉRO DE SÉRIE</span><span class="plan-pill">${escapeHtml(plan.badge)}</span>
    </div>
    <div class="key">${escapeHtml(formatLicenceCode(code, IDM_CODE_FORMAT))}</div>
    <div class="meta">${buildMeta(input, index)}</div>
  </section>
  <div class="paper-body">
    <p class="welcome"><b>Bienvenue chez ${escapeHtml(seller.name)} !</b> Conservez précieusement ce certificat : il contient votre numéro de série et les instructions pour activer IDM.</p>
    <section class="terms" aria-label="Conditions de licence">
      <div class="term"><b>${escapeHtml(plan.validityHeading)}</b><p>${escapeHtml(plan.validityContent)}</p></div>
      <div class="term"><b>Téléchargement Rapide</b><p>Téléchargez plus rapidement et de manière plus fiable</p></div>
    </section>
    <section class="instructions">
      <h2 class="section-name">Activer IDM en 4 étapes</h2>
      <div class="steps">
        <div class="step"><span class="step-number">1</span><div><h3>Télécharger</h3><p>Obtenez la dernière version originale depuis <a href="${IDM_DOWNLOAD_URL}">le site officiel d’IDM</a>.</p></div></div>
        <div class="step"><span class="step-number">2</span><div><h3>Installer</h3><p>Ouvrez le programme téléchargé et suivez l’assistant d’installation.</p></div></div>
        <div class="step"><span class="step-number">3</span><div><h3>Activer</h3><p>Connectez-vous à Internet. Dans IDM, ouvrez « Registration → Registration » (ou son équivalent traduit), saisissez vos informations, collez votre numéro de série, puis validez.</p></div></div>
        <div class="step"><span class="step-number">4</span><div><h3>Vérifier</h3><p>Dans « Help → About » (ou l’équivalent traduit), vérifiez la mention « Full » et votre nom d’enregistrement.</p></div></div>
      </div>
    </section>
    <section class="practical">
      <h2 class="section-name">À retenir</h2>
      <div class="facts">
        <div class="fact"><span><strong>Version officielle et connexion Internet.</strong> Désinstallez toute copie modifiée ou piratée avant l’activation.</span></div>
        <div class="fact"><span><strong>Copiez-collez le code</strong> (attention à 0/O et 1/I). Activez-le rapidement et gardez-le confidentiel.</span></div>
        <div class="fact"><span><strong>Un seul PC à la fois.</strong> L’utilisation simultanée sur plusieurs appareils peut entraîner le blocage du code.</span></div>
        <div class="fact"><span><strong>Réinstallation possible sur le même PC.</strong> Pour un transfert, désinstallez IDM de l’ancien ordinateur.</span></div>
      </div>
    </section>
    <section class="resources">
      <h2 class="section-name">Liens officiels utiles</h2>
      <nav class="links" aria-label="Liens IDM">
        <a href="${IDM_DOWNLOAD_URL}">Télécharger IDM ↗</a><a href="${IDM_REGISTRATION_HELP_URL}">Aide à l’activation ↗</a><a href="${IDM_RETRIEVE_URL}">Retrouver son code ↗</a>
      </nav>
      <p class="recovery"><strong>Code perdu ?</strong> La récupération officielle nécessite l’adresse e-mail de l’achat initial. En cas d’achat via un revendeur, contactez ${escapeHtml(seller.name)} si nécessaire.</p>
    </section>
    <div class="bottom">
      <section class="help">
        <div class="help-copy">Besoin d’aide ?<span>Notre équipe est à votre disposition.</span></div>
        <div class="contacts">${buildHelp(seller)}</div>
      </section>
      <p class="legal"><span>Document d’accompagnement de ${escapeHtml(seller.name)}.</span><span class="pg">${index + 1} / ${input.codes.length}</span></p>
    </div>
  </div>
  <div class="footstripe"></div>
</main>`;
}

export function buildIdmLicenceHtml(input: IdmLicenceDocumentInput): string {
  if (input.codes.length === 0) {
    throw new Error("A licence document needs at least one code");
  }
  const title = `Licence ${input.variant.label}`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; object-src 'none'">
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
</head>
<body>${input.codes.map((code, index) => buildPage(input, code, index)).join("")}
</body>
</html>`;
}
