import { createHash } from "node:crypto";
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
} from "@/lib/db/prisma-server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  isReservedPublicHostname,
  normalizeCatalogHostname,
} from "@/lib/catalog-host";
import { getAppBaseUrl, getCatalogEdgeDomain } from "@/lib/env";
import { assertCustomDomainRecords, DomainVerificationError } from "@/lib/domain-verification";
import {
  ensureVercelProjectDomain,
  removeVercelProjectDomain,
  MissingVercelConfigError,
  VercelApiError,
} from "@/lib/vercel-api";
import { sendEmailMessageForUser } from "@/server/messaging";
import { uploadManagedImageDataUrl } from "@/server/product-media-storage";
import { getSettings } from "@/server/settings";
import {
  WEBSITE_TEMPLATE_KEY_VALUES,
  type WebsiteTemplateKey,
} from "@/lib/website/templates";
import { resolvePage as resolveCisecoPage } from "@/components/website/templates/ecommerce-ciseco/utils";
import {
  translateCisecoText,
  type CisecoLocale,
} from "@/components/website/templates/ecommerce-ciseco/locale";
import {
  CONTACT_SOCIAL_ICON_VALUES,
  type ContactSocialLink,
} from "@/lib/website/contact";
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";
import {
  buildActiveCustomDomainUrl,
  isSameCustomDomain,
} from "@/lib/website/custom-domain";
import {
  normalizeCatalogCategorySlug,
  resolveCatalogCategoryLabel as resolveCanonicalCatalogCategoryLabel,
} from "@/lib/catalog-category";
import { slugify } from "@/lib/slug";
import { fromCents } from "@/lib/money";
import { sanitizeProductHtml, stripProductHtml } from "@/lib/product-html";
import {
  buildProductFaqStructuredData,
  normalizeProductFaqItems,
} from "@/lib/product-faq";
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
  type WebsiteBuilderPageConfig,
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
import {
  isSafeHttpOrRelativeUrl,
  isSafePublicHref,
  isSafeSocialHref,
} from "@/lib/website/url-safety";
import { revalidateClientFilters } from "@/server/clients";
import { revalidateQuoteFilterClients } from "@/server/quotes";
import {
  listApprovedProductReviewsForProducts,
  type PublicProductReview,
} from "@/server/product-review-queries";
import {
  listApprovedSiteReviews,
  type PublicSiteReview,
} from "@/server/site-review-queries";
import {
  getPublicSiteBlogPostBySlug,
  listPublicSiteBlogPostSummaries,
  type PublicSiteBlogPost,
  type PublicSiteBlogPostSummary,
} from "@/server/site-blog-posts";
import type { CatalogViewerState } from "@/lib/catalog-viewer";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexColorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const domainHostnamePattern = /^[a-z0-9.-]+$/i;
const catalogPathPattern = /^\/[a-z0-9/_-]*$/i;
const CATALOG_PATH_MAX_LENGTH = 180;
const WEBSITE_ADMIN_CACHE_REVALIDATE_SECONDS = 15;
export const CATALOG_PAYLOAD_REVALIDATE_SECONDS = 30;
const WEBSITE_PRODUCT_STATS_CACHE_SECONDS = 30;
const WEBSITE_PRODUCT_LIST_DEFAULT_PAGE_SIZE = 40;
const WEBSITE_PRODUCT_LIST_MAX_PAGE_SIZE = 80;
const WEBSITE_FAVICON_MAX_FILE_SIZE = 512 * 1024;

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
      (value) => isSafeSocialHref(value),
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
      (value) =>
        !value ||
        isSafePublicHref(value, {
          allowExternalHttp: true,
          allowHash: true,
          allowRelativePath: true,
        }),
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

function normalizeWebsiteFaviconUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function sniffFaviconContentType(buffer: Buffer) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png" as const;
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return "image/x-icon" as const;
  }

  return null;
}

export function validateWebsiteFaviconFile(file: File) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Fichier favicon invalide.");
  }
  if (file.size > WEBSITE_FAVICON_MAX_FILE_SIZE) {
    throw new Error("Le favicon dépasse la taille maximale de 512 Ko.");
  }
  return file;
}

export async function saveWebsiteFaviconFile(
  file: File,
  userId: string,
): Promise<string> {
  validateWebsiteFaviconFile(file);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = sniffFaviconContentType(buffer);
  if (!contentType) {
    throw new Error("Format de favicon non supporté. Utilisez PNG ou ICO.");
  }
  const asset = await uploadManagedImageDataUrl({
    userId,
    publicSlug: "favicon",
    source: `data:${contentType};base64,${buffer.toString("base64")}`,
    pathPrefix: "favicons",
  });
  return asset.managedUrl;
}

export async function deleteManagedWebsiteFavicon(
  faviconUrl: string | null,
  userId: string,
): Promise<void> {
  void faviconUrl;
  void userId;
  return;
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

const isoCountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => value.length === 0 || /^[A-Z]{2}$/.test(value),
    "Utilisez un code pays ISO 3166-1 alpha-2 sur 2 lettres (ex: TN).",
  );

const shippingDaysSchema = z
  .number()
  .int("Saisissez un nombre entier de jours.")
  .min(0, "La valeur doit être positive ou nulle.");

const shippingSettingsSchema = z
  .object({
    countryCode: isoCountryCodeSchema.default(""),
    rate: z
      .number()
      .min(0, "Le tarif de livraison doit être positif ou nul.")
      .nullable()
      .default(null),
    handlingMinDays: shippingDaysSchema.nullable().default(null),
    handlingMaxDays: shippingDaysSchema.nullable().default(null),
    transitMinDays: shippingDaysSchema.nullable().default(null),
    transitMaxDays: shippingDaysSchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (
      value.handlingMinDays != null &&
      value.handlingMaxDays != null &&
      value.handlingMaxDays < value.handlingMinDays
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Le délai de préparation maximum doit être supérieur ou égal au minimum.",
        path: ["handlingMaxDays"],
      });
    }
    if (
      value.transitMinDays != null &&
      value.transitMaxDays != null &&
      value.transitMaxDays < value.transitMinDays
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Le délai de transport maximum doit être supérieur ou égal au minimum.",
        path: ["transitMaxDays"],
      });
    }
  });

const DEFAULT_SHIPPING_SETTINGS = {
  countryCode: "",
  rate: null,
  handlingMinDays: null,
  handlingMaxDays: null,
  transitMinDays: null,
  transitMaxDays: null,
} as const;

const merchantReturnPolicyCategorySchema = z.enum([
  "FINITE",
  "UNLIMITED",
  "NOT_PERMITTED",
]);

const merchantReturnFeeTypeSchema = z.enum([
  "FREE",
  "CUSTOMER_RESPONSIBILITY",
  "RETURN_SHIPPING_FEES",
]);

const merchantReturnMethodSchema = z.enum([
  "BY_MAIL",
  "IN_STORE",
  "AT_KIOSK",
]);

const returnPolicySettingsSchema = z
  .object({
    countryCode: isoCountryCodeSchema.default(""),
    policyCategory: merchantReturnPolicyCategorySchema.nullable().default(null),
    merchantReturnDays: shippingDaysSchema.nullable().default(null),
    returnFees: merchantReturnFeeTypeSchema.nullable().default(null),
    returnMethod: merchantReturnMethodSchema.nullable().default(null),
    returnShippingFeesAmount: z
      .number()
      .positive("Les frais de retour doivent être supérieurs à zéro.")
      .nullable()
      .default(null),
  })
  .superRefine((value, ctx) => {
    if (
      value.policyCategory === "FINITE" &&
      value.merchantReturnDays == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Le nombre de jours de retour est requis pour une fenêtre de retour limitée.",
        path: ["merchantReturnDays"],
      });
    }
    if (
      value.returnFees === "RETURN_SHIPPING_FEES" &&
      value.returnShippingFeesAmount == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Indiquez un montant pour les frais de retour facturés au client.",
        path: ["returnShippingFeesAmount"],
      });
    }
    if (
      value.returnFees !== "RETURN_SHIPPING_FEES" &&
      value.returnShippingFeesAmount != null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Le montant des frais de retour ne doit être renseigné que si la boutique facture un retour.",
        path: ["returnShippingFeesAmount"],
      });
    }
  });

const DEFAULT_RETURN_POLICY_SETTINGS = {
  countryCode: "",
  policyCategory: null,
  merchantReturnDays: null,
  returnFees: null,
  returnMethod: null,
  returnShippingFeesAmount: null,
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
          (value) => !value || isSafeHttpOrRelativeUrl(value),
          "L'URL doit commencer par http(s):// ou /",
        ),
    })
    .default(DEFAULT_CHECKOUT_SETTINGS),
  shipping: shippingSettingsSchema.default(DEFAULT_SHIPPING_SETTINGS),
  returns: returnPolicySettingsSchema.default(DEFAULT_RETURN_POLICY_SETTINGS),
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
  shipping: {
    countryCode: "",
    rate: null,
    handlingMinDays: null,
    handlingMaxDays: null,
    transitMinDays: null,
    transitMaxDays: null,
  },
  returns: {
    countryCode: "",
    policyCategory: null,
    merchantReturnDays: null,
    returnFees: null,
    returnMethod: null,
    returnShippingFeesAmount: null,
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
  createdAt?: Date | string;
  reviews?: PublicProductReview[];
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

export type CatalogWebsiteBlogPostSummary = PublicSiteBlogPostSummary;

export type CatalogWebsiteBlogPost = PublicSiteBlogPost;

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
  faviconUrl: string | null;
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
  siteReviews: PublicSiteReview[];
  blogPosts?: CatalogWebsiteBlogPostSummary[];
  currentBlogPost?: CatalogWebsiteBlogPost | null;
  currentCmsPage: CatalogWebsiteCmsPage | null;
  viewer?: CatalogViewerState;
};

type CatalogGalleryEntry = {
  src: string;
  alt?: string | null;
  isPrimary?: boolean;
  position?: number | null;
};

type CatalogProductImageSlot = "cover" | `gallery:${number}`;

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

function normalizeCatalogProductImageSlot(
  value?: string | null,
): CatalogProductImageSlot | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "cover") {
    return "cover";
  }
  const match = /^gallery:(\d+)$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const index = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(index) || index < 0) {
    return null;
  }
  return `gallery:${index}`;
}

function resolveCatalogProductImageCandidate(
  product: Pick<CatalogProduct, "coverImageUrl" | "gallery">,
  slot?: CatalogProductImageSlot | null,
) {
  if (slot === "cover") {
    const coverImage = product.coverImageUrl?.trim();
    return coverImage && coverImage.length > 0 ? coverImage : null;
  }

  if (slot?.startsWith("gallery:")) {
    const index = Number.parseInt(slot.slice("gallery:".length), 10);
    if (!Number.isFinite(index) || index < 0) {
      return null;
    }
    return normalizeCatalogGalleryEntries(product.gallery)[index]?.src ?? null;
  }

  return resolveCatalogListingImageCandidate(product);
}

export function isInlineCatalogImageSource(value: string | null | undefined) {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^data:image\//i.test(trimmed));
}

export function resolveCatalogProductListingImageDataUrl(
  product: Pick<CatalogProduct, "coverImageUrl" | "gallery">,
  slot?: string | null,
) {
  const candidate = resolveCatalogProductImageCandidate(
    product,
    normalizeCatalogProductImageSlot(slot),
  );
  return isInlineCatalogImageSource(candidate) ? candidate : null;
}

export function buildCatalogProductListingImagePath(options: {
  productId: string;
  website: Pick<CatalogWebsiteSummary, "slug">;
  version?: string | null;
  slot?: CatalogProductImageSlot | null;
}) {
  const pathname = `/api/catalogue/products/${encodeURIComponent(options.productId)}/listing-image/${encodeURIComponent(options.website.slug)}`;
  const params = new URLSearchParams();
  if (options.version) {
    params.set("v", options.version);
  }
  if (options.slot) {
    params.set("slot", options.slot);
  }
  const queryString = params.toString();
  if (!queryString) {
    return pathname;
  }
  return `${pathname}?${queryString}`;
}

function resolveCatalogProductImageSource(options: {
  productId: string;
  website: Pick<CatalogWebsiteSummary, "slug">;
  source: string | null | undefined;
  slot?: CatalogProductImageSlot | null;
}) {
  const candidate = options.source?.trim();
  if (!candidate) {
    return null;
  }
  if (isInlineCatalogImageSource(candidate)) {
    const version = createHash("sha1").update(candidate).digest("hex").slice(0, 12);
    return buildCatalogProductListingImagePath({
      productId: options.productId,
      website: options.website,
      version,
      slot: options.slot,
    });
  }
  return candidate;
}

