import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants as fsConstants } from "node:fs";
import {
  AccountType,
  Prisma,
  PrismaClient,
  ProductSaleMode,
} from "@/lib/db/prisma-server";
import { sanitizeProductHtml } from "@/lib/product-html";
import { slugify } from "@/lib/slug";
import { resolveScriptDatabaseUrl } from "../src/lib/db/runtime-config";
import {
  ingestManagedProductImages,
  type ManagedProductImageIngestionResult,
} from "../src/server/product-media-storage";
import {
  enrichImportedProductContent,
  type ProductImportEnrichmentInput,
  type ProductImportEnrichmentResult,
} from "../src/server/product-import-ai";
import { productSchema, type ProductInput } from "../src/server/products";

const TARGET_EMAIL =
  process.env.TECHNO_SMART_TARGET_EMAIL?.trim().toLowerCase() ||
  "brinisaziz@gmail.com";
const TARGET_DOMAIN =
  process.env.TECHNO_SMART_TARGET_DOMAIN?.trim().toLowerCase() ||
  "techno-smart.net";
const OUTPUT_DIRECTORY = path.join(
  process.cwd(),
  "tmp",
  "imports",
  "techno-smart",
);
const SOURCE_MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, "source-manifest.json");
const DRY_RUN_REPORT_JSON_PATH = path.join(OUTPUT_DIRECTORY, "dry-run-report.json");
const IMPORT_REPORT_JSON_PATH = path.join(OUTPUT_DIRECTORY, "import-report.json");
const IMPORT_REPORT_MD_PATH = path.join(OUTPUT_DIRECTORY, "import-report.md");
const IMPORT_APPLICATION_NAME = "invoices-app:techno-smart-import";
const PRODUCT_TEMPLATE_KEY = "ecommerce-ciseco-home";
const RELATED_PRODUCT_SIMILARITY_THRESHOLD = 0.7;
const SHORT_DESCRIPTION_HTML_MAX_LENGTH = 600;
const EXCERPT_MAX_LENGTH = 280;
const PUBLIC_SLUG_MAX_LENGTH = 80;
const RELATED_NAME_GENERIC_TOKENS = new Set([
  "1",
  "2",
  "3",
  "abonnement",
  "adobe",
  "pc",
  "pcs",
  "an",
  "ans",
  "app",
  "apps",
  "autodesk",
  "cloud",
  "creative",
  "edition",
  "kaspersky",
  "license",
  "licence",
  "logiciel",
  "logiciels",
  "microsoft",
  "numerique",
  "office",
  "pack",
  "plan",
  "plus",
  "premium",
  "pro",
  "professional",
  "security",
  "server",
  "software",
  "standard",
  "suite",
  "telechargement",
  "total",
  "ultimate",
  "version",
  "windows",
]);
const APPLY_MODE =
  process.argv.includes("--apply") ||
  process.env.TECHNO_SMART_IMPORT_APPLY === "1";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveScriptDatabaseUrl(process.env, {
        applicationName: IMPORT_APPLICATION_NAME,
      }),
    },
  },
});

type SourceManifestProduct = {
  sourceUrl: string;
  canonicalUrl: string | null;
  sourceFingerprint: string;
  meta: {
    title: string | null;
    description: string | null;
    brand: string | null;
  };
  product: {
    idProduct: number | null;
    name: string | null;
    linkRewrite: string | null;
    category: {
      slug: string | null;
      name: string | null;
    };
    quantity: number | null;
    availability: string | null;
    prices: {
      priceAmount: number | null;
      priceTaxExcAmount: number | null;
      priceWithoutReductionAmount: number | null;
      reductionAmount: number | null;
      hasDiscount: boolean;
      specificPrices: unknown;
    };
    descriptions: {
      shortHtml: string | null;
      shortText: string | null;
      fullHtml: string | null;
      fullText: string | null;
    };
    imageUrls: {
      cover: string | null;
      gallery: string[];
    };
    optionSelectors: Array<{
      groupId: string | null;
      name: string | null;
      inputType: "select" | "radio" | "checkbox";
      values: Array<{
        id: string | null;
        label: string;
        selected: boolean;
      }>;
    }>;
    selectedAttributes?: Array<{
      attributeId?: string | null;
      attributeGroupId?: string | null;
      group?: string | null;
      name?: string | null;
    }>;
  };
};

type SourceManifestSkipped = {
  sourceUrl: string;
  reason: string;
  message: string;
  canonicalUrl: string | null;
  bodyId: string | null;
  pageTitle: string | null;
  hasDataProduct: boolean;
};

type SourceManifest = {
  generatedAt: string;
  summary: {
    sitemapUrlCount: number;
    validProductCount: number;
    skippedCount: number;
  };
  products: SourceManifestProduct[];
  skipped: SourceManifestSkipped[];
};

type DryRunCreateEntry = {
  sourceFingerprint: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  candidateSku: string | null;
  candidatePublicSlug: string | null;
  name: string | null;
  category: string | null;
  brand: string | null;
  note: string;
};

type DryRunReport = {
  generatedAt: string;
  target: {
    email: string;
    userId: string;
    accountType: AccountType | null;
    website: {
      id: string;
      userId: string;
      slug: string;
      customDomain: string | null;
      templateKey: string;
      domainStatus: string | null;
    };
  };
  summary: {
    sourceProductCount: number;
    createCount: number;
    skipExistingCount: number;
    manualReviewCount: number;
    invalidSourceCount: number;
  };
  create: DryRunCreateEntry[];
};

