export const PRODUCT_FAQ_MAX_ITEMS = 8;
export const PRODUCT_FAQ_QUESTION_MIN_LENGTH = 3;
export const PRODUCT_FAQ_QUESTION_MAX_LENGTH = 180;
export const PRODUCT_FAQ_ANSWER_MIN_LENGTH = 8;
export const PRODUCT_FAQ_ANSWER_MAX_LENGTH = 1200;

export type ProductFaqItem = {
  question: string;
  answer: string;
};

type ProductFaqStructuredData = {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
};

type ProductFaqBulkParseResult =
  | { success: true; items: ProductFaqItem[] }
  | { success: false; error: string };

const questionPrefixPattern = /^(?:q|question)\s*:\s*(.*)$/i;
const answerPrefixPattern =
  /^(?:a|answer|reponse|réponse)\s*:\s*(.*)$/i;
const separatorPattern = /^-{3,}$/;

function normalizeFaqText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
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

export function buildProductFaqStructuredData(
  value: unknown,
): ProductFaqStructuredData | null {
  const faqItems = normalizeProductFaqItems(value);
  if (!faqItems.length) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function validateParsedFaqItem(
  item: ProductFaqItem,
  index: number,
  seenQuestions: Set<string>,
): string | null {
  if (item.question.length < PRODUCT_FAQ_QUESTION_MIN_LENGTH) {
    return `La question ${index} est trop courte.`;
  }
  if (item.question.length > PRODUCT_FAQ_QUESTION_MAX_LENGTH) {
    return `La question ${index} dépasse ${PRODUCT_FAQ_QUESTION_MAX_LENGTH} caractères.`;
  }
  if (item.answer.length < PRODUCT_FAQ_ANSWER_MIN_LENGTH) {
    return `La réponse ${index} est trop courte.`;
  }
  if (item.answer.length > PRODUCT_FAQ_ANSWER_MAX_LENGTH) {
    return `La réponse ${index} dépasse ${PRODUCT_FAQ_ANSWER_MAX_LENGTH} caractères.`;
  }

  const questionKey = item.question.toLocaleLowerCase();
  if (seenQuestions.has(questionKey)) {
    return `La question ${index} est en double.`;
  }

  seenQuestions.add(questionKey);
  return null;
}

export function parseBulkProductFaqInput(
  input: string,
  options?: {
    existingCount?: number;
    existingQuestions?: string[];
    maxItems?: number;
  },
): ProductFaqBulkParseResult {
  const normalizedInput = normalizeFaqText(input);
  if (!normalizedInput) {
    return {
      success: false,
      error: "Collez au moins une question et une réponse.",
    };
  }

  const maxItems = options?.maxItems ?? PRODUCT_FAQ_MAX_ITEMS;
  const existingCount = Math.max(0, options?.existingCount ?? 0);
  const items: ProductFaqItem[] = [];
  const seenQuestions = new Set(
    (options?.existingQuestions ?? [])
      .map((question) => normalizeFaqText(question).toLocaleLowerCase())
      .filter(Boolean),
  );
  let currentQuestion = "";
  let answerLines: string[] = [];
  let hasAnswer = false;

  const finalizeCurrentItem = () => {
    if (!currentQuestion && !answerLines.length) {
      return null;
    }

    const item = {
      question: normalizeFaqText(currentQuestion),
      answer: normalizeFaqText(answerLines.join("\n")),
    } satisfies ProductFaqItem;
    const validationError = validateParsedFaqItem(
      item,
      existingCount + items.length + 1,
      seenQuestions,
    );
    if (validationError) {
      return validationError;
    }

    items.push(item);
    currentQuestion = "";
    answerLines = [];
    hasAnswer = false;
    return null;
  };

  for (const rawLine of normalizedInput.split("\n")) {
    const line = rawLine.trimEnd();
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      if (hasAnswer) {
        answerLines.push("");
      }
      continue;
    }

    if (separatorPattern.test(trimmedLine)) {
      const separatorError = finalizeCurrentItem();
      if (separatorError) {
        return { success: false, error: separatorError };
      }
      continue;
    }

    const questionMatch = trimmedLine.match(questionPrefixPattern);
    if (questionMatch) {
      const questionText = normalizeFaqText(questionMatch[1]);
      if (!questionText) {
        return {
          success: false,
          error: "Chaque FAQ importée doit contenir une question.",
        };
      }

      if (currentQuestion || answerLines.length) {
        const questionError = finalizeCurrentItem();
        if (questionError) {
          return { success: false, error: questionError };
        }
      }

      currentQuestion = questionText;
      continue;
    }

    const answerMatch = trimmedLine.match(answerPrefixPattern);
    if (answerMatch) {
      if (!currentQuestion) {
        return {
          success: false,
          error: "Chaque réponse doit être précédée d’une question.",
        };
      }

      answerLines = [answerMatch[1]];
      hasAnswer = true;
      continue;
    }

    if (hasAnswer) {
      answerLines.push(line);
      continue;
    }

    return {
      success: false,
      error:
        "Utilisez le format \"Question: ...\" puis \"Réponse: ...\" pour chaque FAQ.",
    };
  }

  const finalError = finalizeCurrentItem();
  if (finalError) {
    return { success: false, error: finalError };
  }

  if (!items.length) {
    return {
      success: false,
      error: "Aucune FAQ valide n’a été détectée dans le texte collé.",
    };
  }

  if (existingCount + items.length > maxItems) {
    return {
      success: false,
      error: `Vous pouvez enregistrer au maximum ${maxItems} FAQs par produit.`,
    };
  }

  return { success: true, items };
}
