"use client";

import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { HomeProduct, HomeProductStatus, ThemeTokens } from "../../types";
import { appendCisecoLocaleToHref, type CisecoLocale } from "../../locale";
import { HomeSections } from "./HomeSections";
import { normalizePath } from "../../utils";

type UnsupportedHomeSectionFallbackProps = {
  theme: ThemeTokens;
  section: WebsiteBuilderSection;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  products: HomeProduct[];
  featuredProducts: HomeProduct[];
  status: HomeProductStatus;
  homeHref: string;
  catalogSlug: string;
  mode: "public" | "preview";
  slug: string;
  locale: CisecoLocale;
};

export function UnsupportedHomeSectionFallback({
  theme,
  section,
  mediaLibrary,
  products,
  featuredProducts,
  status,
  homeHref,
  catalogSlug,
  mode,
  slug,
  locale,
}: UnsupportedHomeSectionFallbackProps) {
  const rawBaseLink = (target: string) =>
    mode === "preview"
      ? `/preview?path=${encodeURIComponent(normalizePath(target))}`
      : `/catalogue/${slug}${normalizePath(target)}`;
  const baseLink = (target: string) =>
    appendCisecoLocaleToHref(rawBaseLink(target), locale);

  return (
    <HomeSections
      theme={theme}
      products={products}
      featuredProducts={featuredProducts}
      status={status}
      homeHref={homeHref}
      catalogSlug={catalogSlug}
      baseLink={baseLink}
      sections={[section]}
      mediaLibrary={mediaLibrary}
      hasBuilder
    />
  );
}