export function resolveCatalogProductListingImageSource(
  product: Pick<CatalogProduct, "id" | "coverImageUrl" | "gallery">,
  website: Pick<CatalogWebsiteSummary, "slug">,
  slot?: string | null,
) {
  const normalizedSlot = normalizeCatalogProductImageSlot(slot);
  return resolveCatalogProductImageSource({
    productId: product.id,
    website,
    source: resolveCatalogProductImageCandidate(product, normalizedSlot),
    slot: normalizedSlot,
  });
}

export function externalizeCatalogProductInlineImages(
  product: CatalogProduct,
  website: Pick<CatalogWebsiteSummary, "slug">,
): CatalogProduct {
  const galleryEntries = normalizeCatalogGalleryEntries(product.gallery).map(
    (entry, index) => ({
      src:
        resolveCatalogProductImageSource({
          productId: product.id,
          website,
          source: entry.src,
          slot: `gallery:${index}`,
        }) ?? entry.src,
      ...(entry.alt ? { alt: entry.alt } : {}),
      ...(typeof entry.isPrimary === "boolean"
        ? { isPrimary: entry.isPrimary }
        : {}),
      ...(typeof entry.position === "number"
        ? { position: entry.position }
        : {}),
    }),
  );

  return {
    ...product,
    coverImageUrl: resolveCatalogProductImageSource({
      productId: product.id,
      website,
      source: product.coverImageUrl,
      slot: "cover",
    }),
    gallery: galleryEntries.length
      ? (galleryEntries as unknown as Prisma.JsonValue)
      : null,
  };
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
  return normalizeCatalogHostname(value);
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
  options?: {
    faviconUrl?: string | null;
  },
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
  if (
    options &&
    Object.prototype.hasOwnProperty.call(options, "faviconUrl")
  ) {
    const nextBuilderConfig = resolveBuilderConfigFromWebsite(currentConfig);
    payload.builderConfig = {
      ...nextBuilderConfig,
      site: {
        ...(nextBuilderConfig.site ?? { faviconUrl: null }),
        faviconUrl: normalizeWebsiteFaviconUrl(options.faviconUrl),
      },
    } as Prisma.JsonObject;
  }

  const updated = await prisma.websiteConfig.update({
    where: { id: currentConfig.id },
    data: payload as Prisma.WebsiteConfigUpdateInput,
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
  if (isReservedPublicHostname(normalized)) {
    throw new Error(
      "Ce domaine est réservé à l’application. Utilisez un sous-domaine public distinct du domaine de l’interface.",
    );
  }
  if (isSameCustomDomain(config.customDomain, normalized)) {
    return {
      config,
      changed: false,
    } as const;
  }
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
  if (config.customDomain) {
    removeVercelProjectDomain(config.customDomain).catch((error) => {
      console.warn("[website] Failed to remove previous project domain", {
        previousDomain: config.customDomain,
        nextDomain: normalized,
        error,
      });
    });
  }
  const updated = await prisma.websiteConfig.update({
    where: { id: config.id },
    data: {
      customDomain: normalized,
      domainStatus: WebsiteDomainStatus.PENDING,
      domainVerifiedAt: null,
      domainActivatedAt: null,
      published: false,
    },
  });
  return {
    config: updated,
    changed: true,
  } as const;
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
  locale?: CisecoLocale | null;
}) {
  const canonicalUrl = buildCatalogUrl({
    website: options.website,
    path: options.path,
  });
  const isEnglish = options.locale === "en";

  return {
    title:
      options.website.seoTitle ??
      (isEnglish
        ? `${options.companyName} — Online catalogue`
        : `${options.companyName} — Catalogue en ligne`),
    description:
      options.website.seoDescription ??
      (options.website.heroSubtitle ??
        (isEnglish
          ? "Browse our offers and contact us with ease."
          : "Découvrez nos prestations et contactez-nous facilement.")),
    canonicalUrl,
    socialImageUrl: options.website.socialImageUrl,
    keywords: options.website.seoKeywords ?? null,
  } satisfies CatalogWebsiteMetadata;
}

function escapeEmailText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type CatalogPageSeoKind =
  | "home"
  | "not-found"
  | "collections"
  | "category"
  | "product"
  | "about"
  | "blog"
  | "blog-detail"
  | "contact"
  | "cms"
  | "search"
  | "cart"
  | "checkout"
  | "confirmation"
  | "login"
  | "signup"
  | "forgot-password"
  | "account"
  | "account-wishlists"
  | "account-orders-history"
  | "account-billing"
  | "account-order-detail"
  | "account-change-password";

type CatalogSeoSearchParams = Record<
  string,
  string | string[] | undefined
>;

type CatalogBlogSeoEntry = {
  slug: string;
  title: string;
  headline: string;
  description: string | null;
  author: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
};

type CatalogRouteInfo = {
  kind: CatalogPageSeoKind;
  canonicalPath: string;
  canonicalQuery: URLSearchParams;
  shouldIndex: boolean;
  shouldFollow: boolean;
  openGraphType: "website" | "article";
  pageConfig: WebsiteBuilderPageConfig | null;
  blogEntry: CatalogBlogSeoEntry | null;
};

export type CatalogRouteAvailability =
  | { ok: true }
  | { ok: false; reason: "unknown-route" | "missing-product" | "missing-category" | "missing-blog-post" | "missing-cms-page" };
type CatalogRouteUnavailableReason = Exclude<
  CatalogRouteAvailability,
  { ok: true }
>["reason"];

type CatalogRoutePreflightWebsite = {
  id: string;
  userId: string;
  slug: string;
  templateKey: string;
  showInactiveProducts: boolean;
  published: boolean;
};

type CatalogRoutePreflightResult =
  | {
      ok: true;
      website: CatalogRoutePreflightWebsite;
      path: string | null;
    }
  | {
      ok: false;
      website: CatalogRoutePreflightWebsite | null;
      path: string | null;
      reason: CatalogRouteUnavailableReason;
    };

export type CatalogSeoResult = {
  metadata: CatalogWebsiteMetadata;
  alternatesLanguages: Record<string, string> | null;
  robots:
    | {
        index: boolean;
        follow: boolean;
      }
    | null;
  openGraphType: "website" | "article";
  locale: CisecoLocale | null;
  openGraphLocale: string | null;
  openGraphAlternateLocales: string[];
  contentLanguage: string | null;
};

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

function stripCatalogSlugPrefix(path: string | null, slug: string) {
  if (!path) return null;
  const prefix = `/catalogue/${slug}`;
  if (path === prefix || path === `${prefix}/`) {
    return "/";
  }
  if (path.startsWith(`${prefix}/`)) {
    const next = path.slice(prefix.length);
    return next || "/";
  }
  return path;
}

export function buildCatalogUrl(options: {
  website: Pick<WebsiteConfig, "slug" | "customDomain" | "domainStatus">;
  path?: string | null;
}) {
  const baseUrl = getAppBaseUrl();
  const normalizedPath = normalizeCatalogPath(options.path);
  const customDomainUrl = buildActiveCustomDomainUrl({
    customDomain: options.website.customDomain,
    domainStatus: options.website.domainStatus,
    path: normalizedPath,
  });
  if (customDomainUrl) {
    return customDomainUrl;
  }
  const pathSegment = normalizedPath !== "/" ? normalizedPath : "";
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

function translateCatalogLabel(
  locale: CisecoLocale | null,
  value: string,
) {
  return locale ? translateCisecoText(locale, value) : value;
}

function resolveCategoryLabel(
  products: CatalogProduct[],
  slug: string,
  locale?: CisecoLocale | null,
) {
  const match = products.find(
    (product) =>
      product.category &&
      normalizeCatalogCategorySlug(product.category) === slug,
  );
  if (match?.category) {
    return translateCatalogLabel(
      locale ?? null,
      resolveCanonicalCatalogCategoryLabel(match.category) ?? match.category,
    );
  }
  return translateCatalogLabel(
    locale ?? null,
    resolveCanonicalCatalogCategoryLabel(slug) ?? titleizeCategorySlug(slug),
  );
}

function trimCatalogText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeCatalogTextToken(value?: string | null) {
  return trimCatalogText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesCatalogPlaceholder(
  value: string | null,
  candidates: readonly string[],
) {
  const normalizedValue = normalizeCatalogTextToken(value);
  if (!normalizedValue) {
    return false;
  }
  return candidates.some(
    (candidate) => normalizeCatalogTextToken(candidate) === normalizedValue,
  );
}

function appendCatalogCompanyName(
  title: string,
  companyName: string,
) {
  const normalizedTitle = normalizeCatalogTextToken(title);
  const normalizedCompany = normalizeCatalogTextToken(companyName);
  if (
    normalizedCompany &&
    normalizedTitle &&
    normalizedTitle.includes(normalizedCompany)
  ) {
    return title;
  }
  return `${title} — ${companyName}`;
}

function normalizeStructuredDataCountryCode(value?: string | null) {
  const normalized = trimCatalogText(value).toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function inferCatalogCountryCode(payload: CatalogPayload) {
  if (payload.website.currencyCode === "TND") {
    return "TN";
  }

  const address = trimCatalogText(payload.website.contact.address).toLowerCase();
  if (/(tunisie|tunisia|tunis|sfax|sousse|nabeul|bizerte|monastir)/i.test(address)) {
    return "TN";
  }

  return null;
}

function resolveCatalogStructuredDataCountryCode(
  payload: CatalogPayload,
  explicitCountryCode?: string | null,
) {
  return (
    normalizeStructuredDataCountryCode(explicitCountryCode) ??
    inferCatalogCountryCode(payload)
  );
}

function truncateCatalogText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeCatalogSeoTitle(value: string) {
  return truncateCatalogText(trimCatalogText(value), 70);
}

function normalizeCatalogSeoDescription(value: string) {
  return truncateCatalogText(trimCatalogText(value), 160);
}

function resolveCatalogBaseMetadata(options: {
  payload: CatalogPayload;
  canonicalUrl: string;
}) {
  const metadata = options.payload.website.metadata;
  const companyName =
    trimCatalogText(options.payload.website.contact.companyName) || "Catalogue";
  const title =
    trimCatalogText(metadata?.title) ||
    trimCatalogText(options.payload.website.heroTitle) ||
    companyName;
  const description = truncateCatalogText(
    trimCatalogText(metadata?.description) ||
      trimCatalogText(options.payload.website.heroSubtitle) ||
      trimCatalogText(options.payload.website.aboutBody) ||
      companyName,
    160,
  );

  return {
    title,
    description,
    canonicalUrl: options.canonicalUrl,
    socialImageUrl:
      resolveCatalogAbsoluteUrl(options.payload.website, metadata?.socialImageUrl) ??
      resolveCatalogAbsoluteUrl(
        options.payload.website,
        options.payload.website.contact.logoUrl,
      ),
    keywords: trimCatalogText(metadata?.keywords) || null,
  } satisfies CatalogWebsiteMetadata;
}

function collectProductTextCandidates(product: CatalogProduct) {
  return [
    trimCatalogText(product.excerpt),
    trimCatalogText(stripProductHtml(product.shortDescriptionHtml ?? "")),
    trimCatalogText(stripProductHtml(product.descriptionHtml ?? "")),
    trimCatalogText(product.description),
  ].filter((entry): entry is string => entry.length > 0);
}

function collectProductFaqTextCandidates(value: unknown) {
  return normalizeProductFaqItems(value)
    .flatMap((item) => [
      trimCatalogText(item.question),
      trimCatalogText(item.answer),
    ])
    .filter((entry): entry is string => entry.length > 0);
}

function buildDigitalOfferShippingDetailsFallback(options: {
  payload: CatalogPayload;
  product: CatalogProduct;
  countryCode: string | null;
}) {
  if (!options.countryCode) {
    return undefined;
  }

  const productText = [
    trimCatalogText(options.product.name),
    ...collectProductTextCandidates(options.product),
    ...collectProductFaqTextCandidates(options.product.faqItems),
  ].join(" ");
  const siteText = [
    trimCatalogText(options.payload.website.metadata?.description),
    trimCatalogText(options.payload.website.heroSubtitle),
    trimCatalogText(options.payload.website.aboutBody),
  ].join(" ");

  const hasDigitalProductCue =
    /(?:t[ée]l[ée]chargement num[ée]rique|digital download|download num[ée]rique|format num[ée]rique|version num[ée]rique|code d['’]activation envoy[ée]e?\s+par email|cl[ée]\s+(?:d['’]activation\s+)?envoy[ée]e?\s+par email|compte pr[ée][ -]?activ[ée]|licence num[ée]rique)/i.test(
      productText,
    );
  const hasDigitalDeliveryCue =
    /(?:email|e-mail|24\s*h|24h|24\s*heures?|acc[èe]s imm[ée]diat|instantan[ée]|pas de frais de livraison|sans frais de livraison|livraison gratuite)/i.test(
      `${productText} ${siteText}`,
    );

  if (!hasDigitalProductCue || !hasDigitalDeliveryCue) {
    return undefined;
  }

  const hasTwentyFourHourCue = /(?:24\s*h|24h|24\s*heures?)/i.test(
    `${productText} ${siteText}`,
  );

  return {
    "@type": "OfferShippingDetails",
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: options.countryCode,
    },
    // Digital delivery verified from existing product/site copy has no shipping fee.
    shippingRate: {
      "@type": "MonetaryAmount",
      value: "0.00",
      currency: options.payload.website.currencyCode,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: hasTwentyFourHourCue ? 1 : 0,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 0,
        unitCode: "DAY",
      },
    },
  } satisfies Record<string, unknown>;
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

function buildOfferShippingDetailsStructuredData(options: {
  payload: CatalogPayload;
  product?: CatalogProduct | null;
}) {
  const shipping =
    options.payload.website.ecommerceSettings?.shipping ??
    DEFAULT_SHIPPING_SETTINGS;
  const countryCode = resolveCatalogStructuredDataCountryCode(
    options.payload,
    shipping.countryCode,
  );

  if (
    countryCode &&
    shipping.rate != null &&
    shipping.handlingMinDays != null &&
    shipping.handlingMaxDays != null &&
    shipping.transitMinDays != null &&
    shipping.transitMaxDays != null
  ) {
    return {
      "@type": "OfferShippingDetails",
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: countryCode,
      },
      shippingRate: {
        "@type": "MonetaryAmount",
        value: shipping.rate.toFixed(2),
        currency: options.payload.website.currencyCode,
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: shipping.handlingMinDays,
          maxValue: shipping.handlingMaxDays,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: shipping.transitMinDays,
          maxValue: shipping.transitMaxDays,
          unitCode: "DAY",
        },
      },
    } satisfies Record<string, unknown>;
  }

  if (!options.product) {
    return undefined;
  }

  return buildDigitalOfferShippingDetailsFallback({
    payload: options.payload,
    product: options.product,
    countryCode,
  });
}

