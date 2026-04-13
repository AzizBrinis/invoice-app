import { ZodError } from "zod";

type ProductFormFieldErrors = Partial<Record<string, string>>;

export function buildProductFormValidationState(error: ZodError): {
  message: string;
  fieldErrors: ProductFormFieldErrors;
} {
  const flat = error.flatten();
  const pick = (...keys: string[]) =>
    error.issues.find((issue) => {
      const root = issue.path[0];
      return typeof root === "string" && keys.includes(root);
    })?.message;

  return {
    message:
      flat.formErrors[0] ??
      error.issues[0]?.message ??
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
        pick("defaultDiscountRate", "defaultDiscountAmountCents"),
    },
  };
}
