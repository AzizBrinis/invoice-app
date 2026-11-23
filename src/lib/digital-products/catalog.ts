/**
 * Registry of every digital product family sold with activation codes.
 *
 * Pure data, safe to import from client components. Inventory, allocation,
 * the licence API, PrestaShop fulfilment and the admin UI are all keyed by
 * SKU; this module tells them which family a SKU belongs to, which code format
 * it uses and where its admin section lives. Adding a product = one family
 * entry here + its catalogue + its PDF template.
 */

import {
  getKasperskyVariant,
  KASPERSKY_TIER_DETAILS,
  KASPERSKY_TIERS,
  KASPERSKY_VARIANTS,
  type KasperskyVariant,
} from "@/lib/digital-products/kaspersky-catalog";
import {
  getIdmVariant,
  IDM_PLAN_DETAILS,
  IDM_PLANS,
  IDM_VARIANTS,
  type IdmVariant,
} from "@/lib/digital-products/idm-catalog";
import {
  IDM_CODE_FORMAT,
  KASPERSKY_CODE_FORMAT,
  WINDOWS_CODE_FORMAT,
  type LicenceCodeFormat,
} from "@/lib/digital-products/licence-code-format";
import {
  getWindowsVariant,
  WINDOWS_EDITION_DETAILS,
  WINDOWS_EDITIONS,
  WINDOWS_VARIANTS,
  type WindowsVariant,
} from "@/lib/digital-products/windows-catalog";

export const DIGITAL_PRODUCT_FAMILY_IDS = ["kaspersky", "windows", "idm"] as const;
export type DigitalProductFamilyId = (typeof DIGITAL_PRODUCT_FAMILY_IDS)[number];

export type DigitalProductVariant = KasperskyVariant | WindowsVariant | IdmVariant;

/** Visual grouping of variants (Kaspersky tiers, Windows editions, IDM plans). */
export type VariantGroup = {
  key: string;
  label: string;
  /** Tailwind background class of the group dot. */
  accent: string;
};

export type DigitalProductFamily = {
  id: DigitalProductFamilyId;
  /** "Kaspersky", "Windows 11 Pro" */
  name: string;
  /** One-line summary for the overview card. */
  summary: string;
  basePath: string;
  codeFormat: LicenceCodeFormat;
  variants: readonly DigitalProductVariant[];
  groups: readonly VariantGroup[];
  /** Duration shown in the generation summary. */
  durationLabel: string;
  /** "Carte d’activation A4" / "Document de licence A4" */
  documentLabel: string;
  /** Pages rendered per code (for the generation hint). */
  documentHint: string;
};

const KASPERSKY_ACCENTS: Record<string, string> = {
  standard: "bg-teal-500",
  plus: "bg-emerald-500",
  premium: "bg-violet-600",
};