type ExistingProductCandidate = {
  id: string;
  sku: string;
  publicSlug: string;
  name: string;
  category: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

type ReportProductSummary = {
  id: string;
  sku: string;
  publicSlug: string;
  name: string;
  category: string | null;
};

type ImportBaseEntry = {
  sourceFingerprint: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  candidateSku: string | null;
  candidatePublicSlug: string | null;
  name: string | null;
  category: string | null;
  brand: string | null;
  note: string;
};

type ImportReadyEntry = ImportBaseEntry & {
  expectedAction: "create" | "update";
  matchRule: "new" | "exact_sku" | "exact_public_slug";
  matchedProduct: ReportProductSummary | null;
  enrichmentMode: "ai" | "fallback";
  enrichmentNote: string;
};

type ImportWriteEntry = ImportBaseEntry & {
  action: "created" | "updated";
  matchRule: "new" | "exact_sku" | "exact_public_slug";
  matchedProduct: ReportProductSummary;
  managedAssetCount: number;
  enrichmentMode: "ai" | "fallback";
  enrichmentNote: string;
};

type ImportSkipExistingEntry = ImportBaseEntry & {
  matchRule:
    | "exact_normalized_name"
    | "exact_normalized_name_with_signal";
  matchedProduct: ReportProductSummary;
};

type ImportManualReviewEntry = ImportBaseEntry & {
  reason:
    | "missing_required_source_fields"
    | "unsafe_variant_mapping"
    | "ambiguous_exact_sku"
    | "ambiguous_exact_public_slug"
    | "public_slug_conflict"
    | "ambiguous_exact_name"
    | "ambiguous_related_existing_products";
  relatedProducts: ReportProductSummary[];
};

type ImportFailedEntry = ImportBaseEntry & {
  stage: "resolve_source" | "map_product" | "ingest_images" | "db_write";
  error: string;
};

type ImportReport = {
  generatedAt: string;
  applyMode: boolean;
  source: {
    manifestPath: string;
    dryRunReportPath: string;
    dryRunGeneratedAt: string;
  };
  target: {
    email: string;
    userId: string;
    accountType: AccountType | null;
    website: {
      id: string;
      userId: string;
      slug: string;
      customDomain: string | null;
      templateKey: string;
      domainStatus: string | null;
    };
  };
  summary: {
    dryRunCreateCount: number;
    readyCount: number;
    createdCount: number;
    updatedCount: number;
    aiAppliedCount: number;
    aiFallbackCount: number;
    skipExistingCount: number;
    manualReviewCount: number;
    failedCount: number;
  };
  ready: ImportReadyEntry[];
  created: ImportWriteEntry[];
  updated: ImportWriteEntry[];
  skipped_existing: ImportSkipExistingEntry[];
  manual_review: ImportManualReviewEntry[];
  failed: ImportFailedEntry[];
};

type ImportDecision =
  | {
      kind: "create";
      note: string;
    }
  | {
      kind: "update";
      matchRule: "exact_sku" | "exact_public_slug";
      matchedProduct: ExistingProductCandidate;
      note: string;
    }
  | {
      kind: "skip_existing";
      matchRule:
        | "exact_normalized_name"
        | "exact_normalized_name_with_signal";
      matchedProduct: ExistingProductCandidate;
      note: string;
    }
  | {
      kind: "manual_review";
      reason: ImportManualReviewEntry["reason"];
      relatedProducts: ExistingProductCandidate[];
      note: string;
    };

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const DIACRITIC_REGEX = /[\u0300-\u036f]/g;
const NON_WORD_REGEX = /[^a-z0-9@\s]/gi;
const MULTI_SPACE_REGEX = /\s+/g;

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeText(value?: string | null) {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(DIACRITIC_REGEX, "")
    .replace(NON_WORD_REGEX, " ")
    .trim()
    .replace(MULTI_SPACE_REGEX, " ")
    .toLowerCase();
}

function normalizeCategorySignal(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  if (/\b(logiciel|logiciels|software|softwares)\b/.test(normalized)) {
    return "software";
  }
  if (/\b(electronique|electronic|electronics)\b/.test(normalized)) {
    return "electronics";
  }
  if (/\bapple\b/.test(normalized)) {
    return "apple";
  }
  if (/\b(pc|ordinateur|computer)\b/.test(normalized)) {
    return "pc";
  }
  return normalized;
}

function tokenizeNormalized(value?: string | null) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 2),
  );
}

function tokenizeMeaningfulProductName(value?: string | null) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .map((entry) => entry.trim())
      .filter(
        (entry) =>
          entry.length >= 3 &&
          !RELATED_NAME_GENERIC_TOKENS.has(entry) &&
          !/^\d+$/.test(entry),
      ),
  );
}

