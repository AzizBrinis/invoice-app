"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  deleteWebsiteCmsPage,
  listWebsiteCmsPages,
  saveWebsiteContent,
  saveWebsiteCmsPage,
  saveWebsiteEcommerceSettings,
  getWebsiteEcommerceSettings,
  updateWebsitePublishing,
  requestCustomDomain,
  verifyCustomDomain,
  activateCustomDomain,
  disconnectCustomDomain,
} from "@/server/website";
import {
  type DomainFormState,
  type WebsiteCmsPageFormState,
  type WebsiteEcommerceFormState,
  type WebsiteContentFormState,
} from "@/app/(app)/site-web/form-state";
import {
  WEBSITE_TEMPLATE_KEY_VALUES,
  type WebsiteTemplateKey,
} from "@/lib/website/templates";
import { requireAppSectionAccess } from "@/lib/authorization";

function booleanFromForm(
  entry: FormDataEntryValue | null,
  fallback = false,
) {
  if (entry == null) return fallback;
  const value = entry.toString().toLowerCase();
  return value === "true" || value === "on" || value === "1";
}

function cleanNullable(value: FormDataEntryValue | null) {
  if (value == null) return null;
  const trimmed = value.toString().trim();
  return trimmed.length ? trimmed : null;
}

function cleanString(value: FormDataEntryValue | null) {
  if (value == null) return "";
  return value.toString().trim();
}

