export const DEFAULT_CLIENT_PAYMENT_METHODS = [
  "Espèces / Cash",
  "Chèque",
  "Virement bancaire",
  "Carte bancaire",
] as const;

type NormalizeClientPaymentMethodsOptions = {
  fallbackToDefaults?: boolean;
};

export function normalizeClientPaymentMethodLabel(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

export function normalizeClientPaymentMethods(
  value: unknown,
  options: NormalizeClientPaymentMethodsOptions = {},
) {
  const { fallbackToDefaults = true } = options;
  const source = Array.isArray(value) ? value : DEFAULT_CLIENT_PAYMENT_METHODS;
  const seen = new Set<string>();
  const methods: string[] = [];

  for (const entry of source) {
    const normalized = normalizeClientPaymentMethodLabel(entry);
    if (!normalized) {
      continue;
    }

    const dedupeKey = normalized.toLocaleLowerCase("fr");
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    methods.push(normalized);
  }

  if (methods.length > 0) {
    return methods;
  }

  if (!fallbackToDefaults) {
    return [];
  }

  return [...DEFAULT_CLIENT_PAYMENT_METHODS];
}
