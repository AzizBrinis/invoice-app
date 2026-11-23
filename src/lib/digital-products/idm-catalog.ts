/**
 * Internet Download Manager (IDM) licence catalogue: one-PC serial numbers,
 * sold as a 1-year or a lifetime licence.
 *
 * Pure data, safe to import from client components. The SKU is the stable
 * identifier stored in the database, accepted by the licence API and selected
 * on the PrestaShop product; never rename an existing SKU (add a new one).
 */

export const IDM_PLANS = ["annual", "lifetime"] as const;
export type IdmPlan = (typeof IDM_PLANS)[number];

export type IdmVariant = {
  sku: string;
  family: "idm";
  plan: IdmPlan;
  devices: 1;
  /** 12 for the annual plan, null for the lifetime plan. */
  durationMonths: 12 | null;
  /** "1 an" / "À vie" */
  durationLabel: string;
  /** e.g. "Internet Download Manager | 1 an | 1 PC" */
  label: string;
  shortLabel: string;
};

export type IdmPlanDetails = {
  /** "1 an" / "À vie" */
  display: string;
  /** Pill on the certificate, e.g. "1 an · 1 PC". */
  badge: string;
  validityHeading: string;
  validityContent: string;
};

export const IDM_PRODUCT_NAME = "Internet Download Manager";
export const IDM_DOWNLOAD_URL = "https://www.internetdownloadmanager.com/download.html";
export const IDM_REGISTRATION_HELP_URL = "https://www.internetdownloadmanager.com/reghelp.html";
export const IDM_RETRIEVE_URL = "https://www.internetdownloadmanager.com/retrieve_registration.html";

export const IDM_PLAN_DETAILS: Readonly<Record<IdmPlan, IdmPlanDetails>> = Object.freeze({
  annual: {
    display: "1 an",
    badge: "1 an · 1 PC",
    validityHeading: "Validité · 1 an",
    validityContent:
      "La licence expire un an après l’achat. IDM cesse de fonctionner sans renouvellement.",
  },
  lifetime: {
    display: "À vie",
    badge: "À vie · 1 PC",
    validityHeading: "Validité · À vie",
    validityContent:
      "Droit d’utilisation permanent : la version acquise reste utilisable sans expiration.",
  },
});

export const IDM_ANNUAL_SKU = "idm-1p-1y";
export const IDM_LIFETIME_SKU = "idm-1p-lifetime";

export const IDM_VARIANTS: readonly IdmVariant[] = Object.freeze([
  Object.freeze({
    sku: IDM_ANNUAL_SKU,
    family: "idm" as const,
    plan: "annual" as const,
    devices: 1 as const,
    durationMonths: 12 as const,
    durationLabel: "1 an",
    label: "Internet Download Manager | 1 an | 1 PC",
    shortLabel: "1 an · 1 PC",
  }),
  Object.freeze({
    sku: IDM_LIFETIME_SKU,
    family: "idm" as const,
    plan: "lifetime" as const,
    devices: 1 as const,
    durationMonths: null,
    durationLabel: "À vie",
    label: "Internet Download Manager | À vie | 1 PC",
    shortLabel: "À vie · 1 PC",
  }),
]);

const VARIANTS_BY_SKU = new Map(IDM_VARIANTS.map((variant) => [variant.sku, variant]));

export function getIdmVariant(sku: string | null | undefined): IdmVariant | null {
  if (!sku) return null;
  return VARIANTS_BY_SKU.get(sku) ?? null;
}

export function isIdmSku(sku: unknown): sku is string {
  return typeof sku === "string" && VARIANTS_BY_SKU.has(sku);
}
