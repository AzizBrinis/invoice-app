import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import { normalizeCatalogCategorySlug } from "@/lib/catalog-category";
import type { CatalogPayload } from "@/server/website";
import {
  buildCollectionQueryParams,
  buildCollectionCatalogItems,
  buildCollectionFacets,
  buildPaginationSequence,
  COLLECTION_SORT_OPTIONS,
  filterCollectionCatalogItems,
  normalizeCollectionFacetValues,
  normalizeCollectionPriceInput,
  normalizeCollectionSort,
  parseCollectionPageValue,
  parseCollectionPriceToCents,
  paginateCollectionCatalogItems,
  sortCollectionCatalogItems,
} from "../collections";
import { resolveBuilderSection } from "../builder-helpers";
import { FiltersSidebar, type FilterOption, type SortOption } from "../components/collections/FiltersSidebar";
import { PaginationBar } from "../components/collections/PaginationBar";
import { ProductGridCard, type CollectionProduct } from "../components/collections/ProductGridCard";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useAccountProfile } from "../hooks/useAccountProfile";
import { useWishlist } from "../hooks/useWishlist";
import { useCisecoI18n } from "../i18n";
import { useCisecoLocation, useCisecoNavigation } from "../navigation";
import { buildCisecoHref } from "../utils";
import type { ThemeTokens } from "../types";

type CollectionsPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  catalogSlug: string;
  products: CatalogPayload["products"] | null;
  showPrices: boolean;
  collectionSlug?: string;
  builder?: WebsiteBuilderPageConfig | null;
  customizeHref?: string;
};

function normalizeCollectionSlug(value?: string | null) {
  return normalizeCatalogCategorySlug(value);
}

function titleizeSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const DEFAULT_COLLECTIONS_HERO_SUBTITLES = [
  "Présentez vos sélections favorites.",
  "Showcase your favourite selections.",
] as const;

function normalizeCollectionText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim().toLocaleLowerCase() ?? "";
}

function isDefaultCollectionsHeroSubtitle(value?: string | null) {
  const normalized = normalizeCollectionText(value);
  if (!normalized) {
    return false;
  }
  return DEFAULT_COLLECTIONS_HERO_SUBTITLES.some(
    (candidate) => normalizeCollectionText(candidate) === normalized,
  );
}

function resolveAvailabilityLabel(product: {
  saleMode: "INSTANT" | "QUOTE";
  stockQuantity: number | null;
}) {
  if (product.saleMode === "QUOTE") {
    return "Quote";
  }
  if (product.stockQuantity === 0) {
    return "Out of stock";
  }
  if (product.stockQuantity != null && product.stockQuantity > 0) {
    return "In stock";
  }
  return "Instant";
}

