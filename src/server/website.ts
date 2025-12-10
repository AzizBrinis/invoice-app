import { unstable_cache } from "next/cache";
import { z } from "zod";
import {
  Prisma,
  ClientSource,
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
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";
import {
  applyThemeFallbacks,
  builderConfigSchema,
  builderVersionHistorySchema,
  createDefaultBuilderConfig,
  createSectionTemplate,
  type BuilderSectionType,
  type WebsiteBuilderConfig,
  type WebsiteBuilderVersionEntry,
} from "@/lib/website/builder";
import { generateId } from "@/lib/id";
import { revalidateClientFilters } from "@/server/clients";
import { revalidateQuoteFilterClients } from "@/server/quotes";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexColorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const relativeOrAbsoluteUrl = /^(?:https?:\/\/|\/)/i;
const domainHostnamePattern = /^[a-z0-9.-]+$/i;
const WEBSITE_ADMIN_CACHE_REVALIDATE_SECONDS = 15;
const CATALOG_PAYLOAD_REVALIDATE_SECONDS = 30;
const WEBSITE_PRODUCT_STATS_CACHE_SECONDS = 30;
const WEBSITE_PRODUCT_LIST_DEFAULT_PAGE_SIZE = 40;
const WEBSITE_PRODUCT_LIST_MAX_PAGE_SIZE = 80;

const slugSchema = z
  .string()
  .min(3, "Le slug doit contenir au moins 3 caractères.")
  .max(64, "Le slug doit contenir au maximum 64 caractères.")
  .regex(slugPattern, "Utilisez uniquement des lettres minuscules, chiffres et tirets.");

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

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  priceHTCents: number;
  priceTTCCents: number;
  vatRate: number;
  sku: string;
  isActive: boolean;
};

export type CatalogWebsiteMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  socialImageUrl: string | null;
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
  leadThanksMessage: string | null;
  spamProtectionEnabled: boolean;
  published: boolean;
  domainStatus: WebsiteDomainStatus;
  customDomain: string | null;
  currencyCode: string;
  contact: {
    companyName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    logoData: string | null;
  };
  metadata: CatalogWebsiteMetadata;
  builder: WebsiteBuilderConfig;
};

export type CatalogPayload = {
  website: CatalogWebsiteSummary;
  products: {
    featured: CatalogProduct[];
    all: CatalogProduct[];
  };
};

export type WebsiteBuilderState = {
  config: WebsiteBuilderConfig;
  history: WebsiteBuilderVersionEntry[];
};

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

async function resolveUserId(userId?: string) {
  if (userId) {
    return userId;
  }
  const user = await requireUser();
  return user.id;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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

  return prisma.websiteConfig.update({
    where: { id: currentConfig.id },
    data: payload,
  });
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
  const baseUrl = getAppBaseUrl();
  const pathSegment =
    options.path && options.path !== "/" ? options.path : "";
  const canonicalUrl = options.website.customDomain &&
    options.website.domainStatus === WebsiteDomainStatus.ACTIVE
    ? `https://${options.website.customDomain}${pathSegment}`
    : `${baseUrl}/catalogue/${options.website.slug}${pathSegment}`;

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
  } satisfies CatalogWebsiteMetadata;
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
  });
  return products as CatalogProduct[];
}

function catalogDataCacheKey(website: WebsiteConfig) {
  return [
    "catalog-data",
    website.id,
    website.updatedAt?.toISOString() ?? "0",
    website.showInactiveProducts ? "with-inactive" : "active",
  ];
}

function getCatalogDataForWebsite(website: WebsiteConfig) {
  const cached = unstable_cache(
    async () => {
      const [settings, products] = await Promise.all([
        getSettings(website.userId),
        listCatalogProducts(website.userId, {
          includeInactive: website.showInactiveProducts,
        }),
      ]);
      const featuredIds = (website.featuredProductIds as string[] | null) ?? [];
      const featured = pickFeaturedProducts(products, featuredIds);
      return {
        settings,
        products,
        featured,
      };
    },
    catalogDataCacheKey(website),
    {
      revalidate: CATALOG_PAYLOAD_REVALIDATE_SECONDS,
    },
  );
  return cached();
}

async function buildCatalogPayloadFromWebsite(
  website: WebsiteConfig,
  options?: { path?: string | null },
) {
  const { settings, products, featured } = await getCatalogDataForWebsite(website);
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
      leadThanksMessage: website.leadThanksMessage,
      spamProtectionEnabled: website.spamProtectionEnabled,
      published: website.published,
      domainStatus: website.domainStatus,
      customDomain: website.customDomain,
      currencyCode: settings.defaultCurrency,
      contact: {
        companyName: settings.companyName,
        email: website.contactEmailOverride ?? settings.email,
        phone: website.contactPhoneOverride ?? settings.phone,
        address: website.contactAddressOverride ?? settings.address,
        logoUrl: settings.logoUrl,
        logoData: settings.logoData,
      },
      metadata,
      builder: builderConfig,
    },
    products: {
      featured,
      all: products,
    },
  } satisfies CatalogPayload;
}

export async function getCatalogPayloadBySlug(
  slug: string,
  options?: { preview?: boolean; path?: string | null },
) {
  const website = await loadCatalogWebsite(
    { slug },
    { allowUnpublished: options?.preview },
  );
  if (!website) {
    return null;
  }
  return buildCatalogPayloadFromWebsite(website, { path: options?.path });
}

export async function getCatalogPayloadByDomain(domain: string, path?: string | null) {
  const normalized = normalizeDomain(domain);
  const website = await loadCatalogWebsite({ domain: normalized });
  if (!website) {
    return null;
  }
  return buildCatalogPayloadFromWebsite(website, { path });
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
  const parsed = builderConfigSchema.parse(input);
  const accent = parsed.theme?.accent ?? website.accentColor ?? "#2563eb";
  const normalizedNext = applyThemeFallbacks(parsed, accent);
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
  const identifier = input.domain
    ? ({ kind: "domain", domain: normalizeDomain(input.domain) } as const)
    : input.slug
      ? ({ kind: "slug", slug: input.slug } as const)
      : null;
  if (!identifier) {
    throw new Error("Site introuvable.");
  }
  const website = identifier.kind === "domain"
    ? await loadCatalogWebsite({ domain: identifier.domain })
    : await loadCatalogWebsite({ slug: identifier.slug });
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
  if (website.templateKey !== "ecommerce-luxe") {
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
  const parsed = builderConfigSchema.safeParse(
    website.builderConfig,
  );
  const base = parsed.success
    ? parsed.data
    : createDefaultBuilderConfig(
      buildDefaultBuilderOptions(website),
    );
  const withTemplateDefaults = ensureTemplateSections(base, website);
  return applyThemeFallbacks(withTemplateDefaults, website.accentColor);
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
      return {
        website,
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
    },
  );
  return cached();
}