function parseIdList(value: FormDataEntryValue | null) {
  if (!value) {
    return [];
  }
  return value
    .toString()
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveTemplateKey(
  entry: FormDataEntryValue | null,
): WebsiteTemplateKey {
  const candidate = entry?.toString();
  const match = WEBSITE_TEMPLATE_KEY_VALUES.find(
    (value) => value === candidate,
  );
  return match ?? "dev-agency";
}

async function requireWebsiteAccess() {
  await requireAppSectionAccess("website");
}

export async function saveWebsiteContentAction(
  _prevState: WebsiteContentFormState,
  formData: FormData,
): Promise<WebsiteContentFormState> {
  try {
    await requireWebsiteAccess();
    await saveWebsiteContent({
      slug: formData.get("slug")?.toString(),
      heroEyebrow: cleanNullable(formData.get("heroEyebrow")),
      heroTitle: formData.get("heroTitle")?.toString() ?? "",
      heroSubtitle: cleanNullable(formData.get("heroSubtitle")),
      heroPrimaryCtaLabel:
        formData.get("heroPrimaryCtaLabel")?.toString() ?? "",
      heroSecondaryCtaLabel: cleanNullable(
        formData.get("heroSecondaryCtaLabel"),
      ),
      heroSecondaryCtaUrl: cleanNullable(formData.get("heroSecondaryCtaUrl")),
      aboutTitle: cleanNullable(formData.get("aboutTitle")),
      aboutBody: cleanNullable(formData.get("aboutBody")),
      contactBlurb: cleanNullable(formData.get("contactBlurb")),
      contactEmailOverride: cleanNullable(formData.get("contactEmailOverride")),
      contactPhoneOverride: cleanNullable(formData.get("contactPhoneOverride")),
      contactAddressOverride: cleanNullable(
        formData.get("contactAddressOverride"),
      ),
      seoTitle: cleanNullable(formData.get("seoTitle")),
      seoDescription: cleanNullable(formData.get("seoDescription")),
      seoKeywords: cleanNullable(formData.get("seoKeywords")),
      socialImageUrl: cleanNullable(formData.get("socialImageUrl")),
      theme: (formData.get("theme")?.toString() ??
        "SYSTEM") as "SYSTEM" | "LIGHT" | "DARK",
      templateKey: resolveTemplateKey(formData.get("templateKey")),
      accentColor: formData.get("accentColor")?.toString() ?? "#2563eb",
      showPrices: booleanFromForm(formData.get("showPrices"), true),
      showInactiveProducts: booleanFromForm(
        formData.get("showInactiveProducts"),
        false,
      ),
      leadNotificationEmail: cleanNullable(
        formData.get("leadNotificationEmail"),
      ),
      leadAutoTag: cleanNullable(formData.get("leadAutoTag")),
      leadThanksMessage: cleanNullable(formData.get("leadThanksMessage")),
      spamProtectionEnabled: booleanFromForm(
        formData.get("spamProtectionEnabled"),
        true,
      ),
    });
    revalidatePath("/site-web");
    revalidatePath("/preview");
    revalidatePath("/catalogue");
    return {
      status: "success",
      message: "Site mis à jour.",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      const fieldErrors: Record<string, string | undefined> = {};
      (
        Object.entries(flattened.fieldErrors) as Array<
          [string, string[] | undefined]
        >
      ).forEach(([key, value]) => {
        if (value?.[0]) {
          fieldErrors[key] = value[0];
        }
      });
      return {
        status: "error",
        message:
          error.issues[0]?.message ??
          "Impossible d’enregistrer : certains champs sont invalides.",
        fieldErrors,
      };
    }
    console.error("[saveWebsiteContentAction] Échec", error);
    return {
      status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d’enregistrer votre site.",
    };
  }
}

export async function saveWebsiteCmsPageAction(
  _prevState: WebsiteCmsPageFormState,
  formData: FormData,
): Promise<WebsiteCmsPageFormState> {
  try {
    await requireWebsiteAccess();
    const pageId = cleanNullable(formData.get("id"));
    const savedPage = await saveWebsiteCmsPage({
      id: pageId,
      title: formData.get("title")?.toString() ?? "",
      path: formData.get("path")?.toString() ?? "",
      content: formData.get("content")?.toString() ?? "",
      showInFooter: booleanFromForm(formData.get("showInFooter"), false),
    });
    const pages = await listWebsiteCmsPages();
    revalidatePath("/site-web");
    revalidatePath("/preview");
    revalidatePath("/catalogue");
    revalidatePath("/catalogue/[...segments]", "page");
    return {
      status: "success",
      message: pageId
        ? "Page CMS mise à jour."
        : "Page CMS créée.",
      pages,
      savedPageId: savedPage.id,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      const fieldErrors: Record<string, string | undefined> = {};
      (
        Object.entries(flattened.fieldErrors) as Array<
          [string, string[] | undefined]
        >
      ).forEach(([key, value]) => {
        if (value?.[0]) {
          fieldErrors[key] = value[0];
        }
      });
      return {
        status: "error",
        message:
          error.issues[0]?.message ??
          "Impossible d’enregistrer : certains champs sont invalides.",
        fieldErrors,
      };
    }
    console.error("[saveWebsiteCmsPageAction] Échec", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer la page CMS.",
    };
  }
}

export async function deleteWebsiteCmsPageAction(
  id: string,
): Promise<WebsiteCmsPageFormState> {
  try {
    await requireWebsiteAccess();
    await deleteWebsiteCmsPage(id);
    const pages = await listWebsiteCmsPages();
    revalidatePath("/site-web");
    revalidatePath("/preview");
    revalidatePath("/catalogue");
    revalidatePath("/catalogue/[...segments]", "page");
    return {
      status: "success",
      message: "Page CMS supprimée.",
      pages,
      savedPageId: null,
    };
  } catch (error) {
    console.error("[deleteWebsiteCmsPageAction] Échec", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la page CMS.",
    };
  }
}

export async function saveWebsiteEcommerceSettingsAction(
  _prevState: WebsiteEcommerceFormState,
  formData: FormData,
): Promise<WebsiteEcommerceFormState> {
  try {
    await requireWebsiteAccess();
    const current = await getWebsiteEcommerceSettings(undefined, {
      includeSecrets: true,
    });
    await saveWebsiteEcommerceSettings({
      ...current,
      payments: {
        methods: {
          card: booleanFromForm(formData.get("paymentMethodCard"), false),
          bankTransfer: booleanFromForm(
            formData.get("paymentMethodBankTransfer"),
            false,
          ),
          cashOnDelivery: booleanFromForm(
            formData.get("paymentMethodCashOnDelivery"),
            false,
          ),
        },
        bankTransfer: {
          instructions: cleanString(
            formData.get("bankTransferInstructions"),
          ),
        },
      },
      checkout: {
        requirePhone: booleanFromForm(
          formData.get("checkoutRequirePhone"),
          false,
        ),
        allowNotes: booleanFromForm(formData.get("checkoutAllowNotes"), true),
        termsUrl: cleanString(formData.get("checkoutTermsUrl")),
      },
      featuredProductIds: parseIdList(
        formData.get("featuredProductIds"),
      ),
    });
    revalidatePath("/site-web");
    revalidatePath("/preview");
    revalidatePath("/catalogue");
    return {
      status: "success",
      message: "Paramètres e-commerce mis à jour.",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string | undefined> = {};
      const fieldMap: Record<string, string> = {
        "payments.methods.card": "paymentMethodCard",
        "payments.methods.bankTransfer": "paymentMethodBankTransfer",
        "payments.methods.cashOnDelivery": "paymentMethodCashOnDelivery",
        "payments.bankTransfer.instructions": "bankTransferInstructions",
        "checkout.requirePhone": "checkoutRequirePhone",
        "checkout.allowNotes": "checkoutAllowNotes",
        "checkout.termsUrl": "checkoutTermsUrl",
        featuredProductIds: "featuredProductIds",
      };
      error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        const mapped =
          fieldMap[path] ??
          (path.startsWith("featuredProductIds")
            ? fieldMap.featuredProductIds
            : undefined);
        if (mapped && !fieldErrors[mapped]) {
          fieldErrors[mapped] = issue.message;
        }
      });
      return {
        status: "error",
        message:
          error.issues[0]?.message ??
          "Impossible d’enregistrer : certains champs sont invalides.",
        fieldErrors,
      };
    }
    console.error("[saveWebsiteEcommerceSettingsAction] Échec", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer les paramètres e-commerce.",
    };
  }
}