function overlapSimilarity(left: string, right: string) {
  const leftTokens = tokenizeNormalized(left);
  const rightTokens = tokenizeNormalized(right);
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function safeIncludes(haystack: string, needle: string) {
  return Boolean(needle) && Boolean(haystack) && haystack.includes(needle);
}

function hasMeaningfulNameTokenOverlap(
  left: Set<string>,
  right: Set<string>,
) {
  if (!left.size || !right.size) {
    return false;
  }

  for (const token of left) {
    if (right.has(token)) {
      return true;
    }
  }

  return false;
}

function buildCandidateSku(source: SourceManifestProduct) {
  if (source.product.idProduct == null) {
    return null;
  }
  return `TS-PS-${source.product.idProduct}`;
}

function hasMultipleChoiceSelectors(source: SourceManifestProduct) {
  return source.product.optionSelectors.some(
    (selector) => selector.values.length > 1,
  );
}

function listSelectedVariantLabels(source: SourceManifestProduct) {
  const labels = new Set<string>();

  source.product.selectedAttributes?.forEach((attribute) => {
    const label = cleanText(attribute.name);
    if (label) {
      labels.add(label);
    }
  });

  source.product.optionSelectors.forEach((selector) => {
    const selectedValues = selector.values.filter((value) => value.selected);
    if (selectedValues.length !== 1) {
      return;
    }
    const label = cleanText(selectedValues[0]?.label);
    if (label) {
      labels.add(label);
    }
  });

  return Array.from(labels);
}

function buildSourceDisplayName(source: SourceManifestProduct) {
  const baseName = cleanText(source.product.name);
  if (!baseName) {
    return null;
  }
  if (!hasMultipleChoiceSelectors(source)) {
    return baseName;
  }

  const normalizedBaseName = normalizeText(baseName);
  const missingLabels = listSelectedVariantLabels(source).filter((label) => {
    const normalizedLabel = normalizeText(label);
    return (
      normalizedLabel.length > 0 &&
      !safeIncludes(normalizedBaseName, normalizedLabel)
    );
  });

  if (!missingLabels.length) {
    return baseName;
  }

  return `${baseName} - ${missingLabels.join(" - ")}`;
}

function buildCandidatePublicSlug(source: SourceManifestProduct) {
  const slugSeedParts = [
    cleanText(source.product.linkRewrite),
    ...(hasMultipleChoiceSelectors(source) ? listSelectedVariantLabels(source) : []),
  ].filter((value): value is string => Boolean(value));
  const normalized = slugify(slugSeedParts.join(" "));
  if (!normalized) {
    return null;
  }
  if (normalized.length <= PUBLIC_SLUG_MAX_LENGTH) {
    return normalized;
  }

  const segments = normalized.split("-").filter((segment) => segment.length > 0);
  let candidate = "";
  for (const segment of segments) {
    const next = candidate ? `${candidate}-${segment}` : segment;
    if (next.length > PUBLIC_SLUG_MAX_LENGTH) {
      break;
    }
    candidate = next;
  }

  const trimmedCandidate = candidate || normalized.slice(0, PUBLIC_SLUG_MAX_LENGTH);
  return trimmedCandidate.replace(/-+$/g, "") || null;
}

function buildReportBase(source: SourceManifestProduct): ImportBaseEntry {
  return {
    sourceFingerprint: source.sourceFingerprint,
    sourceUrl: source.sourceUrl,
    canonicalUrl: source.canonicalUrl,
    candidateSku: buildCandidateSku(source),
    candidatePublicSlug: buildCandidatePublicSlug(source),
    name: buildSourceDisplayName(source),
    category:
      cleanText(source.product.category.name) ??
      cleanText(source.product.category.slug),
    brand: cleanText(source.meta.brand),
    note: "",
  };
}

function toProductSummary(product: ExistingProductCandidate): ReportProductSummary {
  return {
    id: product.id,
    sku: product.sku,
    publicSlug: product.publicSlug,
    name: product.name,
    category: product.category,
  };
}

function hasBrandSignal(
  sourceBrand: string | null,
  product: ExistingProductCandidate,
) {
  const normalizedBrand = normalizeText(sourceBrand);
  if (!normalizedBrand) {
    return false;
  }
  const searchable = normalizeText(
    [product.name, product.metaTitle, product.metaDescription, product.description]
      .filter(Boolean)
      .join(" "),
  );
  return safeIncludes(searchable, normalizedBrand);
}

function hasCategorySignal(
  sourceCategory: string | null,
  productCategory: string | null,
) {
  const sourceSignal = normalizeCategorySignal(sourceCategory);
  const productSignal = normalizeCategorySignal(productCategory);
  if (!sourceSignal || !productSignal) {
    return false;
  }
  return sourceSignal === productSignal;
}

function hasCategoryOrBrandSignal(
  source: SourceManifestProduct,
  product: ExistingProductCandidate,
) {
  return (
    hasCategorySignal(source.product.category.name, product.category) ||
    hasCategorySignal(source.product.category.slug, product.category) ||
    hasBrandSignal(source.meta.brand, product)
  );
}

function requiresVariantManualReview(source: SourceManifestProduct) {
  if (!hasMultipleChoiceSelectors(source)) {
    return false;
  }

  const hasMissingSelections = source.product.optionSelectors
    .filter((selector) => selector.values.length > 1)
    .some(
      (selector) =>
        selector.values.filter((value) => value.selected).length !== 1,
    );

  return hasMissingSelections || listSelectedVariantLabels(source).length === 0;
}

function findRelatedExistingProducts(
  source: SourceManifestProduct,
  products: ExistingProductCandidate[],
) {
  const sourceName = buildSourceDisplayName(source);
  if (!sourceName) {
    return [];
  }

  const normalizedSourceName = normalizeText(sourceName);
  const sourceMeaningfulTokens = tokenizeMeaningfulProductName(sourceName);
  return products.filter((product) => {
    if (!hasCategoryOrBrandSignal(source, product)) {
      return false;
    }

    const normalizedTargetName = normalizeText(product.name);
    if (!normalizedTargetName) {
      return false;
    }

    const targetMeaningfulTokens = tokenizeMeaningfulProductName(product.name);
    const hasMeaningfulOverlap = hasMeaningfulNameTokenOverlap(
      sourceMeaningfulTokens,
      targetMeaningfulTokens,
    );

    if (
      (safeIncludes(normalizedSourceName, normalizedTargetName) ||
        safeIncludes(normalizedTargetName, normalizedSourceName)) &&
      (hasMeaningfulOverlap ||
        sourceMeaningfulTokens.size === 0 ||
        targetMeaningfulTokens.size === 0)
    ) {
      return true;
    }

    return (
      hasMeaningfulOverlap &&
      overlapSimilarity(sourceName, product.name) >=
        RELATED_PRODUCT_SIMILARITY_THRESHOLD
    );
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function limitText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  const sliced = value.slice(0, Math.max(0, maxLength - 1)).trim();
  return `${sliced.replace(/[.,;:!?-]+$/g, "").trim()}…`;
}

function buildLimitedParagraphHtml(value: string | null, maxLength: number) {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  let candidateText = normalized;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const html = sanitizeProductHtml(`<p>${escapeHtml(candidateText)}</p>`);
    if (html.length <= maxLength) {
      return html;
    }
    if (candidateText.length <= 8) {
      break;
    }
    const nextLength = Math.max(0, candidateText.length - 16);
    candidateText = limitText(candidateText, nextLength);
  }

  return null;
}

function buildShortDescriptionHtml(source: SourceManifestProduct) {
  const candidates = [
    source.product.descriptions.shortHtml,
    source.product.descriptions.fullHtml,
  ];
  for (const candidate of candidates) {
    const sanitized = cleanText(candidate ? sanitizeProductHtml(candidate) : null);
    if (sanitized && sanitized.length <= SHORT_DESCRIPTION_HTML_MAX_LENGTH) {
      return sanitized;
    }
  }

  return buildLimitedParagraphHtml(
    source.product.descriptions.shortText ??
      source.product.descriptions.fullText ??
      source.product.name,
    SHORT_DESCRIPTION_HTML_MAX_LENGTH,
  );
}

function buildDescriptionHtml(source: SourceManifestProduct) {
  return (
    cleanText(
      source.product.descriptions.fullHtml
        ? sanitizeProductHtml(source.product.descriptions.fullHtml)
        : null,
    ) ??
    cleanText(
      source.product.descriptions.shortHtml
        ? sanitizeProductHtml(source.product.descriptions.shortHtml)
        : null,
    )
  );
}

function buildExcerpt(source: SourceManifestProduct) {
  const text =
    cleanText(source.product.descriptions.shortText) ??
    cleanText(source.product.descriptions.fullText) ??
    cleanText(source.product.name);

  return text ? limitText(text, EXCERPT_MAX_LENGTH) : null;
}

function toCents(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }
  return Math.max(0, Math.round(amount * 100));
}

function parseOptionalNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function deriveVatRate(source: SourceManifestProduct) {
  const priceAmount = source.product.prices.priceAmount;
  const priceTaxExcAmount = source.product.prices.priceTaxExcAmount;
  if (
    priceAmount == null ||
    priceTaxExcAmount == null ||
    !Number.isFinite(priceAmount) ||
    !Number.isFinite(priceTaxExcAmount) ||
    priceTaxExcAmount <= 0
  ) {
    return 0;
  }

  const rawRate = ((priceAmount / priceTaxExcAmount) - 1) * 100;
  if (!Number.isFinite(rawRate) || rawRate < 0) {
    return 0;
  }

  const rounded = Math.round(rawRate * 100) / 100;
  const integerRounded = Math.round(rounded);
  return Math.abs(rounded - integerRounded) <= 0.01 ? integerRounded : rounded;
}

function resolveDiscounts(source: SourceManifestProduct) {
  const specificPrices =
    source.product.prices.specificPrices &&
    typeof source.product.prices.specificPrices === "object" &&
    !Array.isArray(source.product.prices.specificPrices)
      ? (source.product.prices.specificPrices as Record<string, unknown>)
      : null;
  const reductionType = cleanText(
    typeof specificPrices?.reduction_type === "string"
      ? specificPrices.reduction_type
      : null,
  )?.toLowerCase();

  if (reductionType === "percentage" || reductionType === "percent") {
    const reductionRate = parseOptionalNumber(specificPrices?.reduction);
    return {
      defaultDiscountRate:
        reductionRate != null && reductionRate > 0 ? reductionRate : null,
      defaultDiscountAmountCents: null,
    };
  }

  const priceWithoutReductionAmount =
    source.product.prices.priceWithoutReductionAmount;
  const priceAmount = source.product.prices.priceAmount;
  const amountDifference =
    priceWithoutReductionAmount != null &&
    priceAmount != null &&
    priceWithoutReductionAmount > priceAmount
      ? priceWithoutReductionAmount - priceAmount
      : source.product.prices.reductionAmount;

  return {
    defaultDiscountRate: null,
    defaultDiscountAmountCents:
      amountDifference != null && amountDifference > 0
        ? toCents(amountDifference)
        : null,
  };
}

function resolveStockQuantity(source: SourceManifestProduct) {
  if (source.product.quantity == null || !Number.isFinite(source.product.quantity)) {
    return null;
  }
  return Math.max(0, Math.trunc(source.product.quantity));
}

function resolveIsActive(source: SourceManifestProduct) {
  return normalizeText(source.product.availability) !== "unavailable";
}

function buildManagedImageInputs(source: SourceManifestProduct) {
  const name = buildSourceDisplayName(source) ?? "Produit";
  const seen = new Set<string>();
  const galleryInputs = [
    source.product.imageUrls.cover,
    ...source.product.imageUrls.gallery,
  ]
    .map((entry) => cleanText(entry))
    .filter((entry): entry is string => Boolean(entry))
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    })
    .map((sourceUrl, index, entries) => ({
      sourceUrl,
      alt: entries.length > 1 ? `${name} - image ${index + 1}` : name,
    }));

  if (!galleryInputs.length) {
    throw new Error("Source product is missing gallery and cover images.");
  }

  return {
    coverImage: {
      sourceUrl: cleanText(source.product.imageUrls.cover) ?? galleryInputs[0]!.sourceUrl,
      alt: name,
    },
    galleryImages: galleryInputs,
  };
}

