import clsx from "clsx";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { CartProduct } from "@/components/website/cart/cart-context";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { CatalogPayload } from "@/server/website";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import {
  FeaturedRow,
  type FeaturedProduct,
} from "../components/collections/FeaturedRow";
import {
  ProductGridCard,
  type CollectionProduct,
} from "../components/collections/ProductGridCard";
import { PromoBlock } from "../components/collections/PromoBlock";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";
import { useCisecoLocation, useCisecoNavigation } from "../navigation";
import {
  buildCisecoHrefWithQuery,
  buildHomeProducts,
  toCartProduct,
} from "../utils";

type SearchPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  products: CatalogPayload["products"] | null;
  showPrices: boolean;
  builder?: WebsiteBuilderPageConfig | null;
};

const FILTER_CHIPS = [
  { id: "categories", label: "Categories", icon: CategoriesIcon },
  { id: "colors", label: "Colors", icon: ColorsIcon },
  { id: "sizes", label: "Sizes", icon: SizesIcon },
  { id: "price", label: "Price", icon: PriceIcon },
];

function buildSearchCartProduct(options: {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  image: string;
}): CartProduct {
  const normalizedPrice = options.price.trim();
  const amountMatch = normalizedPrice.match(/(\d+(?:\.\d{1,2})?)/);
  const unitAmountCents = amountMatch
    ? Math.round(Number(amountMatch[1]) * 100)
    : null;

  return {
    id: options.id,
    title: options.name,
    price: normalizedPrice,
    unitAmountCents,
    unitPriceHTCents: unitAmountCents,
    vatRate: unitAmountCents == null ? null : 0,
    discountRate: null,
    currencyCode: normalizedPrice.startsWith("$") ? "USD" : "TND",
    image: options.image,
    tag: options.subtitle,
    slug: options.id,
    saleMode: "INSTANT",
  };
}

