import { z } from "zod";
import { generateId } from "@/lib/id";

export const BUILDER_SECTION_TYPES = [
  "hero",
  "services",
  "about",
  "contact",
  "testimonials",
  "team",
  "gallery",
  "pricing",
  "faq",
  "logos",
] as const;

export type BuilderSectionType =
  (typeof BUILDER_SECTION_TYPES)[number];

export const BUILDER_ANIMATIONS = [
  "none",
  "fade",
  "slide",
  "zoom",
] as const;

export type BuilderAnimation =
  (typeof BUILDER_ANIMATIONS)[number];

export const BUILDER_TYPOGRAPHY_PRESETS = [
  "modern",
  "serif",
  "editorial",
  "tech",
] as const;

export type BuilderTypographyPreset =
  (typeof BUILDER_TYPOGRAPHY_PRESETS)[number];

const builderButtonSchema = z.object({
  id: z.string().default(() => generateId("btn")),
  label: z.string().max(60),
  href: z.string().max(200).default("#"),
  style: z.enum(["primary", "secondary", "ghost"]).default("primary"),
});

const builderStatisticSchema = z.object({
  id: z.string().default(() => generateId("stat")),
  label: z.string().max(80),
  value: z.string().max(40),
});

const builderMediaAssetSchema = z.object({
  id: z.string().default(() => generateId("asset")),
  kind: z.enum(["image", "logo"]).default("image"),
  src: z.string().url().or(z.string().startsWith("data:")).nullable(),
  alt: z.string().max(160).default(""),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  aspectRatio: z.number().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  metadata: z
    .object({
      context: z.string().optional(),
    })
    .optional()
    .default({}),
});

const builderItemSchema = z.object({
  id: z.string().default(() => generateId("item")),
  title: z.string().max(160).nullable().optional(),
  description: z.string().max(400).nullable().optional(),
  badge: z.string().max(60).nullable().optional(),
  tag: z.string().max(60).nullable().optional(),
  price: z.string().max(60).nullable().optional(),
  linkLabel: z.string().max(80).nullable().optional(),
  href: z.string().max(200).nullable().optional(),
  mediaId: z.string().nullable().optional(),
  stats: z.array(builderStatisticSchema).optional().default([]),
});

const builderSectionSchema = z.object({
  id: z.string().default(() => generateId("section")),
  type: z.enum(BUILDER_SECTION_TYPES),
  title: z.string().max(160).nullable().optional(),
  subtitle: z.string().max(280).nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  eyebrow: z.string().max(120).nullable().optional(),
  layout: z
    .string()
    .max(60)
    .default("split"),
  animation: z.enum(BUILDER_ANIMATIONS).default("fade"),
  visible: z.boolean().default(true),
  mediaId: z.string().nullable().optional(),
  secondaryMediaId: z.string().nullable().optional(),
  items: z.array(builderItemSchema).default([]),
  buttons: z.array(builderButtonSchema).max(3).default([]),
});

const builderThemeSchema = z.object({
  accent: z.string().max(7).default("#2563eb"),
  gradient: z
    .object({
      from: z.string().max(7),
      to: z.string().max(7),
      angle: z.number().min(0).max(360).default(130),
    })
    .optional(),
  typography: z.enum(BUILDER_TYPOGRAPHY_PRESETS).default("modern"),
  buttonShape: z.enum(["sharp", "rounded", "pill"]).default("rounded"),
  sectionSpacing: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  containerWidth: z.enum(["narrow", "default", "wide"]).default("default"),
  surfaceStyle: z.enum(["minimal", "card", "gradient"]).default("card"),
  cornerStyle: z.enum(["soft", "rounded", "extra"]).default("rounded"),
  prefersDark: z.enum(["system", "light", "dark"]).default("system"),
});

export const builderConfigSchema = z.object({
  version: z.number().default(1),
  updatedAt: z.string().datetime().optional(),
  sections: z.array(builderSectionSchema).default([]),
  mediaLibrary: z.array(builderMediaAssetSchema).default([]),
  theme: builderThemeSchema.default(() =>
    builderThemeSchema.parse({ accent: "#2563eb" }),
  ),
});

const builderVersionEntrySchema = z.object({
  id: z.string(),
  savedAt: z.string().datetime(),
  label: z.string().max(120).optional(),
  snapshot: builderConfigSchema,
});

