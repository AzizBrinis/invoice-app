/**
 * Windows licence catalogue (perpetual retail-style product keys).
 *
 * Pure data, safe to import from client components. The SKU is the stable
 * identifier stored in the database, accepted by the licence API and selected
 * on the PrestaShop product; never rename an existing SKU (add a new one).
 */

export const WINDOWS_EDITIONS = ["pro"] as const;
export type WindowsEdition = (typeof WINDOWS_EDITIONS)[number];

export type WindowsVariant = {
  sku: string;
  family: "windows";
  edition: WindowsEdition;
  devices: 1;
  /** Perpetual licence. */
  durationMonths: null;
  /** e.g. "Windows 11 Professionnel | Licence perpétuelle | 1 PC" */
  label: string;
  shortLabel: string;
};

export type WindowsEditionDetails = {
  /** "Windows 11" */
  product: string;
  /** "Professionnel" */
  display: string;
  downloadUrl: string;
};

export const WINDOWS_EDITION_DETAILS: Readonly<Record<WindowsEdition, WindowsEditionDetails>> = Object.freeze({
  pro: {
    product: "Windows 11",
    display: "Professionnel",
    downloadUrl: "https://www.microsoft.com/fr-fr/software-download/windows11",
  },
});

export const WINDOWS_11_PRO_SKU = "windows-11-pro";

export const WINDOWS_VARIANTS: readonly WindowsVariant[] = Object.freeze([
  Object.freeze({
    sku: WINDOWS_11_PRO_SKU,
    family: "windows" as const,
    edition: "pro" as const,
    devices: 1 as const,
    durationMonths: null,
    label: "Windows 11 Professionnel | Licence perpétuelle | 1 PC",
    shortLabel: "Professionnel · 1 PC",
  }),
]);

const VARIANTS_BY_SKU = new Map(WINDOWS_VARIANTS.map((variant) => [variant.sku, variant]));

export function getWindowsVariant(sku: string | null | undefined): WindowsVariant | null {
  if (!sku) return null;
  return VARIANTS_BY_SKU.get(sku) ?? null;
}

export function isWindowsSku(sku: unknown): sku is string {
  return typeof sku === "string" && VARIANTS_BY_SKU.has(sku);
}