function buildProductInput(
  source: SourceManifestProduct,
  media: ManagedProductImageIngestionResult | null,
): ProductInput {
  const sku = buildCandidateSku(source);
  const name = buildSourceDisplayName(source);
  const publicSlug = buildCandidatePublicSlug(source);
  const category =
    cleanText(source.product.category.name) ??
    cleanText(source.product.category.slug);
  const priceHTCents = toCents(source.product.prices.priceTaxExcAmount);
  const priceTTCCents = toCents(source.product.prices.priceAmount);

  if (!sku || !name || !publicSlug) {
    throw new Error("Missing candidate SKU, product name, or public slug.");
  }
  if (priceHTCents == null || priceTTCCents == null) {
    throw new Error("Missing taxable or TTC price in the source manifest.");
  }

  const { defaultDiscountAmountCents, defaultDiscountRate } =
    resolveDiscounts(source);

  return {
    sku,
    name,
    publicSlug,
    saleMode: ProductSaleMode.INSTANT,
    description:
      cleanText(source.product.descriptions.shortText) ??
      cleanText(source.product.descriptions.fullText),
    descriptionHtml: buildDescriptionHtml(source),
    shortDescriptionHtml: buildShortDescriptionHtml(source),
    excerpt: buildExcerpt(source),
    metaTitle: cleanText(source.meta.title),
    metaDescription: cleanText(source.meta.description),
    coverImageUrl: media?.coverImageUrl ?? null,
    gallery: media?.gallery ?? null,
    faqItems: null,
    quoteFormSchema: null,
    optionConfig: null,
    variantStock: null,
    category,
    unit: "unité",
    stockQuantity: resolveStockQuantity(source),
    priceHTCents,
    priceTTCCents,
    vatRate: deriveVatRate(source),
    defaultDiscountRate,
    defaultDiscountAmountCents,
    isActive: resolveIsActive(source),
    isListedInCatalog: true,
  };
}

