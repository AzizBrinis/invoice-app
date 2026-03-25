import { z } from "zod";
import { generateId } from "@/lib/id";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import {
  ABOUT_FAST_FACTS,
  ABOUT_FAST_FACTS_COPY,
  ABOUT_FOUNDERS,
  ABOUT_FOUNDERS_COPY,
  ABOUT_HERO_COPY,
  ABOUT_HERO_IMAGES,
  ABOUT_PROMO_COPY,
  ABOUT_TESTIMONIAL,
  ABOUT_TESTIMONIALS_COPY,
  ABOUT_TESTIMONIAL_AVATARS,
} from "@/components/website/templates/ecommerce-ciseco/data/about";
import {
  BLOG_POSTS,
  CATEGORY_CARDS,
  CATEGORY_TABS,
  DEPARTMENTS,
  DISCOVERY_CARDS,
  FAVORITE_FILTERS,
  FEATURE_ITEMS,
  TESTIMONIALS,
} from "@/components/website/templates/ecommerce-ciseco/data/home";
import { HERO_BADGES } from "@/components/website/templates/ecommerce-ciseco/data/navigation";
import { CISECO_PAGE_DEFINITIONS, type CisecoPageKey } from "@/lib/website/ciseco-pages";

export const BUILDER_SECTION_TYPES = [
  "hero",
  "categories",
  "products",
  "promo",
  "newsletter",
  "content",
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

export const BUILDER_SECTION_BUTTON_LIMIT = 6;

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

function isValidBuilderMediaSrc(value: string) {
  if (value.startsWith("data:")) {
    return true;
  }
  if (value.startsWith("/")) {
    return true;
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const builderMediaAssetSchema = z.object({
  id: z.string().default(() => generateId("asset")),
  kind: z.enum(["image", "logo"]).default("image"),
  src: z
    .string()
    .nullable()
    .refine(
      (value) => !value || isValidBuilderMediaSrc(value),
      "Le média doit être une URL valide, un data URI ou un chemin interne commençant par /.",
    ),
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

const builderPageSeoSchema = z.object({
  title: z.string().max(160).nullable().optional(),
  description: z.string().max(260).nullable().optional(),
  keywords: z.string().max(260).nullable().optional(),
  imageId: z.string().nullable().optional(),
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
  buttons: z.array(builderButtonSchema).max(BUILDER_SECTION_BUTTON_LIMIT).default([]),
});

const builderPageSchema = z.object({
  sections: z.array(builderSectionSchema).default([]),
  mediaLibrary: z.array(builderMediaAssetSchema).default([]),
  seo: builderPageSeoSchema.default({}),
});

export function sanitizeBuilderPages(
  input: unknown,
): Record<string, WebsiteBuilderPageConfig> {
  const parseJsonValue = (value: unknown) => {
    if (typeof value !== "string") return value;
    let current: unknown = value;
    for (let i = 0; i < 3; i += 1) {
      if (typeof current !== "string") break;
      try {
        current = JSON.parse(current);
      } catch {
        return null;
      }
    }
    return current;
  };
  const normalizeBoolean = (value: unknown) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (lowered === "true") return true;
      if (lowered === "false") return false;
    }
    return value;
  };
  const normalizeArrayValue = (value: unknown) => {
    const parsed = parseJsonValue(value);
    if (!Array.isArray(parsed)) return parsed;
    return parsed.map((entry) => {
      const normalized = parseJsonValue(entry);
      return normalized ?? entry;
    });
  };
  const normalizeSectionValue = (value: unknown) => {
    const resolved = parseJsonValue(value);
    if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
      return resolved;
    }
    const record = resolved as Record<string, unknown>;
    const normalizedButtons = normalizeArrayValue(record.buttons);
    return {
      ...record,
      visible: normalizeBoolean(record.visible),
      items: normalizeArrayValue(record.items),
      buttons: Array.isArray(normalizedButtons)
        ? normalizedButtons.slice(0, BUILDER_SECTION_BUTTON_LIMIT)
        : normalizedButtons,
    };
  };
  const normalizeMediaLibraryValue = (value: unknown) => {
    const resolved = normalizeArrayValue(value);
    if (!Array.isArray(resolved)) return resolved;
    return resolved
      .map((entry) => {
        const normalized = parseJsonValue(entry);
        const parsed = builderMediaAssetSchema.safeParse(
          normalized ?? entry,
        );
        return parsed.success ? parsed.data : null;
      })
      .filter((entry): entry is WebsiteBuilderMediaAsset => Boolean(entry));
  };
  const parsedInput = parseJsonValue(input);
  if (!parsedInput || typeof parsedInput !== "object" || Array.isArray(parsedInput)) {
    return {};
  }
  const record = parsedInput as Record<string, unknown>;
  const normalized: Record<string, WebsiteBuilderPageConfig> = {};
  for (const [key, entry] of Object.entries(record)) {
    const resolvedEntry = parseJsonValue(entry);
    if (Array.isArray(resolvedEntry)) {
      const parsed = builderPageSchema.safeParse({
        sections: resolvedEntry.map((section) => normalizeSectionValue(section)),
        mediaLibrary: [],
        seo: {},
      });
      if (parsed.success) {
        normalized[key] = parsed.data;
      }
      continue;
    }
    if (!resolvedEntry || typeof resolvedEntry !== "object" || Array.isArray(resolvedEntry)) {
      continue;
    }
    const resolvedRecord = resolvedEntry as Record<string, unknown>;
    const normalizedSections = normalizeArrayValue(resolvedRecord.sections);
    const normalizedEntry = {
      ...resolvedRecord,
      sections: Array.isArray(normalizedSections)
        ? normalizedSections.map((section) => normalizeSectionValue(section))
        : normalizedSections,
      mediaLibrary: normalizeMediaLibraryValue(resolvedRecord.mediaLibrary),
      seo: parseJsonValue(resolvedRecord.seo),
    };
    const parsed = builderPageSchema.safeParse(normalizedEntry);
    if (parsed.success) {
      normalized[key] = parsed.data;
      continue;
    }
    const fallbackSections = Array.isArray(normalizedEntry.sections)
      ? normalizedEntry.sections
        .map((section) => {
          const parsedSection = builderSectionSchema.safeParse(section);
          return parsedSection.success ? parsedSection.data : null;
        })
        .filter((section): section is WebsiteBuilderSection => Boolean(section))
      : [];
    const fallbackMedia = Array.isArray(normalizedEntry.mediaLibrary)
      ? normalizedEntry.mediaLibrary
        .map((asset) => {
          const parsedAsset = builderMediaAssetSchema.safeParse(asset);
          return parsedAsset.success ? parsedAsset.data : null;
        })
        .filter((asset): asset is WebsiteBuilderMediaAsset => Boolean(asset))
      : [];
    const fallbackSeo = builderPageSeoSchema.safeParse(normalizedEntry.seo);
    normalized[key] = {
      sections: fallbackSections,
      mediaLibrary: fallbackMedia,
      seo: fallbackSeo.success ? fallbackSeo.data : {},
    };
  }
  return normalized;
}

const builderPagesSchema = z.preprocess((value) => {
  return sanitizeBuilderPages(value);
}, z.record(z.string(), builderPageSchema).default({}).catch({}));

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
  pages: builderPagesSchema,
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
export type WebsiteBuilderPageSeo = z.infer<typeof builderPageSeoSchema>;
export type WebsiteBuilderPageConfig = z.infer<typeof builderPageSchema>;
export type WebsiteBuilderTheme = z.infer<typeof builderThemeSchema>;
export type WebsiteBuilderConfig = z.infer<typeof builderConfigSchema>;
export type WebsiteBuilderVersionEntry = z.infer<typeof builderVersionEntrySchema>;

export const builderVersionHistorySchema = z
  .array(builderVersionEntrySchema)
  .default([]);

function createPlaceholderMediaAsset(
  params: {
    src: string;
    alt: string;
    width: number;
    height: number;
    context: string;
    createdAt: string;
    kind?: "image" | "logo";
  },
): WebsiteBuilderMediaAsset {
  const aspectRatio = Number((params.width / params.height).toFixed(3));
  return {
    id: generateId("asset"),
    kind: params.kind ?? "image",
    src: params.src,
    alt: params.alt,
    width: params.width,
    height: params.height,
    aspectRatio,
    createdAt: params.createdAt,
    metadata: { context: params.context },
  } satisfies WebsiteBuilderMediaAsset;
}

export const BUILDER_SECTION_LAYOUTS: Record<BuilderSectionType, string[]> = {
  hero: ["split", "center", "image-right"],
  categories: ["grid", "cards", "carousel"],
  products: ["grid", "list", "carousel"],
  promo: ["banner", "split"],
  newsletter: ["split", "center"],
  content: ["stack", "split"],
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

export const TECH_AGENCY_SECTION_LAYOUT_PRESETS: Partial<
  Record<BuilderSectionType, string[]>
> = {
  logos: ["marquee", "grid"],
  about: ["split", "stack"],
  gallery: ["masonry", "grid"],
  pricing: ["grid", "stack"],
  faq: ["accordion", "two-columns"],
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

  const timestamp = new Date().toISOString();
  const heroMedia = createPlaceholderMediaAsset({
    src: WEBSITE_MEDIA_PLACEHOLDERS.hero,
    alt: "Illustration studio web",
    width: 1200,
    height: 900,
    context: "placeholder:hero",
    createdAt: timestamp,
  });
  const aboutMedia = createPlaceholderMediaAsset({
    src: WEBSITE_MEDIA_PLACEHOLDERS.about,
    alt: "Équipe créative au travail",
    width: 900,
    height: 900,
    context: "placeholder:about",
    createdAt: timestamp,
  });
  const galleryLabels = ["Projet Aurora", "Projet Nova", "Projet Atlas"];
  const galleryShots = WEBSITE_MEDIA_PLACEHOLDERS.gallery.map((src, index) =>
    createPlaceholderMediaAsset({
      src,
      alt: galleryLabels[index] ?? `Projet ${index + 1}`,
      width: 960,
      height: 640,
      context: "placeholder:gallery",
      createdAt: timestamp,
    }),
  );
  const portraitLabels = ["Portrait Nadia", "Portrait Yanis", "Portrait Lina"];
  const teamPortraits = WEBSITE_MEDIA_PLACEHOLDERS.team.map((src, index) =>
    createPlaceholderMediaAsset({
      src,
      alt: portraitLabels[index] ?? `Portrait ${index + 1}`,
      width: 640,
      height: 800,
      context: "placeholder:team",
      createdAt: timestamp,
    }),
  );
  const logoLabels = ["Aurora", "Orbit", "Kosmos", "Loop"];
  const logoMarks = WEBSITE_MEDIA_PLACEHOLDERS.logos.map((src, index) =>
    createPlaceholderMediaAsset({
      src,
      alt: `Logo ${logoLabels[index] ?? index + 1}`,
      width: 320,
      height: 140,
      context: "placeholder:logo",
      createdAt: timestamp,
      kind: "logo",
    }),
  );

  const mediaLibrary = [heroMedia, aboutMedia, ...galleryShots, ...teamPortraits, ...logoMarks];
  const serviceItems = services.length
    ? services
    : [
        {
          id: generateId("service"),
          title: "Stratégie & discovery",
          description: "Sprints de cadrage, personas, roadmap alignée au ROI.",
          tag: "Discovery",
          stats: [],
        },
        {
          id: generateId("service"),
          title: "Design produit",
          description: "UI systems, animations micro et prototypes testables.",
          tag: "Design",
          stats: [],
        },
        {
          id: generateId("service"),
          title: "Développement web",
          description: "Apps Next.js, API Node, intégrations CRM & analytics.",
          tag: "Build",
          stats: [],
        },
      ];
  const logoItems = logoMarks.map((logo) => ({
    id: generateId("logo"),
    title: logo.alt?.replace("Logo ", "") ?? "Marque",
    mediaId: logo.id,
    stats: [],
  }));
  const galleryItems = [
    {
      id: generateId("gallery"),
      title: "Aurora ERP",
      description: "Portail client & design system sur-mesure.",
      mediaId: galleryShots[0]?.id,
      stats: [],
    },
    {
      id: generateId("gallery"),
      title: "Nova Assurance",
      description: "Site marketing multi-langues + SEO.",
      mediaId: galleryShots[1]?.id,
      stats: [],
    },
    {
      id: generateId("gallery"),
      title: "Atlas Mobile",
      description: "Dashboard data en temps réel.",
      mediaId: galleryShots[2]?.id,
      stats: [],
    },
  ];
  const testimonialItems = [
    {
      id: generateId("testimonial"),
      title: "Sarah Ben Salah",
      description:
        "Livraison en 8 semaines, trafic multiplié par 2 et leads qualifiés dès la mise en ligne.",
      tag: "CMO — Atelier Eclipse",
      stats: [],
    },
    {
      id: generateId("testimonial"),
      title: "Marc Labbé",
      description: "Une équipe proactive et fiable, qui sait challenger le scope et tenir les délais.",
      tag: "CEO — NovaTech",
      stats: [],
    },
  ];
  const teamItems = teamPortraits.map((portrait, index) => {
    const profiles = [
      {
        title: "Nadia B.",
        tag: "Lead produit",
        description: "Ex-Stripe & Alan, facilite les ateliers stratégiques.",
      },
      {
        title: "Yanis H.",
        tag: "Principal engineer",
        description: "10 ans sur Next.js, Node et infrastructures serverless.",
      },
      {
        title: "Lina K.",
        tag: "UX strategist",
        description: "Pilotage research, tests utilisateurs et analytics.",
      },
    ];
    const profile = profiles[index] ?? profiles[0];
    return {
      id: generateId("team"),
      title: profile.title,
      tag: profile.tag,
      description: profile.description,
      mediaId: portrait.id,
      stats: [],
    };
  });
  const faqItems = [
    {
      id: generateId("faq"),
      title: "Quel est votre délai moyen ?",
      description: "Entre 4 et 6 semaines selon la complexité et la disponibilité des contenus.",
      stats: [],
    },
    {
      id: generateId("faq"),
      title: "Pouvez-vous travailler avec nos équipes internes ?",
      description: "Oui, nous co-créons avec vos designers, PO ou développeurs en mode sprint.",
      stats: [],
    },
    {
      id: generateId("faq"),
      title: "Proposez-vous un accompagnement long terme ?",
      description: "Maintenance, optimisation SEO, growth et itérations produit sont proposés en option.",
      stats: [],
    },
  ];

  return {
    version: 1,
    updatedAt: timestamp,
    mediaLibrary,
    pages: {},
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
        mediaId: heroMedia.id,
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
        id: generateId("logos"),
        type: "logos",
        eyebrow: "Références",
        title: "Ils nous confient leurs produits",
        subtitle: "Scale-ups, industriels et acteurs publics.",
        layout: "grid",
        animation: "fade",
        visible: true,
        items: logoItems,
        buttons: [],
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
        items: serviceItems,
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
        mediaId: aboutMedia.id,
        items: [
          {
            id: generateId("stat"),
            title: options.companyName ?? "Votre marque",
            description: "Ajoutez chiffres clés, certifications ou labels.",
            stats: [],
          },
          {
            id: generateId("stat"),
            title: "98% clients satisfaits",
            description: "Basé sur les sondages post-livraison.",
            stats: [],
          },
        ],
        buttons: [],
      },
      {
        id: generateId("gallery"),
        type: "gallery",
        title: "Études de cas",
        subtitle: "Projets sélectionnés livrés récemment.",
        layout: "grid",
        animation: "fade",
        visible: true,
        items: galleryItems,
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
        items: testimonialItems,
        buttons: [],
      },
      {
        id: generateId("team"),
        type: "team",
        title: "Une équipe senior",
        subtitle: "UX, produit et ingénierie dédiés à votre projet.",
        layout: "grid",
        animation: "fade",
        visible: true,
        items: teamItems,
        buttons: [],
      },
      {
        id: generateId("faq"),
        type: "faq",
        title: "Questions fréquentes",
        subtitle: "Transparence sur nos pratiques et nos garanties.",
        layout: "accordion",
        animation: "fade",
        visible: true,
        items: faqItems,
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
            label: "Planifier un appel",
            href: "#contact",
            style: "primary",
          },
          {
            id: generateId("btn"),
            label: "Télécharger la présentation",
            href: "#services",
            style: "ghost",
          },
        ],
      },
    ],
  };
}

