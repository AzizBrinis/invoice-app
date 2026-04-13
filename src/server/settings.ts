import { prisma } from "@/lib/db";
import { z } from "zod";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { requireUser } from "@/lib/auth";
import { refreshTagForMutation } from "@/lib/cache-invalidation";
import { Prisma } from "@/lib/db/prisma-server";
import {
  DEFAULT_CLIENT_PAYMENT_METHODS,
  normalizeClientPaymentMethods,
} from "@/lib/client-payment-methods";
import {
  CURRENCY_CODES,
  getDefaultCurrencyCode,
} from "@/lib/currency";
import {
  DEFAULT_TAX_CONFIGURATION,
  normalizeTaxConfiguration,
  TAX_ORDER_ITEMS,
} from "@/lib/taxes";

const roundingModeSchema = z.enum(["nearest-cent", "up", "down"]);

const taxRateSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  rate: z.number(),
});

const taxConfigurationSchema = z.object({
  tva: z
    .object({
      rates: z.array(taxRateSchema).min(1),
      applyMode: z.enum(["line", "document"]).default("line"),
      allowExemption: z.boolean().default(true),
    })
    .default(DEFAULT_TAX_CONFIGURATION.tva),
  fodec: z
    .object({
      enabled: z.boolean().default(true),
      autoApply: z.boolean().default(false),
      rate: z.number().min(0).default(DEFAULT_TAX_CONFIGURATION.fodec.rate),
      application: z.enum(["line", "document"]).default("line"),
      calculationOrder: z
        .enum(["BEFORE_TVA", "AFTER_TVA"])
        .default("BEFORE_TVA"),
    })
    .default(DEFAULT_TAX_CONFIGURATION.fodec),
  timbre: z
    .object({
      enabled: z.boolean().default(false),
      amountCents: z.number().int().nonnegative().default(0),
      autoApply: z.boolean().default(true),
    })
    .default(DEFAULT_TAX_CONFIGURATION.timbre),
  order: z
    .array(z.enum(TAX_ORDER_ITEMS))
    .min(1)
    .default(DEFAULT_TAX_CONFIGURATION.order),
  rounding: z
    .object({
      line: roundingModeSchema.default("nearest-cent"),
      total: roundingModeSchema.default("nearest-cent"),
    })
    .default(DEFAULT_TAX_CONFIGURATION.rounding),
});

