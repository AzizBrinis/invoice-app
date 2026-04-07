import { ZodError } from "zod";

type ProductFormFieldErrors = Partial<Record<string, string>>;

export function buildProductFormValidationState(error: ZodError): {
  message: string;
  fieldErrors: ProductFormFieldErrors;
} {
  const flat = error.flatten();
  const rawFieldErrors = flat.fieldErrors as Record<string, string[] | undefined>;
  const pick = (key: string) => rawFieldErrors[key]?.[0];
  const firstFieldError = Object.values(rawFieldErrors)
    .flat()
    .find((message): message is string => Boolean(message));

  return {
    message:
      flat.formErrors[0] ??
      firstFieldError ??
      "Certains champs sont invalides.",
    fieldErrors: {
      sku: pick("sku"),
      name: pick("name"),
      publicSlug: pick("publicSlug"),
      saleMode: pick("saleMode"),
      excerpt: pick("excerpt"),
      descriptionHtml: pick("descriptionHtml"),
      shortDescriptionHtml: pick("shortDescriptionHtml"),
      metaTitle: pick("metaTitle"),
      metaDescription: pick("metaDescription"),
      coverImageUrl: pick("coverImageUrl"),
      gallery: pick("gallery"),
      faqItems: pick("faqItems"),
      quoteFormSchema: pick("quoteFormSchema"),
      optionConfig: pick("optionConfig"),
      variantStock: pick("variantStock"),
      unit: pick("unit"),
      stockQuantity: pick("stockQuantity"),
      priceHTCents: pick("priceHTCents"),
      vatRate: pick("vatRate"),
      defaultDiscount:
        pick("defaultDiscountRate") ??
        pick("defaultDiscountAmountCents"),
    },
  };
}