export function applyCisecoAboutDefaults(
  config: WebsiteBuilderConfig,
  options?: { override?: boolean },
): WebsiteBuilderConfig {
  const override = options?.override ?? false;
  const nextLibrary = [...(config.mediaLibrary ?? [])];

  const heroSection: WebsiteBuilderSection = {
    id: "ciseco-about-hero",
    type: "hero",
    title: ABOUT_HERO_COPY.title,
    subtitle: null,
    description: ABOUT_HERO_COPY.description,
    eyebrow: null,
    layout: "split",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: ABOUT_HERO_IMAGES.map((_, index) => ({
      id: `ciseco-hero-tile-${index + 1}`,
      title: `Hero image ${index + 1}`,
      description: null,
      mediaId: null,
      stats: [],
    })),
    buttons: [],
  };

  const teamSection: WebsiteBuilderSection = {
    id: "ciseco-founders",
    type: "team",
    title: ABOUT_FOUNDERS_COPY.title,
    subtitle: null,
    description: ABOUT_FOUNDERS_COPY.description,
    eyebrow: null,
    layout: "grid",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: ABOUT_FOUNDERS.map((founder) => ({
      id: `ciseco-founder-item-${founder.id}`,
      title: founder.name,
      tag: founder.role,
      description: null,
      mediaId: null,
      stats: [],
    })),
    buttons: [],
  };

  const factsSection: WebsiteBuilderSection = {
    id: "ciseco-fast-facts",
    type: "about",
    title: ABOUT_FAST_FACTS_COPY.title,
    subtitle: null,
    description: ABOUT_FAST_FACTS_COPY.description,
    eyebrow: null,
    layout: "split",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: ABOUT_FAST_FACTS.map((fact) => ({
      id: `ciseco-fast-fact-${fact.id}`,
      title: fact.value,
      description: fact.description,
      stats: [],
    })),
    buttons: [],
  };

  const testimonialsSection: WebsiteBuilderSection = {
    id: "ciseco-testimonials",
    type: "testimonials",
    title: ABOUT_TESTIMONIALS_COPY.title,
    subtitle: ABOUT_TESTIMONIALS_COPY.subtitle,
    description: null,
    eyebrow: null,
    layout: "grid",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [
      {
        id: "ciseco-testimonial-primary",
        title: ABOUT_TESTIMONIAL.name,
        description: ABOUT_TESTIMONIAL.quote,
        mediaId: null,
        stats: [],
      },
      ...ABOUT_TESTIMONIAL_AVATARS.map((_, index) => ({
        id: `ciseco-testimonial-orbit-item-${index + 1}`,
        title: `Orbit ${index + 1}`,
        mediaId: null,
        stats: [],
      })),
    ],
    buttons: [],
  };

  const promoSection: WebsiteBuilderSection = {
    id: "ciseco-promo",
    type: "promo",
    title: ABOUT_PROMO_COPY.title,
    subtitle: null,
    description: ABOUT_PROMO_COPY.description,
    eyebrow: null,
    layout: "banner",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [
      {
        id: "ciseco-promo-primary",
        label: ABOUT_PROMO_COPY.primaryCta,
        href: "#",
        style: "primary",
      },
      {
        id: "ciseco-promo-secondary",
        label: ABOUT_PROMO_COPY.secondaryCta,
        href: "#",
        style: "secondary",
      },
    ],
  };

  const requiredSections = [
    heroSection,
    teamSection,
    factsSection,
    testimonialsSection,
    promoSection,
  ];
  const baseSections = override ? [] : [...config.sections];
  const existingTypes = new Set(baseSections.map((section) => section.type));
  const nextSections = [...baseSections];

  requiredSections.forEach((section) => {
    if (override || !existingTypes.has(section.type)) {
      nextSections.push(section);
    }
  });

  return {
    ...config,
    mediaLibrary: nextLibrary,
    sections: nextSections,
  };
}

