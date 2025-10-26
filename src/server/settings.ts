import { prisma } from "@/lib/prisma";
import { z } from "zod";
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
      invalid_type_error: "Taux de TVA invalide",
    })
    .min(0)
    .max(100),
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

export async function getSettings() {
  const settings = await prisma.companySettings.findUnique({
    where: { id: 1 },
    include: {
      invoiceTemplate: true,
      quoteTemplate: true,
    },
  });

  if (settings) {
    const normalizedTaxConfig = normalizeTaxConfiguration(
      (settings as { taxConfiguration?: unknown }).taxConfiguration,
    );

    return {
      ...settings,
      taxConfiguration: normalizedTaxConfig,
    };
  }

  return prisma.companySettings.create({
    data: {
      id: 1,
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
    include: {
      invoiceTemplate: true,
      quoteTemplate: true,
    },
  });
}

export async function updateSettings(input: SettingsInput) {
  const parsed = settingsSchema.parse(input);
  const { taxConfiguration, ...rest } = parsed;
  const normalizedTaxConfig = normalizeTaxConfiguration(taxConfiguration);

  const settings = await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {
      ...rest,
      taxConfiguration: normalizedTaxConfig,
    },
    create: {
      id: 1,
      ...rest,
      taxConfiguration: normalizedTaxConfig,
    },
    include: {
      invoiceTemplate: true,
      quoteTemplate: true,
    },
  });

  return settings;
}