const imagePositionSchema = z.enum([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);
const clientPaymentMethodsSchema = z
  .array(z.string().trim().min(1).max(80))
  .min(1, "Ajoutez au moins un mode de paiement.");
const isTestEnv = process.env.NODE_ENV === "test";
const SETTINGS_CACHE_REVALIDATE_SECONDS = 60;
const MAX_INLINE_IMAGE_DATA_URL_LENGTH = 1_000_000;

export const settingsSchema = z.object({
  companyName: z.string().min(2, "Nom obligatoire"),
  logoUrl: z.string().url("URL invalide").nullable().optional(),
  logoData: z
    .string()
    .max(
      MAX_INLINE_IMAGE_DATA_URL_LENGTH,
      "Le logo est trop volumineux pour un stockage inline.",
    )
    .nullable()
    .optional(),
  matriculeFiscal: z
    .string()
    .min(3, "Matricule fiscal invalide")
    .nullable()
    .optional(),
  tvaNumber: z
    .string()
    .min(3, "Numéro de TVA invalide")
    .nullable()
    .optional(),
  address: z.string().min(5, "Adresse obligatoire").nullable().optional(),
  email: z.string().email("E-mail invalide").nullable().optional(),
  phone: z.string().min(5, "Téléphone invalide").nullable().optional(),
  iban: z.string().min(10, "IBAN invalide").nullable().optional(),
  stampImage: z
    .string()
    .max(
      MAX_INLINE_IMAGE_DATA_URL_LENGTH,
      "Le cachet est trop volumineux pour un stockage inline.",
    )
    .nullable()
    .optional(),
  signatureImage: z
    .string()
    .max(
      MAX_INLINE_IMAGE_DATA_URL_LENGTH,
      "La signature est trop volumineuse pour un stockage inline.",
    )
    .nullable()
    .optional(),
  stampPosition: imagePositionSchema.default("bottom-right"),
  signaturePosition: imagePositionSchema.default("bottom-right"),
  defaultCurrency: z.enum(CURRENCY_CODES).default(getDefaultCurrencyCode()),
  defaultVatRate: z
    .number({
      error: "Taux de TVA invalide",
    })
    .min(0, "Taux de TVA invalide")
    .max(100, "Taux de TVA invalide"),
  paymentTerms: z.string().nullable().optional(),
  clientPaymentMethods: clientPaymentMethodsSchema,
  invoiceNumberPrefix: z.string().min(2).default("FAC"),
  quoteNumberPrefix: z.string().min(2).default("DEV"),
  resetNumberingAnnually: z.boolean().default(true),
  defaultInvoiceFooter: z.string().nullable().optional(),
  defaultQuoteFooter: z.string().nullable().optional(),
  legalFooter: z.string().nullable().optional(),
  defaultConditions: z.string().nullable().optional(),
  invoiceTemplateId: z.string().nullable().optional(),
  quoteTemplateId: z.string().nullable().optional(),
  taxConfiguration: taxConfigurationSchema.optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

const settingsInclude = {
  invoiceTemplate: true,
  quoteTemplate: true,
} as const;

const settingsSummarySelect = Prisma.validator<Prisma.CompanySettingsSelect>()({
  companyName: true,
  defaultCurrency: true,
  clientPaymentMethods: true,
});

const settingsDocumentDefaultsSelect =
  Prisma.validator<Prisma.CompanySettingsSelect>()({
    defaultCurrency: true,
    invoiceNumberPrefix: true,
    quoteNumberPrefix: true,
    resetNumberingAnnually: true,
    taxConfiguration: true,
  });

export const settingsTag = (tenantId: string) => `settings:${tenantId}`;

export function revalidateSettings(tenantId: string) {
  if (isTestEnv) {
    return;
  }

  refreshTagForMutation(settingsTag(tenantId));
}

type SettingsDatabaseClient = Pick<typeof prisma, "companySettings">;

async function fetchSettings(
  userId: string,
  db: SettingsDatabaseClient = prisma,
) {
  return db.companySettings.findUnique({
    where: { userId },
    include: settingsInclude,
  });
}

async function fetchSettingsSummary(
  userId: string,
  db: SettingsDatabaseClient = prisma,
) {
  return db.companySettings.findUnique({
    where: { userId },
    select: settingsSummarySelect,
  });
}

async function fetchSettingsDocumentDefaults(
  userId: string,
  db: SettingsDatabaseClient = prisma,
) {
  return db.companySettings.findUnique({
    where: { userId },
    select: settingsDocumentDefaultsSelect,
  });
}

function normalizeSettings<
  T extends {
    clientPaymentMethods?: unknown;
    taxConfiguration?: unknown;
  },
>(
  settings: T,
) {
  const normalizedTaxConfig = normalizeTaxConfiguration(
    (settings as { taxConfiguration?: unknown }).taxConfiguration,
  );
  const normalizedPaymentMethods = normalizeClientPaymentMethods(
    (settings as { clientPaymentMethods?: unknown }).clientPaymentMethods,
  );

  return {
    ...settings,
    clientPaymentMethods: normalizedPaymentMethods,
    taxConfiguration: normalizedTaxConfig,
  };
}

async function resolveUserId(userId?: string) {
  if (userId) {
    return userId;
  }
  const user = await requireUser();
  return user.id;
}

async function readOrInitializeSettings(
  resolvedUserId: string,
  db: SettingsDatabaseClient = prisma,
) {
  return readOrInitializeSettingsWithFetcher(
    resolvedUserId,
    fetchSettings,
    db,
  );
}

async function readOrInitializeSettingsWithFetcher<
  T extends {
    clientPaymentMethods?: unknown;
    taxConfiguration?: unknown;
  },
>(
  resolvedUserId: string,
  fetcher: (
    userId: string,
    db: SettingsDatabaseClient,
  ) => Promise<T | null>,
  db: SettingsDatabaseClient = prisma,
) {
  const settings = await fetcher(resolvedUserId, db);

  if (settings) {
    return normalizeSettings(settings);
  }

  await db.companySettings.createMany({
    data: {
      userId: resolvedUserId,
      companyName: "Nouvelle société",
      logoData: null,
      matriculeFiscal: null,
      defaultCurrency: "TND",
      defaultVatRate: 20,
      clientPaymentMethods: DEFAULT_CLIENT_PAYMENT_METHODS,
      invoiceNumberPrefix: "FAC",
      quoteNumberPrefix: "DEV",
      taxConfiguration: DEFAULT_TAX_CONFIGURATION,
      stampImage: null,
      signatureImage: null,
      stampPosition: "bottom-right",
      signaturePosition: "bottom-right",
    },
    skipDuplicates: true,
  });

  const ensuredSettings = await fetcher(resolvedUserId, db);
  if (!ensuredSettings) {
    throw new Error("Unable to initialize default company settings.");
  }

  return normalizeSettings(ensuredSettings);
}

const readSettingsByUserId = cache(async (resolvedUserId: string) => {
  if (isTestEnv) {
    return readOrInitializeSettings(resolvedUserId);
  }

  const cached = unstable_cache(
    () => readOrInitializeSettings(resolvedUserId),
    ["settings", resolvedUserId],
    {
      revalidate: SETTINGS_CACHE_REVALIDATE_SECONDS,
      tags: [settingsTag(resolvedUserId)],
    },
  );

  return cached();
});

const readSettingsSummaryByUserId = cache(async (resolvedUserId: string) => {
  if (isTestEnv) {
    return readOrInitializeSettingsWithFetcher(
      resolvedUserId,
      fetchSettingsSummary,
    );
  }

  const cached = unstable_cache(
    () =>
      readOrInitializeSettingsWithFetcher(
        resolvedUserId,
        fetchSettingsSummary,
      ),
    ["settings", "summary", resolvedUserId],
    {
      revalidate: SETTINGS_CACHE_REVALIDATE_SECONDS,
      tags: [settingsTag(resolvedUserId)],
    },
  );

  return cached();
});

const readSettingsDocumentDefaultsByUserId = cache(
  async (resolvedUserId: string) => {
    if (isTestEnv) {
      return readOrInitializeSettingsWithFetcher(
        resolvedUserId,
        fetchSettingsDocumentDefaults,
      );
    }

    const cached = unstable_cache(
      () =>
        readOrInitializeSettingsWithFetcher(
          resolvedUserId,
          fetchSettingsDocumentDefaults,
        ),
      ["settings", "documents", resolvedUserId],
      {
        revalidate: SETTINGS_CACHE_REVALIDATE_SECONDS,
        tags: [settingsTag(resolvedUserId)],
      },
    );

    return cached();
  },
);

export async function getSettings(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  return readSettingsByUserId(resolvedUserId);
}

export async function getSettingsSummary(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  return readSettingsSummaryByUserId(resolvedUserId);
}

export async function getSettingsDocumentDefaults(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  return readSettingsDocumentDefaultsByUserId(resolvedUserId);
}

export async function getSettingsWithDatabaseClient(
  userId: string,
  db: SettingsDatabaseClient,
) {
  return readOrInitializeSettings(userId, db);
}

export async function updateSettings(input: SettingsInput, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const parsed = settingsSchema.parse(input);
  const { clientPaymentMethods, taxConfiguration, ...rest } = parsed;
  const normalizedTaxConfig = normalizeTaxConfiguration(taxConfiguration);
  const normalizedPaymentMethods = normalizeClientPaymentMethods(
    clientPaymentMethods,
    {
      fallbackToDefaults: false,
    },
  );

  const settings = await prisma.companySettings.upsert({
    where: { userId: resolvedUserId },
    update: {
      ...rest,
      clientPaymentMethods: normalizedPaymentMethods,
      taxConfiguration: normalizedTaxConfig,
    },
    create: {
      userId: resolvedUserId,
      ...rest,
      clientPaymentMethods: normalizedPaymentMethods,
      taxConfiguration: normalizedTaxConfig,
    },
    include: settingsInclude,
  });

  return normalizeSettings(settings);
}
