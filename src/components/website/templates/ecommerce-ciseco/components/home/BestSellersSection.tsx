import type { WebsiteBuilderSection } from "@/lib/website/builder";
import type { HomeProduct, HomeProductStatus, ThemeTokens } from "../../types";
import { Section } from "../layout/Section";
import { ProductCard, ProductCardSkeleton } from "../shared/ProductCard";
import { Reveal } from "../shared/Reveal";

type BestSellersSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  products: HomeProduct[];
  status: HomeProductStatus;
  baseLink: (target: string) => string;
  onAddToCart: (product: HomeProduct) => void;
  emptyMessage: string;
  errorMessage: string;
};

export function BestSellersSection({
  theme,
  section,
  products,
  status,
  baseLink,
  onAddToCart,
  emptyMessage,
  errorMessage,
}: BestSellersSectionProps) {
  const items =
    products.length > 4
      ? products.slice(4, 8)
      : products.slice(0, 4);
  const productHref = (slug: string) => baseLink(`/produit/${slug}`);
  const eyebrow = section?.eyebrow ?? "Top picks";
  const title = section?.title ?? "Best sellers";
  const subtitle =
    section?.subtitle ??
    "Use this section for high-visibility items, featured offers, or important listings.";
  return (
    <Section
      theme={theme}
      id="best-sellers"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-900">
            {eyebrow}
          </p>
          <h2 className="text-[30px] font-semibold leading-tight text-slate-900 sm:text-[34px]">
            {title}
          </h2>
          <p className="text-sm text-slate-500">
            {subtitle}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {status === "loading"
            ? Array.from({ length: 4 }).map((_, index) => (
                <ProductCardSkeleton key={`best-skel-${index}`} />
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
