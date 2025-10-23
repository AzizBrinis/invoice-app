"use server";

import { revalidatePath } from "next/cache";
import { settingsSchema, updateSettings } from "@/server/settings";

function parseSettingsForm(formData: FormData) {
  const data = {
    companyName: formData.get("companyName")?.toString() ?? "",
    logoUrl: formData.get("logoUrl")?.toString() || null,
    siren: formData.get("siren")?.toString() || null,
    tvaNumber: formData.get("tvaNumber")?.toString() || null,
    address: formData.get("address")?.toString() || null,
    email: formData.get("email")?.toString() || null,
    phone: formData.get("phone")?.toString() || null,
    iban: formData.get("iban")?.toString() || null,
    defaultCurrency: formData.get("defaultCurrency")?.toString() ?? "EUR",
    defaultVatRate: Number(formData.get("defaultVatRate") ?? 20),
    paymentTerms: formData.get("paymentTerms")?.toString() || null,
    invoiceNumberPrefix: formData.get("invoiceNumberPrefix")?.toString() ?? "FAC",
    quoteNumberPrefix: formData.get("quoteNumberPrefix")?.toString() ?? "DEV",
    resetNumberingAnnually:
      (formData.get("resetNumberingAnnually")?.toString() ?? "on") === "on",
    defaultInvoiceFooter: formData.get("defaultInvoiceFooter")?.toString() || null,
    defaultQuoteFooter: formData.get("defaultQuoteFooter")?.toString() || null,
    legalFooter: formData.get("legalFooter")?.toString() || null,
    defaultConditions: formData.get("defaultConditions")?.toString() || null,
    invoiceTemplateId: formData.get("invoiceTemplateId")?.toString() || null,
    quoteTemplateId: formData.get("quoteTemplateId")?.toString() || null,
  } satisfies Record<string, unknown>;

  return settingsSchema.parse(data);
}

export async function updateSettingsAction(formData: FormData) {
  const parsed = parseSettingsForm(formData);
  await updateSettings(parsed);
  revalidatePath("/parametres");
}