function createCisecoPageConfig(
  sections: WebsiteBuilderSection[],
): WebsiteBuilderPageConfig {
  return {
    sections,
    mediaLibrary: [],
    seo: {},
  };
}

function createCisecoHeroSection(params: {
  id: string;
  title: string;
  eyebrow?: string | null;
  subtitle?: string | null;
  description?: string | null;
  layout?: string;
  buttons?: WebsiteBuilderButton[];
  items?: WebsiteBuilderSection["items"];
}) {
  return {
    id: params.id,
    type: "hero",
    title: params.title,
    subtitle: params.subtitle ?? null,
    description: params.description ?? null,
    eyebrow: params.eyebrow ?? null,
    layout: params.layout ?? "home-hero",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: params.items ?? [],
    buttons: params.buttons ?? [],
  } satisfies WebsiteBuilderSection;
}

function createCisecoHomePageConfig(): WebsiteBuilderPageConfig {
  const heroBadges = HERO_BADGES.map((badge, index) => ({
    id: `ciseco-home-hero-badge-${index + 1}`,
    title: badge,
    stats: [],
  }));
  const discoveryItems = DISCOVERY_CARDS.map((card) => ({
    id: `ciseco-home-discovery-${card.id}`,
    title: card.title,
    description: card.description,
    linkLabel: card.cta,
    href: card.href,
    stats: [],
  }));
  const featureItems = FEATURE_ITEMS.map((item) => ({
    id: `ciseco-home-feature-${item.id}`,
    title: item.title,
    description: item.subtitle,
    tag: item.icon,
    stats: [],
  }));
  const categoryItems = CATEGORY_CARDS.map((card) => ({
    id: `ciseco-home-category-${card.id}`,
    title: card.title,
    description: card.description,
    tag: card.icon,
    stats: [],
  }));
  const departmentItems = DEPARTMENTS.map((item) => ({
    id: `ciseco-home-department-${item.id}`,
    title: item.title,
    description: item.subtitle,
    stats: [],
  }));
  const blogItems = BLOG_POSTS.map((post) => ({
    id: `ciseco-home-blog-${post.id}`,
    title: post.title,
    description: post.excerpt,
    tag: post.tag,
    badge: post.date,
    stats: [],
  }));
  const testimonialItems = TESTIMONIALS.map((item) => ({
    id: `ciseco-home-testimonial-${item.id}`,
    title: item.name,
    description: item.quote,
    tag: item.role,
    stats: [],
  }));

  const sections: WebsiteBuilderSection[] = [
    createCisecoHeroSection({
      id: "ciseco-home-hero",
      eyebrow: "Handpicked trend",
      title: "Exclusive collection for everyone",
      subtitle:
        "Discover fresh styles and everyday essentials curated for every mood. Lorem ipsum dolor sit amet.",
      description: "Trusted by 32k+ shoppers worldwide",
      layout: "home-hero",
      items: heroBadges,
      buttons: [
        {
          id: "ciseco-home-hero-primary",
          label: "Explore now",
          href: "#",
          style: "primary",
        },
        {
          id: "ciseco-home-hero-secondary",
          label: "See deals",
          href: "#",
          style: "ghost",
        },
      ],
    }),
    {
      id: "ciseco-home-discovery",
      type: "services",
      title: "Good things are waiting for you",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Discover more",
      layout: "discovery",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: discoveryItems,
      buttons: [],
    },
    {
      id: "ciseco-home-new-arrivals",
      type: "products",
      title: "Fresh drops for the week",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "New arrivals",
      layout: "new-arrivals",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: [],
      buttons: [
        {
          id: "ciseco-home-new-arrivals-cta",
          label: "View all",
          href: "#",
          style: "secondary",
        },
      ],
    },
    {
      id: "ciseco-home-features",
      type: "services",
      title: "Shopping essentials",
      subtitle: "Highlights that make every purchase easy.",
      description: null,
      eyebrow: null,
      layout: "features",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: featureItems,
      buttons: [],
    },
    {
      id: "ciseco-home-promo",
      type: "promo",
      title: "Earn free money with Ciseco",
      subtitle: null,
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin gravida, nibh vel commodo posuere, neque sapien.",
      eyebrow: "Earn free money",
      layout: "home-promo",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: [],
      buttons: [
        {
          id: "ciseco-home-promo-cta",
          label: "Get started",
          href: "#",
          style: "primary",
        },
      ],
    },
    {
      id: "ciseco-home-categories",
      type: "categories",
      title: "Explore categories",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Start exploring",
      layout: "explore",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: categoryItems,
      buttons: CATEGORY_TABS.map((tab, index) => ({
        id: `ciseco-home-category-tab-${index + 1}`,
        label: tab,
        href: "#",
        style: "ghost",
      })),
    },
    {
      id: "ciseco-home-best-sellers",
      type: "products",
      title: "Best sellers of the month",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Best sellers",
      layout: "best-sellers",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: [],
      buttons: [],
    },
    {
      id: "ciseco-home-kids-promo",
      type: "promo",
      title: "Special offer in kids products",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Special offer",
      layout: "kids-banner",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: [],
      buttons: [
        {
          id: "ciseco-home-kids-cta",
          label: "Shop kids",
          href: "#",
          style: "primary",
        },
      ],
    },
    {
      id: "ciseco-home-featured-products",
      type: "products",
      title: "Featured for your wishlist",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Featured products",
      layout: "featured",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: CATEGORY_TABS.map((tab, index) => ({
        id: `ciseco-home-featured-tab-${index + 1}`,
        title: tab,
        stats: [],
      })),
      buttons: [],
    },
    {
      id: "ciseco-home-favorites",
      type: "products",
      title: "Find your favorite products",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Find your favorite",
      layout: "favorites",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: FAVORITE_FILTERS.map((label, index) => ({
        id: `ciseco-home-favorites-tab-${index + 1}`,
        title: label,
        stats: [],
      })),
      buttons: [
        {
          id: "ciseco-home-favorites-cta",
          label: "Load more",
          href: "#",
          style: "primary",
        },
      ],
    },
    {
      id: "ciseco-home-departments",
      type: "gallery",
      title: "Explore the absolute",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Shop by department",
      layout: "departments",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: departmentItems,
      buttons: [],
    },
    {
      id: "ciseco-home-blog",
      type: "content",
      title: "From the Ciseco blog",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Our latest news",
      layout: "home-blog",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: blogItems,
      buttons: [],
    },
    {
      id: "ciseco-home-testimonials",
      type: "testimonials",
      title: "People love our products",
      subtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      description: null,
      eyebrow: "Good news from far away",
      layout: "home-testimonials",
      animation: "fade",
      visible: true,
      mediaId: null,
      secondaryMediaId: null,
      items: testimonialItems,
      buttons: [],
    },
  ];

  return createCisecoPageConfig(sections);
}