function buildProductEnrichmentInput(
  source: SourceManifestProduct,
  baseInput: ProductInput,
): ProductImportEnrichmentInput {
  return {
    name: baseInput.name,
    category: baseInput.category ?? null,
    brand: cleanText(source.meta.brand),
    shortDescriptionText: cleanText(source.product.descriptions.shortText),
    shortDescriptionHtml: baseInput.shortDescriptionHtml ?? null,
    descriptionText: cleanText(source.product.descriptions.fullText),
    descriptionHtml: baseInput.descriptionHtml ?? null,
    metaTitle: baseInput.metaTitle ?? null,
    metaDescription: baseInput.metaDescription ?? null,
    excerpt: baseInput.excerpt ?? null,
    priceAmount: source.product.prices.priceAmount,
    discountAmount: source.product.prices.reductionAmount,
    stockQuantity: baseInput.stockQuantity ?? null,
    availability: cleanText(source.product.availability),
    isActive: baseInput.isActive,
  };
}

function applyProductEnrichment(
  baseInput: ProductInput,
  enrichment: ProductImportEnrichmentResult,
): ProductInput {
  return {
    ...baseInput,
    metaTitle: enrichment.metaTitle,
    metaDescription: enrichment.metaDescription,
    shortDescriptionHtml: enrichment.shortDescriptionHtml,
    descriptionHtml: enrichment.descriptionHtml,
    faqItems: enrichment.faqItems,
  };
}

function combineNotes(...values: Array<string | null | undefined>) {
  return values
    .map((value) => cleanText(value))
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function toJsonInput(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildProductWriteData(
  data: Omit<ProductInput, "id" | "publicSlug">,
) {
  return {
    sku: data.sku,
    name: data.name,
    saleMode: data.saleMode,
    description: data.description ?? null,
    descriptionHtml: data.descriptionHtml ?? null,
    shortDescriptionHtml: data.shortDescriptionHtml ?? null,
    excerpt: data.excerpt ?? null,
    metaTitle: data.metaTitle ?? null,
    metaDescription: data.metaDescription ?? null,
    coverImageUrl: data.coverImageUrl ?? null,
    gallery: toJsonInput(data.gallery),
    faqItems: toJsonInput(data.faqItems),
    quoteFormSchema: toJsonInput(data.quoteFormSchema),
    optionConfig: toJsonInput(data.optionConfig),
    variantStock: toJsonInput(data.variantStock),
    category: data.category ?? null,
    unit: data.unit,
    stockQuantity: data.stockQuantity ?? null,
    priceHTCents: data.priceHTCents,
    priceTTCCents: data.priceTTCCents,
    vatRate: data.vatRate,
    defaultDiscountRate: data.defaultDiscountRate ?? null,
    defaultDiscountAmountCents: data.defaultDiscountAmountCents ?? null,
    isActive: data.isActive,
    isListedInCatalog: data.isListedInCatalog,
  };
}

async function fileExists(filePath: string) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function loadSourceManifest() {
  if (!(await fileExists(SOURCE_MANIFEST_PATH))) {
    throw new Error(
      `Source manifest not found at ${SOURCE_MANIFEST_PATH}. Run Task 1 first.`,
    );
  }
  return loadJsonFile<SourceManifest>(SOURCE_MANIFEST_PATH);
}

async function loadDryRunReport() {
  if (!(await fileExists(DRY_RUN_REPORT_JSON_PATH))) {
    throw new Error(
      `Dry-run report not found at ${DRY_RUN_REPORT_JSON_PATH}. Run Task 2 first.`,
    );
  }
  return loadJsonFile<DryRunReport>(DRY_RUN_REPORT_JSON_PATH);
}

async function resolveTarget() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        equals: TARGET_EMAIL,
        mode: Prisma.QueryMode.insensitive,
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      ownedAccount: {
        select: {
          id: true,
          type: true,
          displayName: true,
        },
      },
    },
  });

  if (users.length !== 1) {
    throw new Error(
      `Expected exactly one user for ${TARGET_EMAIL}, found ${users.length}.`,
    );
  }

  const user = users[0]!;
  const websites = await prisma.websiteConfig.findMany({
    where: {
      customDomain: {
        equals: TARGET_DOMAIN,
        mode: Prisma.QueryMode.insensitive,
      },
    },
    select: {
      id: true,
      userId: true,
      slug: true,
      customDomain: true,
      templateKey: true,
      domainStatus: true,
    },
  });

  if (websites.length !== 1) {
    throw new Error(
      `Expected exactly one website for ${TARGET_DOMAIN}, found ${websites.length}.`,
    );
  }

  const website = websites[0]!;
  if (website.userId !== user.id) {
    throw new Error(
      `Resolved website ${website.id} belongs to user ${website.userId}, not ${user.id}.`,
    );
  }
  if (website.templateKey !== PRODUCT_TEMPLATE_KEY) {
    throw new Error(
      `Website template mismatch. Expected ${PRODUCT_TEMPLATE_KEY} but found ${website.templateKey}.`,
    );
  }

  return {
    user,
    website,
  };
}

async function loadExistingProducts(client: DatabaseClient, userId: string) {
  return client.product.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      sku: true,
      publicSlug: true,
      name: true,
      category: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        id: "asc",
      },
    ],
  });
}

