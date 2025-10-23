import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const settingsSchema = z.object({
  companyName: z.string().min(2, "Nom obligatoire"),
  logoUrl: z.string().url("URL invalide").nullable().optional(),
  siren: z.string().min(3, "SIREN invalide").nullable().optional(),
  tvaNumber: z
    .string()
    .min(3, "Numéro de TVA invalide")
    .nullable()
    .optional(),
  address: z.string().min(5, "Adresse obligatoire").nullable().optional(),
  email: z.string().email("E-mail invalide").nullable().optional(),
  phone: z.string().min(5, "Téléphone invalide").nullable().optional(),
  iban: z.string().min(10, "IBAN invalide").nullable().optional(),
  defaultCurrency: z.string().min(3, "Devise requise"),
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
    return settings;
  }

  return prisma.companySettings.create({
    data: {
      id: 1,
      companyName: "Nouvelle société",
      defaultCurrency: "EUR",
      defaultVatRate: 20,
      invoiceNumberPrefix: "FAC",
      quoteNumberPrefix: "DEV",
    },
    include: {
      invoiceTemplate: true,
      quoteTemplate: true,
    },
  });
}

export async function updateSettings(input: SettingsInput) {
  const parsed = settingsSchema.parse(input);

  const settings = await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {
      ...parsed,
    },
    create: {
      id: 1,
      ...parsed,
    },
    include: {
      invoiceTemplate: true,
      quoteTemplate: true,
    },
  });

  return settings;
}