function buildMerchantReturnPolicyStructuredData(options: {
  payload: CatalogPayload;
}) {
  const returns =
    options.payload.website.ecommerceSettings?.returns ??
    DEFAULT_RETURN_POLICY_SETTINGS;
  const countryCode = resolveCatalogStructuredDataCountryCode(
    options.payload,
    returns.countryCode,
  );

  if (!countryCode || !returns.policyCategory || !returns.returnFees) {
    return undefined;
  }

  const categoryMap = {
    FINITE: "https://schema.org/MerchantReturnFiniteReturnWindow",
    UNLIMITED: "https://schema.org/MerchantReturnUnlimitedWindow",
    NOT_PERMITTED: "https://schema.org/MerchantReturnNotPermitted",
  } as const;

  const feesMap = {
    FREE: "https://schema.org/FreeReturn",
    CUSTOMER_RESPONSIBILITY:
      "https://schema.org/ReturnFeesCustomerResponsibility",
    RETURN_SHIPPING_FEES: "https://schema.org/ReturnShippingFees",
  } as const;

  const methodMap = {
    BY_MAIL: "https://schema.org/ReturnByMail",
    IN_STORE: "https://schema.org/ReturnInStore",
    AT_KIOSK: "https://schema.org/ReturnAtKiosk",
  } as const;

  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: countryCode,
    returnPolicyCategory: categoryMap[returns.policyCategory],
    merchantReturnDays:
      returns.policyCategory === "FINITE"
        ? returns.merchantReturnDays ?? undefined
        : undefined,
    returnFees: feesMap[returns.returnFees],
    returnMethod: returns.returnMethod
      ? methodMap[returns.returnMethod]
      : undefined,
    returnShippingFeesAmount:
      returns.returnFees === "RETURN_SHIPPING_FEES" &&
      returns.returnShippingFeesAmount != null
        ? {
            "@type": "MonetaryAmount",
            value: returns.returnShippingFeesAmount.toFixed(2),
            currency: options.payload.website.currencyCode,
          }
        : undefined,
  } satisfies Record<string, unknown>;
}

function resolveReturnPolicyCandidateUrl(payload: CatalogPayload) {
  const termsUrl = trimCatalogText(
    payload.website.ecommerceSettings?.checkout?.termsUrl,
  );
  if (termsUrl.length > 0) {
    return resolveCatalogAbsoluteUrl(payload.website, termsUrl) ?? termsUrl;
  }

  const cmsPages = payload.website.cmsPages ?? [];
  const cmsCandidate =
    cmsPages.find((page) =>
      /(?:^|\/)(returns?|refund(?:s|-policy)?|retours?|remboursements?|conditions-generales|cgv)(?:$|\/)/i.test(
        page.path,
      ),
    ) ??
    cmsPages.find((page) =>
      /(return|refund|retour|remboursement|conditions générales|cgv)/i.test(
        page.title,
      ),
    ) ??
    null;

  if (!cmsCandidate) {
    return null;
  }

  return resolveCatalogAbsoluteUrl(payload.website, cmsCandidate.path);
}

function buildGlobalMerchantReturnPolicyStructuredData(payload: CatalogPayload) {
  const detailedPolicy = buildMerchantReturnPolicyStructuredData({ payload });
  if (detailedPolicy) {
    const returnLink = resolveReturnPolicyCandidateUrl(payload);
    return {
      ...detailedPolicy,
      "@id": `${returnLink ?? buildCatalogCanonicalUrl({
        payload,
        path: "/",
        locale: null,
      })}#policy`,
      merchantReturnLink: returnLink ?? undefined,
    } satisfies Record<string, unknown>;
  }

  const returnLink = resolveReturnPolicyCandidateUrl(payload);
  if (!returnLink) {
    return undefined;
  }

  return {
    "@type": "MerchantReturnPolicy",
    "@id": `${returnLink}#policy`,
    merchantReturnLink: returnLink,
  } satisfies Record<string, unknown>;
}

function buildProductMetaTitle(options: {
  product: CatalogProduct;
  companyName: string;
  marketLabel: string | null;
  locale?: CisecoLocale | null;
}) {
  const localizedSuffix =
    options.marketLabel &&
    !options.product.name.toLowerCase().includes(options.marketLabel.toLowerCase())
      ? options.locale === "en"
        ? ` in ${options.marketLabel}`
        : ` en ${options.marketLabel}`
      : "";
  return `${options.product.name}${localizedSuffix} — ${options.companyName}`;
}

function buildProductMetaDescription(options: {
  product: CatalogProduct;
  fallbackDescription: string;
  currencyCode: string;
  showPrices: boolean;
  marketLabel: string | null;
  locale?: CisecoLocale | null;
}) {
  const source =
    collectProductTextCandidates(options.product)[0] ||
    trimCatalogText(options.fallbackDescription);
  const qualifiers = [
    trimCatalogText(options.product.category),
    options.product.saleMode === "INSTANT" && options.showPrices
      ? options.locale === "en"
        ? `price in ${options.currencyCode}`
        : `prix en ${options.currencyCode}`
      : options.locale === "en"
        ? "quote on request"
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

const CATALOG_QUERY_FILTER_KEYS = [
  "color",
  "size",
  "minPrice",
  "maxPrice",
  "sort",
] as const;

function translateCatalogCopy(
  locale: CisecoLocale | null,
  french: string,
  english: string,
) {
  return locale === "en" ? english : french;
}

const ABOUT_PLACEHOLDER_TITLES = [
  "👋 About Us.",
  "About us",
  "About Us",
  "👋 À propos de nous.",
] as const;

const ABOUT_PLACEHOLDER_DESCRIPTIONS = [
  "We're impartial and independent, and every day we create distinctive, world-class programmes and content which inform, educate and entertain millions of people in around the world.",
  "Nous sommes impartiaux et indépendants, et chaque jour nous créons des programmes et des contenus distinctifs de classe mondiale qui informent, éduquent et divertissent des millions de personnes dans le monde.",
] as const;

const COLLECTIONS_PLACEHOLDER_DESCRIPTIONS = [
  "Présentez vos sélections favorites.",
  "Showcase your favourite selections.",
] as const;

const BLOG_PLACEHOLDER_TITLES = ["Journal"] as const;

const BLOG_PLACEHOLDER_DESCRIPTIONS = [
  "Suivez nos dernières actualités et inspirations.",
  "Follow our latest news and inspiration.",
] as const;

function normalizeCatalogStaticHeroTitle(
  routeKind: CatalogRouteInfo["kind"],
  value: string | null,
) {
  if (!value) {
    return null;
  }

  if (routeKind === "about" && matchesCatalogPlaceholder(value, ABOUT_PLACEHOLDER_TITLES)) {
    return null;
  }

  if (routeKind === "blog" && matchesCatalogPlaceholder(value, BLOG_PLACEHOLDER_TITLES)) {
    return null;
  }

  return value;
}

function normalizeCatalogStaticHeroDescription(
  routeKind: CatalogRouteInfo["kind"],
  value: string | null,
) {
  if (!value) {
    return null;
  }

  if (
    routeKind === "about" &&
    matchesCatalogPlaceholder(value, ABOUT_PLACEHOLDER_DESCRIPTIONS)
  ) {
    return null;
  }

  if (
    routeKind === "collections" &&
    matchesCatalogPlaceholder(value, COLLECTIONS_PLACEHOLDER_DESCRIPTIONS)
  ) {
    return null;
  }

  if (
    routeKind === "blog" &&
    matchesCatalogPlaceholder(value, BLOG_PLACEHOLDER_DESCRIPTIONS)
  ) {
    return null;
  }

  return value;
}

function listCatalogPublicLocales(
  payload: Pick<CatalogPayload, "website">,
): readonly CisecoLocale[] {
  if (payload.website.templateKey !== "ecommerce-ciseco-home") {
    return [];
  }

  // Public Ciseco catalogues are currently published in French only.
  return ["fr"];
}

export function resolveCatalogPublicLocale(
  payload: Pick<CatalogPayload, "website">,
  locale?: CisecoLocale | null,
) {
  const supportedLocales = listCatalogPublicLocales(payload);
  if (!supportedLocales.length) {
    return null;
  }

  if (locale && supportedLocales.includes(locale)) {
    return locale;
  }

  return supportedLocales[0] ?? null;
}

function resolveCatalogSeoLocale(
  payload: CatalogPayload,
  locale?: CisecoLocale | null,
) {
  return resolveCatalogPublicLocale(payload, locale);
}

function normalizeCatalogSeoSearchParams(
  searchParams?: CatalogSeoSearchParams,
) {
  const params = new URLSearchParams();
  if (!searchParams) {
    return params;
  }

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string" && entry.length > 0) {
          params.append(key, entry);
        }
      });
      return;
    }
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  });

  return params;
}

function readCatalogSeoParam(
  params: URLSearchParams,
  key: string,
) {
  const value = params.get(key);
  return value?.trim() ? value.trim() : null;
}

function hasCatalogSeoFilterParams(params: URLSearchParams) {
  return CATALOG_QUERY_FILTER_KEYS.some((key) => {
    if (key === "sort") {
      const value = readCatalogSeoParam(params, key);
      return Boolean(value && value !== "featured");
    }

    return params.getAll(key).some((value) => value.trim().length > 0);
  });
}

