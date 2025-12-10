import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCurrencyInfo,
  getDefaultCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency";

const MAX_CLIENT_CANDIDATES = 60;
const MAX_PRODUCT_CANDIDATES = 120;
const MIN_PRODUCT_CONFIDENCE = 0.2;
const FUZZY_SIMILARITY_THRESHOLD = 0.72;
const INSENSITIVE_MODE: Prisma.QueryMode = "insensitive";

type SearchTokenKind = "text" | "digits" | "email";

export type SearchToken = {
  kind: SearchTokenKind;
  value: string;
};

const clientSearchSelect = Prisma.validator<Prisma.ClientSelect>()({
  id: true,
  displayName: true,
  companyName: true,
  email: true,
  phone: true,
  vatNumber: true,
  updatedAt: true,
});

type ClientCandidate = Prisma.ClientGetPayload<{
  select: typeof clientSearchSelect;
}>;

const productSearchSelect = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  name: true,
  sku: true,
  description: true,
  category: true,
  unit: true,
  priceHTCents: true,
  priceTTCCents: true,
  vatRate: true,
  updatedAt: true,
});

type ProductCandidate = Prisma.ProductGetPayload<{
  select: typeof productSearchSelect;
}>;

type ProductCandidateWithCurrency = ProductCandidate & {
  currency: string;
};

type NormalizedProductCandidate = ProductCandidate & {
  normalizedName: string;
  normalizedSku: string;
  normalizedCategory: string;
  normalizedDescription: string;
  normalizedSkuDigits: string;
};

const DIACRITIC_REGEX = /[\u0300-\u036f]/g;
const NON_WORD_REGEX = /[^a-z0-9@.\s]/gi;
const MULTI_SPACE_REGEX = /\s+/g;
const PRICE_HINT_REGEX = /(?:\b(prix|price|ht|ttc|eur|tnd|dt|mad|dh|usd)\b|€)/i;
const INLINE_PRICE_CAPTURE_REGEX =
  /(\d[\d\s\u00a0\u202f.,]*)(?:(?<![a-z])(eur|tnd|dt|mad|dh|usd)(?![a-z])|€)/gi;
const NUMBER_REGEX = /[-+]?\d{1,3}(?:[\s\u00a0\u202f.,]?\d{3})*(?:[.,]\d+)?/g;
const PRICE_EXACT_TOLERANCE_RATIO = 0.01; // 1%
const PRICE_EXACT_TOLERANCE_MIN = 50; // 0.50 in cents

