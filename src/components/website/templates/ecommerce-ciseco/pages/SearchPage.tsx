import clsx from "clsx";
import type { CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
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

type SearchPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

const CATEGORY_PILLS = ["All items", "Women", "Mans", "Kids", "Jewels"];

const FILTER_CHIPS = [
  { id: "categories", label: "Categories", icon: CategoriesIcon },
  { id: "colors", label: "Colors", icon: ColorsIcon },
  { id: "sizes", label: "Sizes", icon: SizesIcon },
  { id: "price", label: "Price", icon: PriceIcon },
];

const SEARCH_PRODUCTS: CollectionProduct[] = [
  {
    id: "leather-tote-bag",
    name: "Leather Tote Bag",
    subtitle: "Pink Yarrow",
    price: "$85.00",
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

export function SearchPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: SearchPageProps) {
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
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
                  {heroSection.eyebrow}
                </p>
              ) : null}
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {heroSection.title ?? "Search"}
              </h1>
              {heroSubtitle ? (
                <p className="text-sm text-slate-600">{heroSubtitle}</p>
              ) : null}
            </div>
          ) : null}
          <SearchBar />
          <div className="mt-8 space-y-4 sm:mt-10">
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
              <div className="flex flex-wrap items-center gap-2">
                {CATEGORY_PILLS.map((label, index) => {
                  const isActive = index === 0;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={clsx(
                        "rounded-full border px-4 py-2 text-xs font-semibold transition",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-black/10 bg-white text-slate-600 hover:text-slate-900",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:text-slate-900 sm:ml-auto"
              >
                <FilterIcon className="h-4 w-4" />
                Filter
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
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {SEARCH_PRODUCTS.map((product) => (
              <ProductGridCard key={product.id} product={product} />
            ))}
          </div>
          <PaginationBar />
        </section>
        <FeaturedRow theme={theme} items={FEATURED_PRODUCTS} />
        <PromoBlock theme={theme} companyName={companyName} />
        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer theme={theme} companyName={companyName} />
    </PageShell>
  );
}

function SearchBar() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-sm sm:px-5 sm:py-3">
        <SearchIcon className="h-4 w-4 text-slate-400" />
        <input
          type="search"
          placeholder="Type your keywords"
          aria-label="Search keywords"
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none sm:text-base"
        />
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 sm:h-10 sm:w-10"
          aria-label="Submit search"
        >
          <ArrowSubmitIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FilterChipsRow() {
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
              <span>{chip.label}</span>
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
          <span>Newest</span>
          <ChevronDownIcon className="h-3 w-3 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

function PaginationBar() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 sm:mt-12">
      <a
        href="#"
        className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Previous
      </a>
      <div className="flex items-center gap-1 sm:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-slate-100 text-xs font-semibold text-slate-900">
          1
        </span>
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-slate-100 text-xs font-semibold text-slate-900">
          1
        </span>
        <a
          href="#"
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          2
        </a>
        <a
          href="#"
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          3
        </a>
        <a
          href="#"
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          4
        </a>
      </div>
      <a
        href="#"
        className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        Next
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </a>
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

function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14.5 6.5L9 12l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9.5 6.5L15 12l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
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
