import { slugify } from "@/lib/slug";

export type ProductOptionKind = "color" | "size" | "custom";

export type ProductOptionSelection = {
  kind?: ProductOptionKind | null;
  groupId?: string | null;
  valueId?: string | null;
  name: string;
  value: string;
  priceAdjustmentCents?: number | null;
};

export type ProductOptionValueConfig = {
  id: string;
  label: string;
  enabled: boolean;
  swatch?: string | null;
  priceAdjustmentCents?: number | null;
  position?: number | null;
};

export type ProductOptionGroupConfig = {
  id: string;
  name: string;
  values: ProductOptionValueConfig[];
};

export type ProductOptionConfig = {
  colors: ProductOptionValueConfig[];
  sizes: ProductOptionValueConfig[];
  options: ProductOptionGroupConfig[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

export function normalizeProductOptionValues(
  value: unknown,
  fallbackPrefix = "option",
): ProductOptionValueConfig[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<ProductOptionValueConfig[]>((entries, entry, index) => {
    if (!isRecord(entry)) return entries;
    const label =
      typeof entry.label === "string"
        ? entry.label
        : typeof entry.title === "string"
          ? entry.title
          : typeof entry.name === "string"
            ? entry.name
            : "";
    const trimmedLabel = label.trim();
    const rawId =
      typeof entry.id === "string"
        ? entry.id
        : typeof entry.value === "string"
          ? entry.value
          : "";
    const resolvedId =
      rawId.trim() || slugify(trimmedLabel || `${fallbackPrefix}-${index + 1}`);
    entries.push({
      id: resolvedId,
      label: trimmedLabel || resolvedId,
      enabled: entry.enabled !== false,
      swatch: typeof entry.swatch === "string" ? entry.swatch : null,
      priceAdjustmentCents:
        normalizeInteger(entry.priceAdjustmentCents) ??
        normalizeInteger(entry.priceAdjustment) ??
        null,
      position: normalizeInteger(entry.position),
    });
    return entries;
  }, []);
}

export function normalizeProductOptionGroups(
  value: unknown,
): ProductOptionGroupConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!isRecord(entry)) return null;
      const name =
        typeof entry.name === "string"
          ? entry.name
          : typeof entry.label === "string"
            ? entry.label
            : typeof entry.title === "string"
              ? entry.title
              : "";
      const trimmedName = name.trim();
      const rawId =
        typeof entry.id === "string"
          ? entry.id
          : typeof entry.key === "string"
            ? entry.key
            : "";
      const resolvedId =
        rawId.trim() || slugify(trimmedName || `option-${index + 1}`);
      const valuesSource = Array.isArray(entry.values)
        ? entry.values
        : Array.isArray(entry.options)
          ? entry.options
          : [];
      return {
        id: resolvedId,
        name: trimmedName || `Option ${index + 1}`,
        values: normalizeProductOptionValues(
          valuesSource,
          resolvedId || `option-${index + 1}`,
        ),
      } satisfies ProductOptionGroupConfig;
    })
    .filter((entry): entry is ProductOptionGroupConfig => Boolean(entry?.id));
}

export function normalizeProductOptionConfig(value: unknown): ProductOptionConfig {
  if (!isRecord(value)) {
    return { colors: [], sizes: [], options: [] };
  }
  return {
    colors: normalizeProductOptionValues(value.colors, "color"),
    sizes: normalizeProductOptionValues(value.sizes, "size"),
    options: normalizeProductOptionGroups(
      Array.isArray(value.options)
        ? value.options
        : Array.isArray(value.customOptions)
          ? value.customOptions
          : Array.isArray(value.custom)
            ? value.custom
            : [],
    ),
  };
}

function findByIdOrLabel(
  values: ProductOptionValueConfig[],
  selection: ProductOptionSelection,
) {
  const valueId = selection.valueId?.trim();
  if (valueId) {
    const byId = values.find((value) => value.id === valueId);
    if (byId) return byId;
  }
  const valueLabel = selection.value.trim().toLowerCase();
  if (!valueLabel) return null;
  return (
    values.find((value) => value.label.trim().toLowerCase() === valueLabel) ?? null
  );
}

export function resolveConfiguredOptionValue(
  optionConfig: unknown,
  selection: ProductOptionSelection,
): ProductOptionValueConfig | null {
  const normalized = normalizeProductOptionConfig(optionConfig);

  if (selection.kind === "color") {
    return findByIdOrLabel(normalized.colors, selection);
  }

  if (selection.kind === "size") {
    return findByIdOrLabel(normalized.sizes, selection);
  }

  const groupId = selection.groupId?.trim();
  const groups = groupId
    ? normalized.options.filter((group) => group.id === groupId)
    : normalized.options;

  for (const group of groups) {
    const resolved = findByIdOrLabel(group.values, selection);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export function resolveSelectedOptionAdjustments(
  optionConfig: unknown,
  selections: ProductOptionSelection[] | null | undefined,
) {
  if (!selections?.length) return [];
  return selections
    .map((selection) => {
      const configured = resolveConfiguredOptionValue(optionConfig, selection);
      const adjustment =
        configured?.priceAdjustmentCents ?? selection.priceAdjustmentCents ?? null;
      return {
        ...selection,
        priceAdjustmentCents: adjustment,
      };
    })
    .filter((selection) => selection.name.trim() && selection.value.trim());
}

export function calculateSelectedOptionAdjustmentCents(
  optionConfig: unknown,
  selections: ProductOptionSelection[] | null | undefined,
) {
  return resolveSelectedOptionAdjustments(optionConfig, selections).reduce(
    (sum, selection) => sum + (selection.priceAdjustmentCents ?? 0),
    0,
  );
}

export function formatSelectedOptionsSummary(
  selections: ProductOptionSelection[] | null | undefined,
) {
  if (!selections?.length) return null;
  const parts = selections
    .map((selection) => {
      const name = selection.name.trim();
      const value = selection.value.trim();
      if (!name || !value) return null;
      return `${name}: ${value}`;
    })
    .filter((entry): entry is string => Boolean(entry));
  return parts.length ? parts.join(", ") : null;
}
