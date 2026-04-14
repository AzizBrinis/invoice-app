import type { CatalogPayload, CatalogProduct } from "@/server/website";
import { resolveCatalogProductListingImageSource } from "@/server/website";

export function trimCatalogProductForListing(
  product: CatalogProduct,
  website: CatalogPayload["website"],
): CatalogProduct {
  return {
    ...product,
    description: null,
    descriptionHtml: null,
    shortDescriptionHtml: null,
    excerpt: null,
    metaTitle: null,
    metaDescription: null,
    coverImageUrl: resolveCatalogProductListingImageSource(
      product,
      website,
    ),
    gallery: null,
    faqItems: null,
    quoteFormSchema: product.optionConfig ? null : product.quoteFormSchema,
    optionConfig: product.optionConfig,
    variantStock: null,
  };
}