function createCisecoAboutPageConfig(): WebsiteBuilderPageConfig {
  const heroSection: WebsiteBuilderSection = {
    id: "ciseco-about-hero",
    type: "hero",
    title: ABOUT_HERO_COPY.title,
    subtitle: null,
    description: ABOUT_HERO_COPY.description,
    eyebrow: null,
    layout: "split",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: ABOUT_HERO_IMAGES.map((_, index) => ({
      id: `ciseco-hero-tile-${index + 1}`,
      title: `Hero image ${index + 1}`,
      description: null,
      mediaId: null,
      stats: [],
    })),
    buttons: [],
  };

  const teamSection: WebsiteBuilderSection = {
    id: "ciseco-founders",
    type: "team",
    title: ABOUT_FOUNDERS_COPY.title,
    subtitle: null,
    description: ABOUT_FOUNDERS_COPY.description,
    eyebrow: null,
    layout: "grid",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: ABOUT_FOUNDERS.map((founder) => ({
      id: `ciseco-founder-item-${founder.id}`,
      title: founder.name,
      tag: founder.role,
      description: null,
      mediaId: null,
      stats: [],
    })),
    buttons: [],
  };

  const factsSection: WebsiteBuilderSection = {
    id: "ciseco-fast-facts",
    type: "about",
    title: ABOUT_FAST_FACTS_COPY.title,
    subtitle: null,
    description: ABOUT_FAST_FACTS_COPY.description,
    eyebrow: null,
    layout: "split",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: ABOUT_FAST_FACTS.map((fact) => ({
      id: `ciseco-fast-fact-${fact.id}`,
      title: fact.value,
      description: fact.description,
      stats: [],
    })),
    buttons: [],
  };

  const testimonialsSection: WebsiteBuilderSection = {
    id: "ciseco-testimonials",
    type: "testimonials",
    title: ABOUT_TESTIMONIALS_COPY.title,
    subtitle: ABOUT_TESTIMONIALS_COPY.subtitle,
    description: null,
    eyebrow: null,
    layout: "grid",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [
      {
        id: "ciseco-testimonial-primary",
        title: ABOUT_TESTIMONIAL.name,
        description: ABOUT_TESTIMONIAL.quote,
        mediaId: null,
        stats: [],
      },
      ...ABOUT_TESTIMONIAL_AVATARS.map((_, index) => ({
        id: `ciseco-testimonial-orbit-item-${index + 1}`,
        title: `Orbit ${index + 1}`,
        mediaId: null,
        stats: [],
      })),
    ],
    buttons: [],
  };

  const promoSection: WebsiteBuilderSection = {
    id: "ciseco-promo",
    type: "promo",
    title: ABOUT_PROMO_COPY.title,
    subtitle: null,
    description: ABOUT_PROMO_COPY.description,
    eyebrow: null,
    layout: "banner",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [
      {
        id: "ciseco-promo-primary",
        label: ABOUT_PROMO_COPY.primaryCta,
        href: "#",
        style: "primary",
      },
      {
        id: "ciseco-promo-secondary",
        label: ABOUT_PROMO_COPY.secondaryCta,
        href: "#",
        style: "secondary",
      },
    ],
  };

  return createCisecoPageConfig([
    heroSection,
    teamSection,
    factsSection,
    testimonialsSection,
    promoSection,
  ]);
}