function resolveImportDecision(
  source: SourceManifestProduct,
  existingProducts: ExistingProductCandidate[],
): ImportDecision {
  const base = buildReportBase(source);
  const normalizedCandidateSku = normalizeText(base.candidateSku);
  const normalizedCandidateSlug = normalizeText(base.candidatePublicSlug);
  const normalizedCandidateName = normalizeText(base.name);

  if (!base.candidateSku || !base.candidatePublicSlug || !base.name) {
    return {
      kind: "manual_review",
      reason: "missing_required_source_fields",
      relatedProducts: [],
      note: "Missing candidate SKU, public slug, or name.",
    };
  }

  if (requiresVariantManualReview(source)) {
    return {
      kind: "manual_review",
      reason: "unsafe_variant_mapping",
      relatedProducts: [],
      note:
        "Source option selectors expose multiple values, but safe per-option price adjustments are unavailable.",
    };
  }

  const skuMatches = existingProducts.filter(
    (product) => normalizeText(product.sku) === normalizedCandidateSku,
  );
  if (skuMatches.length > 1) {
    return {
      kind: "manual_review",
      reason: "ambiguous_exact_sku",
      relatedProducts: skuMatches,
      note: "More than one target product matched the candidate SKU.",
    };
  }

  const slugMatches = existingProducts.filter(
    (product) => normalizeText(product.publicSlug) === normalizedCandidateSlug,
  );
  if (slugMatches.length > 1) {
    return {
      kind: "manual_review",
      reason: "ambiguous_exact_public_slug",
      relatedProducts: slugMatches,
      note: "More than one target product matched the candidate public slug.",
    };
  }

  const skuMatch = skuMatches[0] ?? null;
  const slugMatch = slugMatches[0] ?? null;
  if (skuMatch && slugMatch && skuMatch.id !== slugMatch.id) {
    return {
      kind: "manual_review",
      reason: "public_slug_conflict",
      relatedProducts: [skuMatch, slugMatch],
      note:
        "The candidate SKU and candidate public slug resolve to different target products.",
    };
  }

  if (skuMatch) {
    return {
      kind: "update",
      matchRule: "exact_sku",
      matchedProduct: skuMatch,
      note: "Existing deterministic SKU match found; the importer can update it safely.",
    };
  }

  if (slugMatch) {
    if (normalizeText(slugMatch.name) === normalizedCandidateName) {
      return {
        kind: "update",
        matchRule: "exact_public_slug",
        matchedProduct: slugMatch,
        note: "Existing public slug match found with the same normalized product name.",
      };
    }
    return {
      kind: "manual_review",
      reason: "public_slug_conflict",
      relatedProducts: [slugMatch],
      note:
        "The candidate public slug already belongs to another target product with a different normalized name.",
    };
  }

  const exactNameMatches = existingProducts.filter(
    (product) => normalizeText(product.name) === normalizedCandidateName,
  );
  if (exactNameMatches.length === 1) {
    return {
      kind: "skip_existing",
      matchRule: "exact_normalized_name",
      matchedProduct: exactNameMatches[0]!,
      note: "Exact normalized product name match found in target account.",
    };
  }
  if (exactNameMatches.length > 1) {
    const signaledMatches = exactNameMatches.filter((product) =>
      hasCategoryOrBrandSignal(source, product),
    );
    if (signaledMatches.length === 1) {
      return {
        kind: "skip_existing",
        matchRule: "exact_normalized_name_with_signal",
        matchedProduct: signaledMatches[0]!,
        note: "Exact normalized name match narrowed by category/brand signal.",
      };
    }
    return {
      kind: "manual_review",
      reason: "ambiguous_exact_name",
      relatedProducts:
        signaledMatches.length > 0 ? signaledMatches : exactNameMatches,
      note:
        signaledMatches.length > 0
          ? "Multiple exact name matches remained after category/brand filtering."
          : "Multiple exact normalized name matches were found.",
    };
  }

  const relatedProducts = findRelatedExistingProducts(source, existingProducts);
  if (relatedProducts.length > 0) {
    return {
      kind: "manual_review",
      reason: "ambiguous_related_existing_products",
      relatedProducts,
      note:
        "Related existing products were found with strong name overlap plus category/brand signal.",
    };
  }

  return {
    kind: "create",
    note: "No existing or ambiguous target match was found.",
  };
}

async function writeImportedProduct(options: {
  tx: Prisma.TransactionClient;
  userId: string;
  source: SourceManifestProduct;
  input: ProductInput;
  decision: Extract<ImportDecision, { kind: "create" | "update" }>;
}) {
  const payload = productSchema.parse(options.input);
  const { id: _id, publicSlug, ...data } = payload;
  void _id;

  if (!publicSlug) {
    throw new Error("A validated public slug is required for import writes.");
  }

  const writeData = buildProductWriteData(data);

  if (options.decision.kind === "create") {
    const created = await options.tx.product.create({
      data: {
        userId: options.userId,
        publicSlug,
        ...writeData,
      },
    });
    return {
      action: "created" as const,
      product: created,
    };
  }

  const updated = await options.tx.product.update({
    where: {
      id: options.decision.matchedProduct.id,
    },
    data: {
      userId: options.userId,
      publicSlug,
      ...writeData,
    },
  });
  return {
    action: "updated" as const,
    product: updated,
  };
}

