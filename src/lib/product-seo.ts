import { slugify } from "@/lib/slug";

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

const PRODUCT_IMAGE_FILENAME_PATTERN =
  /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i;
const PRODUCT_IMAGE_GENERIC_ALT_PATTERN =
  /^(?:image|img|photo|picture|gallery|cover|product)(?:[-_\s]?\d+)?$/i;

function isMeaningfulProductImageAlt(options: {
  explicitAlt?: string | null;
  name?: string | null;
  category?: string | null;
}) {
  const explicitAlt = options.explicitAlt?.trim();
  if (!explicitAlt) {
    return false;
  }

  const withoutExtension = explicitAlt.replace(PRODUCT_IMAGE_FILENAME_PATTERN, "").trim();
  if (!withoutExtension) {
    return false;
  }

  if (PRODUCT_IMAGE_GENERIC_ALT_PATTERN.test(withoutExtension)) {
    return false;
  }

  if (/^\d+$/.test(withoutExtension)) {
    return false;
  }

  if (!/\s/.test(withoutExtension) && /[-_]/.test(withoutExtension)) {
    return false;
  }

  const explicitSlug = slugify(withoutExtension);
  const nameSlug = slugify(options.name ?? "");
  const categorySlug = slugify(options.category ?? "");

  if (!explicitSlug) {
    return false;
  }

  if (explicitSlug === nameSlug || explicitSlug === categorySlug) {
    return false;
  }

  if (
    !/\s/.test(withoutExtension) &&
    explicitSlug.length >= 24 &&
    /^[a-z0-9._-]+$/i.test(withoutExtension)
  ) {
    return false;
  }

  return true;
}

export function buildProductImageAlt(options: {
  explicitAlt?: string | null;
  name?: string | null;
  category?: string | null;
  index?: number;
}) {
  const explicitAlt = options.explicitAlt?.trim();
  if (
    explicitAlt &&
    isMeaningfulProductImageAlt({
      explicitAlt,
      name: options.name,
      category: options.category,
    })
  ) {
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
