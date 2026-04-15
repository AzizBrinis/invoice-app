import { sanitizeProductHtml } from "@/lib/product-html";
import {
  normalizeProductFaqItems,
  PRODUCT_FAQ_ANSWER_MAX_LENGTH,
  PRODUCT_FAQ_ANSWER_MIN_LENGTH,
  PRODUCT_FAQ_MAX_ITEMS,
  PRODUCT_FAQ_QUESTION_MAX_LENGTH,
  PRODUCT_FAQ_QUESTION_MIN_LENGTH,
  type ProductFaqItem,
} from "@/lib/product-faq";
import { assistantConfig } from "@/server/assistant/config";
import { callSelectedModel } from "@/server/assistant/providers";
import { z } from "zod";

const META_TITLE_MAX_LENGTH = 160;
const META_DESCRIPTION_MAX_LENGTH = 260;
const SHORT_DESCRIPTION_HTML_MAX_LENGTH = 600;
const STRONG_META_TITLE_MIN_LENGTH = 30;
const STRONG_META_DESCRIPTION_MIN_LENGTH = 90;
const SOURCE_TEXT_PROMPT_LIMIT = 4_500;
const SOURCE_HTML_PROMPT_LIMIT = 7_500;

const enrichmentPayloadSchema = z.object({
  metaTitle: z.string().trim().min(1).max(220).nullable().optional(),
  metaDescription: z.string().trim().min(1).max(360).nullable().optional(),
  shortDescriptionHtml: z.string().trim().min(1).max(4_000).nullable().optional(),
  descriptionHtml: z.string().trim().min(1).max(20_000).nullable().optional(),
  faqItems: z
    .array(
      z.object({
        question: z.string().trim().min(1),
        answer: z.string().trim().min(1),
      }),
    )
    .max(PRODUCT_FAQ_MAX_ITEMS)
    .nullable()
    .optional(),
});

export type ProductImportEnrichmentInput = {
  name: string;
  category: string | null;
  brand: string | null;
  shortDescriptionText: string | null;
  shortDescriptionHtml: string | null;
  descriptionText: string | null;
  descriptionHtml: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  excerpt: string | null;
  priceAmount: number | null;
  discountAmount: number | null;
  stockQuantity: number | null;
  availability: string | null;
  isActive: boolean;
};

export type ProductImportEnrichmentFallback = {
  metaTitle: string | null;
  metaDescription: string | null;
  shortDescriptionHtml: string | null;
  descriptionHtml: string | null;
  faqItems: ProductFaqItem[] | null;
};

export type ProductImportEnrichmentResult =
  ProductImportEnrichmentFallback & {
    mode: "ai" | "fallback";
    note: string;
    provider: "gemini" | "openai" | null;
  };

function normalizeOptionalString(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function truncateForPrompt(value: string | null | undefined, limit: number) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}\n\n[Contenu tronqué pour l'enrichissement]`;
}

function extractJsonPayload(raw: string) {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1]?.trim() ?? raw.trim();
  }
  return raw.trim();
}