function parseCatalogPageNumber(value: string | null) {
  if (!value) {
    return 1;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.max(1, Math.floor(parsed));
}

function resolveCatalogOpenGraphLocale(locale: CisecoLocale | null) {
  if (locale === "en") {
    return "en_US";
  }
  if (locale === "fr") {
    return "fr_FR";
  }
  return null;
}

function resolveCatalogAbsoluteUrl(
  website: Pick<
    CatalogWebsiteSummary,
    "slug" | "customDomain" | "domainStatus"
  >,
  value?: string | null,
) {
  const normalized = trimCatalogText(value);
  if (!normalized || isInlineCatalogImageSource(normalized)) {
    return null;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (!normalized.startsWith("/")) {
    return null;
  }

  try {
    return new URL(
      normalized,
      buildCatalogUrl({ website, path: "/" }),
    ).toString();
  } catch {
    return null;
  }
}

export function resolveCatalogFaviconUrl(
  website: Pick<
    CatalogWebsiteSummary,
    "slug" | "customDomain" | "domainStatus" | "faviconUrl"
  >,
  options: { resolvedByDomain?: boolean } = {},
) {
  const faviconUrl = normalizeWebsiteFaviconUrl(website.faviconUrl);
  if (!faviconUrl) {
    return null;
  }
  if (!isInlineCatalogImageSource(faviconUrl)) {
    return resolveCatalogAbsoluteUrl(website, faviconUrl);
  }

  const params = new URLSearchParams();
  if (
    !options.resolvedByDomain ||
    !website.customDomain ||
    website.domainStatus !== WebsiteDomainStatus.ACTIVE
  ) {
    params.set("slug", website.slug);
  }
  params.set(
    "v",
    createHash("sha1").update(faviconUrl).digest("hex").slice(0, 12),
  );
  const queryString = params.toString();
  return queryString
    ? `/api/catalogue/site-favicon?${queryString}`
    : "/api/catalogue/site-favicon";
}

export function resolveWebsiteFaviconUrlFromWebsite(
  website: Pick<WebsiteConfig, "builderConfig" | "templateKey" | "accentColor">,
) {
  const builderConfig = resolveBuilderConfigFromWebsite(
    website as WebsiteConfig,
  );
  return normalizeWebsiteFaviconUrl(builderConfig.site?.faviconUrl);
}

function resolveCatalogPageBuilderConfig(
  payload: CatalogPayload,
  path?: string | null,
) {
  if (payload.website.templateKey !== "ecommerce-ciseco-home") {
    return {
      page: null,
      pageConfig: null,
    };
  }

  const page = resolveCisecoPage(path, {
    cmsPaths: (payload.website.cmsPages ?? []).map((entry) => entry.path),
  });
  if (page.page === "not-found") {
    return {
      page,
      pageConfig: null,
    };
  }

  return {
    page,
    pageConfig: payload.website.builder?.pages?.[page.page] ?? null,
  };
}

function resolveBuilderPageHeroSection(
  pageConfig: WebsiteBuilderPageConfig | null,
) {
  if (!pageConfig) {
    return null;
  }

  return (
    pageConfig.sections.find(
      (section) =>
        section.type === "hero" ||
        section.layout === "page-hero" ||
        section.layout === "home-hero",
    ) ?? null
  );
}

function resolveBuilderPageSocialImage(
  payload: CatalogPayload,
  pageConfig: WebsiteBuilderPageConfig | null,
) {
  if (!pageConfig) {
    return null;
  }

  const mediaLibrary = pageConfig.mediaLibrary ?? [];
  const findAsset = (assetId?: string | null) =>
    assetId
      ? mediaLibrary.find((asset) => asset.id === assetId)?.src ?? null
      : null;

  const seoImage = findAsset(pageConfig.seo?.imageId);
  if (seoImage) {
    return resolveCatalogAbsoluteUrl(payload.website, seoImage);
  }

  const heroSection = resolveBuilderPageHeroSection(pageConfig);
  const heroImage =
    findAsset(heroSection?.mediaId) ??
    findAsset(heroSection?.items?.[0]?.mediaId) ??
    findAsset(pageConfig.sections.find((section) => section.mediaId)?.mediaId) ??
    null;

  return heroImage
    ? resolveCatalogAbsoluteUrl(payload.website, heroImage)
    : null;
}

function normalizeBlogSeoSlug(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/^\/+/, "")
    .replace(/^blog\//i, "")
    .replace(/^journal\//i, "")
    .replace(/\/+$/, "");

  return normalized ? slugify(normalized) : null;
}

function buildCatalogPublicApiUrl(
  website: Pick<CatalogWebsiteSummary, "slug" | "customDomain" | "domainStatus">,
  path: string,
  query?: URLSearchParams | null,
) {
  const customDomainUrl = buildActiveCustomDomainUrl({
    customDomain: website.customDomain,
    domainStatus: website.domainStatus,
    path,
  });
  const url = new URL(
    customDomainUrl ?? new URL(path, getAppBaseUrl()).toString(),
  );
  const params = query
    ? new URLSearchParams(query.toString())
    : new URLSearchParams();

  if (!customDomainUrl) {
    params.set("slug", website.slug);
  }

  url.search = params.toString();
  return url.toString();
}

function resolveCatalogBlogImageUrl(
  payload: CatalogPayload,
  options: {
    slug: string;
    socialImageUrl?: string | null;
    coverImageUrl?: string | null;
  },
) {
  const source =
    trimCatalogText(options.socialImageUrl) ||
    trimCatalogText(options.coverImageUrl);
  if (!source) {
    return null;
  }

  const absoluteUrl = resolveCatalogAbsoluteUrl(payload.website, source);
  if (absoluteUrl) {
    return absoluteUrl;
  }

  if (!isInlineCatalogImageSource(source)) {
    return null;
  }

  try {
    const query = new URLSearchParams();
    query.set("post", options.slug);
    query.set("v", createHash("sha1").update(source).digest("hex").slice(0, 12));
    return buildCatalogPublicApiUrl(
      payload.website,
      "/api/catalogue/blog/image",
      query,
    );
  } catch {
    return null;
  }
}

function collectCatalogBlogSeoEntries(
  payload: CatalogPayload,
) {
  if (payload.blogPosts !== undefined) {
    return payload.blogPosts.map((post) => ({
      slug: post.slug,
      title:
        trimCatalogText(post.metaTitle) ||
        trimCatalogText(post.title) ||
        titleizeCategorySlug(post.slug),
      headline: trimCatalogText(post.title) || titleizeCategorySlug(post.slug),
      description:
        trimCatalogText(post.metaDescription) ||
        trimCatalogText(post.excerpt) ||
        null,
      author: trimCatalogText(post.authorName) || null,
      publishedAt: trimCatalogText(post.publishDate) || null,
      imageUrl: resolveCatalogBlogImageUrl(payload, {
        slug: post.slug,
        socialImageUrl: post.socialImageUrl,
        coverImageUrl: post.coverImageUrl,
      }),
    })) satisfies CatalogBlogSeoEntry[];
  }

  if (payload.website.templateKey !== "ecommerce-ciseco-home") {
    return [] as CatalogBlogSeoEntry[];
  }

  const blogPage = payload.website.builder.pages?.blog;
  if (!blogPage) {
    return [] as CatalogBlogSeoEntry[];
  }

  const entries: CatalogBlogSeoEntry[] = [];
  const seen = new Set<string>();
  const resolveImage = (assetId?: string | null) => {
    if (!assetId) {
      return null;
    }
    const asset = blogPage.mediaLibrary.find((entry) => entry.id === assetId);
    return resolveCatalogAbsoluteUrl(payload.website, asset?.src);
  };

  blogPage.sections.forEach((section) => {
    section.items.forEach((item) => {
      const slug = normalizeBlogSeoSlug(item.href);
      if (!slug || seen.has(slug)) {
        return;
      }
      seen.add(slug);
      entries.push({
        slug,
        title: trimCatalogText(item.title) || titleizeCategorySlug(slug),
        headline: trimCatalogText(item.title) || titleizeCategorySlug(slug),
        description: trimCatalogText(item.description) || null,
        author: trimCatalogText(item.tag) || null,
        publishedAt: trimCatalogText(item.badge) || null,
        imageUrl: resolveImage(item.mediaId) ?? resolveImage(section.mediaId),
      });
    });
  });

  return entries;
}

function findCatalogBlogSeoEntry(
  payload: CatalogPayload,
  slug?: string | null,
) {
  const entries = collectCatalogBlogSeoEntries(payload);
  if (!entries.length) {
    return null;
  }
  if (!slug) {
    return entries[0] ?? null;
  }
  return entries.find((entry) => entry.slug === slug) ?? null;
}

function buildCatalogCanonicalUrl(options: {
  payload: CatalogPayload;
  path: string;
  locale: CisecoLocale | null;
  query?: URLSearchParams | null;
}) {
  const url = new URL(
    buildCatalogUrl({
      website: options.payload.website,
      path: options.path,
    }),
  );
  const query = options.query
    ? new URLSearchParams(options.query.toString())
    : new URLSearchParams();

  if (options.locale) {
    query.set("lang", options.locale);
  }

  const serialized = query.toString();
  url.search = serialized;
  return url.toString();
}

function buildCatalogLanguageAlternates(options: {
  payload: CatalogPayload;
  path: string;
  query?: URLSearchParams | null;
}) {
  const supportedLocales = listCatalogPublicLocales(options.payload);
  if (!supportedLocales.length) {
    return null;
  }

  const languages = Object.fromEntries(
    supportedLocales.map((locale) => [
      locale,
      buildCatalogCanonicalUrl({
        payload: options.payload,
        path: options.path,
        locale,
        query: options.query,
      }),
    ]),
  ) as Record<string, string>;

  languages["x-default"] = buildCatalogCanonicalUrl({
    payload: options.payload,
    path: options.path,
    locale: supportedLocales[0] ?? null,
    query: options.query,
  });

  return languages;
}

function listCatalogProductsForCategory(
  payload: Pick<CatalogPayload, "products">,
  categorySlug: string,
) {
  return payload.products.all.filter(
    (product) =>
      trimCatalogText(product.category) &&
      normalizeCatalogCategorySlug(product.category) === categorySlug,
  );
}

async function listCatalogCmsPathsForPreflight(websiteId: string) {
  const pages = await prisma.websiteCmsPage.findMany({
    where: { websiteId },
    select: { path: true },
  });
  return pages.map((page) => page.path);
}

async function hasCatalogProductForPreflight(options: {
  userId: string;
  slug: string;
  includeInactive: boolean;
}) {
  const product = await prisma.product.findFirst({
    where: {
      userId: options.userId,
      isListedInCatalog: true,
      ...(options.includeInactive ? {} : { isActive: true }),
      publicSlug: options.slug,
    },
    select: { id: true },
  });
  return Boolean(product);
}

async function hasCatalogCategoryForPreflight(options: {
  userId: string;
  slug: string;
  includeInactive: boolean;
}) {
  const products = await prisma.product.findMany({
    where: {
      userId: options.userId,
      isListedInCatalog: true,
      ...(options.includeInactive ? {} : { isActive: true }),
      category: { not: null },
    },
    select: { category: true },
    distinct: ["category"],
  });
  return products.some(
    (product) =>
      trimCatalogText(product.category) &&
      normalizeCatalogCategorySlug(product.category) === options.slug,
  );
}

function isMissingPublicBlogPostTableError(error: unknown) {
  return (
    error instanceof Error &&
    /WebsiteBlogPost|relation .* does not exist|does not exist/i.test(error.message)
  );
}

async function hasCatalogBlogPostForPreflight(options: {
  websiteId: string;
  slug: string;
  preview: boolean;
}) {
  try {
    const visibilitySql = options.preview
      ? "TRUE"
      : `(
          bp."status" = 'PUBLISHED'
          OR (
            bp."status" = 'SCHEDULED'
            AND bp."publishDate" IS NOT NULL
            AND bp."publishDate" <= CURRENT_DATE
          )
        )`;
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT bp."id"
       FROM public."WebsiteBlogPost" bp
       WHERE bp."websiteId" = $1
         AND bp."slug" = $2
         AND ${visibilitySql}
       LIMIT 1`,
      options.websiteId,
      options.slug,
    );
    return Boolean(rows[0]);
  } catch (error) {
    if (isMissingPublicBlogPostTableError(error)) {
      console.warn("[site-blog-posts] WebsiteBlogPost table is not installed.");
      return false;
    }
    throw error;
  }
}

async function resolveCatalogRoutePreflightAvailability(options: {
  website: CatalogRoutePreflightWebsite;
  path: string | null;
  preview?: boolean;
}): Promise<CatalogRouteAvailability> {
  if (options.website.templateKey !== "ecommerce-ciseco-home") {
    return { ok: true };
  }

  const initialPage = resolveCisecoPage(options.path);
  const cmsPaths =
    initialPage.page === "not-found"
      ? await listCatalogCmsPathsForPreflight(options.website.id)
      : [];
  const page =
    initialPage.page === "not-found"
      ? resolveCisecoPage(options.path, { cmsPaths })
      : initialPage;

  switch (page.page) {
    case "home":
    case "about":
    case "blog":
    case "contact":
    case "search":
    case "cart":
    case "checkout":
    case "order-success":
    case "login":
    case "signup":
    case "forgot-password":
    case "account":
    case "account-wishlists":
    case "account-orders-history":
    case "account-billing":
    case "account-change-password":
    case "account-order-detail":
      return { ok: true };
    case "collections": {
      if (!page.collectionSlug) {
        return { ok: true };
      }
      const categorySlug =
        normalizeCatalogCategorySlug(page.collectionSlug) ?? page.collectionSlug;
      const exists = await hasCatalogCategoryForPreflight({
        userId: options.website.userId,
        slug: categorySlug,
        includeInactive: options.website.showInactiveProducts,
      });
      return exists ? { ok: true } : { ok: false, reason: "missing-category" };
    }
    case "product":
      if (!page.productSlug) {
        return { ok: false, reason: "missing-product" };
      }
      {
        const exists = await hasCatalogProductForPreflight({
          userId: options.website.userId,
          slug: page.productSlug,
          includeInactive: options.website.showInactiveProducts,
        });
        return exists ? { ok: true } : { ok: false, reason: "missing-product" };
      }
    case "blog-detail":
      if (!page.slug) {
        return { ok: false, reason: "missing-blog-post" };
      }
      {
        const exists = await hasCatalogBlogPostForPreflight({
          websiteId: options.website.id,
          slug: page.slug,
          preview: options.preview === true,
        });
        return exists
          ? { ok: true }
          : { ok: false, reason: "missing-blog-post" };
      }
    case "cms":
      return page.cmsPath && cmsPaths.includes(page.cmsPath)
        ? { ok: true }
        : { ok: false, reason: "missing-cms-page" };
    case "not-found":
    default:
      return { ok: false, reason: "unknown-route" };
  }
}

export function resolveCatalogRouteAvailability(
  payload: CatalogPayload,
  path?: string | null,
): CatalogRouteAvailability {
  if (payload.website.templateKey !== "ecommerce-ciseco-home") {
    return { ok: true };
  }

  const normalizedPath = normalizeCatalogPath(path);
  const cmsPages = payload.website.cmsPages ?? [];
  const page = resolveCisecoPage(normalizedPath, {
    cmsPaths: cmsPages.map((entry) => entry.path),
  });

  switch (page.page) {
    case "home":
    case "about":
    case "blog":
    case "contact":
    case "search":
    case "cart":
    case "checkout":
    case "order-success":
    case "login":
    case "signup":
    case "forgot-password":
    case "account":
    case "account-wishlists":
    case "account-orders-history":
    case "account-billing":
    case "account-change-password":
    case "account-order-detail":
      return { ok: true };
    case "collections":
      if (page.collectionSlug) {
        const categorySlug =
          normalizeCatalogCategorySlug(page.collectionSlug) ??
          page.collectionSlug;
        return listCatalogProductsForCategory(payload, categorySlug).length > 0
          ? { ok: true }
          : { ok: false, reason: "missing-category" };
      }
      return { ok: true };
    case "product":
      return page.productSlug &&
        payload.products.all.some((product) => product.publicSlug === page.productSlug)
        ? { ok: true }
        : { ok: false, reason: "missing-product" };
    case "blog-detail":
      if (!page.slug) {
        return { ok: false, reason: "missing-blog-post" };
      }
      if (payload.blogPosts === undefined) {
        return { ok: true };
      }
      return payload.blogPosts.some((post) => post.slug === page.slug) ||
        payload.currentBlogPost?.slug === page.slug
        ? { ok: true }
        : { ok: false, reason: "missing-blog-post" };
    case "cms":
      return payload.currentCmsPage?.path === page.cmsPath
        ? { ok: true }
        : { ok: false, reason: "missing-cms-page" };
    case "not-found":
    default:
      return { ok: false, reason: "unknown-route" };
  }
}

function resolveCatalogRouteInfo(options: {
  payload: CatalogPayload;
  path?: string | null;
  searchParams?: CatalogSeoSearchParams;
}) {
  const normalizedPath = normalizeCatalogPath(options.path);
  const query = normalizeCatalogSeoSearchParams(options.searchParams);
  const availability = resolveCatalogRouteAvailability(
    options.payload,
    normalizedPath,
  );
  if (!availability.ok) {
    return {
      kind: "not-found",
      canonicalPath: normalizedPath,
      canonicalQuery: new URLSearchParams(),
      shouldIndex: false,
      shouldFollow: false,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  const target = resolveCatalogMetadataTarget(normalizedPath);
  const pageNumber = parseCatalogPageNumber(readCatalogSeoParam(query, "page"));
  const hasFilterParams = hasCatalogSeoFilterParams(query);
  const cmsPage = options.payload.currentCmsPage;

  if (cmsPage) {
    return {
      kind: "cms",
      canonicalPath: cmsPage.path,
      canonicalQuery: new URLSearchParams(),
      shouldIndex: true,
      shouldFollow: true,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  if (target.kind === "product") {
    return {
      kind: "product",
      canonicalPath: `/produit/${target.slug}`,
      canonicalQuery: new URLSearchParams(),
      shouldIndex: true,
      shouldFollow: true,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  if (target.kind === "category") {
    const categorySlug =
      normalizeCatalogCategorySlug(target.slug) ?? target.slug;
    const canonicalQuery = new URLSearchParams();
    if (pageNumber > 1 && !hasFilterParams) {
      canonicalQuery.set("page", String(pageNumber));
    }
    return {
      kind: "category",
      canonicalPath: `/collections/${categorySlug}`,
      canonicalQuery,
      shouldIndex: !hasFilterParams,
      shouldFollow: true,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  if (target.kind === "cart") {
    return {
      kind: "cart",
      canonicalPath: "/cart",
      canonicalQuery: new URLSearchParams(),
      shouldIndex: false,
      shouldFollow: false,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  if (target.kind === "checkout") {
    return {
      kind: "checkout",
      canonicalPath: "/checkout",
      canonicalQuery: new URLSearchParams(),
      shouldIndex: false,
      shouldFollow: false,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  if (target.kind === "confirmation") {
    return {
      kind: "confirmation",
      canonicalPath: "/order-success",
      canonicalQuery: new URLSearchParams(),
      shouldIndex: false,
      shouldFollow: false,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  if (target.kind === "contact") {
    const { pageConfig } = resolveCatalogPageBuilderConfig(
      options.payload,
      normalizedPath,
    );
    return {
      kind: "contact",
      canonicalPath: "/contact",
      canonicalQuery: new URLSearchParams(),
      shouldIndex: true,
      shouldFollow: true,
      openGraphType: "website",
      pageConfig,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  const { page, pageConfig } = resolveCatalogPageBuilderConfig(
    options.payload,
    normalizedPath,
  );

  if (!page) {
    return {
      kind: "home",
      canonicalPath: "/",
      canonicalQuery: new URLSearchParams(),
      shouldIndex: true,
      shouldFollow: true,
      openGraphType: "website",
      pageConfig: null,
      blogEntry: null,
    } satisfies CatalogRouteInfo;
  }

  switch (page.page) {
    case "not-found":
      return {
        kind: "not-found",
        canonicalPath: normalizedPath,
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig: null,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "collections": {
      const normalizedCollectionSlug = page.collectionSlug
        ? normalizeCatalogCategorySlug(page.collectionSlug) ?? page.collectionSlug
        : null;
      const canonicalQuery = new URLSearchParams();
      if (pageNumber > 1 && !hasFilterParams) {
        canonicalQuery.set("page", String(pageNumber));
      }
      return {
        kind: normalizedCollectionSlug ? "category" : "collections",
        canonicalPath: normalizedCollectionSlug
          ? `/collections/${normalizedCollectionSlug}`
          : "/collections",
        canonicalQuery,
        shouldIndex: !hasFilterParams,
        shouldFollow: true,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    }
    case "about":
      return {
        kind: "about",
        canonicalPath: "/about",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: true,
        shouldFollow: true,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "blog":
      return {
        kind: "blog",
        canonicalPath:
          /^\/(?:blog|journal)\/page-\d+$/i.test(normalizedPath)
            ? normalizedPath.replace(/^\/journal\//i, "/blog/")
            : "/blog",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: true,
        shouldFollow: true,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "blog-detail": {
      const blogEntry = findCatalogBlogSeoEntry(options.payload, page.slug);
      return {
        kind: "blog-detail",
        canonicalPath: `/blog/${page.slug ?? "article"}`,
        canonicalQuery: new URLSearchParams(),
        shouldIndex:
          options.payload.blogPosts === undefined ? true : Boolean(blogEntry),
        shouldFollow: true,
        openGraphType: "article",
        pageConfig,
        blogEntry,
      } satisfies CatalogRouteInfo;
    }
    case "search":
      return {
        kind: "search",
        canonicalPath: "/search",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: true,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "login":
      return {
        kind: "login",
        canonicalPath: "/login",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "signup":
      return {
        kind: "signup",
        canonicalPath: "/signup",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "forgot-password":
      return {
        kind: "forgot-password",
        canonicalPath: "/forgot-password",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "account":
      return {
        kind: "account",
        canonicalPath: "/account",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "account-wishlists":
      return {
        kind: "account-wishlists",
        canonicalPath: "/account/wishlists",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "account-orders-history":
      return {
        kind: "account-orders-history",
        canonicalPath: "/account/orders",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "account-billing":
      return {
        kind: "account-billing",
        canonicalPath: "/account/billing",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "account-order-detail":
      return {
        kind: "account-order-detail",
        canonicalPath: `/account/orders/${page.orderId ?? "order"}`,
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "account-change-password":
      return {
        kind: "account-change-password",
        canonicalPath: "/account/change-password",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "cart":
      return {
        kind: "cart",
        canonicalPath: "/cart",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "checkout":
      return {
        kind: "checkout",
        canonicalPath: "/checkout",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "order-success":
      return {
        kind: "confirmation",
        canonicalPath: "/order-success",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: false,
        shouldFollow: false,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "cms":
      return {
        kind: "cms",
        canonicalPath: page.cmsPath ?? normalizedPath,
        canonicalQuery: new URLSearchParams(),
        shouldIndex: true,
        shouldFollow: true,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "contact":
      return {
        kind: "contact",
        canonicalPath: "/contact",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: true,
        shouldFollow: true,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
    case "home":
    default:
      return {
        kind: "home",
        canonicalPath: "/",
        canonicalQuery: new URLSearchParams(),
        shouldIndex: true,
        shouldFollow: true,
        openGraphType: "website",
        pageConfig,
        blogEntry: null,
      } satisfies CatalogRouteInfo;
  }
}

function resolveCatalogSeoContext(
  options: {
    payload: CatalogPayload;
    path?: string | null;
    locale?: CisecoLocale | null;
    searchParams?: CatalogSeoSearchParams;
  },
) {
  const route = resolveCatalogRouteInfo(options);
  const locale = resolveCatalogSeoLocale(options.payload, options.locale);
  const canonicalUrl = buildCatalogCanonicalUrl({
    payload: options.payload,
    path: route.canonicalPath,
    locale,
    query: route.canonicalQuery,
  });

  return {
    route,
    locale,
    canonicalUrl,
    alternatesLanguages:
      route.shouldIndex
        ? buildCatalogLanguageAlternates({
            payload: options.payload,
            path: route.canonicalPath,
            query: route.canonicalQuery,
          })
        : null,
  };
}

function buildCatalogSeoContextValues(options: {
  companyName: string;
  route: CatalogRouteInfo;
  pageTitle?: string | null;
  pageDescription?: string | null;
  product?: CatalogProduct | null;
}) {
  const pageTitle = trimCatalogText(options.pageTitle);
  const pageDescription = trimCatalogText(options.pageDescription);
  const values: Record<string, string> = {
    "site.name": options.companyName,
    siteName: options.companyName,
    "company.name": options.companyName,
    companyName: options.companyName,
    "page.title": pageTitle,
    pageTitle,
    "page.description": pageDescription,
    pageDescription,
    "page.kind": options.route.kind,
    pageKind: options.route.kind,
  };

  if (options.route.blogEntry) {
    values["blog.title"] = options.route.blogEntry.title;
    values.blogTitle = options.route.blogEntry.title;
    values["blog.headline"] = options.route.blogEntry.headline;
    values.blogHeadline = options.route.blogEntry.headline;
    values["blog.description"] = options.route.blogEntry.description ?? "";
    values.blogDescription = options.route.blogEntry.description ?? "";
  }

  if (options.product) {
    values["product.name"] = options.product.name;
    values.productName = options.product.name;
    values["product.category"] = options.product.category ?? "";
    values.productCategory = options.product.category ?? "";
    values["product.sku"] = options.product.sku;
    values.productSku = options.product.sku;
    values["product.slug"] = options.product.publicSlug;
    values.productSlug = options.product.publicSlug;
    values["product.description"] = options.product.description ?? "";
    values.productDescription = options.product.description ?? "";
    values["product.excerpt"] = options.product.excerpt ?? "";
    values.productExcerpt = options.product.excerpt ?? "";
  }

  return values;
}

function resolveCatalogStaticPageMetadata(options: {
  payload: CatalogPayload;
  route: CatalogRouteInfo;
  locale: CisecoLocale | null;
  base: CatalogWebsiteMetadata;
  pageConfig: WebsiteBuilderPageConfig | null;
  companyName: string;
  categoryLabel?: string | null;
}) {
  const heroSection = resolveBuilderPageHeroSection(options.pageConfig);
  const heroTitle = normalizeCatalogStaticHeroTitle(
    options.route.kind,
    trimCatalogText(heroSection?.title),
  );
  const heroDescription = normalizeCatalogStaticHeroDescription(
    options.route.kind,
    trimCatalogText(heroSection?.subtitle ?? heroSection?.description),
  );
  const companyName = options.companyName;

  switch (options.route.kind) {
    case "home":
      return {
        title: options.base.title,
        description: options.base.description,
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "collections":
      return {
        title: appendCatalogCompanyName(
          heroTitle ||
            translateCatalogCopy(
              options.locale,
              "Licences, logiciels et produits numériques",
              "Licences, software, and digital products",
            ),
          companyName,
        ),
        description:
          heroDescription ||
          translateCatalogCopy(
            options.locale,
            `Explorez les produits, catégories et offres disponibles chez ${companyName}. Comparez les prix, vérifiez les disponibilités et commandez en ligne.`,
            `Browse products, categories, and current offers from ${companyName}. Compare prices, check availability, and order online.`,
          ),
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "category": {
      const label =
        trimCatalogText(options.categoryLabel) ||
        titleizeCategorySlug(
          options.route.canonicalPath.split("/").filter(Boolean).pop() ?? "",
        );
      const matchingProducts = options.payload.products.all.filter(
        (product) =>
          trimCatalogText(product.category) &&
          normalizeCatalogCategorySlug(product.category) ===
            options.route.canonicalPath.split("/").filter(Boolean).pop(),
      );
      const countLabel =
        matchingProducts.length > 0
          ? translateCatalogCopy(
              options.locale,
              `${matchingProducts.length} produit${matchingProducts.length > 1 ? "s" : ""}`,
              `${matchingProducts.length} product${matchingProducts.length > 1 ? "s" : ""}`,
            )
          : null;
      return {
        title: `${label} — ${companyName}`,
        description: truncateCatalogText(
          [
            translateCatalogCopy(
              options.locale,
              `Découvrez notre sélection ${label} chez ${companyName}.`,
              `Explore our ${label} collection at ${companyName}.`,
            ),
            countLabel,
            translateCatalogCopy(
              options.locale,
              "Comparez les offres, prix et options disponibles avant de commander en ligne.",
              "Compare available offers, prices, and options before ordering online.",
            ),
          ]
            .filter((entry): entry is string => Boolean(entry))
            .join(" "),
          160,
        ),
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    }
    case "about":
      return {
        title: heroTitle
          ? appendCatalogCompanyName(heroTitle, companyName)
          : translateCatalogCopy(
              options.locale,
              `À propos de ${companyName}`,
              `About ${companyName}`,
            ),
        description:
          heroDescription ||
          translateCatalogCopy(
            options.locale,
            `Découvrez ${companyName}, son accompagnement client, son catalogue et ses engagements pour des achats en ligne clairs et fiables.`,
            `Learn about ${companyName}, its customer support, catalogue, and commitments for clear and reliable online purchases.`,
          ),
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "blog":
      return {
        title: appendCatalogCompanyName(
          heroTitle ||
            translateCatalogCopy(
              options.locale,
              "Guides, conseils et actualités",
              "Guides, advice, and updates",
            ),
          companyName,
        ),
        description:
          heroDescription ||
          translateCatalogCopy(
            options.locale,
            `Retrouvez les guides d’achat, comparatifs et conseils de ${companyName} pour choisir les bons produits et licences.`,
            `Read buying guides, comparisons, and advice from ${companyName} to choose the right products and licences.`,
          ),
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "blog-detail":
      {
        const currentPostImage = options.payload.currentBlogPost
          ? resolveCatalogBlogImageUrl(options.payload, {
              slug: options.payload.currentBlogPost.slug,
              socialImageUrl: options.payload.currentBlogPost.socialImageUrl,
              coverImageUrl: options.payload.currentBlogPost.coverImageUrl,
            })
          : null;
        const blogTitle =
          options.route.blogEntry?.title ??
          trimCatalogText(options.payload.currentBlogPost?.metaTitle) ??
          trimCatalogText(options.payload.currentBlogPost?.title) ??
          heroTitle ??
          translateCatalogCopy(options.locale, "Article", "Article");
        return {
          title: appendCatalogCompanyName(blogTitle, companyName),
          description:
            options.route.blogEntry?.description ??
            trimCatalogText(options.payload.currentBlogPost?.metaDescription) ??
            trimCatalogText(options.payload.currentBlogPost?.excerpt) ??
            heroDescription ??
            options.base.description,
          socialImageUrl:
            options.route.blogEntry?.imageUrl ??
            currentPostImage ??
            resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
            options.base.socialImageUrl,
          keywords: options.base.keywords,
        } satisfies Partial<CatalogWebsiteMetadata>;
      }
    case "contact":
      return {
        title: appendCatalogCompanyName(
          heroTitle ||
            translateCatalogCopy(options.locale, "Contact", "Contact"),
          companyName,
        ),
        description:
          heroDescription ||
          translateCatalogCopy(
            options.locale,
            `Contactez ${companyName} pour une question, un devis ou une aide avant commande. Réponse rapide par email ou téléphone.`,
            `Contact ${companyName} for questions, quotes, or help before ordering. Get a fast reply by email or phone.`,
          ),
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "cms":
      return {
        title: appendCatalogCompanyName(
          options.payload.currentCmsPage?.title ?? heroTitle ?? companyName,
          companyName,
        ),
        description:
          options.payload.currentCmsPage?.excerpt ??
          heroDescription ??
          options.base.description,
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "search":
      return {
        title: `${translateCatalogCopy(options.locale, "Recherche", "Search")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Recherchez des produits, collections et catégories dans le catalogue.",
          "Search products, collections, and categories in the catalogue.",
        ),
        socialImageUrl:
          resolveBuilderPageSocialImage(options.payload, options.pageConfig) ??
          options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "cart":
      return {
        title: `${translateCatalogCopy(options.locale, "Panier", "Cart")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Passez en revue vos articles et finalisez votre commande.",
          "Review your items and complete your order.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "checkout":
      return {
        title: `${translateCatalogCopy(options.locale, "Paiement", "Checkout")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Finalisez votre commande en toute sécurité.",
          "Complete your order with a secure checkout flow.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "confirmation":
      return {
        title: `${translateCatalogCopy(options.locale, "Confirmation", "Order confirmation")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Votre commande a bien été enregistrée.",
          "Your order has been recorded successfully.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "login":
      return {
        title: `${translateCatalogCopy(options.locale, "Connexion", "Sign in")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Connectez-vous à votre espace client.",
          "Sign in to your customer account.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "signup":
      return {
        title: `${translateCatalogCopy(options.locale, "Inscription", "Create account")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Créez votre compte client pour suivre vos commandes et favoris.",
          "Create your customer account to manage orders and wishlists.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "forgot-password":
      return {
        title: `${translateCatalogCopy(options.locale, "Mot de passe oublié", "Forgot password")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Réinitialisez l’accès à votre compte client.",
          "Reset access to your customer account.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "account":
      return {
        title: `${translateCatalogCopy(options.locale, "Mon compte", "My account")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Consultez votre profil, vos commandes et vos préférences.",
          "Review your profile, orders, and preferences.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "account-wishlists":
      return {
        title: `${translateCatalogCopy(options.locale, "Favoris", "Wishlists")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Retrouvez les produits enregistrés pour plus tard.",
          "Review the items you saved for later.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "account-billing":
      return {
        title: `${translateCatalogCopy(options.locale, "Facturation", "Billing")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Demandez des factures pour vos commandes éligibles.",
          "Request invoices for your eligible orders.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "account-orders-history":
      return {
        title: `${translateCatalogCopy(options.locale, "Historique des commandes", "Orders history")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Consultez l’historique de vos commandes.",
          "Review your order history.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "account-order-detail":
      return {
        title: `${translateCatalogCopy(options.locale, "Détail de commande", "Order details")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Consultez les informations de votre commande.",
          "Review the details of your order.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    case "account-change-password":
      return {
        title: `${translateCatalogCopy(options.locale, "Changer le mot de passe", "Change password")} — ${companyName}`,
        description: translateCatalogCopy(
          options.locale,
          "Mettez à jour le mot de passe de votre compte.",
          "Update the password for your account.",
        ),
      } satisfies Partial<CatalogWebsiteMetadata>;
    default:
      return {
        title: options.base.title,
        description: options.base.description,
        socialImageUrl: options.base.socialImageUrl,
        keywords: options.base.keywords,
      } satisfies Partial<CatalogWebsiteMetadata>;
  }
}

export function resolveCatalogSeo(options: {
  payload: CatalogPayload;
  path?: string | null;
  locale?: CisecoLocale | null;
  searchParams?: CatalogSeoSearchParams;
}): CatalogSeoResult {
  const seoContext = resolveCatalogSeoContext(options);
  const { payload } = options;
  const companyName = payload.website.contact.companyName;
  const marketLabel = resolveCatalogMarketLabel(payload);
  const base = resolveCatalogBaseMetadata({
    payload,
    canonicalUrl: seoContext.canonicalUrl,
  });
  const { pageConfig } = resolveCatalogPageBuilderConfig(
    payload,
    seoContext.route.canonicalPath,
  );
  const effectivePageConfig = seoContext.route.pageConfig ?? pageConfig;
  const canonicalTarget = resolveCatalogMetadataTarget(
    seoContext.route.canonicalPath,
  );
  let resolved = { ...base };
  let resolvedProduct: CatalogProduct | null = null;
  let pageTitleSource: string | null = null;
  let pageDescriptionSource: string | null = null;

  if (canonicalTarget.kind === "product") {
    const product = payload.products.all.find(
      (item) => item.publicSlug === canonicalTarget.slug,
    );
    resolvedProduct = product ?? null;
    if (product) {
      const metaTitle = product.metaTitle?.trim();
      const metaDescription = product.metaDescription?.trim();
      const imageUrls = collectProductImageUrls(product)
        .map((image) => resolveCatalogAbsoluteUrl(payload.website, image))
        .filter((image): image is string => Boolean(image));
      pageTitleSource =
        metaTitle && metaTitle.length > 0
          ? metaTitle
          : buildProductMetaTitle({
              product,
              companyName,
              marketLabel:
                seoContext.locale === "en" && marketLabel === "Tunisie"
                  ? "Tunisia"
                  : marketLabel,
              locale: seoContext.locale,
            });
      pageDescriptionSource =
        metaDescription && metaDescription.length > 0
          ? metaDescription
          : buildProductMetaDescription({
              product,
              fallbackDescription: base.description,
              currencyCode: payload.website.currencyCode,
              showPrices: payload.website.showPrices,
              marketLabel:
                seoContext.locale === "en" && marketLabel === "Tunisie"
                  ? "Tunisia"
                  : marketLabel,
              locale: seoContext.locale,
            });
      resolved = {
        ...resolved,
        title: pageTitleSource,
        description: pageDescriptionSource,
        socialImageUrl:
          imageUrls[0] ??
          resolveBuilderPageSocialImage(payload, effectivePageConfig) ??
          base.socialImageUrl,
        keywords:
          base.keywords ??
          buildProductKeywordFallback({
            product,
            companyName,
            marketLabel:
              seoContext.locale === "en" && marketLabel === "Tunisie"
                ? "Tunisia"
                : marketLabel,
            currencyCode: payload.website.currencyCode,
          }),
      };
    }
  } else {
    const categoryLabel =
      canonicalTarget.kind === "category"
        ? resolveCategoryLabel(
            payload.products.all,
            canonicalTarget.slug,
            seoContext.locale,
          )
        : null;
    const staticMetadata = resolveCatalogStaticPageMetadata({
      payload,
      route: seoContext.route,
      locale: seoContext.locale,
      base,
      pageConfig: effectivePageConfig,
      companyName,
      categoryLabel,
    });
    pageTitleSource = staticMetadata.title ?? null;
    pageDescriptionSource = staticMetadata.description ?? null;
    resolved = {
      ...resolved,
      ...staticMetadata,
    };
  }

  const explicitSeo = effectivePageConfig?.seo ?? null;
  const seoContextValues = buildCatalogSeoContextValues({
    companyName,
    route: seoContext.route,
    pageTitle: pageTitleSource ?? resolved.title,
    pageDescription: pageDescriptionSource ?? resolved.description,
    product: resolvedProduct,
  });
  const explicitTitle =
    resolvedProduct
      ? renderProductSeoTemplate(
          explicitSeo?.title,
          resolvedProduct,
          companyName,
        )
      : renderSeoTemplate(explicitSeo?.title, seoContextValues);
  const explicitDescription =
    resolvedProduct
      ? renderProductSeoTemplate(
          explicitSeo?.description,
          resolvedProduct,
          companyName,
        )
      : renderSeoTemplate(explicitSeo?.description, seoContextValues);
  const explicitKeywords = renderSeoTemplate(
    explicitSeo?.keywords,
    seoContextValues,
  );
  const explicitImage = resolveBuilderPageSocialImage(payload, effectivePageConfig);

  resolved = {
    ...resolved,
    canonicalUrl: seoContext.canonicalUrl,
    title: normalizeCatalogSeoTitle(explicitTitle ?? resolved.title),
    description: normalizeCatalogSeoDescription(
      explicitDescription ?? resolved.description,
    ),
    socialImageUrl: explicitImage ?? resolved.socialImageUrl,
    keywords: explicitKeywords ?? resolved.keywords,
  };

  const openGraphLocale = resolveCatalogOpenGraphLocale(seoContext.locale);
  const openGraphAlternateLocales = listCatalogPublicLocales(options.payload)
    .filter((locale) => locale !== seoContext.locale)
    .map((locale) => resolveCatalogOpenGraphLocale(locale))
    .filter(
      (
        locale,
      ): locale is NonNullable<ReturnType<typeof resolveCatalogOpenGraphLocale>> =>
        locale !== null,
    );

  return {
    metadata: resolved,
    alternatesLanguages: seoContext.alternatesLanguages,
    robots:
      seoContext.route.shouldIndex && seoContext.route.shouldFollow
        ? null
        : {
            index: seoContext.route.shouldIndex,
            follow: seoContext.route.shouldFollow,
          },
    openGraphType: seoContext.route.openGraphType,
    locale: seoContext.locale,
    openGraphLocale,
    openGraphAlternateLocales,
    contentLanguage: seoContext.locale,
  };
}

export function resolveCatalogMetadata(options: {
  payload: CatalogPayload;
  path?: string | null;
  locale?: CisecoLocale | null;
  searchParams?: CatalogSeoSearchParams;
}): CatalogWebsiteMetadata {
  return resolveCatalogSeo(options).metadata;
}

function buildCatalogBreadcrumbItems(options: {
  payload: CatalogPayload;
  route: CatalogRouteInfo;
  locale: CisecoLocale | null;
  currentLabel: string;
}) {
  const homeLabel = translateCatalogCopy(options.locale, "Accueil", "Home");
  const collectionLabel = translateCatalogCopy(
    options.locale,
    "Collections",
    "Collections",
  );
  const blogLabel = translateCatalogCopy(options.locale, "Blog", "Blog");
  const informationLabel = translateCatalogCopy(
    options.locale,
    "Informations",
    "Information",
  );
  const items: Array<{
    name: string;
    item: string;
  }> = [
    {
      name: homeLabel,
      item: buildCatalogCanonicalUrl({
        payload: options.payload,
        path: "/",
        locale: options.locale,
      }),
    },
  ];

  switch (options.route.kind) {
    case "collections":
      items.push({
        name: collectionLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: "/collections",
          locale: options.locale,
        }),
      });
      break;
    case "category": {
      const slug = options.route.canonicalPath.split("/").filter(Boolean).pop();
      items.push({
        name: collectionLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: "/collections",
          locale: options.locale,
        }),
      });
      if (slug) {
        items.push({
          name: resolveCategoryLabel(
            options.payload.products.all,
            slug,
            options.locale,
          ),
          item: buildCatalogCanonicalUrl({
            payload: options.payload,
            path: `/collections/${slug}`,
            locale: options.locale,
            query: options.route.canonicalQuery,
          }),
        });
      }
      break;
    }
    case "product": {
      const slug = options.route.canonicalPath.split("/").filter(Boolean).pop();
      const product = slug
        ? options.payload.products.all.find((entry) => entry.publicSlug === slug)
        : null;
      const categorySlug = normalizeCatalogCategorySlug(product?.category);
      items.push({
        name: collectionLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: "/collections",
          locale: options.locale,
        }),
      });
      if (categorySlug && product?.category) {
        items.push({
          name: product.category,
          item: buildCatalogCanonicalUrl({
            payload: options.payload,
            path: `/collections/${categorySlug}`,
            locale: options.locale,
          }),
        });
      }
      items.push({
        name: options.currentLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: options.route.canonicalPath,
          locale: options.locale,
        }),
      });
      break;
    }
    case "blog":
      items.push({
        name: blogLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: options.route.canonicalPath,
          locale: options.locale,
        }),
      });
      break;
    case "blog-detail":
      items.push({
        name: blogLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: "/blog",
          locale: options.locale,
        }),
      });
      items.push({
        name: options.currentLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: options.route.canonicalPath,
          locale: options.locale,
        }),
      });
      break;
    case "cms":
      items.push({
        name: informationLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: options.route.canonicalPath,
          locale: options.locale,
        }),
      });
      break;
    case "about":
    case "contact":
      items.push({
        name: options.currentLabel,
        item: buildCatalogCanonicalUrl({
          payload: options.payload,
          path: options.route.canonicalPath,
          locale: options.locale,
        }),
      });
      break;
    default:
      break;
  }

  return items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.item,
  }));
}

function buildCatalogOrganizationStructuredData(options: {
  payload: CatalogPayload;
  locale: CisecoLocale | null;
  homeUrl: string;
}) {
  const sameAs = (options.payload.website.socialLinks ?? [])
    .map((link) => {
      const href = trimCatalogText(link.href);
      return /^https?:\/\//i.test(href) ? href : null;
    })
    .filter((href): href is string => Boolean(href));
  const logo =
    resolveCatalogAbsoluteUrl(
      options.payload.website,
      options.payload.website.contact.logoUrl,
    ) ??
    resolveCatalogAbsoluteUrl(
      options.payload.website,
      options.payload.website.metadata?.socialImageUrl,
    );
  const globalReturnPolicy =
    buildGlobalMerchantReturnPolicyStructuredData(options.payload);
  const countryCode = inferCatalogCountryCode(options.payload);
  const countryName =
    countryCode === "TN"
      ? options.locale === "en"
        ? "Tunisia"
        : "Tunisie"
      : countryCode;
  const contactEmail = trimCatalogText(options.payload.website.contact.email);
  const contactPhone = trimCatalogText(options.payload.website.contact.phone);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${options.homeUrl}#organization`,
    name: options.payload.website.contact.companyName,
    url: options.homeUrl,
    logo: logo ?? undefined,
    email: options.payload.website.contact.email ?? undefined,
    telephone: options.payload.website.contact.phone ?? undefined,
    address: options.payload.website.contact.address
      ? {
          "@type": "PostalAddress",
          streetAddress: options.payload.website.contact.address,
          addressCountry: countryCode ?? undefined,
        }
      : undefined,
    contactPoint:
      contactEmail || contactPhone
        ? [
            {
              "@type": "ContactPoint",
              contactType:
                options.locale === "en" ? "customer support" : "support client",
              email: contactEmail || undefined,
              telephone: contactPhone || undefined,
              areaServed: countryCode ?? undefined,
              availableLanguage:
                options.locale === "en" ? ["French", "English"] : ["French"],
            },
          ]
        : undefined,
    areaServed: countryCode
      ? {
          "@type": "Country",
          name: countryName,
        }
      : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    hasMerchantReturnPolicy: globalReturnPolicy ?? undefined,
  } satisfies Record<string, unknown>;
}

function buildCatalogWebsiteStructuredData(options: {
  payload: CatalogPayload;
  locale: CisecoLocale | null;
  homeUrl: string;
}) {
  const searchActionTarget = buildCatalogCanonicalUrl({
    payload: options.payload,
    path: "/search",
    locale: options.locale,
    query: new URLSearchParams([["q", "{search_term_string}"]]),
  });

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${options.homeUrl}#website`,
    url: options.homeUrl,
    name: options.payload.website.contact.companyName,
    inLanguage: options.locale ?? undefined,
    potentialAction:
      options.payload.website.templateKey === "ecommerce-ciseco-home"
        ? {
            "@type": "SearchAction",
            target: searchActionTarget,
            "query-input": "required name=search_term_string",
          }
        : undefined,
  } satisfies Record<string, unknown>;
}

function resolveProductApprovedReviewStructuredData(product: CatalogProduct) {
  const reviews = (product.reviews ?? []).filter(
    (review) =>
      Number.isFinite(review.rating) &&
      review.rating >= 1 &&
      review.rating <= 5 &&
      review.body.trim().length > 0,
  );
  if (!reviews.length) {
    return null;
  }

  const averageRating =
    reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(averageRating.toFixed(1)),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, 20).map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.authorName,
      },
      datePublished: review.createdAt.slice(0, 10),
      name: review.title ?? undefined,
      reviewBody: review.body,
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    })),
  };
}

function resolveCatalogProductPublisherBrand(product: CatalogProduct) {
  const signals = [product.name, product.sku, product.category]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLocaleLowerCase();

  if (!signals) {
    return null;
  }

  if (
    signals.includes("microsoft") ||
    /\b(?:mic|ms|off)-/i.test(product.sku ?? "")
  ) {
    return "Microsoft";
  }

  if (
    signals.includes("adobe") ||
    signals.includes("acrobat") ||
    signals.includes("creative cloud")
  ) {
    return "Adobe";
  }

  if (
    signals.includes("autodesk") ||
    signals.includes("revit") ||
    signals.includes("inventor")
  ) {
    return "Autodesk";
  }

  if (
    signals.includes("tonec") ||
    signals.includes("internet download manager") ||
    /\bidm\b/i.test(signals)
  ) {
    return "TONEC";
  }

  return null;
}

export function resolveCatalogStructuredData(options: {
  payload: CatalogPayload;
  path?: string | null;
  locale?: CisecoLocale | null;
  searchParams?: CatalogSeoSearchParams;
}) {
  const seo = resolveCatalogSeo(options);
  const { payload } = options;
  const route = resolveCatalogRouteInfo({
    payload,
    path: options.path,
    searchParams: options.searchParams,
  });
  const locale = seo.locale;
  const homeUrl = buildCatalogCanonicalUrl({
    payload,
    path: "/",
    locale,
  });
  const websiteStructuredData = buildCatalogWebsiteStructuredData({
    payload,
    locale,
    homeUrl,
  });
  const organizationStructuredData = buildCatalogOrganizationStructuredData({
    payload,
    locale,
    homeUrl,
  });

  if (!route.shouldIndex) {
    return [] as Array<Record<string, unknown>>;
  }

  if (route.kind === "home") {
    return [websiteStructuredData, organizationStructuredData];
  }

  const breadcrumbItems = buildCatalogBreadcrumbItems({
    payload,
    route,
    locale,
    currentLabel:
      payload.currentCmsPage?.title ??
      route.blogEntry?.headline ??
      seo.metadata.title,
  });
  const structuredData: Array<Record<string, unknown>> = [];

  if (breadcrumbItems.length > 1) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems,
    });
  }

  if (route.kind === "product") {
    const slug = route.canonicalPath.split("/").filter(Boolean).pop();
    const product = slug
      ? payload.products.all.find((entry) => entry.publicSlug === slug)
      : null;
    if (!product) {
      return structuredData;
    }

    const marketLabel = resolveCatalogMarketLabel(payload);
    const imageUrls = collectProductImageUrls(product)
      .map((image) => resolveCatalogAbsoluteUrl(payload.website, image))
      .filter((image): image is string => Boolean(image));
    const faqItems = normalizeProductFaqItems(product.faqItems);
    const productDescription =
      collectProductTextCandidates(product)[0] || seo.metadata.description;
    const productBrand = resolveCatalogProductPublisherBrand(product);
    const productStructuredData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: productDescription,
      sku: product.sku,
      category: product.category ?? undefined,
      url: seo.metadata.canonicalUrl,
      image: imageUrls.length ? imageUrls : undefined,
      brand: productBrand
        ? {
            "@type": "Brand",
            name: productBrand,
          }
        : undefined,
      mainEntityOfPage: seo.metadata.canonicalUrl,
    };
    const reviewStructuredData =
      resolveProductApprovedReviewStructuredData(product);
    if (reviewStructuredData) {
      productStructuredData.aggregateRating =
        reviewStructuredData.aggregateRating;
      productStructuredData.review = reviewStructuredData.review;
    }

    if (
      product.saleMode === "INSTANT" &&
      payload.website.showPrices &&
      product.priceTTCCents > 0
    ) {
      const shippingDetails = buildOfferShippingDetailsStructuredData({
        payload,
        product,
      });
      const detailedReturnPolicy = buildMerchantReturnPolicyStructuredData({
        payload,
      });
      const globalReturnPolicy = buildGlobalMerchantReturnPolicyStructuredData(
        payload,
      );
      const globalReturnPolicyId =
        globalReturnPolicy && typeof globalReturnPolicy["@id"] === "string"
          ? globalReturnPolicy["@id"]
          : null;
      const hasMerchantReturnPolicy =
        detailedReturnPolicy ??
        (globalReturnPolicyId
          ? {
              "@id": globalReturnPolicyId,
            }
          : undefined);
      productStructuredData.offers = {
        "@type": "Offer",
        url: seo.metadata.canonicalUrl,
        priceCurrency: payload.website.currencyCode,
        price: fromCents(
          product.priceTTCCents,
          payload.website.currencyCode,
        ).toFixed(2),
        availability:
          product.isActive !== false &&
          (product.stockQuantity == null || product.stockQuantity > 0)
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        seller: {
          "@type": "Organization",
          name: payload.website.contact.companyName,
        },
        ...(shippingDetails ? { shippingDetails } : {}),
        ...(hasMerchantReturnPolicy
          ? { hasMerchantReturnPolicy }
          : {}),
        eligibleRegion: marketLabel
          ? {
              "@type": "Country",
              name:
                locale === "en" && marketLabel === "Tunisie"
                  ? "Tunisia"
                  : marketLabel,
            }
          : undefined,
      };
    }

    structuredData.push(productStructuredData);
    structuredData.push(organizationStructuredData);

    const faqStructuredData = buildProductFaqStructuredData(faqItems);
    if (faqStructuredData) {
      structuredData.push(faqStructuredData);
    }

    return structuredData;
  }

  if (route.kind === "collections" || route.kind === "category") {
    const categorySlug =
      route.kind === "category"
        ? route.canonicalPath.split("/").filter(Boolean).pop() ?? null
        : null;
    const products = categorySlug
      ? payload.products.all.filter(
          (product) =>
            trimCatalogText(product.category) &&
            normalizeCatalogCategorySlug(product.category) === categorySlug,
        )
      : payload.products.all;

    structuredData.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: seo.metadata.title,
      description: seo.metadata.description,
      url: seo.metadata.canonicalUrl,
      isPartOf: {
        "@id": `${homeUrl}#website`,
      },
      about: {
        "@id": `${homeUrl}#organization`,
      },
      inLanguage: locale ?? undefined,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: products.slice(0, 24).map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: product.name,
          url: buildCatalogCanonicalUrl({
            payload,
            path: `/produit/${product.publicSlug}`,
            locale,
          }),
        })),
      },
    });
    return structuredData;
  }

  if (route.kind === "blog") {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: seo.metadata.title,
      description: seo.metadata.description,
      url: seo.metadata.canonicalUrl,
      isPartOf: {
        "@id": `${homeUrl}#website`,
      },
      blogPost: collectCatalogBlogSeoEntries(payload).slice(0, 12).map((entry) => ({
        "@type": "BlogPosting",
        headline: entry.headline,
        description: entry.description ?? undefined,
        url: buildCatalogCanonicalUrl({
          payload,
          path: `/blog/${entry.slug}`,
          locale,
        }),
      })),
    });
    return structuredData;
  }

  if (route.kind === "blog-detail") {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: route.blogEntry?.headline ?? seo.metadata.title,
      description: route.blogEntry?.description ?? seo.metadata.description,
      url: seo.metadata.canonicalUrl,
      image: route.blogEntry?.imageUrl
        ? [route.blogEntry.imageUrl]
        : seo.metadata.socialImageUrl
          ? [seo.metadata.socialImageUrl]
          : undefined,
      author: route.blogEntry?.author
        ? {
            "@type": "Person",
            name: route.blogEntry.author,
          }
        : undefined,
      datePublished:
        route.blogEntry?.publishedAt &&
        !Number.isNaN(new Date(route.blogEntry.publishedAt).getTime())
          ? new Date(route.blogEntry.publishedAt).toISOString()
          : undefined,
      publisher: {
        "@id": `${homeUrl}#organization`,
      },
      mainEntityOfPage: seo.metadata.canonicalUrl,
      inLanguage: locale ?? undefined,
    });
    return structuredData;
  }

  if (route.kind === "about" || route.kind === "contact" || route.kind === "cms") {
    structuredData.push({
      "@context": "https://schema.org",
      "@type":
        route.kind === "contact"
          ? "ContactPage"
          : route.kind === "about"
            ? "AboutPage"
            : "WebPage",
      name: seo.metadata.title,
      description: seo.metadata.description,
      url: seo.metadata.canonicalUrl,
      isPartOf: {
        "@id": `${homeUrl}#website`,
      },
      about: {
        "@id": `${homeUrl}#organization`,
      },
      inLanguage: locale ?? undefined,
    });
    if (route.kind === "contact") {
      structuredData.push(organizationStructuredData);
    }
    return structuredData;
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

async function loadCatalogWebsiteForPreflight(
  selector: { slug: string } | { domain: string },
  options?: { allowUnpublished?: boolean },
): Promise<CatalogRoutePreflightWebsite | null> {
  const where: Prisma.WebsiteConfigWhereInput = "slug" in selector
    ? { slug: selector.slug }
    : {
        customDomain: selector.domain,
        domainStatus: WebsiteDomainStatus.ACTIVE,
      };
  const config = await prisma.websiteConfig.findFirst({
    where,
    select: {
      id: true,
      userId: true,
      slug: true,
      templateKey: true,
      showInactiveProducts: true,
      published: true,
    },
  });
  if (!config) {
    return null;
  }
  if (!options?.allowUnpublished && !config.published) {
    return null;
  }
  return config;
}

export async function resolveCatalogRoutePreflight(options: {
  slug?: string | null;
  domain?: string | null;
  path?: string | null;
  preview?: boolean;
}): Promise<CatalogRoutePreflightResult> {
  const domain = normalizeCatalogDomainInput(options.domain);
  const slug = normalizeCatalogSlugInput(options.slug);
  const normalizedPath = normalizeCatalogPathInput(options.path) ?? null;

  const website = domain
    ? await loadCatalogWebsiteForPreflight(
        { domain },
        { allowUnpublished: options.preview },
      )
    : slug
      ? await loadCatalogWebsiteForPreflight(
          { slug },
          { allowUnpublished: options.preview },
        )
      : null;

  if (!website) {
    return {
      ok: false,
      website: null,
      path: normalizedPath,
      reason: "unknown-route",
    };
  }

  const routePath = domain
    ? stripCatalogSlugPrefix(normalizedPath, website.slug)
    : normalizedPath;
  const availability = await resolveCatalogRoutePreflightAvailability({
    website,
    path: routePath,
    preview: options.preview,
  });

  if (!availability.ok) {
    return {
      ok: false,
      website,
      path: routePath,
      reason: availability.reason,
    };
  }

  return {
    ok: true,
    website,
    path: routePath,
  };
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
      createdAt: true,
    },
  });
  const catalogProducts = products as CatalogProduct[];
  const reviewsByProduct = await listApprovedProductReviewsForProducts(
    userId,
    catalogProducts.map((product) => product.id),
  );
  return catalogProducts.map((product) => ({
    ...product,
    descriptionHtml: product.descriptionHtml
      ? sanitizeProductHtml(product.descriptionHtml, {
          imageAltFallback: product.name,
        })
      : null,
    shortDescriptionHtml: product.shortDescriptionHtml
      ? sanitizeProductHtml(product.shortDescriptionHtml, {
          imageAltFallback: product.name,
        })
      : null,
    reviews: reviewsByProduct.get(product.id) ?? [],
  }));
}

