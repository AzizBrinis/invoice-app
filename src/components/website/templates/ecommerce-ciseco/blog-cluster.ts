import {
  normalizeCatalogCategorySlug,
  resolveCatalogCategoryLabel,
} from "@/lib/catalog-category";
import type {
  CatalogProduct,
  CatalogWebsiteBlogPostSummary,
} from "@/server/website";

export type BlogClusterArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
  tags?: string[];
  featured?: boolean;
  publishDate?: string | null;
};

export type BlogClusterCollection = {
  slug: string;
  label: string;
  productCount: number;
};

export type BlogTopicHubEntry = {
  id: string;
  articleSlug: string;
  articleTitle: string;
  description: string;
  collectionSlug: string | null;
  collectionLabel: string | null;
  productSlug: string | null;
  productName: string | null;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "avec",
  "aux",
  "ce",
  "ces",
  "choisir",
  "comment",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "entre",
  "et",
  "for",
  "how",
  "la",
  "le",
  "les",
  "leur",
  "mais",
  "ou",
  "par",
  "pour",
  "pro",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "the",
  "une",
  "versus",
  "vs",
  "votre",
]);

function normalizeKeywordSource(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractKeywords(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const keywords: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeKeywordSource(value ?? "");
    if (!normalized) {
      return;
    }
    normalized.split(/\s+/).forEach((token) => {
      if (token.length < 3 || STOP_WORDS.has(token) || seen.has(token)) {
        return;
      }
      seen.add(token);
      keywords.push(token);
    });
  });

  return keywords;
}

function buildArticleSignals(article: BlogClusterArticle) {
  const phrases = [
    article.title,
    article.excerpt,
    article.category,
    ...(article.tags ?? []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return {
    phrases: phrases.map((value) => normalizeKeywordSource(value)),
    keywords: extractKeywords(phrases),
  };
}

function scoreTextMatch(haystack: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => {
    return haystack.includes(keyword) ? score + 2 : score;
  }, 0);
}

function scorePhraseMatch(haystack: string, phrases: string[]) {
  return phrases.reduce((score, phrase) => {
    if (!phrase || phrase.length < 4) {
      return score;
    }
    return haystack.includes(phrase) ? score + 6 : score;
  }, 0);
}

function scoreProductMatch(
  product: CatalogProduct,
  article: BlogClusterArticle,
) {
  const signals = buildArticleSignals(article);
  const productText = normalizeKeywordSource(
    [
      product.name,
      product.sku,
      product.category,
      product.metaTitle,
      product.metaDescription,
      product.excerpt,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!productText) {
    return 0;
  }

  let score =
    scorePhraseMatch(productText, signals.phrases) +
    scoreTextMatch(productText, signals.keywords);

  const articleCategorySlug = normalizeCatalogCategorySlug(article.category);
  const productCategorySlug = normalizeCatalogCategorySlug(product.category);
  if (
    articleCategorySlug &&
    productCategorySlug &&
    articleCategorySlug === productCategorySlug
  ) {
    score += 8;
  }

  if (signals.keywords.some((keyword) => product.name.toLocaleLowerCase().includes(keyword))) {
    score += 4;
  }

  return score;
}

function sortByDate(left?: string | null, right?: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return rightTime - leftTime;
}

export function rankRelatedBlogPosts<T extends BlogClusterArticle>(
  current: BlogClusterArticle,
  posts: T[],
) {
  const currentSignals = buildArticleSignals(current);

  return posts
    .filter((post) => post.slug !== current.slug)
    .map((post) => {
      const postSignals = buildArticleSignals(post);
      const sharedKeywords = postSignals.keywords.filter((keyword) =>
        currentSignals.keywords.includes(keyword),
      ).length;
      const sharedPhrases = postSignals.phrases.filter((phrase) =>
        currentSignals.phrases.includes(phrase),
      ).length;
      const sameCategory =
        normalizeCatalogCategorySlug(post.category) !== null &&
        normalizeCatalogCategorySlug(post.category) ===
          normalizeCatalogCategorySlug(current.category);

      const score =
        sharedKeywords * 3 +
        sharedPhrases * 7 +
        (sameCategory ? 8 : 0) +
        ((post.tags ?? []).filter((tag) => current.tags?.includes(tag)).length * 6);

      return { post, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (Boolean(right.post.featured) !== Boolean(left.post.featured)) {
        return right.post.featured ? 1 : -1;
      }
      return sortByDate(left.post.publishDate, right.post.publishDate);
    })
    .map((entry) => entry.post);
}

export function matchBlogProducts(
  article: BlogClusterArticle,
  products: CatalogProduct[],
  maxItems = 3,
) {
  return products
    .map((product) => ({
      product,
      score: scoreProductMatch(product, article),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.product.name.localeCompare(right.product.name);
    })
    .slice(0, maxItems)
    .map((entry) => entry.product);
}

export function matchBlogCollections(
  article: BlogClusterArticle,
  products: CatalogProduct[],
  maxItems = 2,
): BlogClusterCollection[] {
  const matches = new Map<string, BlogClusterCollection>();

  matchBlogProducts(article, products, 8).forEach((product) => {
    const slug = normalizeCatalogCategorySlug(product.category);
    if (!slug) {
      return;
    }

    const existing = matches.get(slug);
    if (existing) {
      existing.productCount += 1;
      return;
    }

    matches.set(slug, {
      slug,
      label: resolveCatalogCategoryLabel(product.category) ?? slug,
      productCount: 1,
    });
  });

  return Array.from(matches.values())
    .sort((left, right) => right.productCount - left.productCount)
    .slice(0, maxItems);
}

export function buildBlogTopicHubEntries(
  articles: BlogClusterArticle[],
  products: CatalogProduct[],
  maxItems = 3,
): BlogTopicHubEntry[] {
  return articles
    .flatMap((article) => {
      const collection = matchBlogCollections(article, products, 1)[0] ?? null;
      const product = matchBlogProducts(article, products, 1)[0] ?? null;

      if (!collection && !product) {
        return [];
      }

      return [
        {
          id: `hub-${article.slug}`,
          articleSlug: article.slug,
          articleTitle: article.title,
          description:
            article.excerpt?.trim() ||
            article.category?.trim() ||
            article.title,
          collectionSlug: collection?.slug ?? null,
          collectionLabel: collection?.label ?? null,
          productSlug: product?.publicSlug ?? null,
          productName: product?.name ?? null,
        } satisfies BlogTopicHubEntry,
      ];
    })
    .slice(0, maxItems);
}

export function toBlogClusterArticle(
  post: CatalogWebsiteBlogPostSummary,
): BlogClusterArticle {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags,
    featured: post.featured,
    publishDate: post.publishDate,
  };
}