function renderMarkdownReport(report: ImportReport) {
  const lines: string[] = [];

  lines.push("# Techno Smart Import Report");
  lines.push("");
  lines.push("## Mode");
  lines.push("");
  lines.push(
    `- ${report.applyMode ? "Apply mode: writes and managed image uploads enabled." : "Preview mode: no product data or managed images were written."}`,
  );
  lines.push("");
  lines.push("## Target");
  lines.push("");
  lines.push(`- User: \`${report.target.email}\` (${report.target.userId})`);
  lines.push(
    `- Account type: \`${report.target.accountType ?? "UNKNOWN"}\``,
  );
  lines.push(
    `- Website: \`${report.target.website.customDomain ?? report.target.website.slug}\` (${report.target.website.id})`,
  );
  lines.push(`- Template: \`${report.target.website.templateKey}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Planned from dry-run: ${report.summary.dryRunCreateCount}`);
  lines.push(`- Ready: ${report.summary.readyCount}`);
  lines.push(`- Created: ${report.summary.createdCount}`);
  lines.push(`- Updated: ${report.summary.updatedCount}`);
  lines.push(`- AI enriched: ${report.summary.aiAppliedCount}`);
  lines.push(`- AI fallback: ${report.summary.aiFallbackCount}`);
  lines.push(`- Skip existing: ${report.summary.skipExistingCount}`);
  lines.push(`- Manual review: ${report.summary.manualReviewCount}`);
  lines.push(`- Failed: ${report.summary.failedCount}`);

  const renderSection = (
    title: string,
    items: string[],
    emptyMessage: string,
  ) => {
    lines.push("");
    lines.push(`## ${title}`);
    lines.push("");
    if (items.length === 0) {
      lines.push(`- ${emptyMessage}`);
      return;
    }
    items.forEach((item) => lines.push(`- ${item}`));
  };

  renderSection(
    "Ready",
    report.ready.map((entry) => {
      const target = entry.matchedProduct
        ? ` -> ${entry.matchedProduct.name} (\`${entry.matchedProduct.sku}\`)`
        : "";
      return `\`${entry.expectedAction}\` [${entry.enrichmentMode}] ${entry.name ?? entry.sourceUrl}${target}`;
    }),
    "None.",
  );
  renderSection(
    "Created",
    report.created.map(
      (entry) =>
        `\`${entry.matchedProduct.sku}\` [${entry.enrichmentMode}] ${entry.name ?? entry.sourceUrl} -> ${entry.matchedProduct.publicSlug}`,
    ),
    "None.",
  );
  renderSection(
    "Updated",
    report.updated.map(
      (entry) =>
        `\`${entry.matchRule}\` [${entry.enrichmentMode}] ${entry.name ?? entry.sourceUrl} -> ${entry.matchedProduct.name} (\`${entry.matchedProduct.sku}\`)`,
    ),
    "None.",
  );
  renderSection(
    "Skip Existing",
    report.skipped_existing.map(
      (entry) =>
        `\`${entry.matchRule}\` ${entry.name ?? entry.sourceUrl} -> ${entry.matchedProduct.name} (\`${entry.matchedProduct.sku}\`)`,
    ),
    "None.",
  );
  renderSection(
    "Manual Review",
    report.manual_review.map((entry) => {
      const related = entry.relatedProducts.length
        ? ` [${entry.relatedProducts.map((product) => product.name).join("; ")}]`
        : "";
      return `\`${entry.reason}\` ${entry.name ?? entry.sourceUrl}${related}`;
    }),
    "None.",
  );
  renderSection(
    "Failed",
    report.failed.map(
      (entry) =>
        `\`${entry.stage}\` ${entry.name ?? entry.sourceUrl} -> ${entry.error}`,
    ),
    "None.",
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  const [manifest, dryRunReport, target] = await Promise.all([
    loadSourceManifest(),
    loadDryRunReport(),
    resolveTarget(),
  ]);

  if (dryRunReport.target.userId !== target.user.id) {
    throw new Error(
      `Dry-run target mismatch. Report user ${dryRunReport.target.userId} does not match resolved user ${target.user.id}.`,
    );
  }
  if (dryRunReport.target.website.id !== target.website.id) {
    throw new Error(
      `Dry-run website mismatch. Report website ${dryRunReport.target.website.id} does not match resolved website ${target.website.id}.`,
    );
  }

  const sourceByFingerprint = new Map(
    manifest.products.map((product) => [product.sourceFingerprint, product]),
  );

  const ready: ImportReadyEntry[] = [];
  const created: ImportWriteEntry[] = [];
  const updated: ImportWriteEntry[] = [];
  const skippedExisting: ImportSkipExistingEntry[] = [];
  const manualReview: ImportManualReviewEntry[] = [];
  const failed: ImportFailedEntry[] = [];

  for (const plannedEntry of dryRunReport.create) {
    const source = sourceByFingerprint.get(plannedEntry.sourceFingerprint);
    if (!source) {
      failed.push({
        sourceFingerprint: plannedEntry.sourceFingerprint,
        sourceUrl: plannedEntry.sourceUrl,
        canonicalUrl: plannedEntry.canonicalUrl,
        candidateSku: plannedEntry.candidateSku,
        candidatePublicSlug: plannedEntry.candidatePublicSlug,
        name: plannedEntry.name,
        category: plannedEntry.category,
        brand: plannedEntry.brand,
        note: "Dry-run create entry no longer resolves to a manifest product.",
        stage: "resolve_source",
        error: "Source manifest record not found by sourceFingerprint.",
      });
      continue;
    }

    const baseEntry = buildReportBase(source);
    const existingProducts = await loadExistingProducts(prisma, target.user.id);
    const decision = resolveImportDecision(source, existingProducts);

    if (decision.kind === "skip_existing") {
      skippedExisting.push({
        ...baseEntry,
        matchRule: decision.matchRule,
        matchedProduct: toProductSummary(decision.matchedProduct),
        note: decision.note,
      });
      continue;
    }

    if (decision.kind === "manual_review") {
      manualReview.push({
        ...baseEntry,
        reason: decision.reason,
        relatedProducts: decision.relatedProducts.map(toProductSummary),
        note: decision.note,
      });
      continue;
    }

    if (!APPLY_MODE) {
      let enrichment: ProductImportEnrichmentResult;
      try {
        buildManagedImageInputs(source);
      } catch (error) {
        failed.push({
          ...baseEntry,
          note: "Preview validation failed because required source images are missing.",
          stage: "ingest_images",
          error:
            error instanceof Error
              ? error.message
              : "Unknown source image validation failure.",
        });
        continue;
      }

      try {
        const baseInput = buildProductInput(source, null);
        enrichment = await enrichImportedProductContent({
          source: buildProductEnrichmentInput(source, baseInput),
          fallback: {
            metaTitle: baseInput.metaTitle ?? null,
            metaDescription: baseInput.metaDescription ?? null,
            shortDescriptionHtml: baseInput.shortDescriptionHtml ?? null,
            descriptionHtml: baseInput.descriptionHtml ?? null,
            faqItems: null,
          },
        });
        productSchema.parse(applyProductEnrichment(baseInput, enrichment));
      } catch (error) {
        failed.push({
          ...baseEntry,
          note: "Preview validation failed because the mapped product payload is invalid.",
          stage: "map_product",
          error:
            error instanceof Error
              ? error.message
              : "Unknown preview mapping failure.",
        });
        continue;
      }

      ready.push({
        ...baseEntry,
        expectedAction: decision.kind,
        matchRule: decision.kind === "create" ? "new" : decision.matchRule,
        matchedProduct:
          decision.kind === "update"
            ? toProductSummary(decision.matchedProduct)
            : null,
        enrichmentMode: enrichment.mode,
        enrichmentNote: enrichment.note,
        note: combineNotes(decision.note, enrichment.note),
      });
      continue;
    }

    let media: ManagedProductImageIngestionResult;
    let validatedInput: ProductInput;
    let enrichment: ProductImportEnrichmentResult;
    try {
      const imageInputs = buildManagedImageInputs(source);
      media = await ingestManagedProductImages({
        userId: target.user.id,
        publicSlug: baseEntry.candidatePublicSlug ?? "produit",
        coverImage: imageInputs.coverImage,
        galleryImages: imageInputs.galleryImages,
      });
    } catch (error) {
      failed.push({
        ...baseEntry,
        note: "Managed image ingestion failed; product write was not attempted.",
        stage: "ingest_images",
        error: error instanceof Error ? error.message : "Unknown image ingestion failure.",
      });
      continue;
    }

    try {
      const baseInput = buildProductInput(source, media);
      enrichment = await enrichImportedProductContent({
        source: buildProductEnrichmentInput(source, baseInput),
        fallback: {
          metaTitle: baseInput.metaTitle ?? null,
          metaDescription: baseInput.metaDescription ?? null,
          shortDescriptionHtml: baseInput.shortDescriptionHtml ?? null,
          descriptionHtml: baseInput.descriptionHtml ?? null,
          faqItems: null,
        },
      });
      validatedInput = productSchema.parse(
        applyProductEnrichment(baseInput, enrichment),
      );
    } catch (error) {
      failed.push({
        ...baseEntry,
        note: "Mapped product payload failed validation; product write was not attempted.",
        stage: "map_product",
        error: error instanceof Error ? error.message : "Unknown product mapping failure.",
      });
      continue;
    }

    try {
      const writeResult = await prisma.$transaction(async (tx) => {
        const latestProducts = await loadExistingProducts(tx, target.user.id);
        const latestDecision = resolveImportDecision(source, latestProducts);

        if (latestDecision.kind === "skip_existing") {
          return {
            kind: "skip_existing" as const,
            decision: latestDecision,
          };
        }
        if (latestDecision.kind === "manual_review") {
          return {
            kind: "manual_review" as const,
            decision: latestDecision,
          };
        }

        const write = await writeImportedProduct({
          tx,
          userId: target.user.id,
          source,
          input: validatedInput,
          decision: latestDecision,
        });

        return {
          kind: "write" as const,
          decision: latestDecision,
          write,
        };
      });

      if (writeResult.kind === "skip_existing") {
        skippedExisting.push({
          ...baseEntry,
          matchRule: writeResult.decision.matchRule,
          matchedProduct: toProductSummary(writeResult.decision.matchedProduct),
          note: writeResult.decision.note,
        });
        continue;
      }

      if (writeResult.kind === "manual_review") {
        manualReview.push({
          ...baseEntry,
          reason: writeResult.decision.reason,
          relatedProducts: writeResult.decision.relatedProducts.map(toProductSummary),
          note: writeResult.decision.note,
        });
        continue;
      }

      const matchedProduct = toProductSummary({
        id: writeResult.write.product.id,
        sku: writeResult.write.product.sku,
        publicSlug: writeResult.write.product.publicSlug,
        name: writeResult.write.product.name,
        category: writeResult.write.product.category,
        description: writeResult.write.product.description,
        metaTitle: writeResult.write.product.metaTitle,
        metaDescription: writeResult.write.product.metaDescription,
      });

      const reportEntry: ImportWriteEntry = {
        ...baseEntry,
        action: writeResult.write.action,
        matchRule:
          writeResult.decision.kind === "create"
            ? "new"
            : writeResult.decision.matchRule,
        matchedProduct,
        managedAssetCount: media.assets.length,
        enrichmentMode: enrichment.mode,
        enrichmentNote: enrichment.note,
        note: combineNotes(writeResult.decision.note, enrichment.note),
      };

      if (writeResult.write.action === "created") {
        created.push(reportEntry);
      } else {
        updated.push(reportEntry);
      }
    } catch (error) {
      failed.push({
        ...baseEntry,
        note: "Transactional product write failed.",
        stage: "db_write",
        error: error instanceof Error ? error.message : "Unknown database write failure.",
      });
    }
  }

  const report: ImportReport = {
    generatedAt: new Date().toISOString(),
    applyMode: APPLY_MODE,
    source: {
      manifestPath: SOURCE_MANIFEST_PATH,
      dryRunReportPath: DRY_RUN_REPORT_JSON_PATH,
      dryRunGeneratedAt: dryRunReport.generatedAt,
    },
    target: {
      email: target.user.email,
      userId: target.user.id,
      accountType: target.user.ownedAccount?.type ?? null,
      website: {
        id: target.website.id,
        userId: target.website.userId,
        slug: target.website.slug,
        customDomain: target.website.customDomain,
        templateKey: target.website.templateKey,
        domainStatus: target.website.domainStatus,
      },
    },
    summary: {
      dryRunCreateCount: dryRunReport.create.length,
      readyCount: ready.length,
      createdCount: created.length,
      updatedCount: updated.length,
      aiAppliedCount: [...ready, ...created, ...updated].filter(
        (entry) => entry.enrichmentMode === "ai",
      ).length,
      aiFallbackCount: [...ready, ...created, ...updated].filter(
        (entry) => entry.enrichmentMode === "fallback",
      ).length,
      skipExistingCount: skippedExisting.length,
      manualReviewCount: manualReview.length,
      failedCount: failed.length,
    },
    ready,
    created,
    updated,
    skipped_existing: skippedExisting,
    manual_review: manualReview,
    failed,
  };

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(
    IMPORT_REPORT_JSON_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(IMPORT_REPORT_MD_PATH, renderMarkdownReport(report), "utf8");

  console.log(`Import report written to ${IMPORT_REPORT_JSON_PATH}`);
  console.log(`Markdown report written to ${IMPORT_REPORT_MD_PATH}`);
  console.log(
    JSON.stringify(
      {
        applyMode: APPLY_MODE,
        dryRunCreateCount: report.summary.dryRunCreateCount,
        readyCount: report.summary.readyCount,
        createdCount: report.summary.createdCount,
        updatedCount: report.summary.updatedCount,
        aiAppliedCount: report.summary.aiAppliedCount,
        aiFallbackCount: report.summary.aiFallbackCount,
        skipExistingCount: report.summary.skipExistingCount,
        manualReviewCount: report.summary.manualReviewCount,
        failedCount: report.summary.failedCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[import-techno-smart-products] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