export const DIGITAL_PRODUCT_FAMILIES: Readonly<Record<DigitalProductFamilyId, DigitalProductFamily>> =
  Object.freeze({
    kaspersky: Object.freeze({
      id: "kaspersky" as const,
      name: "Kaspersky",
      summary: `Standard, Plus et Premium · 1 an · ${KASPERSKY_VARIANTS.length} variantes`,
      basePath: "/produits-digitaux/kaspersky",
      codeFormat: KASPERSKY_CODE_FORMAT,
      variants: KASPERSKY_VARIANTS,
      groups: KASPERSKY_TIERS.map((tier) => ({
        key: tier,
        label: `Kaspersky ${KASPERSKY_TIER_DETAILS[tier].display}`,
        accent: KASPERSKY_ACCENTS[tier],
      })),
      durationLabel: "1 an",
      documentLabel: "carte d’activation A4",
      documentHint: "Une page A4 par code.",
    }),
    windows: Object.freeze({
      id: "windows" as const,
      name: "Windows 11 Pro",
      summary: "Windows 11 Professionnel · licence perpétuelle · 1 PC",
      basePath: "/produits-digitaux/windows",
      codeFormat: WINDOWS_CODE_FORMAT,
      variants: WINDOWS_VARIANTS,
      groups: WINDOWS_EDITIONS.map((edition) => ({
        key: edition,
        label: `${WINDOWS_EDITION_DETAILS[edition].product} ${WINDOWS_EDITION_DETAILS[edition].display}`,
        accent: "bg-blue-600",
      })),
      durationLabel: "Perpétuelle",
      documentLabel: "document de licence A4",
      documentHint: "Une page A4 par clé, plus la notice de mise à niveau.",
    }),
    idm: Object.freeze({
      id: "idm" as const,
      name: "IDM",
      summary: "Internet Download Manager · 1 an ou à vie · 1 PC",
      basePath: "/produits-digitaux/idm",
      codeFormat: IDM_CODE_FORMAT,
      variants: IDM_VARIANTS,
      groups: IDM_PLANS.map((plan) => ({
        key: plan,
        label: `IDM · ${IDM_PLAN_DETAILS[plan].display}`,
        accent: plan === "lifetime" ? "bg-sky-700" : "bg-sky-400",
      })),
      durationLabel: "1 an ou à vie",
      documentLabel: "certificat de licence A4",
      documentHint: "Une page A4 par numéro de série.",
    }),
  });

export const ALL_DIGITAL_PRODUCT_VARIANTS: readonly DigitalProductVariant[] = Object.freeze([
  ...KASPERSKY_VARIANTS,
  ...WINDOWS_VARIANTS,
  ...IDM_VARIANTS,
]);

/** Every SKU accepted by the licence API, the PrestaShop endpoint and the UI. */
export const DIGITAL_PRODUCT_SKUS = ALL_DIGITAL_PRODUCT_VARIANTS.map((variant) => variant.sku) as [
  string,
  ...string[],
];

export function getDigitalProductVariant(sku: string | null | undefined): DigitalProductVariant | null {
  return getKasperskyVariant(sku) ?? getWindowsVariant(sku) ?? getIdmVariant(sku);
}

export function isDigitalProductSku(sku: unknown): sku is string {
  return typeof sku === "string" && getDigitalProductVariant(sku) !== null;
}

export function getDigitalProductFamily(id: DigitalProductFamilyId): DigitalProductFamily {
  return DIGITAL_PRODUCT_FAMILIES[id];
}

/** Family of a SKU, or null for an unknown SKU. */
export function familyOfSku(sku: string | null | undefined): DigitalProductFamily | null {
  const variant = getDigitalProductVariant(sku);
  return variant ? DIGITAL_PRODUCT_FAMILIES[variant.family] : null;
}

/** Code format of a SKU; unknown SKUs fall back to the historical format. */
export function codeFormatForSku(sku: string | null | undefined): LicenceCodeFormat {
  return familyOfSku(sku)?.codeFormat ?? KASPERSKY_CODE_FORMAT;
}

export function isFamilySku(family: DigitalProductFamily, sku: unknown): sku is string {
  return typeof sku === "string" && family.variants.some((variant) => variant.sku === sku);
}

/** Group key of a variant (Kaspersky tier / Windows edition / IDM plan). */
export function variantGroupKey(variant: DigitalProductVariant): string {
  switch (variant.family) {
    case "kaspersky":
      return variant.tier;
    case "windows":
      return variant.edition;
    case "idm":
      return variant.plan;
  }
}

/** Licence duration of a variant ("1 an", "Perpétuelle", "À vie"). */
export function variantDurationLabel(variant: DigitalProductVariant): string {
  return variant.family === "idm" ? variant.durationLabel : DIGITAL_PRODUCT_FAMILIES[variant.family].durationLabel;
}

export function variantGroup(variant: DigitalProductVariant): VariantGroup | null {
  const family = DIGITAL_PRODUCT_FAMILIES[variant.family];
  return family.groups.find((group) => group.key === variantGroupKey(variant)) ?? null;
}
