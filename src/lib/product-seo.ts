export type ProductFaqItem = {
  question: string;
  answer: string;
};

function normalizeFaqText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeProductFaqItems(value: unknown): ProductFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const question = normalizeFaqText(record.question ?? record.title);
      const answer = normalizeFaqText(record.answer ?? record.description);

      if (!question || !answer) {
        return null;
      }

      return {
        question,
        answer,
      } satisfies ProductFaqItem;
    })
    .filter((entry): entry is ProductFaqItem => Boolean(entry));
}

export function buildProductImageAlt(options: {
  explicitAlt?: string | null;
  name?: string | null;
  category?: string | null;
  index?: number;
}) {
  const explicitAlt = options.explicitAlt?.trim();
  if (explicitAlt) {
    return explicitAlt;
  }

  const name = options.name?.trim();
  const category = options.category?.trim();
  const fallbackBase = name || category || "Produit";
  const index = options.index ?? 0;

  if (index <= 0) {
    return fallbackBase;
  }

  return `${fallbackBase} ${index + 1}`;
}
