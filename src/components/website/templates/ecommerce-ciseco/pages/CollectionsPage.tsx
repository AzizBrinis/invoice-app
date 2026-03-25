import clsx from "clsx";
import { useMemo, type CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import { slugify } from "@/lib/slug";
import type { CatalogPayload } from "@/server/website";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { FiltersSidebar } from "../components/collections/FiltersSidebar";
import { FeaturedRow, type FeaturedProduct } from "../components/collections/FeaturedRow";
import { PaginationBar } from "../components/collections/PaginationBar";
import { ProductGridCard, type CollectionProduct } from "../components/collections/ProductGridCard";
import { PromoBlock } from "../components/collections/PromoBlock";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { buildHomeProducts, buildProductGallery } from "../utils";

type CollectionsPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  products: CatalogPayload["products"] | null;
  showPrices: boolean;
  collectionSlug?: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type CollectionEntry = {
  slug: string;
  label: string;
  count: number;
};

function normalizeCollectionSlug(value?: string | null) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function titleizeSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CollectionsPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  products,
  showPrices,
  collectionSlug,
  builder,
}: CollectionsPageProps) {
  const productSource = Array.isArray(products?.all) ? products.all : [];
  const homeProducts = useMemo(
    () =>
      buildHomeProducts({
        products: productSource,
        showPrices,
      }),
    [productSource, showPrices],
  );
  const productsById = useMemo(
    () => new Map(productSource.map((product) => [product.id, product])),
    [productSource],
  );
  const collections = useMemo<CollectionEntry[]>(() => {
    const entries = new Map<string, CollectionEntry>();
    homeProducts.forEach((product) => {
      const label = product.category?.trim() || "Collection";
      const slug = slugify(label) || "collection";
      const existing = entries.get(slug);
      if (existing) {
        existing.count += 1;
        return;
      }
      entries.set(slug, {
        slug,
        label,
        count: 1,
      });
    });
    return Array.from(entries.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [homeProducts]);
  const selectedCollectionSlug = normalizeCollectionSlug(collectionSlug);
  const selectedCollection = useMemo(
    () =>
      selectedCollectionSlug
        ? collections.find((collection) => collection.slug === selectedCollectionSlug) ?? null
        : null,
    [collections, selectedCollectionSlug],
  );
  const filteredProducts = useMemo(() => {
    if (!selectedCollectionSlug) {
      return homeProducts;
    }
    return homeProducts.filter((product) => {
      const collection = product.category?.trim() || "Collection";
      const slug = slugify(collection) || "collection";
      return slug === selectedCollectionSlug;
    });
  }, [homeProducts, selectedCollectionSlug]);
  const collectionProducts = useMemo<CollectionProduct[]>(
    () =>
      filteredProducts.map((product, index) => ({
        id: product.id,
        name: product.name,
        subtitle: product.category,
        price: product.price,
        rating: product.rating,
        reviewCount: 36 + (index % 6) * 9,
        image: product.image,
        colors: product.colors,
        badge: index < 2 ? "New in" : undefined,
        favorite: index % 3 === 0,
        showActions: true,
      })),
    [filteredProducts],
  );
  const featuredSource = filteredProducts.length > 0 ? filteredProducts : homeProducts;
  const featuredProducts = useMemo<FeaturedProduct[]>(
    () =>
      featuredSource.slice(0, 3).map((product, index) => {
        const source = productsById.get(product.id);
        const galleryImages = source
          ? buildProductGallery({
              product: source,
              title: source.name,
              maxItems: 4,
            }).map((entry) => entry.src)
          : [];
        const fallbackThumbnails = [
          product.image,
          ...featuredSource
            .filter((entry) => entry.id !== product.id)
            .map((entry) => entry.image),
        ]
          .filter((entry, imageIndex, values) => values.indexOf(entry) === imageIndex)
          .slice(0, 3);
        const thumbnails =
          galleryImages.length > 0 ? galleryImages.slice(0, 3) : fallbackThumbnails;
        return {
          id: `featured-${product.id}`,
          name: product.name,
          subtitle: product.category,
          price: product.price,
          rating: product.rating,
          reviewCount: 48 + index * 11,
          image: product.image,
          thumbnails,
        };
      }),
    [featuredSource, productsById],
  );
  const categoryOptions = useMemo(
    () =>
      collections.map((collection, index) => ({
        id: collection.slug,
        label: collection.label,
        checked: selectedCollectionSlug
          ? collection.slug === selectedCollectionSlug
          : index === 0,
      })),
    [collections, selectedCollectionSlug],
  );
  const collectionTitle = selectedCollection
    ? `${selectedCollection.label} collection`
    : selectedCollectionSlug
      ? `${titleizeSlug(selectedCollectionSlug)} collection`
      : "Sale collection";
  const collectionSubtitle =
    selectedCollection != null
      ? `Discover ${selectedCollection.count} item${
          selectedCollection.count > 1 ? "s" : ""
        } in this collection.`
      : selectedCollectionSlug
        ? "No products are currently assigned to this collection."
        : "Excellent new arrivals for every occasion, from casual to formal, explore our collection of trendy pieces that elevate your outfit.";
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
        <div
          className={clsx(
            "mx-auto px-6 pb-16 pt-8 sm:px-8 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          <div className="max-w-3xl space-y-3">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              {heroSection?.title ?? collectionTitle}
            </h1>
            <p className="text-sm text-slate-500 sm:text-base">
              {heroSubtitle ?? collectionSubtitle}
            </p>
          </div>
          <div className="mt-6 border-b border-black/5" />
          <div className="mt-6 flex items-center lg:hidden">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
            >
              <FilterIcon className="h-4 w-4" />
              Filters
            </button>
          </div>
          <div className="mt-8 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
            <FiltersSidebar
              className="hidden lg:block"
              categoryOptions={categoryOptions}
            />
            <div>
              {collectionProducts.length > 0 ? (
                <>
                  <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {collectionProducts.map((product) => (
                      <ProductGridCard key={product.id} product={product} />
                    ))}
                  </div>
                  <PaginationBar />
                </>
              ) : (
                <div className="rounded-3xl border border-black/10 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  No products found for this collection yet.
                </div>
              )}
            </div>
          </div>
        </div>
        {featuredProducts.length ? (
          <FeaturedRow theme={theme} items={featuredProducts} />
        ) : null}
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

type IconProps = {
  className?: string;
};

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