export function CollectionsPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  catalogSlug,
  products,
  showPrices,
  collectionSlug,
  builder,
  customizeHref,
}: CollectionsPageProps) {
  const { t, locale, localizeHref } = useCisecoI18n();
  const { authStatus } = useAccountProfile({
    redirectOnUnauthorized: false,
    loadStrategy: "manual",
  });
  const { href, searchParams } = useCisecoLocation();
  const { isNavigating, navigate, replace } = useCisecoNavigation();
  const { isWishlisted, toggleWishlist, pendingIds } = useWishlist({
    redirectOnLoad: false,
    redirectOnAction: true,
    slug: catalogSlug,
    loginHref: baseLink("/login"),
    loadStrategy: authStatus === "authenticated" ? "idle" : "manual",
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;

  const allProducts = useMemo(
    () =>
      buildCollectionCatalogItems({
        products,
        showPrices,
      }),
    [products, showPrices],
  );
  const allFacets = useMemo(() => buildCollectionFacets(allProducts), [allProducts]);
  const selectedCollectionSlug = normalizeCollectionSlug(collectionSlug);
  const collectionScopedProducts = useMemo(
    () =>
      selectedCollectionSlug
        ? allProducts.filter(
            (product) => product.categorySlug === selectedCollectionSlug,
          )
        : allProducts,
    [allProducts, selectedCollectionSlug],
  );
  const scopedFacets = useMemo(
    () => buildCollectionFacets(collectionScopedProducts),
    [collectionScopedProducts],
  );
  const rawSelectedSort = searchParams.get("sort");
  const rawRequestedPage = searchParams.get("page");
  const rawRequestedMinPrice = searchParams.get("minPrice");
  const rawRequestedMaxPrice = searchParams.get("maxPrice");
  const selectedSort = normalizeCollectionSort(rawSelectedSort);
  const requestedPage = parseCollectionPageValue(rawRequestedPage);
  const requestedMinPrice = normalizeCollectionPriceInput(rawRequestedMinPrice);
  const requestedMaxPrice = normalizeCollectionPriceInput(rawRequestedMaxPrice);
  const validColorIds = new Set(scopedFacets.colors.map((option) => option.id));
  const validSizeIds = new Set(scopedFacets.sizes.map((option) => option.id));
  const rawColorIds = normalizeCollectionFacetValues(searchParams.getAll("color"));
  const rawSizeIds = normalizeCollectionFacetValues(searchParams.getAll("size"));
  const selectedColorIds = rawColorIds.filter((value) => validColorIds.has(value));
  const selectedSizeIds = rawSizeIds.filter((value) => validSizeIds.has(value));
  const minPriceCents = parseCollectionPriceToCents(requestedMinPrice);
  const maxPriceCents = parseCollectionPriceToCents(requestedMaxPrice);
  const normalizedMinPriceCents =
    minPriceCents != null && maxPriceCents != null && minPriceCents > maxPriceCents
      ? maxPriceCents
      : minPriceCents;
  const normalizedMaxPriceCents =
    minPriceCents != null && maxPriceCents != null && minPriceCents > maxPriceCents
      ? minPriceCents
      : maxPriceCents;
  const normalizedMinPriceValue =
    minPriceCents != null && maxPriceCents != null && minPriceCents > maxPriceCents
      ? requestedMaxPrice
      : requestedMinPrice;
  const normalizedMaxPriceValue =
    minPriceCents != null && maxPriceCents != null && minPriceCents > maxPriceCents
      ? requestedMinPrice
      : requestedMaxPrice;
  const filteredProducts = useMemo(
    () =>
      filterCollectionCatalogItems(allProducts, {
        collectionSlug: selectedCollectionSlug,
        colorIds: selectedColorIds,
        sizeIds: selectedSizeIds,
        minPriceCents: normalizedMinPriceCents,
        maxPriceCents: normalizedMaxPriceCents,
      }),
    [
      allProducts,
      normalizedMaxPriceCents,
      normalizedMinPriceCents,
      selectedCollectionSlug,
      selectedColorIds,
      selectedSizeIds,
    ],
  );
  const sortedProducts = useMemo(
    () => sortCollectionCatalogItems(filteredProducts, selectedSort),
    [filteredProducts, selectedSort],
  );
  const pagination = useMemo(
    () => paginateCollectionCatalogItems(sortedProducts, requestedPage),
    [requestedPage, sortedProducts],
  );
  const pageSequence = useMemo(
    () => buildPaginationSequence(pagination.page, pagination.pageCount),
    [pagination.page, pagination.pageCount],
  );
  const selectedCollection = useMemo(
    () =>
      selectedCollectionSlug
        ? allFacets.collections.find(
            (collection) => collection.id === selectedCollectionSlug,
          ) ?? null
        : null,
    [allFacets.collections, selectedCollectionSlug],
  );
  const collectionOptions = useMemo<FilterOption[]>(
    () => [
      {
        id: "all",
        label: "All collections",
        count: allProducts.length,
        selected: !selectedCollectionSlug,
      },
      ...allFacets.collections.map((option) => ({
        ...option,
        selected: option.id === selectedCollectionSlug,
      })),
    ],
    [allFacets.collections, allProducts.length, selectedCollectionSlug],
  );
  const colorOptions = useMemo<FilterOption[]>(
    () =>
      scopedFacets.colors.map((option) => ({
        ...option,
        selected: selectedColorIds.includes(option.id),
      })),
    [scopedFacets.colors, selectedColorIds],
  );
  const sizeOptions = useMemo<FilterOption[]>(
    () =>
      scopedFacets.sizes.map((option) => ({
        ...option,
        selected: selectedSizeIds.includes(option.id),
      })),
    [scopedFacets.sizes, selectedSizeIds],
  );
  const sortOptions = useMemo<SortOption[]>(
    () =>
      COLLECTION_SORT_OPTIONS.map((option) => ({
        ...option,
        selected: option.id === selectedSort,
      })),
    [selectedSort],
  );
  const hasActiveQueryFilters =
    Boolean(selectedCollectionSlug) ||
    selectedColorIds.length > 0 ||
    selectedSizeIds.length > 0 ||
    normalizedMinPriceValue.length > 0 ||
    normalizedMaxPriceValue.length > 0 ||
    selectedSort !== "featured";
  const collectionProducts = useMemo<CollectionProduct[]>(
    () =>
      pagination.items.map((product) => ({
        id: product.id,
        name: product.name,
        subtitle: product.categoryLabel,
        price: product.price,
        rating: product.rating ?? undefined,
        reviewCount: product.reviewCount,
        href: buildCisecoHref(homeHref, `/produit/${product.slug}`),
        cartProduct: product.cartProduct,
        saleMode: product.saleMode,
        image: product.image,
        colorOptions: product.colorOptions,
        sizeCount: product.sizeOptions.length,
        availabilityLabel: resolveAvailabilityLabel(product),
        badge: product.isFeatured ? "Featured" : null,
      })),
    [homeHref, pagination.items],
  );
  const buildCollectionsHref = useCallback(
    (nextState?: {
      collectionSlug?: string | null;
      colorIds?: string[];
      sizeIds?: string[];
      minPrice?: string;
      maxPrice?: string;
      sort?: string;
      page?: number;
    }) => {
      const targetCollectionSlug =
        nextState?.collectionSlug === undefined
          ? selectedCollectionSlug
          : nextState.collectionSlug;
      const targetPath = targetCollectionSlug
        ? `/collections/${targetCollectionSlug}`
        : "/collections";
      const baseHref = buildCisecoHref(homeHref, targetPath);
      const [pathname, query = ""] = baseHref.split("?");
      const baseParams = new URLSearchParams(query);

      const colorIds = nextState?.colorIds ?? selectedColorIds;
      const sizeIds = nextState?.sizeIds ?? selectedSizeIds;
      const minPrice = nextState?.minPrice ?? normalizedMinPriceValue;
      const maxPrice = nextState?.maxPrice ?? normalizedMaxPriceValue;
      const sort = nextState?.sort ?? selectedSort;
      const page = nextState?.page ?? 1;
      const params = buildCollectionQueryParams({
        currentSearchParams: searchParams,
        baseSearchParams: baseParams,
        state: {
          colorIds,
          sizeIds,
          minPrice,
          maxPrice,
          sort: normalizeCollectionSort(sort),
          page: Math.max(1, page),
        },
      });

      const queryString = params.toString();
      return `${pathname}${queryString ? `?${queryString}` : ""}`;
    },
    [
      homeHref,
      normalizedMaxPriceValue,
      normalizedMinPriceValue,
      searchParams,
      selectedCollectionSlug,
      selectedColorIds,
      selectedSizeIds,
      selectedSort,
    ],
  );

  useEffect(() => {
    const canonicalHref = localizeHref(
      buildCollectionsHref({
        page: pagination.page,
      }),
    );

    if (canonicalHref === href) {
      return;
    }

    replace(canonicalHref, {
      scroll: false,
    });
  }, [
    href,
    buildCollectionsHref,
    localizeHref,
    pagination.page,
    replace,
  ]);

  const navigateTo = useCallback(
    (href: string, replaceHistory = false) => {
      const localizedHref = localizeHref(href);
      if (replaceHistory) {
        replace(localizedHref, { scroll: false });
      } else {
        navigate(localizedHref);
      }
      setMobileFiltersOpen(false);
    },
    [localizeHref, navigate, replace],
  );

  const handleSelectCollection = useCallback(
    (nextCollectionSlug: string | null) => {
      navigateTo(
        buildCollectionsHref({
          collectionSlug: nextCollectionSlug,
          colorIds: [],
          sizeIds: [],
          page: 1,
        }),
      );
    },
    [buildCollectionsHref, navigateTo],
  );

  const handleToggleColor = useCallback(
    (colorId: string) => {
      const nextColorIds = selectedColorIds.includes(colorId)
        ? selectedColorIds.filter((value) => value !== colorId)
        : [...selectedColorIds, colorId];
      navigateTo(
        buildCollectionsHref({
          colorIds: nextColorIds,
          page: 1,
        }),
      );
    },
    [buildCollectionsHref, navigateTo, selectedColorIds],
  );

  const handleToggleSize = useCallback(
    (sizeId: string) => {
      const nextSizeIds = selectedSizeIds.includes(sizeId)
        ? selectedSizeIds.filter((value) => value !== sizeId)
        : [...selectedSizeIds, sizeId];
      navigateTo(
        buildCollectionsHref({
          sizeIds: nextSizeIds,
          page: 1,
        }),
      );
    },
    [buildCollectionsHref, navigateTo, selectedSizeIds],
  );

  const handleSelectSort = useCallback(
    (sortId: string) => {
      navigateTo(
        buildCollectionsHref({
          sort: sortId,
          page: 1,
        }),
      );
    },
    [buildCollectionsHref, navigateTo],
  );

  const handleApplyPrice = useCallback(
    (minPrice: string, maxPrice: string) => {
      navigateTo(
        buildCollectionsHref({
          minPrice: normalizeCollectionPriceInput(minPrice),
          maxPrice: normalizeCollectionPriceInput(maxPrice),
          page: 1,
        }),
      );
    },
    [buildCollectionsHref, navigateTo],
  );

  const handleClearFilters = useCallback(() => {
    navigateTo(
      buildCollectionsHref({
        collectionSlug: null,
        colorIds: [],
        sizeIds: [],
        minPrice: "",
        maxPrice: "",
        sort: "featured",
        page: 1,
      }),
    );
  }, [buildCollectionsHref, navigateTo]);

  const collectionTitle = selectedCollection
    ? t(selectedCollection.label)
    : selectedCollectionSlug
      ? t(titleizeSlug(selectedCollectionSlug))
      : t(heroSection?.title ?? "Collections");
  const collectionSubtitle =
    selectedCollectionSlug
      ? collectionScopedProducts.length > 0
        ? `${t("Discover")} ${collectionScopedProducts.length} ${t(
            collectionScopedProducts.length === 1 ? "item" : "items",
          )} ${t("in this collection.")}`
        : t("No products are currently assigned to this collection.")
      : heroSubtitle && !isDefaultCollectionsHeroSubtitle(heroSubtitle)
        ? t(heroSubtitle)
        : locale === "en"
          ? `Browse ${allProducts.length} ${
              allProducts.length === 1 ? "item" : "items"
            } across the current catalogue collections.`
          : `Parcourez ${allProducts.length} ${
              allProducts.length === 1 ? "article" : "articles"
            } dans les collections actuellement disponibles.`;
  const consumedIds = new Set(
    [heroSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) => section.visible !== false && !consumedIds.has(section.id),
  );
  const isCollectionMissing =
    Boolean(selectedCollectionSlug) && collectionScopedProducts.length === 0;
  const activeFilters = useMemo(() => {
    const filters: Array<{
      key: string;
      label: string;
      onRemove: () => void;
    }> = [];

    if (selectedCollectionSlug) {
      filters.push({
        key: `collection:${selectedCollectionSlug}`,
        label: t(selectedCollection?.label ?? titleizeSlug(selectedCollectionSlug)),
        onRemove: () => handleSelectCollection(null),
      });
    }

    colorOptions
      .filter((option) => option.selected)
      .forEach((option) => {
        filters.push({
          key: `color:${option.id}`,
          label: option.label,
          onRemove: () => handleToggleColor(option.id),
        });
      });

    sizeOptions
      .filter((option) => option.selected)
      .forEach((option) => {
        filters.push({
          key: `size:${option.id}`,
          label: option.label,
          onRemove: () => handleToggleSize(option.id),
        });
      });

    if (normalizedMinPriceValue.length > 0) {
      filters.push({
        key: "minPrice",
        label: `${t("Min price")}: ${normalizedMinPriceValue}`,
        onRemove: () =>
          navigateTo(
            buildCollectionsHref({
              minPrice: "",
              page: 1,
            }),
          ),
      });
    }

    if (normalizedMaxPriceValue.length > 0) {
      filters.push({
        key: "maxPrice",
        label: `${t("Max price")}: ${normalizedMaxPriceValue}`,
        onRemove: () =>
          navigateTo(
            buildCollectionsHref({
              maxPrice: "",
              page: 1,
            }),
          ),
      });
    }

    if (selectedSort !== "featured") {
      const activeSort = sortOptions.find((option) => option.selected);
      if (activeSort) {
        filters.push({
          key: `sort:${activeSort.id}`,
          label: t(activeSort.label),
          onRemove: () => handleSelectSort("featured"),
        });
      }
    }

    return filters;
  }, [
    buildCollectionsHref,
    colorOptions,
    handleSelectCollection,
    handleSelectSort,
    handleToggleColor,
    handleToggleSize,
    navigateTo,
    normalizedMaxPriceValue,
    normalizedMinPriceValue,
    selectedCollection,
    selectedCollectionSlug,
    selectedSort,
    sizeOptions,
    sortOptions,
    t,
  ]);

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
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              {heroSection?.eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                  {t(heroSection.eyebrow)}
                </p>
              ) : null}
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {selectedCollectionSlug ? collectionTitle : t(heroSection?.title ?? collectionTitle)}
              </h1>
              <p className="text-sm text-slate-500 sm:text-base">
                {collectionSubtitle}
              </p>
            </div>
            {customizeHref ? (
              <a
                href={customizeHref}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.42)] transition hover:-translate-y-0.5 hover:border-black/15 hover:text-slate-950"
              >
                {t("Customize this page")}
              </a>
            ) : null}
          </div>
          <div className="mt-6 border-b border-black/5" />

          <div className="mt-6 rounded-[30px] border border-black/5 bg-white/85 px-4 py-4 shadow-[0_22px_44px_-36px_rgba(15,23,42,0.28)] backdrop-blur-sm sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-black/5 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {t("Showing")} {pagination.total} {t(pagination.total === 1 ? "item" : "items")}
                  </span>
                  {isNavigating ? (
                    <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                      {t("Loading...")}
                    </span>
                  ) : null}
                  {selectedCollection ? (
                    <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                      {t(selectedCollection.label)}
                    </span>
                  ) : null}
                </div>
                {activeFilters.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFilters.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={filter.onRemove}
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-black/15 hover:text-slate-900"
                      >
                        <span>{filter.label}</span>
                        <span aria-hidden="true" className="text-slate-400">
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {selectedCollectionSlug
                      ? t(collectionSubtitle)
                      : t("Refine the catalog view")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <label className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-[0_12px_28px_-28px_rgba(15,23,42,0.38)] sm:w-auto sm:min-w-[240px]">
                  <span className="whitespace-nowrap">{t("Sort by")}</span>
                  <select
                    value={selectedSort}
                    onChange={(event) => handleSelectSort(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-slate-900 outline-none"
                  >
                    {COLLECTION_SORT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {t(option.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((current) => !current)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-[0_12px_28px_-28px_rgba(15,23,42,0.38)] transition hover:text-slate-900 lg:hidden"
                >
                  <FilterIcon className="h-4 w-4" />
                  {t("Filters")}
                </button>
              </div>
            </div>
          </div>

          {mobileFiltersOpen ? (
            <div className="mt-6 lg:hidden">
              <FiltersSidebar
                collectionOptions={collectionOptions}
                colorOptions={colorOptions}
                sizeOptions={sizeOptions}
                minPriceValue={normalizedMinPriceValue}
                maxPriceValue={normalizedMaxPriceValue}
                hasActiveFilters={hasActiveQueryFilters}
                onSelectCollection={handleSelectCollection}
                onToggleColor={handleToggleColor}
                onToggleSize={handleToggleSize}
                onApplyPrice={handleApplyPrice}
                onClearFilters={handleClearFilters}
              />
            </div>
          ) : null}

          <div className="mt-8 grid gap-8 lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)]">
            <FiltersSidebar
              className="sticky top-24 hidden self-start lg:block"
              collectionOptions={collectionOptions}
              colorOptions={colorOptions}
              sizeOptions={sizeOptions}
              minPriceValue={normalizedMinPriceValue}
              maxPriceValue={normalizedMaxPriceValue}
              hasActiveFilters={hasActiveQueryFilters}
              onSelectCollection={handleSelectCollection}
              onToggleColor={handleToggleColor}
              onToggleSize={handleToggleSize}
              onApplyPrice={handleApplyPrice}
              onClearFilters={handleClearFilters}
            />
            <div>
              {collectionProducts.length > 0 ? (
                <>
                  <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-5">
                    {collectionProducts.map((product) => (
                      <ProductGridCard
                        key={product.id}
                        product={product}
                        isWishlisted={isWishlisted(product.id)}
                        isWishlistBusy={pendingIds.has(product.id)}
                        onToggleWishlist={() => toggleWishlist(product.id)}
                        className="max-w-[23.5rem] justify-self-center"
                      />
                    ))}
                  </div>
                  <PaginationBar
                    currentPage={pagination.page}
                    pageCount={pagination.pageCount}
                    pages={pageSequence}
                    hrefForPage={(page) =>
                      localizeHref(buildCollectionsHref({ page }))
                    }
                  />
                </>
              ) : (
                <div className="rounded-[32px] border border-dashed border-black/10 bg-white px-6 py-12 text-center">
                  <p className="text-base font-semibold text-slate-900">
                    {isCollectionMissing
                      ? t("No products are currently assigned to this collection.")
                      : t("No products match this collection yet.")}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {hasActiveQueryFilters
                      ? t("No items match this filter yet.")
                      : t("No products found for this collection yet.")}
                  </p>
                  {hasActiveQueryFilters ? (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:text-slate-900"
                      >
                        {t("Clear")}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
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
