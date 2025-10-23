"use server";

import { revalidatePath } from "next/cache";
import { settingsSchema, updateSettings } from "@/server/settings";
import {
  DEFAULT_TAX_CONFIGURATION,
  normalizeTaxConfiguration,
  TAX_ORDER_ITEMS,
  RoundingMode,
} from "@/lib/taxes";
import { toCents } from "@/lib/money";

function parseSettingsForm(formData: FormData) {
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

  const data = {
    companyName: formData.get("companyName")?.toString() ?? "",
    logoUrl: formData.get("logoUrl")?.toString() || null,
    siren: formData.get("siren")?.toString() || null,
    tvaNumber: formData.get("tvaNumber")?.toString() || null,
    address: formData.get("address")?.toString() || null,
    email: formData.get("email")?.toString() || null,
    phone: formData.get("phone")?.toString() || null,
    iban: formData.get("iban")?.toString() || null,
    defaultCurrency:
      formData.get("defaultCurrency")?.toString().toUpperCase() ?? "TND",
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
          toCents(
            Number(formData.get("timbreAmount") ?? DEFAULT_TAX_CONFIGURATION.timbre.amountCents / 100),
          ) || 0,
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
  const parsed = parseSettingsForm(formData);
  await updateSettings(parsed);
  revalidatePath("/parametres");
}
