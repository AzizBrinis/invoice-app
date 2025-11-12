import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
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

export const settingsSchema = z.object({
  companyName: z.string().min(2, "Nom obligatoire"),
  logoUrl: z.string().url("URL invalide").nullable().optional(),
  logoData: z.string().nullable().optional(),
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
  stampImage: z.string().nullable().optional(),
  signatureImage: z.string().nullable().optional(),
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

const SETTINGS_CACHE_SECONDS = 60;
const settingsTag = (userId: string) => `settings:${userId}`;

const fetchSettings = cache(async (userId: string) =>
  prisma.companySettings.findUnique({
    where: { userId },
    include: settingsInclude,
  }),
);

function normalizeSettings<T extends { taxConfiguration?: unknown }>(
  settings: T,
) {
  const normalizedTaxConfig = normalizeTaxConfiguration(
    (settings as { taxConfiguration?: unknown }).taxConfiguration,
  );

  return {
    ...settings,
    taxConfiguration: normalizedTaxConfig,
  };
}

async function readCachedSettings(userId: string) {
  if (process.env.NODE_ENV === "test") {
    return fetchSettings(userId);
  }

  const cached = unstable_cache(
    () => fetchSettings(userId),
    ["settings", userId],
    {
      revalidate: SETTINGS_CACHE_SECONDS,
      tags: [settingsTag(userId)],
    },
  );

  return cached();
}

function revalidateSettings(userId: string) {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  revalidateTag(settingsTag(userId), "max");
}

async function resolveUserId(userId?: string) {
  if (userId) {
    return userId;
  }
  const user = await requireUser();
  return user.id;
}

export async function getSettings(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const settings = await readCachedSettings(resolvedUserId);

  if (settings) {
    return normalizeSettings(settings);
  }

  const created = await prisma.companySettings.upsert({
    where: { userId: resolvedUserId },
    create: {
      userId: resolvedUserId,
      companyName: "Nouvelle société",
      logoData: null,
      matriculeFiscal: null,
      defaultCurrency: "TND",
      defaultVatRate: 20,
      invoiceNumberPrefix: "FAC",
      quoteNumberPrefix: "DEV",
      taxConfiguration: DEFAULT_TAX_CONFIGURATION,
      stampImage: null,
      signatureImage: null,
      stampPosition: "bottom-right",
      signaturePosition: "bottom-right",
    },
    update: {},
    include: settingsInclude,
  });

  revalidateSettings(resolvedUserId);
  return normalizeSettings(created);
}

export async function updateSettings(input: SettingsInput, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const parsed = settingsSchema.parse(input);
  const { taxConfiguration, ...rest } = parsed;
  const normalizedTaxConfig = normalizeTaxConfiguration(taxConfiguration);

  const settings = await prisma.companySettings.upsert({
    where: { userId: resolvedUserId },
    update: {
      ...rest,
      taxConfiguration: normalizedTaxConfig,
    },
    create: {
      userId: resolvedUserId,
      ...rest,
      taxConfiguration: normalizedTaxConfig,
    },
    include: settingsInclude,
  });

  revalidateSettings(resolvedUserId);
  return settings;
}