function createCisecoSimplePageConfig(options: {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
}): WebsiteBuilderPageConfig {
  return createCisecoPageConfig([
    createCisecoHeroSection({
      id: options.id,
      title: options.title,
      subtitle: options.subtitle ?? null,
      description: options.description ?? null,
      layout: "page-hero",
    }),
  ]);
}

function createCisecoProductPageConfig(): WebsiteBuilderPageConfig {
  const gallerySection: WebsiteBuilderSection = {
    id: "ciseco-product-gallery",
    type: "gallery",
    title: "Galerie",
    subtitle: null,
    description: null,
    eyebrow: null,
    layout: "product-gallery",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [],
  };

  const optionsSection: WebsiteBuilderSection = {
    id: "ciseco-product-options",
    type: "products",
    title: "{{product.name}}",
    subtitle: null,
    description: null,
    eyebrow: null,
    layout: "product-options",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [
      {
        id: "ciseco-product-options-accordion-description",
        title: "Description",
        stats: [],
      },
      {
        id: "ciseco-product-options-accordion-specs",
        title: "Details",
        stats: [],
      },
      {
        id: "ciseco-product-options-accordion-category",
        title: "Category",
        stats: [],
      },
      {
        id: "ciseco-product-options-accordion-availability",
        title: "Availability",
        stats: [],
      },
    ],
    buttons: [
      {
        id: "ciseco-product-options-size-chart",
        label: "See sizing chart",
        href: "#",
        style: "ghost",
      },
      {
        id: "ciseco-product-options-add-to-cart",
        label: "Add to cart",
        href: "#",
        style: "primary",
      },
    ],
  };

  const descriptionSection: WebsiteBuilderSection = {
    id: "ciseco-product-description",
    type: "content",
    title: "Product Details",
    subtitle: null,
    description: null,
    eyebrow: null,
    layout: "product-description",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [],
  };

  const reviewsSection: WebsiteBuilderSection = {
    id: "ciseco-product-reviews",
    type: "testimonials",
    title: "{{reviewCount}} Reviews",
    subtitle: null,
    description: "No reviews yet. Be the first to share your feedback.",
    eyebrow: null,
    layout: "product-reviews",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [
      {
        id: "ciseco-product-reviews-cta",
        label: "Write a review",
        href: "#",
        style: "primary",
      },
    ],
  };

  const relatedSection: WebsiteBuilderSection = {
    id: "ciseco-product-related",
    type: "products",
    title: "Customers also purchased",
    subtitle: null,
    description: "No related products are available yet.",
    eyebrow: null,
    layout: "product-related",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [],
  };

  const bannerSection: WebsiteBuilderSection = {
    id: "ciseco-product-banner",
    type: "promo",
    title: "Special offer in kids products",
    subtitle: null,
    description:
      "Fashion is a form of self-expression and autonomy at a given period and place.",
    eyebrow: "Special offer",
    layout: "kids-banner",
    animation: "fade",
    visible: true,
    mediaId: null,
    secondaryMediaId: null,
    items: [],
    buttons: [
      {
        id: "ciseco-product-banner-cta",
        label: "Discover more",
        href: "#",
        style: "primary",
      },
    ],
  };

  return createCisecoPageConfig([
    createCisecoHeroSection({
      id: "ciseco-product-hero",
      title: "Fiche produit",
      subtitle: "Mettez en avant les détails clés.",
      layout: "page-hero",
    }),
    gallerySection,
    optionsSection,
    descriptionSection,
    reviewsSection,
    relatedSection,
    bannerSection,
  ]);
}

