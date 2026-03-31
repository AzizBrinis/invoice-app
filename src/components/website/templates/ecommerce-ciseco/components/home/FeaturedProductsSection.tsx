import type { WebsiteBuilderSection } from "@/lib/website/builder";
import type { HomeProduct, HomeProductStatus, ThemeTokens } from "../../types";
import { Section } from "../layout/Section";
import { Reveal } from "../shared/Reveal";

type FeaturedProductsSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  products: HomeProduct[];
  status: HomeProductStatus;
  baseLink: (target: string) => string;
  onAddToCart: (product: HomeProduct) => void;
  emptyMessage: string;
  errorMessage: string;
};

export function FeaturedProductsSection({
  theme,
  section,
  products,
  status,
  baseLink,
  emptyMessage,
  errorMessage,
}: FeaturedProductsSectionProps) {
  const productHref = (slug: string) => baseLink(`/produit/${slug}`);
  const heroCards = products.slice(0, 3);
  const stripCards = products.slice(0, 9);
  const eyebrow = section?.eyebrow ?? "Featured";
  const title = section?.title ?? "Shopping essentials";
  const subtitle =
    section?.subtitle ??
    "Use this area to surface important items, launches, or offers.";

  return (
    <Section
      theme={theme}
      id="featured"
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {status === "loading"
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`featured-skel-${index}`}
                  className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-200"
                />
              ))
            : null}
          {status === "error" ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
              {errorMessage}
            </div>
          ) : null}
          {status === "empty" ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
              {emptyMessage}
            </div>
          ) : null}
          {status === "ready"
            ? heroCards.length
              ? heroCards.map((card, index) => (
                  <Reveal key={`${card.id}-feature-${index}`} delay={index * 60}>
                    <a
                      href={productHref(card.slug)}
                      className="group overflow-hidden rounded-2xl bg-white shadow-sm"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                        <img
                          src={card.image}
                          alt={card.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 text-sm">
                        <span className="font-semibold text-slate-900">{card.name}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {card.category}
                        </span>
                      </div>
                    </a>
                  </Reveal>
                ))
              : (
                <div className="rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
                  {emptyMessage}
                </div>
              )
            : null}
        </div>
        {status === "ready" && stripCards.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-9">
            {stripCards.map((card, index) => (
              <a
                key={`${card.id}-thumb-${index}`}
                href={productHref(card.slug)}
                className="overflow-hidden rounded-xl border border-black/5 bg-white"
                aria-label={`Open ${card.name}`}
              >
                <div className="aspect-square overflow-hidden bg-slate-100">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