export function normalizeSearchText(value?: string | null) {
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

export function normalizeDigits(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.replace(/\D+/g, "");
}

export function normalizeEmail(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase();
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1).fill(0);

  for (let i = 0; i < a.length; i++) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + cost,
      );
    }
    for (let j = 0; j < previous.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function similarityScore(a: string, b: string) {
  const max = Math.max(a.length, b.length);
  if (max === 0) {
    return 1;
  }
  const distance = levenshteinDistance(a, b);
  return 1 - distance / max;
}

function uniqueTokens(tokens: SearchToken[]) {
  const map = new Map<string, SearchToken>();
  tokens.forEach((token) => {
    if (!token.value) {
      return;
    }
    map.set(`${token.kind}:${token.value}`, token);
  });
  return Array.from(map.values());
}

export function tokenizeSearchQuery(query: string): SearchToken[] {
  const normalized = normalizeSearchText(query);
  const tokens: SearchToken[] = [];
  if (normalized) {
    tokens.push({ kind: "text", value: normalized });
    normalized
      .split(" ")
      .filter((part) => part.length >= 2)
      .forEach((part) => tokens.push({ kind: "text", value: part }));
  }
  const digitsOnly = normalizeDigits(query);
  if (digitsOnly.length >= 4) {
    tokens.push({ kind: "digits", value: digitsOnly });
  }
  if (query.includes("@")) {
    const emailToken = normalizeEmail(query);
    if (emailToken) {
      tokens.push({ kind: "email", value: emailToken });
    }
  }
  return uniqueTokens(tokens);
}

function buildProductSearchTerms(query: string) {
  const trimmed = query.trim();
  const normalized = normalizeSearchText(query);
  const terms = new Set<string>();

  if (trimmed) {
    terms.add(trimmed);
    trimmed
      .split(MULTI_SPACE_REGEX)
      .filter((part) => part.length >= 2)
      .forEach((part) => terms.add(part));
  }

  if (normalized) {
    terms.add(normalized);
    normalized
      .split(" ")
      .filter((part) => part.length >= 2)
      .forEach((part) => terms.add(part));
  }

  const digits = normalizeDigits(query);

  return {
    terms: Array.from(terms.values()),
    digits: digits.length >= 3 ? digits : "",
  };
}

function detectCurrencyFromQuery(query: string): CurrencyCode {
  const lower = query.toLowerCase();
  if (lower.includes("eur") || lower.includes("€")) {
    return "EUR";
  }
  if (lower.includes("usd") || lower.includes("dollar")) {
    return "USD";
  }
  if (lower.includes("gbp") || lower.includes("£")) {
    return "GBP";
  }
  if (lower.includes("cad")) {
    return "CAD";
  }
  if (lower.includes("tnd") || lower.includes(" dt")) {
    return "TND";
  }
  return getDefaultCurrencyCode();
}

function parsePriceToMinorUnits(raw: string, currency: CurrencyCode): number | null {
  const compact = raw.replace(/[\s\u00a0\u202f]/g, "");
  const withoutThousands = compact.replace(
    /(?<=\d)[.,](?=\d{3}(?:\D|$))/g,
    "",
  );
  const normalized = withoutThousands.replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const factor = 10 ** getCurrencyInfo(currency).decimals;
  return Math.round(value * factor);
}

function extractPriceCents(query: string): number | null {
  const currency = detectCurrencyFromQuery(query);
  const inlineMatches = Array.from(query.matchAll(INLINE_PRICE_CAPTURE_REGEX));
  if (inlineMatches.length) {
    const lastInline = inlineMatches[inlineMatches.length - 1];
    const cents = parsePriceToMinorUnits(lastInline[1] ?? "", currency);
    if (cents !== null) {
      return cents;
    }
  }

  if (!PRICE_HINT_REGEX.test(query)) {
    return null;
  }

  const numberMatches = Array.from(query.matchAll(NUMBER_REGEX));
  if (!numberMatches.length) {
    return null;
  }

  const hintIndex = query.search(PRICE_HINT_REGEX);
  const bestMatch =
    hintIndex >= 0
      ? numberMatches.reduce((best, current) => {
          const currentIndex = current.index ?? 0;
          const bestIndex = best.index ?? 0;
          const currentDistance = Math.abs(currentIndex - hintIndex);
          const bestDistance = Math.abs(bestIndex - hintIndex);
          if (currentDistance < bestDistance) {
            return current;
          }
          if (currentDistance === bestDistance && currentIndex > bestIndex) {
            return current;
          }
          return best;
        }, numberMatches[0]!)
      : numberMatches[numberMatches.length - 1]!;

  return parsePriceToMinorUnits(bestMatch[0] ?? "", currency);
}

function computePriceTolerance(priceCents: number | null | undefined) {
  if (!priceCents || priceCents <= 0) {
    return null;
  }
  return Math.max(PRICE_EXACT_TOLERANCE_MIN, Math.round(priceCents * PRICE_EXACT_TOLERANCE_RATIO));
}

function isPriceMatch(candidate: ProductCandidate, targetPrice: number, tolerance: number | null) {
  const prices = [candidate.priceHTCents, candidate.priceTTCCents];
  return prices.some((price) => {
    if (price == null) return false;
    const diff = Math.abs(price - targetPrice);
    return tolerance != null ? diff <= tolerance : diff === 0;
  });
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsExactPhrase(query: string, phrase: string) {
  if (!phrase || phrase.length < 3) {
    return false;
  }
  const pattern = new RegExp(`(?:^|\\s)${escapeRegex(phrase)}(?:\\s|$)`);
  return pattern.test(query);
}

function withNormalizedProduct(candidate: ProductCandidate): NormalizedProductCandidate {
  return {
    ...candidate,
    normalizedName: normalizeSearchText(candidate.name),
    normalizedSku: normalizeSearchText(candidate.sku ?? ""),
    normalizedCategory: normalizeSearchText(candidate.category ?? ""),
    normalizedDescription: normalizeSearchText(candidate.description ?? ""),
    normalizedSkuDigits: normalizeDigits(candidate.sku ?? ""),
  };
}

export type ClientSearchMatch = ClientCandidate & {
  confidence: number;
  matchFields: string[];
};

export type ProductSearchMatch = ProductCandidateWithCurrency & {
  confidence: number;
  matchFields: string[];
};

export type ProductSearchResult = {
  matches: ProductSearchMatch[];
  bestConfidence: number;
  hasExactMatch: boolean;
};

export function scoreClientCandidate(
  candidate: ClientCandidate,
  tokens: SearchToken[],
): { confidence: number; matchFields: string[] } {
  if (!tokens.length) {
    return { confidence: 0.35, matchFields: [] };
  }
  const normalized = {
    displayName: normalizeSearchText(candidate.displayName),
    companyName: normalizeSearchText(candidate.companyName ?? ""),
    email: normalizeEmail(candidate.email ?? ""),
    phone: normalizeDigits(candidate.phone ?? ""),
    vatNumber: normalizeDigits(candidate.vatNumber ?? ""),
  };
  let weight = 0;
  const matchedFields = new Set<string>();

  const matchTextToken = (token: string) => {
    const textFields: Array<[string, string]> = [
      ["displayName", normalized.displayName],
      ["companyName", normalized.companyName],
      ["email", normalized.email],
    ];
    for (const [field, value] of textFields) {
      if (!value) continue;
      if (value === token) {
        weight += field === "email" ? 4 : 3;
        matchedFields.add(field);
        return true;
      }
      if (value.includes(token)) {
        weight += field === "email" ? 3 : 2;
        matchedFields.add(field);
        return true;
      }
    }
    return false;
  };

  const matchDigitToken = (token: string) => {
    const digitFields: Array<[string, string]> = [
      ["phone", normalized.phone],
      ["vatNumber", normalized.vatNumber],
    ];
    for (const [field, value] of digitFields) {
      if (!value) continue;
      if (value.endsWith(token) || value.includes(token)) {
        weight += 2;
        matchedFields.add(field);
        return true;
      }
    }
    return false;
  };

  for (const token of tokens) {
    if (token.kind === "email") {
      if (matchTextToken(token.value)) {
        continue;
      }
      if (normalized.email && normalized.email.includes(token.value)) {
        weight += 3;
        matchedFields.add("email");
      }
      continue;
    }
    if (token.kind === "digits") {
      matchDigitToken(token.value);
      continue;
    }
    matchTextToken(token.value);
  }

  const maxWeight = tokens.length * 4 || 4;
  const confidence = Math.min(1, weight / maxWeight);
  return {
    confidence,
    matchFields: Array.from(matchedFields),
  };
}

export function scoreProductCandidate(
  candidate: ProductCandidate | NormalizedProductCandidate,
  tokens: SearchToken[],
  options?: { priceCents?: number | null },
): { confidence: number; matchFields: string[] } {
  if (!tokens.length && !options?.priceCents) {
    return { confidence: 0.35, matchFields: [] };
  }
  const normalizedCandidate: NormalizedProductCandidate =
    "normalizedName" in candidate
      ? (candidate as NormalizedProductCandidate)
      : withNormalizedProduct(candidate as ProductCandidate);
  let weight = 0;
  const matchedFields = new Set<string>();

  const fuzzyMatch = (value: string, token: string) => {
    if (!value || token.length < 3) {
      return 0;
    }
    const directSimilarity = similarityScore(value, token);
    const wordSimilarity = value
      .split(" ")
      .reduce((best, part) => Math.max(best, similarityScore(part, token)), 0);
    return Math.max(directSimilarity, wordSimilarity);
  };

  const matchText = (token: string) => {
    const fields: Array<[string, string]> = [
      ["sku", normalizedCandidate.normalizedSku],
      ["name", normalizedCandidate.normalizedName],
      ["category", normalizedCandidate.normalizedCategory],
      ["description", normalizedCandidate.normalizedDescription],
    ];
    for (const [field, value] of fields) {
      if (!value) continue;
      if (value === token) {
        weight += field === "sku" ? 6 : 5;
        matchedFields.add(field);
        return true;
      }
      if (value.startsWith(token)) {
        weight += field === "sku" ? 4 : 3.5;
        matchedFields.add(field);
        return true;
      }
      if (value.includes(token)) {
        weight += field === "sku" ? 3 : 2.5;
        matchedFields.add(field);
        return true;
      }
      const similarity = fuzzyMatch(value, token);
      if (similarity >= FUZZY_SIMILARITY_THRESHOLD) {
        weight += field === "sku" ? 2.5 : 1.5;
        matchedFields.add(field);
        return true;
      }
    }
    return false;
  };

  const matchDigits = (token: string) => {
    if (
      normalizedCandidate.normalizedSkuDigits &&
      normalizedCandidate.normalizedSkuDigits.includes(token)
    ) {
      weight += 3;
      matchedFields.add("sku");
      return true;
    }
    return false;
  };

  const priceWeight = (() => {
    let priceMatched = false;
    const priceCents = options?.priceCents;
    if (!priceCents) {
      return { weight: 0, priceMatched: false, strongMatch: false };
    }
    const basePrice = normalizedCandidate.priceHTCents;
    const ttcPrice = (normalizedCandidate as any).priceTTCCents as number | undefined;
    const candidatePrice = Number.isFinite(basePrice) ? basePrice : ttcPrice ?? 0;
    const denominator = Math.max(priceCents, candidatePrice, 1);
    const ratio = Math.abs(priceCents - candidatePrice) / denominator;
    const tolerance = computePriceTolerance(priceCents);

    if (ratio === 0) {
      priceMatched = true;
      return { weight: 8, priceMatched: true, strongMatch: true };
    }
    if (tolerance != null && Math.abs(priceCents - candidatePrice) <= tolerance) {
      priceMatched = true;
      if (ratio <= 0.01) {
        matchedFields.add("price");
        return { weight: 6, priceMatched: true, strongMatch: true };
      }
      if (ratio <= 0.05) {
        matchedFields.add("price");
        return { weight: 4, priceMatched: true, strongMatch: false };
      }
      if (ratio <= 0.1) {
        matchedFields.add("price");
        return { weight: 2.5, priceMatched: true, strongMatch: false };
      }
    }
    if (ratio <= 0.0001) {
      priceMatched = true;
      matchedFields.add("price");
      return { weight: 5, priceMatched: true, strongMatch: true };
    }
    if (ratio <= 0.01) {
      priceMatched = true;
      matchedFields.add("price");
      return { weight: 4, priceMatched: true, strongMatch: true };
    }
    if (ratio <= 0.05) {
      priceMatched = true;
      matchedFields.add("price");
      return { weight: 3.5, priceMatched: true, strongMatch: false };
    }
    if (ratio <= 0.1) {
      priceMatched = true;
      matchedFields.add("price");
      return { weight: 2, priceMatched: true, strongMatch: false };
    }
    return { weight: 0, priceMatched, strongMatch: false };
  })();

  for (const token of tokens) {
    if (token.kind === "digits") {
      matchDigits(token.value);
      continue;
    }
    matchText(token.value);
  }

  weight += priceWeight.weight;

  const maxWeightBase = tokens.length ? tokens.length * 6 : 4;
  const maxWeight = maxWeightBase + (options?.priceCents ? 8 : 0);
  let confidence = Math.min(1, weight / maxWeight);
  if (priceWeight.priceMatched) {
    confidence = Math.max(confidence, priceWeight.strongMatch ? 0.9 : 0.7);
  }
  return {
    confidence,
    matchFields: Array.from(matchedFields),
  };
}

function sortMatches<T extends { confidence: number; updatedAt: Date; name?: string; displayName?: string }>(
  matches: T[],
) {
  return [...matches].sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    if (b.updatedAt.getTime() !== a.updatedAt.getTime()) {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    const aLabel = ("displayName" in a ? a.displayName : a.name) ?? "";
    const bLabel = ("displayName" in b ? b.displayName : b.name) ?? "";
    return aLabel.localeCompare(bLabel);
  });
}

function sortProductMatches(
  matches: Array<ProductSearchMatch & { updatedAt: Date }>,
  options?: { priceCents?: number | null },
) {
  const priceTarget = options?.priceCents;
  return [...matches].sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    if (priceTarget != null) {
      const diffA = Math.abs(a.priceHTCents - priceTarget);
      const diffB = Math.abs(b.priceHTCents - priceTarget);
      if (diffA !== diffB) {
        return diffA - diffB;
      }
    }
    if (b.updatedAt.getTime() !== a.updatedAt.getTime()) {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    const aLabel = a.name ?? "";
    const bLabel = b.name ?? "";
    return aLabel.localeCompare(bLabel);
  });
}

