export const WEBSITE_TEMPLATE_KEY_VALUES = ["dev-agency"] as const;

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
] as const;

export function getTemplateDefinition(
  key: WebsiteTemplateKey,
) {
  return (
    WEBSITE_TEMPLATES.find((template) => template.key === key) ??
    WEBSITE_TEMPLATES[0]
  );
}