export async function updateWebsitePublishingAction(
  formData: FormData,
) {
  await requireWebsiteAccess();
  const published = booleanFromForm(formData.get("published"), false);
  await updateWebsitePublishing({ published });
  revalidatePath("/site-web");
  revalidatePath("/catalogue");
  revalidatePath("/preview");
}

export async function requestCustomDomainAction(
  _prev: DomainFormState,
  formData: FormData,
): Promise<DomainFormState> {
  try {
    await requireWebsiteAccess();
    const domain = formData.get("customDomain")?.toString() ?? "";
    await requestCustomDomain({ customDomain: domain });
    revalidatePath("/site-web");
    revalidatePath("/catalogue");
    return {
      status: "success",
      message: "Domaine enregistré. Ajoutez le CNAME puis lancez la vérification.",
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        message:
          error.issues[0]?.message ?? "Le domaine indiqué est invalide.",
      };
    }
    return {
      status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d’enregistrer le domaine.",
    };
  }
}

async function runDomainAction(
  action: () => Promise<unknown>,
  successMessage: string,
): Promise<DomainFormState> {
  try {
    await requireWebsiteAccess();
    await action();
    revalidatePath("/site-web");
    revalidatePath("/catalogue");
    return {
      status: "success",
      message: successMessage,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Action domaine impossible pour le moment.",
    };
  }
}

export async function verifyDomainAction() {
  return runDomainAction(verifyCustomDomain, "Domaine vérifié.");
}

export async function activateDomainAction() {
  return runDomainAction(activateCustomDomain, "Domaine activé.");
}

export async function disconnectDomainAction() {
  return runDomainAction(
    disconnectCustomDomain,
    "Domaine déconnecté et site dépublié.",
  );
}
