/**
 * Kaspersky licence catalogue (1-year subscriptions).
 *
 * Pure data, safe to import from client components. The SKU is the stable
 * identifier stored in the database and accepted by the licence API; never
 * rename an existing SKU (add a new one instead).
 */

// Product families (Kaspersky, Windows…) are registered in ./catalog.ts.

export const KASPERSKY_TIERS = ["standard", "plus", "premium"] as const;
export type KasperskyTier = (typeof KASPERSKY_TIERS)[number];

export type KasperskyVariant = {
  sku: string;
  family: "kaspersky";
  tier: KasperskyTier;
  devices: number;
  durationMonths: 12;
  /** e.g. "Kaspersky Plus | 1 an | 3 Postes" */
  label: string;
  shortLabel: string;
};

export type KasperskyTierDetails = {
  display: string;
  tagline: string;
  downloadUrl: string;
  benefits: readonly string[];
};

export const KASPERSKY_TIER_DETAILS: Readonly<Record<KasperskyTier, KasperskyTierDetails>> =
  Object.freeze({
    standard: {
      display: "Standard",
      tagline: "Une protection essentielle, rapide et légère pour vos appareils.",
      downloadUrl: "https://www.kaspersky.com/downloads/standard",
      benefits: [
        "Antivirus en temps réel",
        "Navigation sécurisée",
        "Protection des paiements",
        "Pare-feu intelligent",
        "Optimisation des performances",
      ],
    },
    plus: {
      display: "Plus",
      tagline: "Sécurité, confidentialité et performances au quotidien.",
      downloadUrl: "https://www.kaspersky.com/downloads/plus",
      benefits: [
        "Antivirus optimisé par l’IA",
        "Navigation sécurisée",
        "Protection de la vie privée",
        "VPN intégré",
        "Optimisation des performances",
      ],
    },
    premium: {
      display: "Premium",
      tagline: "Une sécurité avancée pour votre identité et vos données.",
      downloadUrl: "https://www.kaspersky.com/downloads/premium",
      benefits: [
        "Antivirus optimisé par l’IA",
        "Navigation sécurisée",
        "Protection de l’identité",
        "VPN intégré",
        "Assistance premium",
      ],
    },
  });

const VARIANT_MATRIX: ReadonlyArray<readonly [KasperskyTier, number]> = [
  ["standard", 1],
  ["standard", 3],
  ["plus", 1],
  ["plus", 3],
  ["plus", 5],
  ["plus", 10],
  ["premium", 3],
  ["premium", 5],
];

function buildVariant(tier: KasperskyTier, devices: number): KasperskyVariant {
  const display = KASPERSKY_TIER_DETAILS[tier].display;
  const postes = `${devices} Poste${devices > 1 ? "s" : ""}`;
  return Object.freeze({
    sku: `kaspersky-${tier}-${devices}p-1y`,
    family: "kaspersky" as const,
    tier,
    devices,
    durationMonths: 12 as const,
    label: `Kaspersky ${display} | 1 an | ${postes}`,
    shortLabel: `${display} · ${postes}`,
  });
}

export const KASPERSKY_VARIANTS: readonly KasperskyVariant[] = Object.freeze(
  VARIANT_MATRIX.map(([tier, devices]) => buildVariant(tier, devices)),
);

const VARIANTS_BY_SKU = new Map(KASPERSKY_VARIANTS.map((variant) => [variant.sku, variant]));

export function getKasperskyVariant(sku: string | null | undefined): KasperskyVariant | null {
  if (!sku) return null;
  return VARIANTS_BY_SKU.get(sku) ?? null;
}

export function isKasperskySku(sku: unknown): sku is string {
  return typeof sku === "string" && VARIANTS_BY_SKU.has(sku);
}

export const KASPERSKY_SKUS = KASPERSKY_VARIANTS.map((variant) => variant.sku) as [
  string,
  ...string[],
];

export function deviceLabel(count: number) {
  return `${count} appareil${count > 1 ? "s" : ""}`;
}

// ---------------------------------------------------------------------------
// Statuses (shared by UI and server)
// ---------------------------------------------------------------------------

export const LICENCE_CODE_STATUSES = ["AVAILABLE", "RESERVED", "USED", "REVOKED"] as const;
export type LicenceCodeStatus = (typeof LICENCE_CODE_STATUSES)[number];

export const LICENCE_CODE_STATUS_LABELS: Record<LicenceCodeStatus, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Réservé",
  USED: "Utilisé",
  REVOKED: "Retiré",
};

export const LICENCE_ORDER_STATUSES = ["PENDING", "GENERATED", "DELIVERED", "CANCELLED"] as const;
export type LicenceOrderStatus = (typeof LICENCE_ORDER_STATUSES)[number];

export const LICENCE_ORDER_STATUS_LABELS: Record<LicenceOrderStatus, string> = {
  PENDING: "En attente du PDF",
  GENERATED: "PDF généré",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export const LICENCE_ORDER_SOURCES = ["MANUAL", "API", "PRESTASHOP"] as const;
export type LicenceOrderSource = (typeof LICENCE_ORDER_SOURCES)[number];

export const LICENCE_ORDER_SOURCE_LABELS: Record<LicenceOrderSource, string> = {
  MANUAL: "Manuelle",
  API: "API",
  PRESTASHOP: "PrestaShop",
};

/** Maximum number of codes per licence document (DB check allows 100). */
export const MAX_LICENCE_QUANTITY = 50;
