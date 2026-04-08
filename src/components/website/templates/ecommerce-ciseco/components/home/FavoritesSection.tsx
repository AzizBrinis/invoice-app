import clsx from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WebsiteBuilderSection } from "@/lib/website/builder";
import { FAVORITE_FILTERS } from "../../data/home";
import type { HomeProduct, HomeProductStatus, ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { buildCategoryFilters, resolveCisecoNavigationHref } from "../../utils";
import { Section } from "../layout/Section";
import { PillTabs } from "../shared/PillTabs";
import { ProductCard, ProductCardSkeleton } from "../shared/ProductCard";
import { Reveal } from "../shared/Reveal";

type FavoritesSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  homeHref: string;
  products: HomeProduct[];
  status: HomeProductStatus;
  baseLink: (target: string) => string;
  onAddToCart: (product: HomeProduct) => boolean;
  isWishlisted: (productId: string) => boolean;
  pendingIds: Set<string>;
  onToggleWishlist: (productId: string) => Promise<boolean>;
  emptyMessage: string;
  errorMessage: string;
};

export function FavoritesSection({
  theme,
  section,
  homeHref,
  products,
  status,
  baseLink,
  onAddToCart,
  isWishlisted,
  pendingIds,
  onToggleWishlist,
  emptyMessage,
  errorMessage,
}: FavoritesSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const overrideTabs =
    section?.items?.length
      ? section.items
          .map((item) => item.title)
          .filter((value): value is string => Boolean(value))
      : null;
  const generatedTabs = buildCategoryFilters(products, { includeAll: true });
  const categoryTabs = overrideTabs?.length
    ? overrideTabs
    : generatedTabs.length
      ? generatedTabs
      : FAVORITE_FILTERS;
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex =
    activeIndex < categoryTabs.length ? activeIndex : 0;
  const activeLabel = categoryTabs[safeActiveIndex] ?? categoryTabs[0];
  const filteredProducts = !activeLabel
    ? products
    : activeLabel.toLowerCase() === "all"
      ? products
      : products.filter(
          (product) =>
            product.category.toLowerCase() === activeLabel.toLowerCase(),
        );
  const items = filteredProducts.slice(0, 8);
  const productHref = (slug: string) => baseLink(`/produit/${slug}`);
  const filteredEmptyMessage =
    activeLabel && activeLabel.toLowerCase() !== "all"
      ? t("No items match this filter yet.")
      : emptyMessage;
  const eyebrow = section?.eyebrow ?? "Browse by category";
  const title = section?.title ?? "Find your favorite products";
  const subtitle =
    section?.subtitle ??
    "Filter neutral sample entries to preview how grouped content will appear.";
  const cta = section?.buttons?.[0];

  return (
    <Section
      theme={theme}
      id="favorites"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
      deferRendering
      containIntrinsicSize="1px 1560px"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="ciseco-home-eyebrow">
            {t(eyebrow)}
          </p>
          <h2 className="ciseco-home-title max-w-3xl text-[34px] sm:text-[42px]">
            {t(title)}
          </h2>
          <p className="ciseco-home-subtitle max-w-2xl">
            {t(subtitle)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PillTabs
            items={categoryTabs}
            activeIndex={safeActiveIndex}
            onSelect={setActiveIndex}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {status === "loading"
            ? Array.from({ length: 8 }).map((_, index) => (
                <ProductCardSkeleton key={`fav-skel-${index}`} />
              ))
            : null}
          {status === "error" ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600">
              {errorMessage}
            </div>
          ) : null}
          {status === "empty" ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600">
              {emptyMessage}
            </div>
          ) : null}
          {status === "ready"
            ? items.length
              ? items.map((card, index) => (
                  <Reveal key={`fav-${card.id}-${index}`} delay={index * 45}>
                    <ProductCard
                      product={card}
                      href={productHref(card.slug)}
                      isWishlisted={isWishlisted(card.id)}
                      isWishlistBusy={pendingIds.has(card.id)}
                      onToggleWishlist={() => onToggleWishlist(card.id)}
                      onAddToCart={() => onAddToCart(card)}
                    />
                  </Reveal>
                ))
              : (
                <div className="sm:col-span-2 lg:col-span-4 rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600">
                  {filteredEmptyMessage}
                </div>
              )
            : null}
        </div>
        <div className="flex justify-center">
          {cta ? (
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "bg-slate-900 px-6 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-20px_rgba(15,23,42,0.45)]",
              )}
            >
              <a
                href={localizeHref(
                  resolveCisecoNavigationHref({
                    href: cta.href,
                    homeHref,
                    baseLink,
                    fallbackPath: "/collections",
                  }),
                )}
              >
                {t(cta.label)}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
