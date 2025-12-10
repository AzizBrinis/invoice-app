import { z } from "zod";
import { generateId } from "@/lib/id";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";

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
