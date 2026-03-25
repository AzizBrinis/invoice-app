export const WEBSITE_TEMPLATE_KEY_VALUES = [
  "dev-agency",
  "ecommerce-luxe",
  "ecommerce-tech-agency",
  "ecommerce-cesco",
  "ecommerce-ciseco-home",
] as const;

export type WebsiteTemplateKey =
  (typeof WEBSITE_TEMPLATE_KEY_VALUES)[number];

export const WEBSITE_TEMPLATES: ReadonlyArray<{
  key: WebsiteTemplateKey;
  label: string;
  description: string;
}> = [
  {
    key: "dev-agency",
    label: "Dev Agency",
    description:
      "Mise en page moderne pour agences web, SSII et studios de développement.",
  },
  {
    key: "ecommerce-luxe",
    label: "E-commerce Luxe",
    description:
      "Template boutique premium : pages produits, catégories, panier et paiement, prêt à personnaliser.",
  },
  {
    key: "ecommerce-tech-agency",
    label: "E-commerce Tech Agency",
    description:
      "Template agence tech : services, catalogue et parcours d'achat orienté conversion.",
  },
  {
    key: "ecommerce-cesco",
    label: "E-commerce Cesco",
    description:
      "Template e-commerce chaleureux avec sections promo, nouveautés et avis clients.",
  },
  {
    key: "ecommerce-ciseco-home",
    label: "Ciseco Home Clone",
    description:
      "Clone de la home Ciseco : sections promo, best-sellers, blog et avis (accueil uniquement).",
  },
] as const;

export function getTemplateDefinition(
  key: WebsiteTemplateKey,
) {
  return (
    WEBSITE_TEMPLATES.find((template) => template.key === key) ??
    WEBSITE_TEMPLATES[0]
  );
}