function createCisecoPageDefaults(): Record<CisecoPageKey, WebsiteBuilderPageConfig> {
  const basePages = Object.fromEntries(
    CISECO_PAGE_DEFINITIONS.map((entry) => [
      entry.key,
      createCisecoSimplePageConfig({
        id: `ciseco-${entry.key}-hero`,
        title: entry.label,
        subtitle: "Personnalisez cette page avec vos contenus.",
      }),
    ]),
  ) as Record<CisecoPageKey, WebsiteBuilderPageConfig>;

  basePages.home = createCisecoHomePageConfig();
  basePages.about = createCisecoAboutPageConfig();
  basePages.contact = createCisecoSimplePageConfig({
    id: "ciseco-contact-hero",
    title: "Contact",
    subtitle: "Nous sommes disponibles pour répondre à vos questions.",
  });
  basePages.blog = createCisecoSimplePageConfig({
    id: "ciseco-blog-hero",
    title: "Journal",
    subtitle: "Suivez nos dernières actualités et inspirations.",
  });
  basePages["blog-detail"] = createCisecoSimplePageConfig({
    id: "ciseco-blog-detail-hero",
    title: "Article",
    subtitle: "Racontez l’histoire derrière vos collections.",
  });
  basePages.collections = createCisecoSimplePageConfig({
    id: "ciseco-collections-hero",
    title: "Collections",
    subtitle: "Présentez vos sélections favorites.",
  });
  basePages.search = createCisecoSimplePageConfig({
    id: "ciseco-search-hero",
    title: "Recherche",
    subtitle: "Aidez vos visiteurs à trouver le bon produit.",
  });
  basePages.product = createCisecoProductPageConfig();
  basePages.cart = createCisecoSimplePageConfig({
    id: "ciseco-cart-hero",
    title: "Panier",
    subtitle: "Encouragez vos clients à finaliser.",
  });
  basePages.checkout = createCisecoSimplePageConfig({
    id: "ciseco-checkout-hero",
    title: "Paiement",
    subtitle: "Rassurez vos clients avant validation.",
  });
  basePages["order-success"] = createCisecoSimplePageConfig({
    id: "ciseco-order-success-hero",
    title: "Confirmation",
    subtitle: "Remerciez vos clients après l’achat.",
  });
  basePages.login = createCisecoSimplePageConfig({
    id: "ciseco-login-hero",
    title: "Connexion",
    subtitle: "Invitez vos clients à accéder à leur compte.",
  });
  basePages.signup = createCisecoSimplePageConfig({
    id: "ciseco-signup-hero",
    title: "Inscription",
    subtitle: "Créez une expérience d’onboarding fluide.",
  });
  basePages["forgot-password"] = createCisecoSimplePageConfig({
    id: "ciseco-forgot-hero",
    title: "Mot de passe oublié",
    subtitle: "Simplifiez la récupération de compte.",
  });
  basePages.account = createCisecoSimplePageConfig({
    id: "ciseco-account-hero",
    title: "Mon compte",
    subtitle: "Centralisez les informations clients.",
  });
  basePages["account-wishlists"] = createCisecoSimplePageConfig({
    id: "ciseco-account-wishlists-hero",
    title: "Favoris",
    subtitle: "Mettez en avant les produits enregistrés.",
  });
  basePages["account-orders-history"] = createCisecoSimplePageConfig({
    id: "ciseco-account-orders-hero",
    title: "Commandes",
    subtitle: "Suivi complet des achats précédents.",
  });
  basePages["account-order-detail"] = createCisecoSimplePageConfig({
    id: "ciseco-account-order-detail-hero",
    title: "Détail commande",
    subtitle: "Fournissez un aperçu clair du statut.",
  });
  basePages["account-change-password"] = createCisecoSimplePageConfig({
    id: "ciseco-account-password-hero",
    title: "Changer le mot de passe",
    subtitle: "Sécurisez les accès avec un nouveau mot de passe.",
  });

  return basePages;
}