export async function searchClientsForAssistant(
  userId: string,
  query: string,
  limit: number,
): Promise<ClientSearchMatch[]> {
  const tokens = tokenizeSearchQuery(query);
  const candidates = await fetchClientCandidates(userId, query, limit);
  const scored = candidates.map((candidate) => ({
    ...candidate,
    ...scoreClientCandidate(candidate, tokens),
  }));
  const filtered = scored.filter(
    (entry) => entry.confidence > 0 || tokens.length === 0,
  );
  return sortMatches(filtered).slice(0, limit);
}

export async function searchProductsForAssistant(
  userId: string,
  query: string,
  limit: number,
  options?: { candidates?: ProductCandidate[] },
): Promise<ProductSearchResult> {
  const tokens = tokenizeSearchQuery(query);
  const priceCents = extractPriceCents(query);
  const priceTol = computePriceTolerance(priceCents);
  const normalizedQuery = normalizeSearchText(query);
  const trimmedLower = query.trim().toLowerCase();
  const [baseCandidates, priceCandidates] = await Promise.all([
    options?.candidates
      ? Promise.resolve(options.candidates)
      : fetchProductCandidates(userId, query, limit, { priceCents }),
    options?.candidates || priceCents == null
      ? Promise.resolve([] as ProductCandidate[])
      : fetchPriceCandidates(userId, priceCents, priceTol),
  ]);
  const normalizedCandidates = dedupeById([
    ...baseCandidates,
    ...priceCandidates,
  ]).map(withNormalizedProduct);
  const defaultCurrency = getDefaultCurrencyCode();

  const exactNameOrSkuMatches = normalizedCandidates.filter((candidate) => {
    if (!trimmedLower && !normalizedQuery) {
      return false;
    }
    const nameLower = candidate.name.trim().toLowerCase();
    const skuLower = (candidate.sku ?? "").trim().toLowerCase();
    const nameExact =
      (!!trimmedLower && nameLower === trimmedLower) ||
      (!!normalizedQuery && candidate.normalizedName === normalizedQuery) ||
      (!!normalizedQuery && mentionsExactPhrase(normalizedQuery, candidate.normalizedName));
    const skuExact =
      (!!trimmedLower && skuLower === trimmedLower) ||
      (!!normalizedQuery && candidate.normalizedSku === normalizedQuery) ||
      (!!normalizedQuery && mentionsExactPhrase(normalizedQuery, candidate.normalizedSku));
    return nameExact || skuExact;
  });

  const exactPriceMatches =
    priceCents != null
      ? normalizedCandidates.filter((candidate) =>
          isPriceMatch(candidate, priceCents, priceTol),
        )
      : [];

  const exactMatches = dedupeById([...exactNameOrSkuMatches, ...exactPriceMatches]).map(
    (candidate) => {
      const {
        normalizedName,
        normalizedSku,
        normalizedCategory: _normalizedCategory,
        normalizedDescription: _normalizedDescription,
        normalizedSkuDigits: _normalizedSkuDigits,
        ...base
      } = candidate;
      const matchFields: string[] = [];
      if (
        base.name.trim().toLowerCase() === trimmedLower ||
        normalizedName === normalizedQuery ||
        mentionsExactPhrase(normalizedQuery, normalizedName)
      ) {
        matchFields.push("name");
      }
      if (
        (base.sku ?? "").trim().toLowerCase() === trimmedLower ||
        normalizedSku === normalizedQuery ||
        mentionsExactPhrase(normalizedQuery, normalizedSku)
      ) {
        matchFields.push("sku");
      }
      if (priceCents != null && isPriceMatch(base, priceCents, priceTol)) {
        matchFields.push("price");
      }
      return {
        ...base,
        currency: defaultCurrency,
        confidence: 1,
        matchFields: matchFields.length ? matchFields : ["name"],
      };
    },
  );

  if (exactMatches.length) {
    const matches = sortProductMatches(exactMatches, { priceCents }).slice(0, limit);
    return {
      matches,
      bestConfidence: matches[0]?.confidence ?? 0,
      hasExactMatch: true,
    };
  }

  const scored = normalizedCandidates.map((candidate) => {
    const {
      normalizedName: _normalizedName,
      normalizedSku: _normalizedSku,
      normalizedCategory: _normalizedCategory,
      normalizedDescription: _normalizedDescription,
      normalizedSkuDigits: _normalizedSkuDigits,
      ...base
    } = candidate;
    return {
      ...base,
      currency: defaultCurrency,
      ...scoreProductCandidate(candidate, tokens, { priceCents }),
    };
  });
  const filtered = scored.filter((entry) =>
    tokens.length || priceCents ? entry.confidence >= MIN_PRODUCT_CONFIDENCE : true,
  );
  const matches = sortProductMatches(filtered, { priceCents }).slice(0, limit);
  return {
    matches,
    bestConfidence: matches[0]?.confidence ?? 0,
    hasExactMatch: false,
  };
}

