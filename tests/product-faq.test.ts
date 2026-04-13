import { describe, expect, it } from "vitest";
import {
  buildProductFaqStructuredData,
  parseBulkProductFaqInput,
  PRODUCT_FAQ_MAX_ITEMS,
} from "@/lib/product-faq";

describe("product faq helpers", () => {
  it("parses bulk FAQ text into normalized question/answer items", () => {
    const result = parseBulkProductFaqInput(`
Question: Comment vais-je recevoir ma licence Microsoft Office 2021 ?
Réponse: Il s'agit d'un téléchargement numérique.
Vous recevrez votre clé par email après validation.

---
Question: La licence est-elle valable à vie ?
Réponse: Oui, il s'agit d'une licence perpétuelle pour 1 PC.
`);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.items).toEqual([
      {
        question: "Comment vais-je recevoir ma licence Microsoft Office 2021 ?",
        answer:
          "Il s'agit d'un téléchargement numérique.\nVous recevrez votre clé par email après validation.",
      },
      {
        question: "La licence est-elle valable à vie ?",
        answer: "Oui, il s'agit d'une licence perpétuelle pour 1 PC.",
      },
    ]);
  });

  it("rejects bulk imports that would exceed the FAQ limit", () => {
    const result = parseBulkProductFaqInput(
      `
Question: FAQ 1 ?
Réponse: Réponse numéro une suffisamment longue.
`,
      {
        existingCount: PRODUCT_FAQ_MAX_ITEMS,
      },
    );

    expect(result).toEqual({
      success: false,
      error: `Vous pouvez enregistrer au maximum ${PRODUCT_FAQ_MAX_ITEMS} FAQs par produit.`,
    });
  });

  it("rejects duplicate questions against existing FAQs", () => {
    const result = parseBulkProductFaqInput(
      `
Question: Livrez-vous en Tunisie ?
Réponse: Oui, partout dans le pays.
`,
      {
        existingCount: 1,
        existingQuestions: ["Livrez-vous en Tunisie ?"],
      },
    );

    expect(result).toEqual({
      success: false,
      error: "La question 2 est en double.",
    });
  });

  it("builds valid FAQPage structured data from stored FAQ items", () => {
    expect(
      buildProductFaqStructuredData([
        {
          question: "Comment vais-je recevoir ma licence Microsoft Office 2021 ?",
          answer: "Il s'agit d'un téléchargement numérique...",
        },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Comment vais-je recevoir ma licence Microsoft Office 2021 ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Il s'agit d'un téléchargement numérique...",
          },
        },
      ],
    });
  });
});
