import { slugify } from "@/lib/slug";

const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  logiciel: "logiciels",
  logiciels: "logiciels",
  software: "logiciels",
};

const CATEGORY_CANONICAL_LABELS: Record<string, string> = {
  logiciels: "Logiciels",
};

function titleizeCategorySlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeCatalogCategorySlug(
  value?: string | null,
): string | null {
  const slug = slugify(value ?? "");
  if (!slug) {
    return null;
  }

  return CATEGORY_SLUG_ALIASES[slug] ?? slug;
}

export function resolveCatalogCategoryLabel(
  value?: string | null,
): string | null {
  const canonicalSlug = normalizeCatalogCategorySlug(value);
  if (!canonicalSlug) {
    return null;
  }

  return (
    CATEGORY_CANONICAL_LABELS[canonicalSlug] ??
    value?.trim() ??
    titleizeCategorySlug(canonicalSlug)
  );
}