const SEARCH_PRODUCTS: CollectionProduct[] = [
  {
    id: "leather-tote-bag",
    name: "Leather Tote Bag",
    subtitle: "Pink Yarrow",
    price: "$85.00",
    cartProduct: buildSearchCartProduct({
      id: "leather-tote-bag",
      name: "Leather Tote Bag",
      subtitle: "Pink Yarrow",
      price: "$85.00",
      image:
        "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.5,
    reviewCount: 87,
    image:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#111827", "#9a6b3b", "#e7d3bf"],
    badge: "New in",
    favorite: true,
    showActions: true,
  },
  {
    id: "silk-midi-dress",
    name: "Silk Midi Dress",
    subtitle: "Emerald Green",
    price: "$120.00",
    cartProduct: buildSearchCartProduct({
      id: "silk-midi-dress",
      name: "Silk Midi Dress",
      subtitle: "Emerald Green",
      price: "$120.00",
      image:
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.7,
    reviewCount: 95,
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#22c55e", "#2563eb", "#111827", "#fb7185"],
    showActions: true,
  },
  {
    id: "denim-jacket",
    name: "Denim Jacket",
    subtitle: "Light Blue",
    price: "$65.00",
    cartProduct: buildSearchCartProduct({
      id: "denim-jacket",
      name: "Denim Jacket",
      subtitle: "Light Blue",
      price: "$65.00",
      image:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.3,
    reviewCount: 120,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#93c5fd", "#2563eb", "#111827"],
    badge: "New in",
    favorite: true,
  },
  {
    id: "cashmere-sweater",
    name: "Cashmere Sweater",
    subtitle: "Cream",
    price: "$150.00",
    cartProduct: buildSearchCartProduct({
      id: "cashmere-sweater",
      name: "Cashmere Sweater",
      subtitle: "Cream",
      price: "$150.00",
      image:
        "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.8,
    reviewCount: 75,
    image:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#f9a8d4", "#9ca3af", "#ef4444"],
    showActions: true,
  },
  {
    id: "linen-blazer",
    name: "Linen Blazer",
    subtitle: "Beige",
    price: "$80.00",
    cartProduct: buildSearchCartProduct({
      id: "linen-blazer",
      name: "Linen Blazer",
      subtitle: "Beige",
      price: "$80.00",
      image:
        "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.4,
    reviewCount: 60,
    image:
      "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#1e3a8a", "#111827", "#d1bfa3"],
  },
  {
    id: "velvet-skirt",
    name: "Velvet Skirt",
    subtitle: "Wine Red",
    price: "$70.00",
    cartProduct: buildSearchCartProduct({
      id: "velvet-skirt",
      name: "Velvet Skirt",
      subtitle: "Wine Red",
      price: "$70.00",
      image:
        "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.2,
    reviewCount: 45,
    image:
      "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#7c3aed", "#ef4444", "#111827", "#22c55e"],
    favorite: true,
  },
  {
    id: "wool-trench-coat",
    name: "Wool Trench Coat",
    subtitle: "Camel",
    price: "$160.00",
    cartProduct: buildSearchCartProduct({
      id: "wool-trench-coat",
      name: "Wool Trench Coat",
      subtitle: "Camel",
      price: "$160.00",
      image:
        "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.6,
    reviewCount: 68,
    image:
      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#111827", "#eab308", "#cbd5f5"],
  },
  {
    id: "cotton-shirt",
    name: "Cotton Shirt",
    subtitle: "White",
    price: "$45.00",
    cartProduct: buildSearchCartProduct({
      id: "cotton-shirt",
      name: "Cotton Shirt",
      subtitle: "White",
      price: "$45.00",
      image:
        "https://images.unsplash.com/photo-1585386959984-a4155224a1f3?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    }),
    rating: 4.1,
    reviewCount: 32,
    image:
      "https://images.unsplash.com/photo-1585386959984-a4155224a1f3?auto=format&fit=pad&w=800&h=800&q=80&bg=ffffff",
    colors: ["#0ea5e9", "#64748b", "#f9a8d4"],
  },
];

const FEATURED_PRODUCTS: FeaturedProduct[] = [
  {
    id: "featured-leather-tote",
    name: "Leather Tote Bag",
    subtitle: "Pink Yarrow",
    price: "$85.00",
    rating: 4.5,
    reviewCount: 87,
    image: SEARCH_PRODUCTS[0].image,
    thumbnails: [
      SEARCH_PRODUCTS[0].image,
      SEARCH_PRODUCTS[3].image,
      SEARCH_PRODUCTS[4].image,
    ],
  },
  {
    id: "featured-silk-midi",
    name: "Silk Midi Dress",
    subtitle: "Emerald Green",
    price: "$120.00",
    rating: 4.7,
    reviewCount: 95,
    image: SEARCH_PRODUCTS[1].image,
    thumbnails: [
      SEARCH_PRODUCTS[1].image,
      SEARCH_PRODUCTS[2].image,
      SEARCH_PRODUCTS[5].image,
    ],
  },
  {
    id: "featured-denim-jacket",
    name: "Denim Jacket",
    subtitle: "Light Blue",
    price: "$65.00",
    rating: 4.3,
    reviewCount: 120,
    image: SEARCH_PRODUCTS[2].image,
    thumbnails: [
      SEARCH_PRODUCTS[2].image,
      SEARCH_PRODUCTS[6].image,
      SEARCH_PRODUCTS[7].image,
    ],
  },
];

function buildFeaturedProducts(
  items: CollectionProduct[],
): FeaturedProduct[] {
  if (!items.length) return FEATURED_PRODUCTS;

  return items.slice(0, 3).map((product) => ({
    id: `featured-${product.id}`,
    name: product.name,
    subtitle: product.subtitle,
    price: product.price,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    image: product.image,
    thumbnails: [
      product.image,
      ...items
        .filter((item) => item.id !== product.id)
        .map((item) => item.image),
    ]
      .filter((image, imageIndex, values) => values.indexOf(image) === imageIndex)
      .slice(0, 3),
  }));
}

export function SearchPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  products,
  showPrices,
  builder,
}: SearchPageProps) {
  const { t } = useCisecoI18n();
  const { searchParams } = useCisecoLocation();
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const productSource = useMemo(
    () => (Array.isArray(products?.all) ? products.all : []),
    [products],
  );
  const liveProducts = useMemo(
    () =>
      buildHomeProducts({
        products: productSource,
        showPrices,
      }),
    [productSource, showPrices],
  );
  const searchProducts = useMemo<CollectionProduct[]>(
    () =>
      liveProducts.length
        ? liveProducts.map((product, index) => ({
            id: product.id,
            name: product.name,
            subtitle: product.category,
            price: product.price,
            href: baseLink(`/produit/${product.slug}`),
            cartProduct: toCartProduct(product),
            rating: product.rating,
            reviewCount: 24 + index * 4,
            image: product.image,
            colors: product.colors,
            badge: index < 2 ? "New in" : undefined,
            favorite: index % 3 === 0,
            showActions: true,
          }))
        : SEARCH_PRODUCTS.map((product) => ({
            ...product,
            href: baseLink("/collections"),
          })),
    [baseLink, liveProducts],
  );
  const categoryPills = useMemo(
    () => [
      "All items",
      ...Array.from(
        new Set(
          searchProducts
            .map((product) => product.subtitle?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).slice(0, 5),
    ],
    [searchProducts],
  );
  const [activeCategory, setActiveCategory] = useState(
    categoryPills[0] ?? "All items",
  );
  const query = searchParams.get("q")?.trim() ?? "";
  const selectedCategory = categoryPills.includes(activeCategory)
    ? activeCategory
    : categoryPills[0] ?? "All items";

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return searchProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === "All items" ||
        product.subtitle.toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.subtitle.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [query, searchProducts, selectedCategory]);
  const featuredProducts = useMemo(
    () =>
      buildFeaturedProducts(
        filteredProducts.length ? filteredProducts : searchProducts,
      ),
    [filteredProducts, searchProducts],
  );
  const consumedIds = new Set(
    [heroSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) =>
      section.visible !== false && !consumedIds.has(section.id),
  );
  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        <section
          className={clsx(
            "mx-auto px-6 pb-6 pt-8 sm:px-8 sm:pt-10 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          {heroSection ? (
            <div className="mb-6 space-y-2">
              {heroSection.eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                  {t(heroSection.eyebrow)}
                </p>
              ) : null}
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {t(heroSection.title ?? "Search")}
              </h1>
              {heroSubtitle ? (
                <p className="text-sm text-slate-600">{t(heroSubtitle)}</p>
              ) : null}
            </div>
          ) : null}
          <SearchBar homeHref={homeHref} initialValue={query} />
          <div className="mt-8 space-y-4 sm:mt-10">
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
              <div className="flex flex-wrap items-center gap-2">
                {categoryPills.map((label) => {
                  const isActive = label === selectedCategory;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActiveCategory(label)}
                      className={clsx(
                        "rounded-full border px-4 py-2 text-xs font-semibold transition",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-black/10 bg-white text-slate-600 hover:text-slate-900",
                      )}
                    >
                      {t(label)}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:text-slate-900 sm:ml-auto"
              >
                <FilterIcon className="h-4 w-4" />
                {t("Filter")}
              </button>
            </div>
            <FilterChipsRow />
          </div>
        </section>
        <section
          className={clsx(
            "mx-auto px-6 pb-16 sm:px-8 lg:pb-20",
            theme.containerClass,
          )}
        >
          {query ? (
            <p className="mb-5 text-sm text-slate-500">
              {filteredProducts.length}{" "}
              {t(filteredProducts.length === 1 ? "result" : "results")} {t("for")}{" "}
              <span>&ldquo;{query}&rdquo;</span>
            </p>
          ) : null}
          {filteredProducts.length ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductGridCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white px-6 py-10 text-center text-sm text-slate-500">
              {t(
                "No products matched your search. Try another keyword or clear the filters.",
              )}
            </div>
          )}
          <ResultsSummary count={filteredProducts.length} />
        </section>
        <FeaturedRow theme={theme} items={featuredProducts} />
        <PromoBlock
          theme={theme}
          companyName={companyName}
          homeHref={homeHref}
        />
        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}

function SearchBar({
  homeHref,
  initialValue,
}: {
  homeHref: string;
  initialValue: string;
}) {
  const { t, localizeHref } = useCisecoI18n();
  const { navigate } = useCisecoNavigation();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(
      localizeHref(
        buildCisecoHrefWithQuery(homeHref, "/search", {
          q: value.trim() || undefined,
        }),
      ),
    );
  };

  return (
    <form className="mx-auto w-full max-w-3xl" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-sm sm:px-5 sm:py-3">
        <SearchIcon className="h-4 w-4 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("Type your keywords")}
          aria-label={t("Search keywords")}
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none sm:text-base"
        />
        <button
          type="submit"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 sm:h-10 sm:w-10"
          aria-label={t("Submit search")}
        >
          <ArrowSubmitIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

function FilterChipsRow() {
  const { t } = useCisecoI18n();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_CHIPS.map((chip) => {
          const ChipIcon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900"
            >
              <ChipIcon className="h-4 w-4 text-slate-500" />
              <span>{t(chip.label)}</span>
              <ChevronDownIcon className="h-3 w-3 text-slate-400" />
            </button>
          );
        })}
      </div>
      <div className="flex sm:justify-end">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900"
        >
          <SortIcon className="h-4 w-4 text-slate-500" />
          <span>{t("Newest")}</span>
          <ChevronDownIcon className="h-3 w-3 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

function ResultsSummary({ count }: { count: number }) {
  const { t } = useCisecoI18n();
  return (
    <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-500 sm:mt-12">
      <span className="inline-flex rounded-full border border-black/5 bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
        {t("Showing")} {count} {t(count === 1 ? "item" : "items")}
      </span>
    </div>
  );
}

type IconProps = {
  className?: string;
};

function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M16 16l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowSubmitIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9 12h6m0 0l-2.5-2.5M15 12l-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CategoriesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function ColorsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 4c4.4 0 8 3 8 6.8 0 2.9-2 5.4-4.8 6.3-1.2.4-2.2 1.3-2.7 2.4l-.5 1.1-1.6-.8c-2.8-1.4-4.4-4-4.4-6.9C6 7 9.6 4 12 4z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="15.5" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

function SizesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 9h16M6 9v6m6-6v6m6-6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PriceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M6 12l6-6h6v6l-6 6-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
    </svg>
  );
}

function SortIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M7 6v12m0 0l-2.5-2.5M7 18l2.5-2.5M17 6l2.5 2.5M17 6l-2.5 2.5M17 6v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