function isAiConfigured() {
  if (process.env.TECHNO_SMART_IMPORT_DISABLE_AI === "1") {
    return false;
  }
  if (assistantConfig.provider === "gemini") {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function isStrongMetaTitle(value: string | null) {
  return Boolean(
    value &&
      value.length >= STRONG_META_TITLE_MIN_LENGTH &&
      value.length <= META_TITLE_MAX_LENGTH,
  );
}

function isStrongMetaDescription(value: string | null) {
  return Boolean(
    value &&
      value.length >= STRONG_META_DESCRIPTION_MIN_LENGTH &&
      value.length <= META_DESCRIPTION_MAX_LENGTH,
  );
}

function normalizeMetaCandidate(value: string | null | undefined, maxLength: number) {
  const normalized = normalizeOptionalString(value);
  if (!normalized || normalized.length > maxLength) {
    return null;
  }
  return normalized;
}

function normalizeHtmlCandidate(
  value: string | null | undefined,
  options: { maxLength?: number } = {},
) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  const sanitized = normalizeOptionalString(sanitizeProductHtml(normalized));
  if (!sanitized) {
    return null;
  }
  if (options.maxLength && sanitized.length > options.maxLength) {
    return null;
  }
  return sanitized;
}

function validateFaqItems(value: ProductFaqItem[]) {
  const seenQuestions = new Set<string>();
  for (const item of value) {
    if (item.question.length < PRODUCT_FAQ_QUESTION_MIN_LENGTH) {
      return false;
    }
    if (item.question.length > PRODUCT_FAQ_QUESTION_MAX_LENGTH) {
      return false;
    }
    if (item.answer.length < PRODUCT_FAQ_ANSWER_MIN_LENGTH) {
      return false;
    }
    if (item.answer.length > PRODUCT_FAQ_ANSWER_MAX_LENGTH) {
      return false;
    }
    const questionKey = item.question.toLocaleLowerCase();
    if (seenQuestions.has(questionKey)) {
      return false;
    }
    seenQuestions.add(questionKey);
  }
  return true;
}

function normalizeFaqCandidate(
  value: Array<{ question: string; answer: string }> | null | undefined,
) {
  const faqItems = normalizeProductFaqItems(value);
  if (!faqItems.length) {
    return null;
  }
  if (faqItems.length > PRODUCT_FAQ_MAX_ITEMS) {
    return null;
  }
  if (!validateFaqItems(faqItems)) {
    return null;
  }
  return faqItems;
}

function formatEnrichmentError(error: unknown) {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    if (!firstIssue) {
      return "invalid AI enrichment payload.";
    }
    const path = firstIssue.path.join(".") || "payload";
    return `invalid AI enrichment payload (${path}: ${firstIssue.message}).`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown model error.";
}

function buildSystemPrompt() {
  return [
    "Tu es un éditeur SEO produit pour un import e-commerce.",
    "Tu travailles uniquement à partir des faits présents dans la fiche source.",
    "N'invente jamais des spécifications techniques, garanties, durées de licence, compatibilités, prix, promotions, disponibilité, délais ou engagements commerciaux.",
    "Écris en français sauf si la source est clairement dans une autre langue.",
    "Pour le HTML, utilise des balises simples et sûres comme <p>, <ul>, <li>, <strong>, <em>, <h3>, <br>, <a>, <img>.",
    "Ne crée jamais de nouvelles URL d'image ou de lien. Tu peux conserver des URLs déjà présentes dans le HTML source si elles sont utiles.",
    "Renvoie uniquement du JSON valide, sans explication et sans bloc markdown.",
  ].join(" ");
}

function buildUserPrompt(options: {
  source: ProductImportEnrichmentInput;
  fallback: ProductImportEnrichmentFallback;
}) {
  const sourcePayload = {
    title: options.source.name,
    category: options.source.category,
    brand: options.source.brand,
    sourceMetaTitle: options.source.metaTitle,
    sourceMetaDescription: options.source.metaDescription,
    shortDescriptionText: truncateForPrompt(
      options.source.shortDescriptionText,
      SOURCE_TEXT_PROMPT_LIMIT,
    ),
    shortDescriptionHtml: truncateForPrompt(
      options.source.shortDescriptionHtml,
      SOURCE_HTML_PROMPT_LIMIT,
    ),
    fullDescriptionText: truncateForPrompt(
      options.source.descriptionText,
      SOURCE_TEXT_PROMPT_LIMIT,
    ),
    fullDescriptionHtml: truncateForPrompt(
      options.source.descriptionHtml,
      SOURCE_HTML_PROMPT_LIMIT,
    ),
    excerpt: options.source.excerpt,
    priceAmount: options.source.priceAmount,
    discountAmount: options.source.discountAmount,
    stockQuantity: options.source.stockQuantity,
    availability: options.source.availability,
    isActive: options.source.isActive,
    fallbackMetaTitle: options.fallback.metaTitle,
    fallbackMetaDescription: options.fallback.metaDescription,
  };

  const constraints = [
    `- metaTitle: maximum ${META_TITLE_MAX_LENGTH} caractères.`,
    `- metaDescription: maximum ${META_DESCRIPTION_MAX_LENGTH} caractères.`,
    `- shortDescriptionHtml: HTML court, puissant, maximum ${SHORT_DESCRIPTION_HTML_MAX_LENGTH} caractères au total.`,
    "- descriptionHtml: HTML propre, fidèle à la source, sans faits inventés.",
    `- faqItems: 3 à 5 FAQ maximum, et seulement si la source permet des réponses factuelles. Sinon renvoie [].`,
    "- Si le meta title ou la meta description source sont déjà solides, tu peux les conserver avec une légère amélioration seulement.",
    "- Ne mentionne pas un prix ou une disponibilité précise si tu n'en as pas besoin pour rester fidèle et durable.",
  ];

  return [
    "Produit source :",
    JSON.stringify(sourcePayload, null, 2),
    "",
    "Contraintes :",
    ...constraints,
    "",
    'Réponds strictement avec ce JSON : {"metaTitle":"...","metaDescription":"...","shortDescriptionHtml":"...","descriptionHtml":"...","faqItems":[{"question":"...","answer":"..."}]}.',
  ].join("\n");
}

export async function enrichImportedProductContent(options: {
  source: ProductImportEnrichmentInput;
  fallback: ProductImportEnrichmentFallback;
}): Promise<ProductImportEnrichmentResult> {
  const fallback = {
    metaTitle: normalizeOptionalString(options.fallback.metaTitle),
    metaDescription: normalizeOptionalString(options.fallback.metaDescription),
    shortDescriptionHtml: normalizeHtmlCandidate(
      options.fallback.shortDescriptionHtml,
      { maxLength: SHORT_DESCRIPTION_HTML_MAX_LENGTH },
    ),
    descriptionHtml: normalizeHtmlCandidate(options.fallback.descriptionHtml),
    faqItems: options.fallback.faqItems?.length ? options.fallback.faqItems : null,
  } satisfies ProductImportEnrichmentFallback;

  if (!isAiConfigured()) {
    return {
      ...fallback,
      mode: "fallback",
      note: "AI enrichment skipped because import AI is disabled or provider credentials are unavailable.",
      provider: null,
    };
  }

  try {
    const response = await callSelectedModel({
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(options),
        },
      ],
      tools: [],
    });

    const content = normalizeOptionalString(response.content);
    if (!content) {
      throw new Error("Empty AI enrichment response.");
    }

    const parsedJson = JSON.parse(extractJsonPayload(content)) as unknown;
    const parsed = enrichmentPayloadSchema.parse(parsedJson);

    const aiMetaTitle = normalizeMetaCandidate(
      parsed.metaTitle,
      META_TITLE_MAX_LENGTH,
    );
    const aiMetaDescription = normalizeMetaCandidate(
      parsed.metaDescription,
      META_DESCRIPTION_MAX_LENGTH,
    );
    const aiShortDescriptionHtml = normalizeHtmlCandidate(
      parsed.shortDescriptionHtml,
      { maxLength: SHORT_DESCRIPTION_HTML_MAX_LENGTH },
    );
    const aiDescriptionHtml = normalizeHtmlCandidate(parsed.descriptionHtml);
    const aiFaqItems = normalizeFaqCandidate(parsed.faqItems);

    const result: ProductImportEnrichmentFallback = {
      metaTitle: isStrongMetaTitle(fallback.metaTitle)
        ? fallback.metaTitle
        : aiMetaTitle ?? fallback.metaTitle,
      metaDescription: isStrongMetaDescription(fallback.metaDescription)
        ? fallback.metaDescription
        : aiMetaDescription ?? fallback.metaDescription,
      shortDescriptionHtml:
        aiShortDescriptionHtml ?? fallback.shortDescriptionHtml ?? null,
      descriptionHtml: aiDescriptionHtml ?? fallback.descriptionHtml ?? null,
      faqItems: aiFaqItems ?? fallback.faqItems ?? null,
    };

    const usedAi = Boolean(
      (!isStrongMetaTitle(fallback.metaTitle) && aiMetaTitle) ||
        (!isStrongMetaDescription(fallback.metaDescription) &&
          aiMetaDescription) ||
        aiShortDescriptionHtml ||
        aiDescriptionHtml ||
        aiFaqItems,
    );

    if (!usedAi) {
      return {
        ...fallback,
        mode: "fallback",
        note:
          "AI enrichment returned no safely usable changes, so sanitized source content was kept.",
        provider: assistantConfig.provider,
      };
    }

    return {
      ...result,
      mode: "ai",
      note: `AI enrichment applied with provider ${assistantConfig.provider}.`,
      provider: assistantConfig.provider,
    };
  } catch (error) {
    const formattedError = formatEnrichmentError(error);
    console.warn("[product-import-ai] fallback", formattedError);
    return {
      ...fallback,
      mode: "fallback",
      note: `AI enrichment fallback: ${formattedError}`,
      provider: assistantConfig.provider,
    };
  }
}
