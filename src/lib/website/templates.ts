export const WEBSITE_TEMPLATE_KEY_VALUES = [
  "dev-agency",
  "ecommerce-luxe",
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
] as const;

export function getTemplateDefinition(
  key: WebsiteTemplateKey,
) {
  return (
    WEBSITE_TEMPLATES.find((template) => template.key === key) ??
    WEBSITE_TEMPLATES[0]
  );
}