async function fetchClientCandidates(
  userId: string,
  query: string,
  limit: number,
) {
  const trimmed = query.trim();
  const take = Math.min(limit * 4, MAX_CLIENT_CANDIDATES);
  const where = trimmed
    ? {
        userId,
        OR: [
          { displayName: { contains: trimmed, mode: INSENSITIVE_MODE } },
          { companyName: { contains: trimmed, mode: INSENSITIVE_MODE } },
          { email: { contains: trimmed, mode: INSENSITIVE_MODE } },
          { phone: { contains: trimmed, mode: INSENSITIVE_MODE } },
          { vatNumber: { contains: trimmed, mode: INSENSITIVE_MODE } },
        ],
      }
    : { userId };
  const primary = await prisma.client.findMany({
    where,
    orderBy: [
      { updatedAt: "desc" },
      { displayName: "asc" },
    ],
    take,
    select: clientSearchSelect,
  });
  if (primary.length >= limit || !trimmed) {
    return dedupeById(primary);
  }
  const fallback = await prisma.client.findMany({
    where: { userId },
    orderBy: [
      { updatedAt: "desc" },
      { displayName: "asc" },
    ],
    take,
    select: clientSearchSelect,
  });
  return dedupeById([...primary, ...fallback]);
}

async function fetchProductCandidates(
  userId: string,
  query: string,
  limit: number,
  options?: { priceCents?: number | null },
) {
  const { terms, digits } = buildProductSearchTerms(query);
  const take = Math.min(Math.max(limit * 6, 30), MAX_PRODUCT_CANDIDATES);
  const priceCents = options?.priceCents ?? null;
  const priceTol = computePriceTolerance(priceCents);

  const orFilters: Prisma.ProductWhereInput[] = [];
  for (const term of terms) {
    orFilters.push(
      { name: { contains: term, mode: INSENSITIVE_MODE } },
      { sku: { contains: term, mode: INSENSITIVE_MODE } },
      { description: { contains: term, mode: INSENSITIVE_MODE } },
      { category: { contains: term, mode: INSENSITIVE_MODE } },
    );
  }
  if (digits) {
    orFilters.push({ sku: { contains: digits, mode: INSENSITIVE_MODE } });
  }
  if (priceCents && priceTol !== null) {
    orFilters.push({
      OR: [
        {
          priceHTCents: {
            gte: Math.max(0, priceCents - priceTol),
            lte: priceCents + priceTol,
          },
        },
        {
          priceTTCCents: {
            gte: Math.max(0, priceCents - priceTol),
            lte: priceCents + priceTol,
          },
        },
      ],
    });
  }

  const where: Prisma.ProductWhereInput = orFilters.length
    ? { userId, OR: orFilters }
    : { userId };

  const primary = await prisma.product.findMany({
    where,
    orderBy: [
      { updatedAt: "desc" },
      { name: "asc" },
    ],
    take,
    select: productSearchSelect,
  });
  if (primary.length >= limit || !orFilters.length) {
    return dedupeById(primary);
  }
  const fallback = await prisma.product.findMany({
    where: { userId },
    orderBy: [
      { updatedAt: "desc" },
      { name: "asc" },
    ],
    take: Math.min(MAX_PRODUCT_CANDIDATES, take + limit * 2),
    select: productSearchSelect,
  });
  return dedupeById([...primary, ...fallback]);
}

async function fetchPriceCandidates(
  userId: string,
  priceCents: number,
  tolerance: number | null,
) {
  const priceFilter =
    tolerance != null
      ? {
          gte: Math.max(0, priceCents - tolerance),
          lte: priceCents + tolerance,
        }
      : { equals: priceCents };
  return prisma.product.findMany({
    where: {
      userId,
      OR: [
        { priceHTCents: priceFilter },
        { priceTTCCents: priceFilter },
      ],
    },
    orderBy: [
      { updatedAt: "desc" },
      { name: "asc" },
    ],
    take: Math.min(40, MAX_PRODUCT_CANDIDATES),
    select: productSearchSelect,
  });
}