export type WebsiteBuilderButton = z.infer<typeof builderButtonSchema>;
export type WebsiteBuilderStatistic = z.infer<typeof builderStatisticSchema>;
export type WebsiteBuilderMediaAsset = z.infer<typeof builderMediaAssetSchema>;
export type WebsiteBuilderItem = z.infer<typeof builderItemSchema>;
export type WebsiteBuilderSection = z.infer<typeof builderSectionSchema>;
export type WebsiteBuilderTheme = z.infer<typeof builderThemeSchema>;
export type WebsiteBuilderConfig = z.infer<typeof builderConfigSchema>;
export type WebsiteBuilderVersionEntry = z.infer<typeof builderVersionEntrySchema>;

export const builderVersionHistorySchema = z
  .array(builderVersionEntrySchema)
  .default([]);

export const BUILDER_SECTION_LAYOUTS: Record<BuilderSectionType, string[]> = {
  hero: ["split", "center", "image-right"],
  services: ["grid", "list", "stack"],
  about: ["split", "stack"],
  contact: ["split", "card"],
  testimonials: ["grid", "carousel"],
  team: ["grid", "list"],
  gallery: ["grid", "masonry"],
  pricing: ["grid", "stack"],
  faq: ["accordion", "two-columns"],
  logos: ["grid", "marquee"],
};

type DefaultConfigOptions = {
  companyName?: string;
  heroEyebrow?: string | null;
  heroTitle: string;
  heroSubtitle?: string | null;
  heroPrimaryCtaLabel?: string | null;
  heroSecondaryCtaLabel?: string | null;
  heroSecondaryCtaUrl?: string | null;
  aboutTitle?: string | null;
  aboutBody?: string | null;
  contactBlurb?: string | null;
  accentColor?: string;
  products?: Array<{
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    unit?: string | null;
    price?: string | null;
  }>;
};

export function createDefaultBuilderConfig(
  options: DefaultConfigOptions,
): WebsiteBuilderConfig {
  const accent = options.accentColor ?? "#2563eb";
  const products = options.products ?? [];
  const services = products.slice(0, 4).map((product) => ({
    id: generateId("service"),
    title: product.name,
    description: product.description ?? "",
    tag: product.category ?? "Service",
    price: product.unit ? `${product.unit}` : undefined,
    stats: [],
  }));

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    mediaLibrary: [],
    theme: {
      accent,
      typography: "modern",
      buttonShape: "rounded",
      sectionSpacing: "comfortable",
      containerWidth: "default",
      surfaceStyle: "card",
      cornerStyle: "rounded",
      prefersDark: "system",
    },
    sections: [
      {
        id: generateId("hero"),
        type: "hero",
        eyebrow: options.heroEyebrow ?? "Agence digitale",
        title: options.heroTitle,
        subtitle:
          options.heroSubtitle ??
          "Concevez un site moderne, lisible et impactant.",
        layout: "split",
        animation: "fade",
        visible: true,
        items: [],
        buttons: [
          {
            id: generateId("btn"),
            label: options.heroPrimaryCtaLabel ?? "Commencer un projet",
            href: "#contact",
            style: "primary",
          },
          options.heroSecondaryCtaLabel
            ? {
                id: generateId("btn"),
                label: options.heroSecondaryCtaLabel,
                href: options.heroSecondaryCtaUrl ?? "#services",
                style: "ghost",
              }
            : null,
        ].filter(Boolean) as WebsiteBuilderButton[],
      },
      {
        id: generateId("services"),
        type: "services",
        title: "Services & expertises",
        subtitle:
          "Sélectionnez les prestations visibles pour alimenter ce bloc.",
        layout: "grid",
        animation: "fade",
        visible: true,
        items: services.length
          ? services
          : [
              {
                id: generateId("service"),
                title: "Design produit",
                description: "Interfaces premium, micro-interactions, UX flows.",
                stats: [],
              },
              {
                id: generateId("service"),
                title: "Développement web",
                description:
                  "Stacks modernes (Next.js) optimisées SEO + performance.",
                stats: [],
              },
            ],
        buttons: [],
      },
      {
        id: generateId("about"),
        type: "about",
        title: options.aboutTitle ?? "Une équipe engagée",
        description:
          options.aboutBody ??
          "Expliquez votre manifeste, votre façon de travailler et vos forces.",
        layout: "split",
        animation: "fade",
        visible: true,
        items: [
          {
            id: generateId("stat"),
            title: options.companyName ?? "Votre marque",
            description: "Ajoutez chiffres clés, certifications ou labels.",
            stats: [],
          },
        ],
        buttons: [],
      },
      {
        id: generateId("testimonials"),
        type: "testimonials",
        title: "Ils nous font confiance",
        subtitle:
          "Ajoutez quelques retours clients pour rassurer vos prospects.",
        layout: "grid",
        animation: "fade",
        visible: true,
        items: [],
        buttons: [],
      },
      {
        id: generateId("contact"),
        type: "contact",
        title: "Parlons de vos objectifs",
        subtitle:
          options.contactBlurb ??
          "Décrivez votre projet et recevez un plan d’action en 24h.",
        layout: "split",
        animation: "fade",
        visible: true,
        items: [],
        buttons: [
          {
            id: generateId("btn"),
            label: "Écrire au studio",
            href: "#contact",
            style: "primary",
          },
        ],
      },
    ],
  };
}

