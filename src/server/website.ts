import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";
import { z, ZodError } from "zod";
import {
  Prisma,
  ClientSource,
  ProductSaleMode,
  WebsiteDomainStatus,
  WebsiteThemeMode,
  type WebsiteConfig,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getAppBaseUrl, getCatalogEdgeDomain } from "@/lib/env";
import { assertCustomDomainRecords, DomainVerificationError } from "@/lib/domain-verification";
import {
  ensureVercelProjectDomain,
  removeVercelProjectDomain,
  MissingVercelConfigError,
  VercelApiError,
} from "@/lib/vercel-api";
import { sendEmailMessageForUser } from "@/server/messaging";
import { getSettings } from "@/server/settings";
import {
  WEBSITE_TEMPLATE_KEY_VALUES,
  type WebsiteTemplateKey,
} from "@/lib/website/templates";
import { resolvePage as resolveCisecoPage } from "@/components/website/templates/ecommerce-ciseco/utils";
import {
  CONTACT_SOCIAL_ICON_VALUES,
  type ContactSocialLink,
} from "@/lib/website/contact";
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";
import { slugify } from "@/lib/slug";
import { fromCents } from "@/lib/money";
import { stripProductHtml } from "@/lib/product-html";
import { normalizeProductFaqItems } from "@/lib/product-seo";
import {
  applyThemeFallbacks,
  builderConfigSchema,
  builderVersionHistorySchema,
  createDefaultBuilderConfig,
  createSectionTemplate,
  normalizeBuilderConfigForTemplate,
  sanitizeBuilderPages,
  type BuilderSectionType,
  type WebsiteBuilderConfig,
  type WebsiteBuilderVersionEntry,
} from "@/lib/website/builder";
import {
  isReservedWebsiteCmsPagePath,
  normalizeWebsiteCmsPagePath,
  renderWebsiteCmsPageContent,
  summarizeWebsiteCmsPageContent,
  WEBSITE_CMS_PAGE_MAX_CONTENT_LENGTH,
  WEBSITE_CMS_PAGE_MAX_PATH_LENGTH,
  type WebsiteCmsPageHeading,
} from "@/lib/website/cms";
import { generateId } from "@/lib/id";
import { revalidateClientFilters } from "@/server/clients";
import { revalidateQuoteFilterClients } from "@/server/quotes";
import type { CatalogViewerState } from "@/lib/catalog-viewer";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexColorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const relativeOrAbsoluteUrl = /^(?:https?:\/\/|\/)/i;
const socialLinkUrlPattern = /^(?:https?:\/\/|mailto:|tel:|\/)/i;
const domainHostnamePattern = /^[a-z0-9.-]+$/i;
const catalogPathPattern = /^\/[a-z0-9/_-]*$/i;
const CATALOG_PATH_MAX_LENGTH = 180;
const WEBSITE_ADMIN_CACHE_REVALIDATE_SECONDS = 15;
export const CATALOG_PAYLOAD_REVALIDATE_SECONDS = 30;
const WEBSITE_PRODUCT_STATS_CACHE_SECONDS = 30;
const WEBSITE_PRODUCT_LIST_DEFAULT_PAGE_SIZE = 40;
const WEBSITE_PRODUCT_LIST_MAX_PAGE_SIZE = 80;

function websiteAdminTag(userId: string) {
  return `website-admin:${userId}`;
}

const slugSchema = z
  .string()
  .min(3, "Le slug doit contenir au moins 3 caractères.")
  .max(64, "Le slug doit contenir au maximum 64 caractères.")
  .regex(slugPattern, "Utilisez uniquement des lettres minuscules, chiffres et tirets.");

const contactSocialLinkSchema = z.object({
  id: z.string().default(() => generateId("social")),
  label: z.string().max(60),
  href: z
    .string()
    .max(200)
    .refine(
      (value) => socialLinkUrlPattern.test(value),
      "L'URL doit commencer par http(s)://, /, mailto: ou tel:",
    ),
  icon: z.enum(CONTACT_SOCIAL_ICON_VALUES),
});

const contactSocialLinksSchema = z
  .array(contactSocialLinkSchema)
  .max(12)
  .default([]);

const websiteContentSchema = z.object({
  slug: slugSchema.optional(),
  heroEyebrow: z.string().max(80).nullable().optional(),
  heroTitle: z.string().min(4).max(120),
  heroSubtitle: z.string().max(240).nullable().optional(),
  heroPrimaryCtaLabel: z.string().min(3).max(60),
  heroSecondaryCtaLabel: z.string().max(60).nullable().optional(),
  heroSecondaryCtaUrl: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .refine(
      (value) => !value || relativeOrAbsoluteUrl.test(value),
      "L'URL doit commencer par http(s):// ou /",
    ),
  aboutTitle: z.string().max(120).nullable().optional(),
  aboutBody: z.string().max(2000).nullable().optional(),
  contactBlurb: z.string().max(600).nullable().optional(),
  contactEmailOverride: z.string().email().max(160).nullable().optional(),
  contactPhoneOverride: z.string().max(60).nullable().optional(),
  contactAddressOverride: z.string().max(280).nullable().optional(),
  seoTitle: z.string().max(160).nullable().optional(),
  seoDescription: z.string().max(260).nullable().optional(),
  seoKeywords: z.string().max(260).nullable().optional(),
  socialImageUrl: z.string().url().max(400).nullable().optional(),
  theme: z.nativeEnum(WebsiteThemeMode),
  accentColor: z
    .string()
    .max(7)
    .refine(
      (value) => hexColorPattern.test(value),
      "Couleur hexadécimale invalide (#123ABC).",
    ),
  showPrices: z.boolean().default(true),
  showInactiveProducts: z.boolean().default(false),
  leadNotificationEmail: z.string().email().max(160).nullable().optional(),
  leadAutoTag: z.string().max(60).nullable().optional(),
  leadThanksMessage: z.string().max(200).nullable().optional(),
  spamProtectionEnabled: z.boolean().default(true),
  templateKey: z.enum(WEBSITE_TEMPLATE_KEY_VALUES).default("dev-agency"),
});

const contactPageSchema = z.object({
  contactBlurb: z.string().max(600).nullable().optional(),
  contactEmailOverride: z.string().email().max(160).nullable().optional(),
  contactPhoneOverride: z.string().max(60).nullable().optional(),
  contactAddressOverride: z.string().max(280).nullable().optional(),
  socialLinks: contactSocialLinksSchema.default([]),
});

const websiteCmsPageSchema = z.object({
  id: z.string().cuid().nullable().optional(),
  title: z.string().trim().min(3).max(140),
  path: z
    .string()
    .trim()
    .min(1)
    .max(WEBSITE_CMS_PAGE_MAX_PATH_LENGTH),
  content: z
    .string()
    .trim()
    .min(1, "Ajoutez le contenu de la page.")
    .max(
      WEBSITE_CMS_PAGE_MAX_CONTENT_LENGTH,
      `Le contenu ne doit pas dépasser ${WEBSITE_CMS_PAGE_MAX_CONTENT_LENGTH} caractères.`,
    ),
  showInFooter: z.boolean().default(false),
});

const websiteCmsPageDeleteSchema = z.object({
  id: z.string().cuid(),
});

export function resolveContactSocialLinks(
  value: unknown,
): ContactSocialLink[] {
  const parsed = contactSocialLinksSchema.safeParse(value ?? []);
  if (!parsed.success) {
    return [];
  }
  return parsed.data;
}

const signupProviderSchema = z
  .object({
    enabled: z.boolean().default(false),
    useEnv: z.boolean().default(true),
    clientId: z.string().max(220).nullable().optional(),
    clientSecret: z.string().max(220).nullable().optional(),
  })
  .default({
    enabled: false,
    useEnv: true,
    clientId: null,
    clientSecret: null,
  });

const DEFAULT_SIGNUP_PROVIDERS = {
  facebook: {
    enabled: false,
    useEnv: true,
    clientId: null,
    clientSecret: null,
  },
  google: {
    enabled: false,
    useEnv: true,
    clientId: null,
    clientSecret: null,
  },
  twitter: {
    enabled: false,
    useEnv: true,
    clientId: null,
    clientSecret: null,
  },
} as const;

const DEFAULT_PAYMENT_METHODS = {
  card: false,
  bankTransfer: false,
  cashOnDelivery: false,
} as const;

const DEFAULT_BANK_TRANSFER_SETTINGS = {
  instructions: "",
} as const;

const DEFAULT_CHECKOUT_SETTINGS = {
  requirePhone: false,
  allowNotes: true,
  termsUrl: "",
} as const;

const signupProvidersSchema = z
  .object({
    facebook: signupProviderSchema.optional(),
    google: signupProviderSchema.optional(),
    twitter: signupProviderSchema.optional(),
  })
  .default(DEFAULT_SIGNUP_PROVIDERS)
  .transform((value) => ({
    facebook: signupProviderSchema.parse(value.facebook),
    google: signupProviderSchema.parse(value.google),
    twitter: signupProviderSchema.parse(value.twitter),
  }));

const signupSettingsSchema = z
  .object({
    redirectTarget: z.enum(["home", "account"]).default("home"),
    providers: signupProvidersSchema,
  })
  .default({
    redirectTarget: "home",
    providers: DEFAULT_SIGNUP_PROVIDERS,
  });

