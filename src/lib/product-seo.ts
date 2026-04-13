export {
  buildProductFaqStructuredData,
  normalizeProductFaqItems,
  parseBulkProductFaqInput,
  PRODUCT_FAQ_ANSWER_MAX_LENGTH,
  PRODUCT_FAQ_ANSWER_MIN_LENGTH,
  PRODUCT_FAQ_MAX_ITEMS,
  PRODUCT_FAQ_QUESTION_MAX_LENGTH,
  PRODUCT_FAQ_QUESTION_MIN_LENGTH,
  type ProductFaqItem,
} from "@/lib/product-faq";

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
