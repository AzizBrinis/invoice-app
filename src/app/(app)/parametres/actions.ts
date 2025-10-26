"use server";

import { revalidatePath } from "next/cache";
import type { CompanySettings } from "@prisma/client";
import { settingsSchema, updateSettings } from "@/server/settings";
import {
  DEFAULT_TAX_CONFIGURATION,
  normalizeTaxConfiguration,
  TAX_ORDER_ITEMS,
  RoundingMode,
} from "@/lib/taxes";
import { fromCents, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const IMAGE_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

type ImagePosition = (typeof IMAGE_POSITIONS)[number];

const isImagePosition = (value: string | undefined | null): value is ImagePosition =>
  !!value && IMAGE_POSITIONS.includes(value as ImagePosition);

async function fileToDataUrl(entry: FormDataEntryValue | null): Promise<string | null> {
  if (!entry || !(entry instanceof File) || entry.size === 0) {
    return null;
  }
  const arrayBuffer = await entry.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = entry.type || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function parseSettingsForm(
  formData: FormData,
  currentSettings: CompanySettings | null,
) {
  const tvaRatesRaw = formData.get("tvaRatesJson")?.toString().trim();
  let tvaRates = DEFAULT_TAX_CONFIGURATION.tva.rates;
  if (tvaRatesRaw && tvaRatesRaw.length > 0) {
    try {
      const parsed = JSON.parse(tvaRatesRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        tvaRates = parsed.map((item) => ({
          code: typeof item.code === "string" ? item.code : `T${item.rate}`,
          label: typeof item.label === "string" ? item.label : `TVA ${item.rate}%`,
          rate:
            typeof item.rate === "number"
              ? item.rate
              : Number(item.rate ?? 0),
        }));
      }
    } catch (error) {
      console.warn("Impossible de parser les taux de TVA", error);
    }
  }

  const taxOrderSelections = [
    formData.get("taxOrder1")?.toString(),
    formData.get("taxOrder2")?.toString(),
    formData.get("taxOrder3")?.toString(),
  ];
  const seenOrder = new Set<string>();
  const taxOrder: string[] = [];
  taxOrderSelections.forEach((entry) => {
    if (entry && TAX_ORDER_ITEMS.includes(entry as (typeof TAX_ORDER_ITEMS)[number]) && !seenOrder.has(entry)) {
      seenOrder.add(entry);
      taxOrder.push(entry);
    }
  });
  TAX_ORDER_ITEMS.forEach((item) => {
    if (!seenOrder.has(item)) {
      seenOrder.add(item);
      taxOrder.push(item);
    }
  });

  const defaultCurrency =
    formData.get("defaultCurrency")?.toString().toUpperCase() ?? "TND";

  const timbreAmountInput = formData.get("timbreAmount");
  const timbreAmountValue =
    timbreAmountInput && timbreAmountInput.toString().length > 0
      ? Number(timbreAmountInput)
      : fromCents(DEFAULT_TAX_CONFIGURATION.timbre.amountCents, defaultCurrency);

  const logoClear = formData.get("logoClear")?.toString() === "on";
  const stampClear = formData.get("stampClear")?.toString() === "on";
  const signatureClear = formData.get("signatureClear")?.toString() === "on";

  const [logoFileData, stampFileData, signatureFileData] = await Promise.all([
    fileToDataUrl(formData.get("logoFile")),
    fileToDataUrl(formData.get("stampFile")),
    fileToDataUrl(formData.get("signatureFile")),
  ]);

  const resolvePosition = (
    raw: string | undefined,
    fallback: ImagePosition = "bottom-right",
  ): ImagePosition => {
    if (isImagePosition(raw)) {
      return raw;
    }
    if (isImagePosition(fallback)) {
      return fallback;
    }
    return "bottom-right";
  };

  const data = {
    companyName: formData.get("companyName")?.toString() ?? "",
    logoUrl: formData.get("logoUrl")?.toString() || null,
    logoData: logoClear
      ? null
      : logoFileData ?? currentSettings?.logoData ?? null,
    matriculeFiscal: formData.get("matriculeFiscal")?.toString() || null,
    tvaNumber: formData.get("tvaNumber")?.toString() || null,
    address: formData.get("address")?.toString() || null,
    email: formData.get("email")?.toString() || null,
    phone: formData.get("phone")?.toString() || null,
    iban: formData.get("iban")?.toString() || null,
    stampImage: stampClear
      ? null
      : stampFileData ?? currentSettings?.stampImage ?? null,
    signatureImage: signatureClear
      ? null
      : signatureFileData ?? currentSettings?.signatureImage ?? null,
    stampPosition: resolvePosition(
      formData.get("stampPosition")?.toString(),
      (currentSettings?.stampPosition as ImagePosition | undefined) ?? "bottom-right",
    ),
    signaturePosition: resolvePosition(
      formData.get("signaturePosition")?.toString(),
      (currentSettings?.signaturePosition as ImagePosition | undefined) ?? "bottom-right",
    ),
    defaultCurrency,
    defaultVatRate: Number(formData.get("defaultVatRate") ?? 20),
    paymentTerms: formData.get("paymentTerms")?.toString() || null,
    invoiceNumberPrefix: formData.get("invoiceNumberPrefix")?.toString() ?? "FAC",
    quoteNumberPrefix: formData.get("quoteNumberPrefix")?.toString() ?? "DEV",
    resetNumberingAnnually:
      formData.get("resetNumberingAnnually")?.toString() === "on",
    defaultInvoiceFooter: formData.get("defaultInvoiceFooter")?.toString() || null,
    defaultQuoteFooter: formData.get("defaultQuoteFooter")?.toString() || null,
    legalFooter: formData.get("legalFooter")?.toString() || null,
    defaultConditions: formData.get("defaultConditions")?.toString() || null,
    invoiceTemplateId: formData.get("invoiceTemplateId")?.toString() || null,
    quoteTemplateId: formData.get("quoteTemplateId")?.toString() || null,
    taxConfiguration: normalizeTaxConfiguration({
      tva: {
        rates: tvaRates,
        applyMode:
          formData.get("tvaApplyMode")?.toString() === "document"
            ? "document"
            : "line",
        allowExemption: formData.get("tvaAllowExemption")?.toString() === "on",
      },
      fodec: {
        enabled: formData.get("fodecEnabled")?.toString() === "on",
        autoApply: formData.get("fodecAutoApply")?.toString() === "on",
        rate: Number(formData.get("fodecRate") ?? DEFAULT_TAX_CONFIGURATION.fodec.rate) || 0,
        application:
          formData.get("fodecApplication")?.toString() === "document"
            ? "document"
            : "line",
        calculationOrder:
          formData.get("fodecOrder")?.toString() === "AFTER_TVA"
            ? "AFTER_TVA"
            : "BEFORE_TVA",
      },
      timbre: {
        enabled: formData.get("timbreEnabled")?.toString() === "on",
        amountCents:
          toCents(timbreAmountValue, defaultCurrency) || 0,
        autoApply: formData.get("timbreAutoApply")?.toString() === "on",
      },
      order: taxOrder,
      rounding: {
        line: (formData.get("roundingLine")?.toString() as RoundingMode) ?? DEFAULT_TAX_CONFIGURATION.rounding.line,
        total:
          (formData.get("roundingTotal")?.toString() as RoundingMode) ??
          DEFAULT_TAX_CONFIGURATION.rounding.total,
      },
    }),
  } satisfies Record<string, unknown>;

  return settingsSchema.parse(data);
}

export async function updateSettingsAction(formData: FormData) {
  const currentSettings = await prisma.companySettings.findUnique({
    where: { id: 1 },
  });
  const parsed = await parseSettingsForm(formData, currentSettings);
  await updateSettings(parsed);
  revalidatePath("/parametres");
}
