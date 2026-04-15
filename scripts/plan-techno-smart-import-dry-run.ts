import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants as fsConstants } from "node:fs";
import {
  Prisma,
  PrismaClient,
  AccountType,
} from "@/lib/db/prisma-server";
import { slugify } from "@/lib/slug";
import { resolveScriptDatabaseUrl } from "../src/lib/db/runtime-config";

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
const DRY_RUN_REPORT_MD_PATH = path.join(OUTPUT_DIRECTORY, "dry-run-report.md");
const PLANNER_APPLICATION_NAME = "invoices-app:techno-smart-dry-run";
const PRODUCT_TEMPLATE_KEY = "ecommerce-ciseco-home";
const RELATED_PRODUCT_SIMILARITY_THRESHOLD = 0.7;
const RELATED_NAME_GENERIC_TOKENS = new Set([
  "1",
  "2",
  "3",
  "abonnement",
  "adobe",
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
  "pc",
  "pcs",
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

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: resolveScriptDatabaseUrl(process.env, {
        applicationName: PLANNER_APPLICATION_NAME,
      }),
    },
  },
});

type SourceManifestProduct = {
  sourceUrl: string;
  canonicalUrl: string | null;
  sourceFingerprint: string;
  meta: {
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
    availability: string | null;
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
  source: {
    sitemapUrl: string;
    siteUrl: string;
    crawlConcurrency: number;
  };
  summary: {
    sitemapUrlCount: number;
    validProductCount: number;
    skippedCount: number;
  };
  products: SourceManifestProduct[];
  skipped: SourceManifestSkipped[];
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
  updatedAt: Date;
};

type ReportProductSummary = {
  id: string;
  sku: string;
  publicSlug: string;
  name: string;
  category: string | null;
};

type ReportBaseEntry = {
  sourceFingerprint: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  candidateSku: string | null;
  candidatePublicSlug: string | null;
  name: string | null;
  category: string | null;
  brand: string | null;
};

type ReportCreateEntry = ReportBaseEntry & {
  note: string;
};

type ReportSkipExistingEntry = ReportBaseEntry & {
  matchRule:
    | "exact_sku"
    | "exact_public_slug"
    | "exact_normalized_name"
    | "exact_normalized_name_with_signal"
    | "previous_source_fingerprint";
  matchedProduct: ReportProductSummary | null;
  previousArtifactBucket: string | null;
  note: string;
};

type ReportManualReviewEntry = ReportBaseEntry & {
  reason:
    | "missing_required_source_fields"
    | "ambiguous_exact_sku"
    | "ambiguous_exact_public_slug"
    | "ambiguous_exact_name"
    | "unsafe_variant_mapping"
    | "ambiguous_related_existing_products";
  relatedProducts: ReportProductSummary[];
  note: string;
};

type ReportInvalidSourceEntry = SourceManifestSkipped;

type DryRunReport = {
  generatedAt: string;
  source: {
    manifestPath: string;
    previousReportPath: string | null;
    previousFingerprintCount: number;
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
    sourceProductCount: number;
    invalidSourceCount: number;
    createCount: number;
    skipExistingCount: number;
    manualReviewCount: number;
  };
  create: ReportCreateEntry[];
  skip_existing: ReportSkipExistingEntry[];
  manual_review: ReportManualReviewEntry[];
  invalid_source: ReportInvalidSourceEntry[];
};

type PreviousFingerprintRecord = {
  bucket: "create" | "skip_existing" | "manual_review";
  sourceUrl: string;
  name: string | null;
};

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
  return slugify(slugSeedParts.join(" "));
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

function buildReportBase(source: SourceManifestProduct): ReportBaseEntry {
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

async function loadExistingProducts(userId: string) {
  return prisma.product.findMany({
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
      updatedAt: true,
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

function buildIndex<T>(
  items: T[],
  keyResolver: (item: T) => string,
) {
  const index = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyResolver(item);
    if (!key) {
      return;
    }
    const current = index.get(key) ?? [];
    current.push(item);
    index.set(key, current);
  });
  return index;
}

function hasBrandSignal(sourceBrand: string | null, product: ExistingProductCandidate) {
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

function collectPreviousFingerprints(report: DryRunReport | null) {
  const map = new Map<string, PreviousFingerprintRecord>();
  if (!report) {
    return map;
  }

  report.create.forEach((entry) => {
    map.set(entry.sourceFingerprint, {
      bucket: "create",
      sourceUrl: entry.sourceUrl,
      name: entry.name,
    });
  });
  report.skip_existing.forEach((entry) => {
    map.set(entry.sourceFingerprint, {
      bucket: "skip_existing",
      sourceUrl: entry.sourceUrl,
      name: entry.name,
    });
  });
  report.manual_review.forEach((entry) => {
    map.set(entry.sourceFingerprint, {
      bucket: "manual_review",
      sourceUrl: entry.sourceUrl,
      name: entry.name,
    });
  });

  return map;
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

function renderMarkdownReport(report: DryRunReport) {
  const lines: string[] = [];

  lines.push("# Techno Smart Dry Run Report");
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
  lines.push(`- Source products: ${report.summary.sourceProductCount}`);
  lines.push(`- Create: ${report.summary.createCount}`);
  lines.push(`- Skip existing: ${report.summary.skipExistingCount}`);
  lines.push(`- Manual review: ${report.summary.manualReviewCount}`);
  lines.push(`- Invalid source: ${report.summary.invalidSourceCount}`);

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
    "Create",
    report.create.map(
      (entry) =>
        `\`${entry.candidateSku ?? "no-sku"}\` ${entry.name ?? entry.sourceUrl} -> create`,
    ),
    "None.",
  );
  renderSection(
    "Skip Existing",
    report.skip_existing.map((entry) => {
      const target = entry.matchedProduct
        ? `${entry.matchedProduct.name} (\`${entry.matchedProduct.sku}\`)`
        : "previous dry-run artifact";
      return `\`${entry.matchRule}\` ${entry.name ?? entry.sourceUrl} -> ${target}`;
    }),
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
    "Invalid Source",
    report.invalid_source.map(
      (entry) => `\`${entry.reason}\` ${entry.sourceUrl} -> ${entry.message}`,
    ),
    "None.",
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  const manifest = await loadSourceManifest();
  const previousReport = (await fileExists(DRY_RUN_REPORT_JSON_PATH))
    ? await loadJsonFile<DryRunReport>(DRY_RUN_REPORT_JSON_PATH)
    : null;
  const previousFingerprints = collectPreviousFingerprints(previousReport);
  const { user, website } = await resolveTarget();
  const existingProducts = await loadExistingProducts(user.id);

  const existingBySku = buildIndex(existingProducts, (product) =>
    normalizeText(product.sku),
  );
  const existingBySlug = buildIndex(existingProducts, (product) =>
    normalizeText(product.publicSlug),
  );
  const existingByName = buildIndex(existingProducts, (product) =>
    normalizeText(product.name),
  );

  const create: ReportCreateEntry[] = [];
  const skipExisting: ReportSkipExistingEntry[] = [];
  const manualReview: ReportManualReviewEntry[] = [];
  const invalidSource = [...manifest.skipped];

  for (const sourceProduct of manifest.products) {
    const baseEntry = buildReportBase(sourceProduct);
    const normalizedCandidateSku = normalizeText(baseEntry.candidateSku);
    const normalizedCandidateSlug = normalizeText(baseEntry.candidatePublicSlug);
    const normalizedCandidateName = normalizeText(baseEntry.name);

    if (!baseEntry.candidateSku || !baseEntry.candidatePublicSlug || !baseEntry.name) {
      manualReview.push({
        ...baseEntry,
        reason: "missing_required_source_fields",
        relatedProducts: [],
        note: "Missing candidate SKU, public slug, or name.",
      });
      continue;
    }

    const skuMatches = existingBySku.get(normalizedCandidateSku) ?? [];
    if (skuMatches.length === 1) {
      skipExisting.push({
        ...baseEntry,
        matchRule: "exact_sku",
        matchedProduct: toProductSummary(skuMatches[0]!),
        previousArtifactBucket: null,
        note: "Exact SKU match found in target account.",
      });
      continue;
    }
    if (skuMatches.length > 1) {
      manualReview.push({
        ...baseEntry,
        reason: "ambiguous_exact_sku",
        relatedProducts: skuMatches.map(toProductSummary),
        note: "More than one target product matched the candidate SKU.",
      });
      continue;
    }

    const slugMatches = existingBySlug.get(normalizedCandidateSlug) ?? [];
    if (slugMatches.length === 1) {
      skipExisting.push({
        ...baseEntry,
        matchRule: "exact_public_slug",
        matchedProduct: toProductSummary(slugMatches[0]!),
        previousArtifactBucket: null,
        note: "Exact public slug match found in target account.",
      });
      continue;
    }
    if (slugMatches.length > 1) {
      manualReview.push({
        ...baseEntry,
        reason: "ambiguous_exact_public_slug",
        relatedProducts: slugMatches.map(toProductSummary),
        note: "More than one target product matched the candidate public slug.",
      });
      continue;
    }

    const exactNameMatches = existingByName.get(normalizedCandidateName) ?? [];
    if (exactNameMatches.length === 1) {
      skipExisting.push({
        ...baseEntry,
        matchRule: "exact_normalized_name",
        matchedProduct: toProductSummary(exactNameMatches[0]!),
        previousArtifactBucket: null,
        note: "Exact normalized product name match found in target account.",
      });
      continue;
    }
    if (exactNameMatches.length > 1) {
      const signaledMatches = exactNameMatches.filter((product) =>
        hasCategoryOrBrandSignal(sourceProduct, product),
      );
      if (signaledMatches.length === 1) {
        skipExisting.push({
          ...baseEntry,
          matchRule: "exact_normalized_name_with_signal",
          matchedProduct: toProductSummary(signaledMatches[0]!),
          previousArtifactBucket: null,
          note: "Exact normalized name match narrowed by category/brand signal.",
        });
        continue;
      }
      manualReview.push({
        ...baseEntry,
        reason: "ambiguous_exact_name",
        relatedProducts: (signaledMatches.length > 0 ? signaledMatches : exactNameMatches).map(
          toProductSummary,
        ),
        note:
          signaledMatches.length > 0
            ? "Multiple exact name matches remained after category/brand filtering."
            : "Multiple exact normalized name matches were found.",
      });
      continue;
    }

    if (requiresVariantManualReview(sourceProduct)) {
      manualReview.push({
        ...baseEntry,
        reason: "unsafe_variant_mapping",
        relatedProducts: [],
        note:
          "Source option selectors expose multiple values, but the manifest does not safely preserve per-option price adjustments.",
      });
      continue;
    }

    const relatedProducts = findRelatedExistingProducts(sourceProduct, existingProducts);
    if (relatedProducts.length > 0) {
      manualReview.push({
        ...baseEntry,
        reason: "ambiguous_related_existing_products",
        relatedProducts: relatedProducts.map(toProductSummary),
        note:
          "Related existing products were found with strong name overlap plus category/brand signal.",
      });
      continue;
    }

    create.push({
      ...baseEntry,
      note: "No existing or ambiguous target match was found.",
    });
  }

  const report: DryRunReport = {
    generatedAt: new Date().toISOString(),
    source: {
      manifestPath: SOURCE_MANIFEST_PATH,
      previousReportPath: previousReport ? DRY_RUN_REPORT_JSON_PATH : null,
      previousFingerprintCount: previousFingerprints.size,
    },
    target: {
      email: user.email,
      userId: user.id,
      accountType: user.ownedAccount?.type ?? null,
      website: {
        id: website.id,
        userId: website.userId,
        slug: website.slug,
        customDomain: website.customDomain,
        templateKey: website.templateKey,
        domainStatus: website.domainStatus,
      },
    },
    summary: {
      sourceProductCount: manifest.products.length,
      invalidSourceCount: invalidSource.length,
      createCount: create.length,
      skipExistingCount: skipExisting.length,
      manualReviewCount: manualReview.length,
    },
    create,
    skip_existing: skipExisting,
    manual_review: manualReview,
    invalid_source: invalidSource,
  };

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(
    DRY_RUN_REPORT_JSON_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(DRY_RUN_REPORT_MD_PATH, renderMarkdownReport(report), "utf8");

  console.log(`Dry-run report written to ${DRY_RUN_REPORT_JSON_PATH}`);
  console.log(`Markdown report written to ${DRY_RUN_REPORT_MD_PATH}`);
  console.log(
    JSON.stringify(
      {
        sourceProductCount: report.summary.sourceProductCount,
        createCount: report.summary.createCount,
        skipExistingCount: report.summary.skipExistingCount,
        manualReviewCount: report.summary.manualReviewCount,
        invalidSourceCount: report.summary.invalidSourceCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[plan-techno-smart-import-dry-run] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
