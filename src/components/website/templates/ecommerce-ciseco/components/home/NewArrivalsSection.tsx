import clsx from "clsx";
import type { WebsiteBuilderSection } from "@/lib/website/builder";
import type { HomeProduct, HomeProductStatus, ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { resolveCisecoNavigationHref } from "../../utils";
import { Section } from "../layout/Section";
import { ProductCard, ProductCardSkeleton } from "../shared/ProductCard";
import { Reveal } from "../shared/Reveal";

type NewArrivalsSectionProps = {
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

export function NewArrivalsSection({
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
}: NewArrivalsSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const items = products.length ? products.slice(0, 4) : [];
  const productHref = (slug: string) => baseLink(`/produit/${slug}`);
  const eyebrow = section?.eyebrow ?? "Latest additions";
  const title = section?.title ?? "Fresh placeholder cards";
  const subtitle =
    section?.subtitle ??
    "A clean set of reusable sample items ready to be replaced with real catalog content.";
  const cta = section?.buttons?.[0];
  return (
    <Section
      theme={theme}
      id="new-arrivals"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
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
          {cta ? (
            <a
              href={localizeHref(
                resolveCisecoNavigationHref({
                  href: cta.href,
                  homeHref,
                  baseLink,
                  fallbackPath: "/collections",
                }),
              )}
              className={clsx(
                theme.buttonShape,
                "border border-black/10 bg-white px-5 py-2 text-[12px] font-semibold tracking-[0.02em] text-slate-700 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.45)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_22px_40px_-28px_rgba(15,23,42,0.4)]",
              )}
            >
              {t(cta.label)}
            </a>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {status === "loading"
            ? Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`new-skel-${index}`} />
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
                  <Reveal key={`${card.id}-${index}`} delay={index * 55}>
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
                  {emptyMessage}
                </div>
              )
            : null}
        </div>
      </div>
    </Section>
  );
}