export function ensureCisecoPageConfigs(
  config: WebsiteBuilderConfig,
  options?: { override?: boolean },
): WebsiteBuilderConfig {
  const override = options?.override ?? false;
  const hasPages = Object.keys(config.pages ?? {}).length > 0;
  const shouldMigrate =
    !hasPages &&
    config.sections.some((section) => section.id.startsWith("ciseco-"));
  const migratedPages = shouldMigrate
    ? {
        about: {
          sections: config.sections,
          mediaLibrary: config.mediaLibrary,
          seo: {},
        },
      }
    : {};

  const defaults = createCisecoPageDefaults();
  const defaultProductSections = defaults.product.sections.filter(
    (section) => section.id !== "ciseco-product-hero",
  );
  const nextPages: Record<CisecoPageKey, WebsiteBuilderPageConfig> = {
    ...defaults,
    ...(config.pages ?? {}),
    ...(migratedPages as Record<CisecoPageKey, WebsiteBuilderPageConfig>),
  };

  const productPage = nextPages.product;
  if (productPage) {
    const hasProductLayouts = productPage.sections.some((section) => {
      if (section.layout?.startsWith("product-")) {
        return true;
      }
      return section.id.startsWith("ciseco-product-") && section.id !== "ciseco-product-hero";
    });
    if (!hasProductLayouts && defaultProductSections.length) {
      nextPages.product = {
        ...productPage,
        sections: [...productPage.sections, ...defaultProductSections],
      };
    }
  }

  if (!override && hasPages) {
    return {
      ...config,
      pages: nextPages,
      sections: shouldMigrate ? [] : config.sections,
      mediaLibrary: shouldMigrate ? [] : config.mediaLibrary,
    };
  }

  if (override) {
    return {
      ...config,
      pages: nextPages,
      sections: [],
      mediaLibrary: [],
    };
  }

  return {
    ...config,
    pages: nextPages,
    sections: shouldMigrate ? [] : config.sections,
    mediaLibrary: shouldMigrate ? [] : config.mediaLibrary,
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
    case "categories":
      return {
        ...base,
        title: "Catégories",
        subtitle: "Présentez 3 à 6 catégories clés.",
        layout: "grid",
        items: [
          {
            id: generateId("category"),
            title: "Catégorie 1",
            description: "Courte description ou USP.",
            tag: "Nouveau",
            stats: [],
          },
        ],
      };
    case "products":
      return {
        ...base,
        title: "Produits en vedette",
        subtitle: "Mettez en avant vos best-sellers.",
        layout: "grid",
        items: [
          {
            id: generateId("product"),
            title: "Produit 1",
            description: "Description rapide du produit.",
            price: "99 €",
            tag: "Populaire",
            badge: "Nouveau",
            stats: [],
          },
        ],
      };
    case "promo":
      return {
        ...base,
        title: "Offres",
        subtitle: "Mettez en avant vos promotions.",
        layout: "banner",
        items: [
          {
            id: generateId("promo"),
            title: "Livraison offerte",
            description: "Dès 99 € d’achats.",
            stats: [],
          },
        ],
      };
    case "newsletter":
      return {
        ...base,
        title: "Newsletter",
        subtitle: "Ajoutez un formulaire pour capter des emails.",
        layout: "split",
        buttons: [
          {
            id: generateId("btn"),
            label: "S’abonner",
            href: "#newsletter",
            style: "primary",
          },
        ],
      };
    case "content":
      return {
        ...base,
        title: "Bloc éditorial",
        subtitle: "Racontez votre histoire, votre manifeste.",
        layout: "stack",
        items: [
          {
            id: generateId("content"),
            title: "Titre de paragraphe",
            description: "Ajoutez du texte riche pour détailler votre offre.",
            stats: [],
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