const readCatalogProductsCached = cache(
  async (userId: string, includeInactive: boolean) =>
    listCatalogProducts(userId, { includeInactive }),
);

const readCatalogSiteReviewsCached = cache(
  async (userId: string, websiteId: string) =>
    listApprovedSiteReviews({ userId, websiteId }),
);

const readCatalogBlogPostSummariesCached = cache(
  async (websiteId: string, preview: boolean) =>
    listPublicSiteBlogPostSummaries({ websiteId, preview }),
);

const readCatalogBlogPostDetailCached = cache(
  async (websiteId: string, slug: string, preview: boolean) =>
    getPublicSiteBlogPostBySlug({ websiteId, slug, preview }),
);

async function getCatalogDataForWebsite(
  website: WebsiteConfig,
  options?: { preview?: boolean },
) {
  const [settings, products, siteReviews, blogPosts] = await Promise.all([
    getSettings(website.userId),
    readCatalogProductsCached(website.userId, website.showInactiveProducts),
    readCatalogSiteReviewsCached(website.userId, website.id),
    readCatalogBlogPostSummariesCached(website.id, options?.preview === true),
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
    siteReviews,
    blogPosts,
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

async function getCurrentCatalogBlogPost(
  websiteId: string,
  path?: string | null,
  options?: { preview?: boolean },
) {
  const page = resolveCisecoPage(path);
  if (page.page !== "blog-detail" || !page.slug) {
    return null;
  }
  return readCatalogBlogPostDetailCached(
    websiteId,
    page.slug,
    options?.preview === true,
  );
}

async function buildCatalogPayloadFromWebsite(
  website: WebsiteConfig,
  options?: { path?: string | null; preview?: boolean },
) {
  const [
    { settings, products, featured, siteReviews, blogPosts },
    cmsPages,
    currentCmsPage,
    currentBlogPost,
  ] = await Promise.all([
    getCatalogDataForWebsite(website, { preview: options?.preview }),
    listCatalogWebsiteCmsPageLinks(website.id),
    getCurrentCatalogWebsiteCmsPage(website.id, options?.path),
    getCurrentCatalogBlogPost(website.id, options?.path, {
      preview: options?.preview,
    }),
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
      faviconUrl: normalizeWebsiteFaviconUrl(builderConfig.site?.faviconUrl),
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
    siteReviews,
    blogPosts,
    currentBlogPost,
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
    return buildCatalogPayloadFromWebsite(website, {
      path: normalizedPath,
      preview,
    });
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
    return buildCatalogPayloadFromWebsite(website, {
      path: normalizedPath,
      preview: false,
    });
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
      const escapedName = escapeEmailText(parsed.name);
      const escapedEmail = escapeEmailText(parsed.email);
      const escapedPhone = escapeEmailText(parsed.phone ?? "—");
      const escapedCompany = escapeEmailText(parsed.company ?? "—");
      const escapedNeeds = escapeEmailText(parsed.needs).replace(/\n/g, "<br />");
      const escapedSourceUrl = escapeEmailText(metadata.canonicalUrl);
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
        html: `<p><strong>Nom :</strong> ${escapedName}</p>
<p><strong>Email :</strong> ${escapedEmail}</p>
<p><strong>Téléphone :</strong> ${escapedPhone}</p>
<p><strong>Entreprise :</strong> ${escapedCompany}</p>
<p><strong>Besoin :</strong><br />${escapedNeeds}</p>
<p style="font-size:12px;color:#64748b;">Source : ${escapedSourceUrl}</p>`,
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
      const activeCustomDomainUrl = buildActiveCustomDomainUrl({
        customDomain: website.customDomain,
        domainStatus: website.domainStatus,
      });
      const edgeDomain = getCatalogEdgeDomain();
      const builderConfig = resolveBuilderConfigFromWebsite(website);
      const builderHistory = resolveBuilderHistoryFromWebsite(website);
      const ecommerceSettings = resolveEcommerceSettingsFromWebsite(website);
      const cmsPages = await listWebsiteCmsPages(resolvedUserId);
      return {
        website: {
          ...website,
          faviconUrl: normalizeWebsiteFaviconUrl(builderConfig.site?.faviconUrl),
          ecommerceSettings,
          cmsPages,
        },
        company: settings,
        links: {
          slugPreviewUrl,
          previewUrl,
          activeCustomDomainUrl,
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