export function applyThemeFallbacks(
  config: WebsiteBuilderConfig,
  accent: string,
): WebsiteBuilderConfig {
  return {
    ...config,
    theme: {
      accent: config.theme?.accent ?? accent,
      gradient: config.theme?.gradient,
      typography: config.theme?.typography ?? "modern",
      buttonShape: config.theme?.buttonShape ?? "rounded",
      sectionSpacing: config.theme?.sectionSpacing ?? "comfortable",
      containerWidth: config.theme?.containerWidth ?? "default",
      surfaceStyle: config.theme?.surfaceStyle ?? "card",
      cornerStyle: config.theme?.cornerStyle ?? "rounded",
      prefersDark: config.theme?.prefersDark ?? "system",
    },
  };
}

export function createSectionTemplate(
  type: BuilderSectionType,
): WebsiteBuilderSection {
  const base: WebsiteBuilderSection = {
    id: generateId(type),
    type,
    title: null,
    subtitle: null,
    description: null,
    eyebrow: null,
    layout: BUILDER_SECTION_LAYOUTS[type]?.[0] ?? "split",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [],
  };

  switch (type) {
    case "hero":
      return {
        ...base,
        eyebrow: "Nouvelle section",
        title: "Ajoutez un titre héro percutant",
        subtitle: "Décrivez votre valeur en deux phrases maximum.",
        buttons: [
          {
            id: generateId("btn"),
            label: "CTA principal",
            href: "#contact",
            style: "primary",
          },
        ],
      };
    case "services":
      return {
        ...base,
        title: "Services & offres",
        subtitle: "Présentez vos expertises phares.",
        items: [
          {
            id: generateId("service"),
            title: "Service clé",
            description: "Expliquez le résultat obtenu ou la méthode.",
            stats: [],
          },
        ],
      };
    case "about":
      return {
        ...base,
        title: "À propos",
        description:
          "Expliquez votre manifeste, votre processus ou vos garanties.",
        items: [
          {
            id: generateId("stat"),
            title: "10+ ans d’expérience",
            description: "Ajoutez un chiffre clé ou une récompense.",
            stats: [],
          },
        ],
      };
    case "contact":
      return {
        ...base,
        title: "Contact",
        subtitle: "Invitez vos prospects à décrire leur besoin.",
        buttons: [
          {
            id: generateId("btn"),
            label: "Planifier un appel",
            href: "#contact",
            style: "primary",
          },
        ],
      };
    case "testimonials":
      return {
        ...base,
        title: "Témoignages",
        items: [
          {
            id: generateId("testimonial"),
            title: "Nom du client",
            description: "“Ajoutez un retour client ou un extrait de citation.”",
            tag: "Poste / Société",
            stats: [],
          },
        ],
      };
    case "team":
      return {
        ...base,
        title: "Équipe",
        items: [
          {
            id: generateId("team"),
            title: "Prénom Nom",
            description: "Rôle / spécialité",
            stats: [],
          },
        ],
      };
    case "gallery":
      return {
        ...base,
        title: "Portfolio",
        subtitle: "Illustrez vos projets en images.",
      };
    case "pricing":
      return {
        ...base,
        title: "Plans & tarifs",
        items: [
          {
            id: generateId("plan"),
            title: "Plan standard",
            price: "€ / mois",
            description: "Listez les fonctionnalités incluses.",
            stats: [],
          },
        ],
      };
    case "faq":
      return {
        ...base,
        title: "Questions fréquentes",
        items: [
          {
            id: generateId("faq"),
            title: "Question",
            description: "Réponse courte et claire.",
            stats: [],
          },
        ],
      };
    case "logos":
      return {
        ...base,
        title: "Clients & partenaires",
        subtitle: "Affichez des logos avec légendes optionnelles.",
      };
    default:
      return base;
  }
}