const ecommerceSettingsSchema = z.object({
  payments: z
    .object({
      methods: z
        .object({
          card: z.boolean().default(false),
          bankTransfer: z.boolean().default(false),
          cashOnDelivery: z.boolean().default(false),
        })
        .default(DEFAULT_PAYMENT_METHODS),
      bankTransfer: z
        .object({
          instructions: z.string().max(2000).default(""),
        })
        .default(DEFAULT_BANK_TRANSFER_SETTINGS),
    })
    .default({
      methods: DEFAULT_PAYMENT_METHODS,
      bankTransfer: DEFAULT_BANK_TRANSFER_SETTINGS,
    }),
  checkout: z
    .object({
      requirePhone: z.boolean().default(false),
      allowNotes: z.boolean().default(true),
      termsUrl: z
        .string()
        .max(200)
        .default("")
        .refine(
          (value) => !value || relativeOrAbsoluteUrl.test(value),
          "L'URL doit commencer par http(s):// ou /",
        ),
    })
    .default(DEFAULT_CHECKOUT_SETTINGS),
  featuredProductIds: z.array(z.string()).default([]),
  signup: signupSettingsSchema,
});

export type EcommerceSettingsInput = z.infer<typeof ecommerceSettingsSchema>;
export type SignupSettingsInput = z.infer<typeof signupSettingsSchema>;
export type SignupProviderInput = z.infer<typeof signupProviderSchema>;

const DEFAULT_ECOMMERCE_SETTINGS: EcommerceSettingsInput = {
  payments: {
    methods: {
      card: false,
      bankTransfer: false,
      cashOnDelivery: false,
    },
    bankTransfer: {
      instructions: "",
    },
  },
  checkout: {
    requirePhone: false,
    allowNotes: true,
    termsUrl: "",
  },
  featuredProductIds: [],
  signup: {
    redirectTarget: "home",
    providers: {
      facebook: {
        enabled: false,
        useEnv: true,
        clientId: null,
        clientSecret: null,
      },
      google: {
        enabled: false,
        useEnv: true,
        clientId: null,
        clientSecret: null,
      },
      twitter: {
        enabled: false,
        useEnv: true,
        clientId: null,
        clientSecret: null,
      },
    },
  },
};

const domainSchema = z.object({
  customDomain: z.preprocess(
    (value) =>
      typeof value === "string" ? sanitizeDomain(value) : value,
    z
      .string()
      .min(4, "Domaine trop court.")
      .max(120, "Domaine trop long.")
      .regex(
        domainHostnamePattern,
        "Le domaine ne doit contenir que lettres, chiffres, points et tirets.",
      ),
  ),
});

const publishSchema = z.object({
  published: z.boolean(),
});

const leadSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(120).nullable().optional(),
  needs: z.string().min(12).max(1200),
  path: z.string().max(180).nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  honeypot: z.string().optional(),
});

type WebsiteContentInput = z.infer<typeof websiteContentSchema>;
type DomainInput = z.infer<typeof domainSchema>;
type PublishInput = z.infer<typeof publishSchema>;
type WebsiteCmsPageInput = z.infer<typeof websiteCmsPageSchema>;

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  descriptionHtml: string | null;
  shortDescriptionHtml?: string | null;
  excerpt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  gallery: Prisma.JsonValue | null;
  faqItems?: Prisma.JsonValue | null;
  quoteFormSchema: Prisma.JsonValue | null;
  optionConfig: Prisma.JsonValue | null;
  variantStock: Prisma.JsonValue | null;
  category: string | null;
  unit: string;
  stockQuantity: number | null;
  priceHTCents: number;
  priceTTCCents: number;
  vatRate: number;
  defaultDiscountRate: number | null;
  defaultDiscountAmountCents?: number | null;
  sku: string;
  publicSlug: string;
  saleMode: ProductSaleMode;
  isActive: boolean;
};

export type CatalogWebsiteMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  socialImageUrl: string | null;
  keywords: string | null;
};

export type CatalogWebsiteCmsPageLink = {
  id: string;
  title: string;
  path: string;
  showInFooter: boolean;
};

export type CatalogWebsiteCmsPage = CatalogWebsiteCmsPageLink & {
  contentHtml: string;
  excerpt: string | null;
  headings: WebsiteCmsPageHeading[];
};

export type WebsiteAdminCmsPage = {
  id: string;
  title: string;
  path: string;
  content: string;
  excerpt: string | null;
  showInFooter: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CatalogWebsiteSummary = {
  id: string;
  slug: string;
  templateKey: WebsiteTemplateKey;
  heroEyebrow: string | null;
  heroTitle: string;
  heroSubtitle: string | null;
  heroPrimaryCtaLabel: string;
  heroSecondaryCtaLabel: string | null;
  heroSecondaryCtaUrl: string | null;
  aboutTitle: string | null;
  aboutBody: string | null;
  contactBlurb: string | null;
  accentColor: string;
  theme: WebsiteThemeMode;
  showPrices: boolean;
  ecommerceSettings: EcommerceSettingsInput;
  leadThanksMessage: string | null;
  spamProtectionEnabled: boolean;
  published: boolean;
  domainStatus: WebsiteDomainStatus;
  customDomain: string | null;
  currencyCode: string;
  socialLinks: ContactSocialLink[];
  contact: {
    companyName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    logoData: string | null;
  };
  cmsPages: CatalogWebsiteCmsPageLink[];
  metadata: CatalogWebsiteMetadata;
  builder: WebsiteBuilderConfig;
};

export type CatalogPayload = {
  website: CatalogWebsiteSummary;
  products: {
    featured: CatalogProduct[];
    all: CatalogProduct[];
  };
  currentCmsPage: CatalogWebsiteCmsPage | null;
  viewer?: CatalogViewerState;
};

type CatalogGalleryEntry = {
  src: string;
  alt?: string | null;
  isPrimary?: boolean;
  position?: number | null;
};

export type WebsiteBuilderState = {
  config: WebsiteBuilderConfig;
  history: WebsiteBuilderVersionEntry[];
};

export type ContactPageInput = z.infer<typeof contactPageSchema>;

export type WebsiteLeadInput = z.input<typeof leadSchema> & {
  slug?: string | null;
  domain?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type WebsiteAdminPayload = Awaited<
  ReturnType<typeof getWebsiteAdminPayload>
>;

const websiteProductSummarySelect = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  name: true,
  sku: true,
  category: true,
  isActive: true,
  isListedInCatalog: true,
});

export type WebsiteProductSummary = Prisma.ProductGetPayload<{
  select: typeof websiteProductSummarySelect;
}>;

export type WebsiteProductStats = {
  totalProducts: number;
  listedProducts: number;
};

export type WebsiteProductListFilters = {
  search?: string;
  visibility?: "all" | "visible" | "hidden";
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

export type WebsiteProductListResult = {
  items: WebsiteProductSummary[];
  total: number;
  listed: number;
  filteredTotal: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const websiteCmsPageAdminSelect =
  Prisma.validator<Prisma.WebsiteCmsPageSelect>()({
    id: true,
    title: true,
    path: true,
    content: true,
    showInFooter: true,
    createdAt: true,
    updatedAt: true,
  });

function normalizeCatalogGalleryEntries(
  value: Prisma.JsonValue | null | undefined,
): CatalogGalleryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: CatalogGalleryEntry[] = [];
  value.forEach((entry, index) => {
    if (typeof entry === "string") {
      const src = entry.trim();
      if (!src) return;
      entries.push({ src, position: index });
      return;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    const src =
      typeof entry.src === "string"
        ? entry.src.trim()
        : typeof entry.url === "string"
          ? entry.url.trim()
          : "";
    if (!src) return;
    entries.push({
      src,
      alt: typeof entry.alt === "string" ? entry.alt : null,
      isPrimary: typeof entry.isPrimary === "boolean" ? entry.isPrimary : undefined,
      position: typeof entry.position === "number" ? entry.position : index,
    });
  });
  return entries.sort((left, right) => {
    const leftPos = left.position ?? 0;
    const rightPos = right.position ?? 0;
    if (leftPos === rightPos) return 0;
    return leftPos - rightPos;
  });
}

function resolveCatalogListingImageCandidate(
  product: Pick<CatalogProduct, "coverImageUrl" | "gallery">,
) {
  const galleryEntries = normalizeCatalogGalleryEntries(product.gallery);
  const primaryEntry = galleryEntries.find((entry) => entry.isPrimary);
  const coverImage = product.coverImageUrl?.trim();
  return (
    [primaryEntry?.src, coverImage, galleryEntries[0]?.src].find(
      (entry): entry is string => Boolean(entry && entry.trim().length > 0),
    ) ?? null
  );
}

export function isInlineCatalogImageSource(value: string | null | undefined) {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^data:image\//i.test(trimmed));
}

export function resolveCatalogProductListingImageDataUrl(
  product: Pick<CatalogProduct, "coverImageUrl" | "gallery">,
) {
  const candidate = resolveCatalogListingImageCandidate(product);
  return isInlineCatalogImageSource(candidate) ? candidate : null;
}

export function buildCatalogProductListingImagePath(options: {
  productId: string;
  website: Pick<CatalogWebsiteSummary, "slug">;
}) {
  return `/api/catalogue/products/${encodeURIComponent(options.productId)}/listing-image/${encodeURIComponent(options.website.slug)}`;
}

export function resolveCatalogProductListingImageSource(
  product: Pick<CatalogProduct, "id" | "coverImageUrl" | "gallery">,
  website: Pick<CatalogWebsiteSummary, "slug">,
) {
  const candidate = resolveCatalogListingImageCandidate(product);
  if (!candidate) return null;
  if (isInlineCatalogImageSource(candidate)) {
    return buildCatalogProductListingImagePath({
      productId: product.id,
      website,
    });
  }
  return candidate;
}

const websiteCmsPageLinkSelect =
  Prisma.validator<Prisma.WebsiteCmsPageSelect>()({
    id: true,
    title: true,
    path: true,
    showInFooter: true,
  });

const websiteCmsPageContentSelect =
  Prisma.validator<Prisma.WebsiteCmsPageSelect>()({
    id: true,
    title: true,
    path: true,
    content: true,
    showInFooter: true,
  });

type WebsiteCmsPageAdminRecord = Prisma.WebsiteCmsPageGetPayload<{
  select: typeof websiteCmsPageAdminSelect;
}>;

type WebsiteCmsPageLinkRecord = Prisma.WebsiteCmsPageGetPayload<{
  select: typeof websiteCmsPageLinkSelect;
}>;

type WebsiteCmsPageContentRecord = Prisma.WebsiteCmsPageGetPayload<{
  select: typeof websiteCmsPageContentSelect;
}>;

function serializeWebsiteCmsPageAdmin(
  page: WebsiteCmsPageAdminRecord,
): WebsiteAdminCmsPage {
  return {
    id: page.id,
    title: page.title,
    path: page.path,
    content: page.content,
    excerpt: summarizeWebsiteCmsPageContent(page.content),
    showInFooter: page.showInFooter,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

function serializeCatalogWebsiteCmsPageLink(
  page: WebsiteCmsPageLinkRecord,
): CatalogWebsiteCmsPageLink {
  return {
    id: page.id,
    title: page.title,
    path: page.path,
    showInFooter: page.showInFooter,
  };
}

function serializeCatalogWebsiteCmsPage(
  page: WebsiteCmsPageContentRecord,
): CatalogWebsiteCmsPage {
  const rendered = renderWebsiteCmsPageContent(page.content);
  return {
    id: page.id,
    title: page.title,
    path: page.path,
    showInFooter: page.showInFooter,
    contentHtml: rendered.html,
    excerpt: rendered.excerpt,
    headings: rendered.headings,
  };
}

async function resolveUserId(userId?: string) {
  if (userId) {
    return userId;
  }
  const user = await requireUser();
  return user.id;
}

async function findAvailableSlug(base: string) {
  const cleaned = base.length >= 3 && slugPattern.test(base) ? base : "catalogue";
  let candidate = cleaned;
  let attempt = 1;
  while (true) {
    const existing = await prisma.websiteConfig.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    attempt += 1;
    candidate = `${cleaned}-${attempt}`;
  }
}

function sanitizeDomain(domain: string) {
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/.*$/, "");
}

function normalizeDomain(domain: string) {
  return sanitizeDomain(domain).toLowerCase();
}

export function normalizeCatalogDomainInput(value?: string | null) {
  if (!value) return null;
  const sanitized = sanitizeDomain(value);
  if (!sanitized) return null;
  const candidate = /^https?:\/\//i.test(sanitized)
    ? sanitized
    : `https://${sanitized}`;
  try {
    const hostname = new URL(candidate).hostname.toLowerCase();
    if (!hostname || !domainHostnamePattern.test(hostname)) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

export function normalizeCatalogSlugInput(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (!slugPattern.test(trimmed)) return null;
  return trimmed;
}

export function normalizeCatalogPathInput(value?: string | null) {
  if (value == null) return null;
  const normalized = normalizeCatalogPath(value);
  if (normalized.length > CATALOG_PATH_MAX_LENGTH) {
    return null;
  }
  if (!catalogPathPattern.test(normalized)) {
    return null;
  }
  if (normalized.includes("..") || normalized.includes("\\")) {
    return null;
  }
  return normalized;
}

export function resolveCatalogCurrencyCode(
  website: WebsiteConfig,
  configuredCurrency?: string | null,
) {
  const normalized = configuredCurrency?.trim().toUpperCase() || "TND";
  if (
    website.templateKey === "ecommerce-tech-agency" ||
    website.templateKey === "ecommerce-cesco"
  ) {
    if (normalized !== "TND") {
      console.warn("[catalogue] currency mismatch", {
        websiteId: website.id,
        templateKey: website.templateKey,
        configuredCurrency: normalized,
      });
    }
    return "TND";
  }
  return normalized;
}

function pickFeaturedProducts(
  products: CatalogProduct[],
  preferred?: string[] | null,
): CatalogProduct[] {
  if (!preferred?.length) {
    return products.slice(0, 4);
  }
  const map = new Map(products.map((product) => [product.id, product]));
  const featured: CatalogProduct[] = [];
  preferred.forEach((id) => {
    const match = map.get(id);
    if (match) {
      featured.push(match);
    }
  });
  if (!featured.length) {
    return products.slice(0, 4);
  }
  return featured;
}

async function ensureWebsiteConfig(userId: string) {
  const existing = await prisma.websiteConfig.findUnique({
    where: { userId },
  });
  if (existing) {
    return existing;
  }
  const settings = await prisma.companySettings.findUnique({
    where: { userId },
  });
  const baseName = settings?.companyName ?? "catalogue";
  const slug = await findAvailableSlug(slugify(baseName));
  return prisma.websiteConfig.create({
    data: {
      userId,
      slug,
      templateKey: "dev-agency",
      heroEyebrow: "Catalogue public",
      heroTitle: settings?.companyName
        ? `Catalogue — ${settings.companyName}`
        : "Présentez vos prestations",
      heroSubtitle:
        "Publiez vos produits, rassurez vos prospects et capturez les demandes en direct.",
      heroPrimaryCtaLabel: DEFAULT_PRIMARY_CTA_LABEL,
      aboutTitle: settings?.companyName
        ? `Pourquoi ${settings.companyName} ?`
        : "Notre expertise",
      contactBlurb:
        settings?.address ??
        "Ajoutez ici votre argumentaire commercial et vos garanties.",
      contactEmailOverride: settings?.email,
      contactPhoneOverride: settings?.phone,
      leadNotificationEmail: settings?.email,
      ecommerceSettings: DEFAULT_ECOMMERCE_SETTINGS,
      accentColor: "#2563eb",
      builderConfig: createDefaultBuilderConfig({
        heroEyebrow: "Catalogue public",
        heroTitle: settings?.companyName
          ? `Catalogue — ${settings.companyName}`
          : "Présentez vos prestations",
        heroSubtitle:
          "Publiez vos produits, rassurez vos prospects et capturez les demandes en direct.",
        heroPrimaryCtaLabel: DEFAULT_PRIMARY_CTA_LABEL,
        heroSecondaryCtaLabel: "Télécharger la plaquette",
        heroSecondaryCtaUrl: "/catalogue",
        aboutTitle: settings?.companyName
          ? `Pourquoi ${settings.companyName} ?`
          : "Notre expertise",
        aboutBody:
          "Nous aidons les entreprises ambitieuses à concevoir et déployer des expériences numériques efficaces.",
        contactBlurb:
          settings?.address ??
          "Ajoutez ici votre argumentaire commercial et vos garanties.",
        accentColor: "#2563eb",
      }),
      builderVersionHistory: [],
    },
  });
}

export async function getWebsiteConfig(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  return ensureWebsiteConfig(resolvedUserId);
}

export async function saveWebsiteContent(
  input: WebsiteContentInput,
  userId?: string,
) {
  const resolvedUserId = await resolveUserId(userId);
  const currentConfig = await ensureWebsiteConfig(resolvedUserId);
  const parsed = websiteContentSchema.parse(input);
  let nextSlug = currentConfig.slug;
  if (parsed.slug && parsed.slug !== currentConfig.slug) {
    const sanitizedSlug = slugify(parsed.slug);
    const validSlug = slugSchema.parse(sanitizedSlug);
    if (validSlug !== currentConfig.slug) {
      const exists = await prisma.websiteConfig.findUnique({
        where: { slug: validSlug },
        select: { id: true },
      });
      if (exists && exists.id !== currentConfig.id) {
        throw new Error("Ce slug est déjà utilisé par un autre site.");
      }
      nextSlug = validSlug;
    }
  }

  const payload: Prisma.WebsiteConfigUpdateInput = {
    slug: nextSlug,
    heroEyebrow: parsed.heroEyebrow ?? null,
    heroTitle: parsed.heroTitle,
    heroSubtitle: parsed.heroSubtitle ?? null,
    heroPrimaryCtaLabel: parsed.heroPrimaryCtaLabel,
    heroSecondaryCtaLabel: parsed.heroSecondaryCtaLabel ?? null,
    heroSecondaryCtaUrl: parsed.heroSecondaryCtaUrl ?? null,
    aboutTitle: parsed.aboutTitle ?? null,
    aboutBody: parsed.aboutBody ?? null,
    contactBlurb: parsed.contactBlurb ?? null,
    contactEmailOverride: parsed.contactEmailOverride ?? null,
    contactPhoneOverride: parsed.contactPhoneOverride ?? null,
    contactAddressOverride: parsed.contactAddressOverride ?? null,
    seoTitle: parsed.seoTitle ?? null,
    seoDescription: parsed.seoDescription ?? null,
    seoKeywords: parsed.seoKeywords ?? null,
    socialImageUrl: parsed.socialImageUrl ?? null,
    theme: parsed.theme,
    accentColor: parsed.accentColor,
    showPrices: parsed.showPrices,
    showInactiveProducts: parsed.showInactiveProducts,
    leadNotificationEmail: parsed.leadNotificationEmail ?? null,
    leadAutoTag: parsed.leadAutoTag ?? null,
    leadThanksMessage: parsed.leadThanksMessage ?? null,
    spamProtectionEnabled: parsed.spamProtectionEnabled,
    templateKey: parsed.templateKey,
  };

  const updated = await prisma.websiteConfig.update({
    where: { id: currentConfig.id },
    data: payload,
  });
  revalidateTag(websiteAdminTag(resolvedUserId), "max");
  return updated;
}

export async function listWebsiteCmsPages(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const website = await ensureWebsiteConfig(resolvedUserId);
  const pages = await prisma.websiteCmsPage.findMany({
    where: {
      websiteId: website.id,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: websiteCmsPageAdminSelect,
  });
  return pages.map((page) => serializeWebsiteCmsPageAdmin(page));
}

export async function saveWebsiteCmsPage(
  input: WebsiteCmsPageInput,
  userId?: string,
) {
  const resolvedUserId = await resolveUserId(userId);
  const website = await ensureWebsiteConfig(resolvedUserId);
  const parsed = websiteCmsPageSchema.parse(input);
  const normalizedPath = normalizeWebsiteCmsPagePath(parsed.path);

  if (!normalizedPath) {
    throw new ZodError([
      {
        code: "custom",
        path: ["path"],
        message:
          "Utilisez une URL courte comme /delivery ou /mentions-legales.",
      },
    ]);
  }

  if (isReservedWebsiteCmsPagePath(normalizedPath)) {
    throw new ZodError([
      {
        code: "custom",
        path: ["path"],
        message:
          "Cette URL est réservée par le template. Choisissez un autre chemin.",
      },
    ]);
  }

  const existing = parsed.id
    ? await prisma.websiteCmsPage.findFirst({
        where: {
          id: parsed.id,
          websiteId: website.id,
        },
        select: {
          id: true,
        },
      })
    : null;

  if (parsed.id && !existing) {
    throw new Error("Cette page CMS est introuvable.");
  }

  const conflict = await prisma.websiteCmsPage.findUnique({
    where: {
      websiteId_path: {
        websiteId: website.id,
        path: normalizedPath,
      },
    },
    select: {
      id: true,
    },
  });

  if (conflict && conflict.id !== existing?.id) {
    throw new ZodError([
      {
        code: "custom",
        path: ["path"],
        message: "Cette URL est déjà utilisée par une autre page CMS.",
      },
    ]);
  }

  const payload = {
    title: parsed.title.trim(),
    path: normalizedPath,
    content: parsed.content.trim(),
    showInFooter: parsed.showInFooter,
  };

  const saved = existing
    ? await prisma.websiteCmsPage.update({
        where: {
          id: existing.id,
        },
        data: payload,
        select: websiteCmsPageAdminSelect,
      })
    : await prisma.websiteCmsPage.create({
        data: {
          ...payload,
          userId: resolvedUserId,
          websiteId: website.id,
        },
        select: websiteCmsPageAdminSelect,
      });

  revalidateTag(websiteAdminTag(resolvedUserId), "max");
  return serializeWebsiteCmsPageAdmin(saved);
}

export async function deleteWebsiteCmsPage(id: string, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const website = await ensureWebsiteConfig(resolvedUserId);
  const parsed = websiteCmsPageDeleteSchema.parse({ id });
  const existing = await prisma.websiteCmsPage.findFirst({
    where: {
      id: parsed.id,
      websiteId: website.id,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new Error("Cette page CMS est introuvable.");
  }

  await prisma.websiteCmsPage.delete({
    where: {
      id: existing.id,
    },
  });
  revalidateTag(websiteAdminTag(resolvedUserId), "max");
}

export async function saveWebsiteContactPage(
  input: ContactPageInput,
  userId?: string,
) {
  const resolvedUserId = await resolveUserId(userId);
  const currentConfig = await ensureWebsiteConfig(resolvedUserId);
  const parsed = contactPageSchema.parse(input);

  const cleanValue = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const socialLinks = parsed.socialLinks
    .map((link) => ({
      ...link,
      label: link.label.trim(),
      href: link.href.trim(),
    }))
    .filter((link) => link.label.length > 0 && link.href.length > 0);

  const updated = await prisma.websiteConfig.update({
    where: { id: currentConfig.id },
    data: {
      contactBlurb: cleanValue(parsed.contactBlurb),
      contactEmailOverride: cleanValue(parsed.contactEmailOverride),
      contactPhoneOverride: cleanValue(parsed.contactPhoneOverride),
      contactAddressOverride: cleanValue(parsed.contactAddressOverride),
      socialLinks: socialLinks as Prisma.JsonArray,
    },
  });
  revalidateTag(websiteAdminTag(resolvedUserId), "max");
  return updated;
}

export async function saveWebsiteEcommerceSettings(
  input: EcommerceSettingsInput,
  userId?: string,
) {
  const resolvedUserId = await resolveUserId(userId);
  const currentConfig = await ensureWebsiteConfig(resolvedUserId);
  const parsed = ecommerceSettingsSchema.parse(input);
  const updated = await prisma.websiteConfig.update({
    where: { id: currentConfig.id },
    data: {
      ecommerceSettings: parsed as Prisma.JsonObject,
      featuredProductIds: parsed.featuredProductIds as Prisma.JsonArray,
    },
  });
  revalidateTag(websiteAdminTag(resolvedUserId), "max");
  return updated;
}

export async function getWebsiteEcommerceSettings(
  userId?: string,
  options?: { includeSecrets?: boolean },
) {
  const resolvedUserId = await resolveUserId(userId);
  const website = await ensureWebsiteConfig(resolvedUserId);
  return resolveEcommerceSettingsFromWebsite(website, options);
}

export async function updateWebsitePublishing(
  input: PublishInput,
  userId?: string,
) {
  const resolvedUserId = await resolveUserId(userId);
  const parsed = publishSchema.parse(input);
  const config = await ensureWebsiteConfig(resolvedUserId);
  return prisma.websiteConfig.update({
    where: { id: config.id },
    data: {
      published: parsed.published,
    },
  });
}

export async function requestCustomDomain(
  input: DomainInput,
  userId?: string,
) {
  const resolvedUserId = await resolveUserId(userId);
  const parsed = domainSchema.parse(input);
  const config = await ensureWebsiteConfig(resolvedUserId);
  const normalized = normalizeDomain(parsed.customDomain);
  const alreadyUsed = await prisma.websiteConfig.findFirst({
    where: {
      customDomain: normalized,
      userId: {
        not: resolvedUserId,
      },
    },
    select: { id: true },
  });
  if (alreadyUsed) {
    throw new Error("Ce domaine est déjà connecté à un autre compte.");
  }
  return prisma.websiteConfig.update({
    where: { id: config.id },
    data: {
      customDomain: normalized,
      domainStatus: WebsiteDomainStatus.PENDING,
      domainVerifiedAt: null,
      domainActivatedAt: null,
      published: false,
    },
  });
}

export async function verifyCustomDomain(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const config = await ensureWebsiteConfig(resolvedUserId);
  if (!config.customDomain) {
    throw new Error("Aucun domaine à vérifier.");
  }
  if (config.domainStatus === WebsiteDomainStatus.ACTIVE) {
    throw new Error(
      "Ce domaine est déjà actif. Déconnectez-le avant de relancer la vérification.",
    );
  }
  const edgeDomain = getCatalogEdgeDomain();
  try {
    await assertCustomDomainRecords({
      domain: config.customDomain,
      verificationCode: config.domainVerificationCode,
      cnameTarget: edgeDomain,
    });
  } catch (error) {
    if (error instanceof DomainVerificationError) {
      throw error;
    }
    console.error("[website] DNS verification failed", error);
    throw new Error(
      "Impossible de vérifier les enregistrements DNS pour le moment. Réessayez d’ici quelques minutes.",
    );
  }
  return prisma.websiteConfig.update({
    where: { id: config.id },
    data: {
      domainStatus: WebsiteDomainStatus.VERIFIED,
      domainVerifiedAt: new Date(),
    },
  });
}

export async function activateCustomDomain(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const config = await ensureWebsiteConfig(resolvedUserId);
  if (!config.customDomain) {
    throw new Error("Aucun domaine configuré.");
  }
  if (config.domainStatus === WebsiteDomainStatus.PENDING) {
    throw new Error("Vérifiez le domaine avant de l’activer.");
  }
  try {
    await ensureVercelProjectDomain(config.customDomain);
  } catch (error) {
    if (error instanceof MissingVercelConfigError) {
      throw new Error(error.message);
    }
    if (error instanceof VercelApiError) {
      console.error("[website] Vercel domain linking failed", {
        domain: config.customDomain,
        code: error.code,
        status: error.status,
        requestId: error.requestId,
      });
      const requestHint = error.requestId ? ` (req ${error.requestId})` : "";
      throw new Error(
        `Vercel a refusé le domaine : ${error.message}${requestHint}`,
      );
    }
    console.error("[website] Unexpected domain activation error", error);
    throw new Error(
      "Impossible d’activer le domaine pour le moment. Réessayez plus tard.",
    );
  }
  return prisma.websiteConfig.update({
    where: { id: config.id },
    data: {
      domainStatus: WebsiteDomainStatus.ACTIVE,
      domainActivatedAt: new Date(),
      published: true,
    },
  });
}

export async function disconnectCustomDomain(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const config = await ensureWebsiteConfig(resolvedUserId);
  if (config.customDomain) {
    removeVercelProjectDomain(config.customDomain).catch((error) => {
      console.warn("[website] Failed to remove project domain", {
        domain: config.customDomain,
        error,
      });
    });
  }
  return prisma.websiteConfig.update({
    where: { id: config.id },
    data: {
      customDomain: null,
      domainStatus: WebsiteDomainStatus.PENDING,
      domainActivatedAt: null,
      domainVerifiedAt: null,
      published: false,
    },
  });
}

function buildMetadata(options: {
  website: WebsiteConfig;
  companyName: string;
  path?: string | null;
}) {
  const canonicalUrl = buildCatalogUrl({
    website: options.website,
    path: options.path,
  });

  return {
    title:
      options.website.seoTitle ??
      `${options.companyName} — Catalogue en ligne`,
    description:
      options.website.seoDescription ??
      (options.website.heroSubtitle ??
        "Découvrez nos prestations et contactez-nous facilement."),
    canonicalUrl,
    socialImageUrl: options.website.socialImageUrl,
    keywords: options.website.seoKeywords ?? null,
  } satisfies CatalogWebsiteMetadata;
}

export type CatalogMetadataTarget =
  | { kind: "home" }
  | { kind: "category"; slug: string }
  | { kind: "product"; slug: string }
  | { kind: "cart" }
  | { kind: "checkout" }
  | { kind: "confirmation" }
  | { kind: "contact" };

function normalizeCatalogPath(path?: string | null): string {
  if (!path) return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function buildCatalogUrl(options: {
  website: Pick<WebsiteConfig, "slug" | "customDomain" | "domainStatus">;
  path?: string | null;
}) {
  const baseUrl = getAppBaseUrl();
  const normalizedPath = normalizeCatalogPath(options.path);
  const pathSegment = normalizedPath !== "/" ? normalizedPath : "";
  if (
    options.website.customDomain &&
    options.website.domainStatus === WebsiteDomainStatus.ACTIVE
  ) {
    return `https://${options.website.customDomain}${pathSegment}`;
  }
  return `${baseUrl}/catalogue/${options.website.slug}${pathSegment}`;
}

export function resolveCatalogMetadataTarget(
  path?: string | null,
): CatalogMetadataTarget {
  const normalized = normalizeCatalogPath(path);
  const segments = normalized.split("/").filter(Boolean);
  const [head, second, third] = segments;
  if (!head) return { kind: "home" };
  if (head === "panier" || head === "cart") {
    return { kind: "cart" };
  }
  if (head === "checkout" || head === "paiement" || head === "payment") {
    return { kind: "checkout" };
  }
  if (
    head === "confirmation" ||
    head === "merci" ||
    head === "order-success" ||
    head === "order-successful" ||
    head === "payment-success" ||
    head === "payment-successful" ||
    (head === "order" && second === "success") ||
    (head === "payment" && second === "success")
  ) {
    return { kind: "confirmation" };
  }
  if (head === "contact") {
    return { kind: "contact" };
  }
  if (head === "catalogue") {
    if (
      (second === "categories" || second === "category" || second === "categorie") &&
      third
    ) {
      return { kind: "category", slug: third };
    }
    if (
      (second === "collections" || second === "collection" || second === "shop") &&
      third
    ) {
      return { kind: "category", slug: third };
    }
    if ((second === "produit" || second === "product") && third) {
      return { kind: "product", slug: third };
    }
  }
  if ((head === "categories" || head === "category" || head === "categorie") && second) {
    return { kind: "category", slug: second };
  }
  if (
    (head === "collections" || head === "collection" || head === "shop") &&
    second
  ) {
    return { kind: "category", slug: second };
  }
  if ((head === "produit" || head === "product") && second) {
    return { kind: "product", slug: second };
  }
  return { kind: "home" };
}

function titleizeCategorySlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveCategoryLabel(products: CatalogProduct[], slug: string) {
  const match = products.find(
    (product) => product.category && slugify(product.category) === slug,
  );
  if (match?.category) {
    return match.category;
  }
  return titleizeCategorySlug(slug);
}

function trimCatalogText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function truncateCatalogText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function collectProductTextCandidates(product: CatalogProduct) {
  return [
    trimCatalogText(product.excerpt),
    trimCatalogText(stripProductHtml(product.shortDescriptionHtml ?? "")),
    trimCatalogText(stripProductHtml(product.descriptionHtml ?? "")),
    trimCatalogText(product.description),
  ].filter((entry): entry is string => entry.length > 0);
}

function collectProductImageUrls(product: CatalogProduct) {
  const urls: string[] = [];
  const seen = new Set<string>();
  const pushUrl = (value?: string | null) => {
    const normalized = trimCatalogText(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    urls.push(normalized);
  };

  pushUrl(product.coverImageUrl);
  if (Array.isArray(product.gallery)) {
    product.gallery.forEach((entry) => {
      if (typeof entry === "string") {
        pushUrl(entry);
        return;
      }
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return;
      }
      const record = entry as Record<string, unknown>;
      pushUrl(
        typeof record.src === "string"
          ? record.src
          : typeof record.url === "string"
            ? record.url
            : null,
      );
    });
  }

  return urls;
}

function resolveCatalogMarketLabel(payload: CatalogPayload) {
  const address = trimCatalogText(payload.website.contact.address).toLowerCase();
  if (payload.website.currencyCode === "TND") {
    return "Tunisie";
  }
  if (
    /(tunisie|tunis|sfax|sousse|nabeul|bizerte|monastir|ariana|ben arous|gabes|gabès|mahdia|kairouan|tozeur|gafsa)/i.test(
      address,
    )
  ) {
    return "Tunisie";
  }
  return null;
}

function buildProductMetaTitle(options: {
  product: CatalogProduct;
  companyName: string;
  marketLabel: string | null;
}) {
  const localizedSuffix =
    options.marketLabel &&
    !options.product.name.toLowerCase().includes(options.marketLabel.toLowerCase())
      ? ` en ${options.marketLabel}`
      : "";
  return `${options.product.name}${localizedSuffix} — ${options.companyName}`;
}

function buildProductMetaDescription(options: {
  product: CatalogProduct;
  fallbackDescription: string;
  currencyCode: string;
  showPrices: boolean;
  marketLabel: string | null;
}) {
  const source =
    collectProductTextCandidates(options.product)[0] ||
    trimCatalogText(options.fallbackDescription);
  const qualifiers = [
    trimCatalogText(options.product.category),
    options.product.saleMode === "INSTANT" && options.showPrices
      ? `prix en ${options.currencyCode}`
      : "devis sur demande",
    options.marketLabel,
  ].filter((entry): entry is string => Boolean(entry));
  const description = [source, qualifiers.join(" · ")]
    .filter((entry): entry is string => entry.length > 0)
    .join(" ");

  return truncateCatalogText(description, 160);
}

function buildProductKeywordFallback(options: {
  product: CatalogProduct;
  companyName: string;
  marketLabel: string | null;
  currencyCode: string;
}) {
  const entries = [
    options.product.name,
    options.product.category,
    options.product.sku,
    options.companyName,
    options.product.publicSlug.replace(/-/g, " "),
    options.marketLabel,
    options.marketLabel ? `${options.product.name} ${options.marketLabel}` : null,
    options.currencyCode === "TND" ? "TND" : null,
  ]
    .map((entry) => trimCatalogText(entry))
    .filter((entry): entry is string => entry.length > 0);

  if (!entries.length) {
    return null;
  }

  const unique = entries.filter((entry, index, values) => {
    const normalized = entry.toLowerCase();
    return values.findIndex((candidate) => candidate.toLowerCase() === normalized) === index;
  });

  return unique.join(", ");
}

const SEO_TEMPLATE_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function renderSeoTemplate(
  template: string | null | undefined,
  context: Record<string, string>,
) {
  const trimmed = template?.trim();
  if (!trimmed) return null;
  const rendered = trimmed
    .replace(SEO_TEMPLATE_TOKEN_PATTERN, (_match, rawKey: string) => {
      return context[rawKey] ?? "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return rendered.length ? rendered : null;
}

function renderProductSeoTemplate(
  template: string | null | undefined,
  product: CatalogProduct,
  companyName: string,
) {
  return renderSeoTemplate(template, {
    "product.name": product.name,
    productName: product.name,
    "product.category": product.category ?? "",
    productCategory: product.category ?? "",
    "product.sku": product.sku,
    productSku: product.sku,
    "product.slug": product.publicSlug,
    productSlug: product.publicSlug,
    "product.description": product.description ?? "",
    productDescription: product.description ?? "",
    "product.excerpt": product.excerpt ?? "",
    productExcerpt: product.excerpt ?? "",
    "site.name": companyName,
    siteName: companyName,
    "company.name": companyName,
    companyName,
  });
}

const STATIC_PAGE_METADATA: Record<
  Extract<
    CatalogMetadataTarget["kind"],
    "cart" | "checkout" | "confirmation" | "contact"
  >,
  { title: string; description: string }
> = {
  cart: {
    title: "Panier",
    description: "Passez en revue vos services et finalisez votre commande.",
  },
  checkout: {
    title: "Paiement",
    description: "Finalisez votre commande en toute sécurité.",
  },
  confirmation: {
    title: "Confirmation",
    description: "Votre commande a bien été enregistrée.",
  },
  contact: {
    title: "Contact",
    description: "Parlez-nous de votre projet et recevez un devis sur mesure.",
  },
};

function resolveCisecoPageSeo(options: {
  payload: CatalogPayload;
  path?: string | null;
}) {
  if (options.payload.website.templateKey !== "ecommerce-ciseco-home") {
    return null;
  }
  const page = resolveCisecoPage(options.path);
  const pageConfig = options.payload.website.builder.pages?.[page.page];
  if (!pageConfig?.seo) return null;
  const title = pageConfig.seo.title?.trim();
  const description = pageConfig.seo.description?.trim();
  const keywords = pageConfig.seo.keywords?.trim();
  const imageId = pageConfig.seo.imageId;
  const image =
    imageId && pageConfig.mediaLibrary?.length
      ? pageConfig.mediaLibrary.find((asset) => asset.id === imageId)?.src
      : null;
  return {
    title: title && title.length > 0 ? title : null,
    description: description && description.length > 0 ? description : null,
    socialImageUrl: image ?? null,
    keywords: keywords && keywords.length > 0 ? keywords : null,
  };
}

export function resolveCatalogMetadata(options: {
  payload: CatalogPayload;
  path?: string | null;
}): CatalogWebsiteMetadata {
  const base = options.payload.website.metadata;
  const companyName = options.payload.website.contact.companyName;
  const marketLabel = resolveCatalogMarketLabel(options.payload);
  const target = resolveCatalogMetadataTarget(options.path);
  const cisecoSeo = resolveCisecoPageSeo(options);
  const cmsPage = options.payload.currentCmsPage;
  let resolved = base;
  let resolvedProduct: CatalogProduct | null = null;
  if (cmsPage) {
    resolved = {
      ...base,
      title: `${cmsPage.title} — ${companyName}`,
      description: cmsPage.excerpt ?? base.description,
    };
  } else if (target.kind === "product") {
    const product = options.payload.products.all.find(
      (item) => item.publicSlug === target.slug,
    );
    resolvedProduct = product ?? null;
    if (!product) {
      resolved = base;
    } else {
      const imageUrls = collectProductImageUrls(product);
      const metaTitle = product.metaTitle?.trim();
      const metaDescription = product.metaDescription?.trim();
      resolved = {
        ...base,
        title: metaTitle && metaTitle.length > 0
          ? metaTitle
          : buildProductMetaTitle({
              product,
              companyName,
              marketLabel,
            }),
        description:
          metaDescription && metaDescription.length > 0
            ? metaDescription
            : buildProductMetaDescription({
                product,
                fallbackDescription: base.description,
                currencyCode: options.payload.website.currencyCode,
                showPrices: options.payload.website.showPrices,
                marketLabel,
              }),
        socialImageUrl:
          imageUrls[0] ?? base.socialImageUrl,
        keywords:
          base.keywords ??
          buildProductKeywordFallback({
            product,
            companyName,
            marketLabel,
            currencyCode: options.payload.website.currencyCode,
          }),
      };
    }
  } else if (target.kind === "category") {
    const label = resolveCategoryLabel(
      options.payload.products.all,
      target.slug,
    );
    if (!label) {
      resolved = base;
    } else {
      resolved = {
        ...base,
        title: `Catégorie ${label} — ${companyName}`,
        description: `Découvrez notre sélection ${label}.`,
      };
    }
  } else if (
    target.kind === "cart" ||
    target.kind === "checkout" ||
    target.kind === "confirmation" ||
    target.kind === "contact"
  ) {
    const pageMetadata = STATIC_PAGE_METADATA[target.kind];
    resolved = {
      ...base,
      title: `${pageMetadata.title} — ${companyName}`,
      description: pageMetadata.description,
    };
  }
  if (cisecoSeo) {
    const cisecoTitle =
      target.kind === "product"
        ? resolvedProduct
          ? renderProductSeoTemplate(
              cisecoSeo.title,
              resolvedProduct,
              companyName,
            )
          : null
        : cisecoSeo.title;
    const cisecoDescription =
      target.kind === "product"
        ? resolvedProduct
          ? renderProductSeoTemplate(
              cisecoSeo.description,
              resolvedProduct,
              companyName,
            )
          : null
        : cisecoSeo.description;
    resolved = {
      ...resolved,
      title: cisecoTitle ?? resolved.title,
      description: cisecoDescription ?? resolved.description,
      socialImageUrl: cisecoSeo.socialImageUrl ?? resolved.socialImageUrl,
      keywords: cisecoSeo.keywords ?? resolved.keywords,
    };
  }
  return resolved;
}

export function resolveCatalogStructuredData(options: {
  payload: CatalogPayload;
  path?: string | null;
}) {
  const target = resolveCatalogMetadataTarget(options.path);
  if (target.kind !== "product") {
    return [] as Array<Record<string, unknown>>;
  }

  const product = options.payload.products.all.find(
    (item) => item.publicSlug === target.slug,
  );
  if (!product) {
    return [] as Array<Record<string, unknown>>;
  }

  const metadata = resolveCatalogMetadata(options);
  const companyName = options.payload.website.contact.companyName;
  const marketLabel = resolveCatalogMarketLabel(options.payload);
  const imageUrls = collectProductImageUrls(product);
  const faqItems = normalizeProductFaqItems(product.faqItems);
  const categorySlug = product.category ? slugify(product.category) : "";
  const productDescription =
    collectProductTextCandidates(product)[0] || metadata.description;
  const productUrl = metadata.canonicalUrl;
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: companyName,
      item: buildCatalogUrl({
        website: options.payload.website,
        path: "/",
      }),
    },
    ...(categorySlug
      ? [
          {
            "@type": "ListItem",
            position: 2,
            name: product.category,
            item: buildCatalogUrl({
              website: options.payload.website,
              path: `/categories/${categorySlug}`,
            }),
          },
        ]
      : []),
    {
      "@type": "ListItem",
      position: categorySlug ? 3 : 2,
      name: product.name,
      item: productUrl,
    },
  ];

  const productStructuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDescription,
    sku: product.sku,
    category: product.category ?? undefined,
    url: productUrl,
    image: imageUrls.length ? imageUrls : undefined,
    brand: {
      "@type": "Brand",
      name: companyName,
    },
  };

  if (
    product.saleMode === "INSTANT" &&
    options.payload.website.showPrices &&
    product.priceTTCCents > 0
  ) {
    productStructuredData.offers = {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: options.payload.website.currencyCode,
      price: fromCents(
        product.priceTTCCents,
        options.payload.website.currencyCode,
      ).toFixed(2),
      availability:
        product.isActive !== false &&
        (product.stockQuantity == null || product.stockQuantity > 0)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: companyName,
      },
      eligibleRegion: marketLabel
        ? {
            "@type": "Country",
            name: marketLabel,
          }
        : undefined,
    };
  }

  const structuredData: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems,
    },
    productStructuredData,
  ];

  if (faqItems.length) {
    structuredData.push({
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
    });
  }

  return structuredData;
}

async function loadCatalogWebsite(
  selector:
    | { slug: string }
    | { domain: string }
    | { userId: string; allowDraft?: boolean },
  options?: { allowUnpublished?: boolean },
) {
  const where: Prisma.WebsiteConfigWhereInput = "slug" in selector
    ? { slug: selector.slug }
    : "domain" in selector
      ? {
          customDomain: selector.domain,
          domainStatus: WebsiteDomainStatus.ACTIVE,
        }
      : { userId: selector.userId };
  const config = await prisma.websiteConfig.findFirst({
    where,
  });
  if (!config) {
    return null;
  }
  if (!options?.allowUnpublished && !config.published) {
    return null;
  }
  return config;
}

async function listCatalogProducts(userId: string, options?: { includeInactive?: boolean }) {
  const products = await prisma.product.findMany({
    where: {
      userId,
      isListedInCatalog: true,
      ...(options?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        descriptionHtml: true,
        shortDescriptionHtml: true,
        excerpt: true,
        metaTitle: true,
        metaDescription: true,
        coverImageUrl: true,
        gallery: true,
        faqItems: true,
        quoteFormSchema: true,
        optionConfig: true,
        variantStock: true,
        category: true,
        unit: true,
        stockQuantity: true,
        priceHTCents: true,
        priceTTCCents: true,
        vatRate: true,
        defaultDiscountRate: true,
        defaultDiscountAmountCents: true,
      sku: true,
      publicSlug: true,
      saleMode: true,
      isActive: true,
    },
  });
  return products as CatalogProduct[];
}

const readCatalogProductsCached = cache(
  async (userId: string, includeInactive: boolean) =>
    listCatalogProducts(userId, { includeInactive }),
);

async function getCatalogDataForWebsite(website: WebsiteConfig) {
  const [settings, products] = await Promise.all([
    getSettings(website.userId),
    readCatalogProductsCached(website.userId, website.showInactiveProducts),
  ]);
  const ecommerceSettings = resolveEcommerceSettingsFromWebsite(website, {
    includeSecrets: true,
  });
  const featured = pickFeaturedProducts(
    products,
    ecommerceSettings.featuredProductIds,
  );
  return {
    settings,
    products,
    featured,
  };
}

async function listCatalogWebsiteCmsPageLinks(websiteId: string) {
  const pages = await prisma.websiteCmsPage.findMany({
    where: {
      websiteId,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    select: websiteCmsPageLinkSelect,
  });
  return pages.map((page) => serializeCatalogWebsiteCmsPageLink(page));
}

async function getCurrentCatalogWebsiteCmsPage(
  websiteId: string,
  path?: string | null,
) {
  const normalizedPath = normalizeWebsiteCmsPagePath(path);
  if (!normalizedPath) {
    return null;
  }

  const page = await prisma.websiteCmsPage.findUnique({
    where: {
      websiteId_path: {
        websiteId,
        path: normalizedPath,
      },
    },
    select: websiteCmsPageContentSelect,
  });

  return page ? serializeCatalogWebsiteCmsPage(page) : null;
}

async function buildCatalogPayloadFromWebsite(
  website: WebsiteConfig,
  options?: { path?: string | null },
) {
  const [{ settings, products, featured }, cmsPages, currentCmsPage] =
    await Promise.all([
      getCatalogDataForWebsite(website),
      listCatalogWebsiteCmsPageLinks(website.id),
      getCurrentCatalogWebsiteCmsPage(website.id, options?.path),
    ]);
  const currencyCode = resolveCatalogCurrencyCode(
    website,
    settings.defaultCurrency,
  );
  const metadata = buildMetadata({
    website,
    companyName: settings.companyName,
    path: options?.path,
  });
  const builderConfig = resolveBuilderConfigFromWebsite(website);
  return {
    website: {
      id: website.id,
      slug: website.slug,
      templateKey: (website.templateKey ?? "dev-agency") as WebsiteTemplateKey,
      heroEyebrow: website.heroEyebrow,
      heroTitle: website.heroTitle,
      heroSubtitle: website.heroSubtitle,
      heroPrimaryCtaLabel:
        website.heroPrimaryCtaLabel ?? DEFAULT_PRIMARY_CTA_LABEL,
      heroSecondaryCtaLabel: website.heroSecondaryCtaLabel,
      heroSecondaryCtaUrl: website.heroSecondaryCtaUrl,
      aboutTitle: website.aboutTitle,
      aboutBody: website.aboutBody,
      contactBlurb: website.contactBlurb,
      accentColor: website.accentColor,
      theme: website.theme,
      showPrices: website.showPrices,
      ecommerceSettings: resolveEcommerceSettingsFromWebsite(website),
      leadThanksMessage: website.leadThanksMessage,
      spamProtectionEnabled: website.spamProtectionEnabled,
      published: website.published,
      domainStatus: website.domainStatus,
      customDomain: website.customDomain,
      currencyCode,
      socialLinks: resolveContactSocialLinks(website.socialLinks),
      contact: {
        companyName: settings.companyName,
        email: website.contactEmailOverride ?? settings.email,
        phone: website.contactPhoneOverride ?? settings.phone,
        address: website.contactAddressOverride ?? settings.address,
        logoUrl: settings.logoUrl,
        logoData: settings.logoData,
      },
      cmsPages,
      metadata,
      builder: builderConfig,
    },
    products: {
      featured,
      all: products,
    },
    currentCmsPage,
  } satisfies CatalogPayload;
}

// Full catalogue payloads can exceed Next.js's 2 MB data-cache limit.
// Keep payload assembly request-scoped while reusing the cached subqueries below.
const getCatalogPayloadBySlugCached = cache(
  async (
    slug: string,
    preview: boolean,
    normalizedPath: string,
  ): Promise<CatalogPayload | null> => {
    const website = await loadCatalogWebsite(
      { slug },
      { allowUnpublished: preview },
    );
    if (!website) {
      return null;
    }
    return buildCatalogPayloadFromWebsite(website, { path: normalizedPath });
  },
);

const getCatalogPayloadByDomainCached = cache(
  async (
    domain: string,
    normalizedPath: string,
  ): Promise<CatalogPayload | null> => {
    const website = await loadCatalogWebsite({ domain });
    if (!website) {
      return null;
    }
    return buildCatalogPayloadFromWebsite(website, { path: normalizedPath });
  },
);

export async function getCatalogPayloadBySlug(
  slug: string,
  options?: { preview?: boolean; path?: string | null },
) {
  const normalizedPath = normalizeCatalogPath(options?.path);
  return getCatalogPayloadBySlugCached(
    slug,
    options?.preview === true,
    normalizedPath,
  );
}

export async function getCatalogPayloadByDomain(domain: string, path?: string | null) {
  const normalized = normalizeCatalogDomainInput(domain);
  if (!normalized) {
    return null;
  }
  return getCatalogPayloadByDomainCached(
    normalized,
    normalizeCatalogPath(path),
  );
}

export async function resolveCatalogWebsite(input: {
  slug?: string | null;
  domain?: string | null;
  preview?: boolean;
}) {
  const domain = normalizeCatalogDomainInput(input.domain);
  const slug = normalizeCatalogSlugInput(input.slug);
  if (domain) {
    const website = await loadCatalogWebsite(
      { domain },
      { allowUnpublished: input.preview },
    );
    if (!website) {
      return null;
    }
    if (slug && website.slug !== slug) {
      console.warn("[catalogue] slug/domain mismatch", {
        domain,
        slug,
        resolvedSlug: website.slug,
      });
    }
    return website;
  }
  if (!slug) {
    return null;
  }
  return loadCatalogWebsite(
    { slug },
    { allowUnpublished: input.preview },
  );
}

export async function getWebsiteBuilderState(userId?: string): Promise<WebsiteBuilderState> {
  const resolvedUserId = await resolveUserId(userId);
  const website = await ensureWebsiteConfig(resolvedUserId);
  return {
    config: resolveBuilderConfigFromWebsite(website),
    history: resolveBuilderHistoryFromWebsite(website),
  };
}

export async function saveWebsiteBuilderConfig(
  input: WebsiteBuilderConfig,
  userId?: string,
): Promise<WebsiteBuilderState> {
  const resolvedUserId = await resolveUserId(userId);
  const website = await ensureWebsiteConfig(resolvedUserId);
  const parsed = builderConfigSchema.parse({
    ...input,
    pages: sanitizeBuilderPages(input.pages),
  });
  const templateNormalized = normalizeBuilderConfigForTemplate(
    parsed,
    website.templateKey,
  );
  const accent = parsed.theme?.accent ?? website.accentColor ?? "#2563eb";
  const normalizedNext = applyThemeFallbacks(templateNormalized, accent);
  const previousConfig = resolveBuilderConfigFromWebsite(website);
  const previousSerialized = JSON.stringify(previousConfig);
  const nextSerialized = JSON.stringify(normalizedNext);
  if (previousSerialized === nextSerialized) {
    return {
      config: previousConfig,
      history: resolveBuilderHistoryFromWebsite(website),
    };
  }
  const history = resolveBuilderHistoryFromWebsite(website);
  const revision: WebsiteBuilderVersionEntry = {
    id: generateId("revision"),
    savedAt: new Date().toISOString(),
    label: "Version précédente",
    snapshot: previousConfig,
  };
  const nextHistory = [revision, ...history].slice(0, 3);
  const updated = await prisma.websiteConfig.update({
    where: { id: website.id },
    data: {
      builderConfig: normalizedNext as Prisma.JsonObject,
      builderVersionHistory: nextHistory as Prisma.JsonArray,
      accentColor: accent,
    },
  });
  revalidateTag(websiteAdminTag(resolvedUserId), "max");
  return {
    config: resolveBuilderConfigFromWebsite(updated),
    history: nextHistory,
  };
}

export async function recordWebsiteLead(input: WebsiteLeadInput) {
  const parsed = leadSchema.parse(input);
  if (parsed.honeypot && parsed.honeypot.trim().length > 0) {
    throw new Error("Requête bloquée.");
  }
  if (parsed.mode === "preview") {
    return { status: "preview-only" } as const;
  }
  const website = await resolveCatalogWebsite({
    slug: input.slug ?? null,
    domain: input.domain ?? null,
    preview: false,
  });
  if (!website) {
    throw new Error("Site indisponible.");
  }
  const settings = await getSettings(website.userId);
  const metadata = buildMetadata({
    website,
    companyName: settings.companyName,
    path: parsed.path,
  });
  const emailLower = parsed.email.toLowerCase();
  if (website.spamProtectionEnabled) {
    const duplicateCount = await prisma.client.count({
      where: {
        userId: website.userId,
        source: ClientSource.WEBSITE_LEAD,
        email: emailLower,
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000),
        },
      },
    });
    if (duplicateCount > 0) {
      throw new Error(
        "Nous avons bien reçu votre demande. Merci de patienter avant de renvoyer un message.",
      );
    }
    if (/\bhttps?:\/\//i.test(parsed.needs) || /www\./i.test(parsed.needs)) {
      throw new Error(
        "La description ne doit pas contenir de liens externes.",
      );
    }
  }
  await prisma.client.create({
    data: {
      userId: website.userId,
      displayName: parsed.name,
      companyName: parsed.company ?? null,
      email: emailLower,
      phone: parsed.phone ?? null,
      notes: `[Lead web${website.leadAutoTag ? ` · ${website.leadAutoTag}` : ""}] ${parsed.needs}`,
      source: ClientSource.WEBSITE_LEAD,
      leadMetadata: {
        needs: parsed.needs,
        path: parsed.path ?? null,
        domain: website.customDomain,
        slug: website.slug,
        tag: website.leadAutoTag ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    },
  });
  revalidateClientFilters(website.userId);
  revalidateQuoteFilterClients(website.userId);

  const notificationEmail =
    website.leadNotificationEmail ??
    website.contactEmailOverride ??
    settings.email;
  if (notificationEmail) {
    try {
      await sendEmailMessageForUser(website.userId, {
        to: [notificationEmail],
        subject: `Nouveau lead — ${parsed.name}`,
        text: `Nom : ${parsed.name}
Email : ${parsed.email}
Téléphone : ${parsed.phone ?? "—"}
Entreprise : ${parsed.company ?? "—"}
Besoin :
${parsed.needs}

Source : ${metadata.canonicalUrl}`,
        html: `<p><strong>Nom :</strong> ${parsed.name}</p>
<p><strong>Email :</strong> ${parsed.email}</p>
<p><strong>Téléphone :</strong> ${parsed.phone ?? "—"}</p>
<p><strong>Entreprise :</strong> ${parsed.company ?? "—"}</p>
<p><strong>Besoin :</strong><br />${parsed.needs.replace(/\n/g, "<br />")}</p>
<p style="font-size:12px;color:#64748b;">Source : ${metadata.canonicalUrl}</p>`,
      });
    } catch (error) {
      console.warn("[website] Impossible d'envoyer la notification lead", error);
    }
  }

  return {
    status: "created" as const,
    thanks: website.leadThanksMessage,
  };
}

function normalizeWebsiteProductPage(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }
  return value;
}

function normalizeWebsiteProductPageSize(value?: number) {
  if (!value || Number.isNaN(value)) {
    return WEBSITE_PRODUCT_LIST_DEFAULT_PAGE_SIZE;
  }
  return Math.min(
    WEBSITE_PRODUCT_LIST_MAX_PAGE_SIZE,
    Math.max(10, value),
  );
}

function buildWebsiteProductWhere(
  userId: string,
  filters: WebsiteProductListFilters,
) {
  const visibility = filters.visibility ?? "all";
  const includeInactive = filters.includeInactive ?? false;
  const search = filters.search?.trim();
  return {
    userId,
    ...(includeInactive ? {} : { isActive: true }),
    ...(visibility === "visible"
      ? { isListedInCatalog: true }
      : visibility === "hidden"
        ? { isListedInCatalog: false }
        : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              sku: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              category: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.ProductWhereInput;
}

async function fetchWebsiteProductStats(userId: string) {
  const [totalProducts, listedProducts] = await Promise.all([
    prisma.product.count({ where: { userId } }),
    prisma.product.count({
      where: { userId, isListedInCatalog: true },
    }),
  ]);
  return { totalProducts, listedProducts };
}

function getCachedWebsiteProductStats(userId: string) {
  if (process.env.NODE_ENV === "test") {
    return fetchWebsiteProductStats(userId);
  }
  const cached = unstable_cache(
    () => fetchWebsiteProductStats(userId),
    ["website-products", "stats", userId],
    {
      revalidate: WEBSITE_PRODUCT_STATS_CACHE_SECONDS,
    },
  );
  return cached();
}

export async function getWebsiteProductStats(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  return getCachedWebsiteProductStats(resolvedUserId);
}

function buildDefaultBuilderOptions(website: WebsiteConfig) {
  return {
    heroEyebrow: website.heroEyebrow,
    heroTitle: website.heroTitle,
    heroSubtitle: website.heroSubtitle,
    heroPrimaryCtaLabel: website.heroPrimaryCtaLabel,
    heroSecondaryCtaLabel: website.heroSecondaryCtaLabel,
    heroSecondaryCtaUrl: website.heroSecondaryCtaUrl,
    aboutTitle: website.aboutTitle,
    aboutBody: website.aboutBody,
    contactBlurb: website.contactBlurb,
    accentColor: website.accentColor,
  };
}

function ensureTemplateSections(
  config: WebsiteBuilderConfig,
  website: WebsiteConfig,
): WebsiteBuilderConfig {
  const templatesRequiringDefaults: WebsiteTemplateKey[] = [
    "ecommerce-luxe",
    "ecommerce-tech-agency",
    "ecommerce-cesco",
  ];
  if (!(templatesRequiringDefaults as readonly string[]).includes(website.templateKey)) {
    return config;
  }
  const required: BuilderSectionType[] = [
    "hero",
    "categories",
    "products",
    "promo",
    "newsletter",
    "about",
    "contact",
  ];
  const existing = new Set(config.sections.map((section) => section.type));
  const missing = required.filter((type) => !existing.has(type));
  if (!missing.length) {
    return config;
  }
  const injectedSections = missing.map((type) => createSectionTemplate(type));
  return {
    ...config,
    sections: [...config.sections, ...injectedSections],
  };
}

function resolveBuilderConfigFromWebsite(
  website: WebsiteConfig,
) {
  const parsedConfig =
    typeof website.builderConfig === "string"
      ? (() => {
          try {
            return JSON.parse(website.builderConfig);
          } catch {
            return null;
          }
        })()
      : website.builderConfig;
  const parsed = builderConfigSchema.safeParse(parsedConfig);
  const base = parsed.success
    ? parsed.data
    : createDefaultBuilderConfig(
      buildDefaultBuilderOptions(website),
    );
  const withTemplateDefaults = ensureTemplateSections(base, website);
  const normalizedForTemplate = normalizeBuilderConfigForTemplate(
    withTemplateDefaults,
    website.templateKey,
  );
  return applyThemeFallbacks(normalizedForTemplate, website.accentColor);
}

function resolveBuilderHistoryFromWebsite(
  website: WebsiteConfig,
) {
  const parsed = builderVersionHistorySchema.safeParse(
    website.builderVersionHistory,
  );
  if (!parsed.success) {
    return [];
  }
  return parsed.data.slice(0, 3);
}

function isSignupProviderConfigured(provider: SignupProviderInput) {
  if (provider.useEnv) {
    return true;
  }
  return Boolean(provider.clientId && provider.clientSecret);
}

function sanitizeSignupSettings(settings: SignupSettingsInput) {
  const parsed = signupSettingsSchema.safeParse(settings);
  const safeSettings = parsed.success
    ? parsed.data
    : signupSettingsSchema.parse({});
  const providers = safeSettings.providers ?? signupProvidersSchema.parse({});
  const facebook = signupProviderSchema.parse(providers.facebook ?? {});
  const google = signupProviderSchema.parse(providers.google ?? {});
  const twitter = signupProviderSchema.parse(providers.twitter ?? {});
  return {
    ...safeSettings,
    providers: {
      facebook: {
        ...facebook,
        enabled:
          facebook.enabled && isSignupProviderConfigured(facebook),
        clientId: null,
        clientSecret: null,
      },
      google: {
        ...google,
        enabled:
          google.enabled && isSignupProviderConfigured(google),
        clientId: null,
        clientSecret: null,
      },
      twitter: {
        ...twitter,
        enabled:
          twitter.enabled && isSignupProviderConfigured(twitter),
        clientId: null,
        clientSecret: null,
      },
    },
  } satisfies SignupSettingsInput;
}

export function resolveEcommerceSettingsFromWebsite(
  website: WebsiteConfig,
  options?: { includeSecrets?: boolean },
) {
  const source = website.ecommerceSettings ?? DEFAULT_ECOMMERCE_SETTINGS;
  const parsed = ecommerceSettingsSchema.safeParse(source);
  const baseSettings = parsed.success
    ? parsed.data
    : DEFAULT_ECOMMERCE_SETTINGS;
  const legacyFeaturedIds = Array.isArray(website.featuredProductIds)
    ? (website.featuredProductIds as Array<unknown>)
      .filter((value): value is string => typeof value === "string")
    : [];
  if (!baseSettings.featuredProductIds.length && legacyFeaturedIds.length) {
    const merged = {
      ...baseSettings,
      featuredProductIds: legacyFeaturedIds,
    };
    return options?.includeSecrets
      ? merged
      : { ...merged, signup: sanitizeSignupSettings(merged.signup) };
  }
  return options?.includeSecrets
    ? baseSettings
    : { ...baseSettings, signup: sanitizeSignupSettings(baseSettings.signup) };
}

export async function listWebsiteProductSummaries(
  filters: WebsiteProductListFilters = {},
  userId?: string,
): Promise<WebsiteProductListResult> {
  const resolvedUserId = await resolveUserId(userId);
  const page = normalizeWebsiteProductPage(filters.page);
  const pageSize = normalizeWebsiteProductPageSize(filters.pageSize);
  const where = buildWebsiteProductWhere(resolvedUserId, filters);
  const skip = (page - 1) * pageSize;

  const [items, filteredTotal, stats] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take: pageSize,
      select: websiteProductSummarySelect,
    }),
    prisma.product.count({ where }),
    getCachedWebsiteProductStats(resolvedUserId),
  ]);

  const pageCount =
    filteredTotal === 0 ? 0 : Math.ceil(filteredTotal / pageSize);

  return {
    items,
    filteredTotal,
    total: stats.totalProducts,
    listed: stats.listedProducts,
    page,
    pageSize,
    pageCount,
  };
}

export async function getWebsiteAdminPayload(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const cached = unstable_cache(
    async () => {
      const website = await ensureWebsiteConfig(resolvedUserId);
      const [settings, productStats] = await Promise.all([
        getSettings(resolvedUserId),
        getCachedWebsiteProductStats(resolvedUserId),
      ]);
      const appBaseUrl = getAppBaseUrl();
      const slugPreviewUrl = `${appBaseUrl}/catalogue/${website.slug}`;
      const previewUrl = `${appBaseUrl}/preview`;
      const edgeDomain = getCatalogEdgeDomain();
      const builderConfig = resolveBuilderConfigFromWebsite(website);
      const builderHistory = resolveBuilderHistoryFromWebsite(website);
      const ecommerceSettings = resolveEcommerceSettingsFromWebsite(website);
      const cmsPages = await listWebsiteCmsPages(resolvedUserId);
      return {
        website: {
          ...website,
          ecommerceSettings,
          cmsPages,
        },
        company: settings,
        links: {
          slugPreviewUrl,
          previewUrl,
        },
        domain: {
          target: edgeDomain,
          verificationCode: website.domainVerificationCode,
        },
        stats: {
          published: website.published,
          domainStatus: website.domainStatus,
          customDomain: website.customDomain,
          totalProducts: productStats.totalProducts,
          listedProducts: productStats.listedProducts,
        },
        builder: {
          config: builderConfig,
          history: builderHistory,
        },
      };
    },
    ["website-admin", resolvedUserId],
    {
      revalidate: WEBSITE_ADMIN_CACHE_REVALIDATE_SECONDS,
      tags: [websiteAdminTag(resolvedUserId)],
    },
  );
  return cached();
}
