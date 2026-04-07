"use client";

import clsx from "clsx";
import { useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import {
  computeAdjustedUnitPriceTTCCents,
  resolveProductDiscount,
} from "@/lib/product-pricing";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { AccountTabs } from "../components/account/AccountTabs";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { StarIcon, WishlistHeartIcon } from "../components/shared/Icons";
import {
  resolveVariantOptions,
  formatCisecoLabel,
  formatCisecoPrice,
} from "../utils";
import { useCisecoI18n } from "../i18n";
import { useWishlist } from "../hooks/useWishlist";
import { useAccountProfile } from "../hooks/useAccountProfile";

type WishlistsPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  catalogSlug: string;
  loginHref: string;
  showPrices: boolean;
  builder?: WebsiteBuilderPageConfig | null;
};

type WishlistItem = {
  id: string;
  productId: string;
  name: string;
  subtitle: string;
  price: string;
  rating: number;
  reviewCount: number;
  image: string;
  colors: string[];
  badge?: string;
  favorite?: boolean;
  isMissing?: boolean;
};

const DEFAULT_SWATCHES = [
  "#111827",
  "#9a6b3b",
  "#eab308",
  "#2563eb",
  "#16a34a",
  "#be185d",
  "#f97316",
  "#64748b",
];

function normalizeGallery(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if (typeof record.src === "string") return record.src.trim();
        if (typeof record.url === "string") return record.url.trim();
      }
      return "";
    })
    .filter((entry): entry is string => entry.length > 0);
}

function resolveUnitAmountCents(options: {
  saleMode: "INSTANT" | "QUOTE";
  priceTTCCents: number | null;
  priceHTCents: number | null;
  vatRate: number | null;
  discountRate?: number | null;
  discountAmountCents?: number | null;
}) {
  return computeAdjustedUnitPriceTTCCents({
    saleMode: options.saleMode,
    priceTTCCents: options.priceTTCCents,
    priceHTCents: options.priceHTCents,
    vatRate: options.vatRate,
    discountRate: options.discountRate ?? null,
    discountAmountCents: options.discountAmountCents ?? null,
  });
}

function resolveWishlistRating(index: number) {
  const value = 4.8 - index * 0.07;
  return Math.max(4.2, Number(value.toFixed(1)));
}

function resolveWishlistReviews(index: number) {
  const value = 96 - index * 7;
  return Math.max(12, Math.round(value));
}

export function WishlistsPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  catalogSlug,
  loginHref,
  showPrices,
  builder,
}: WishlistsPageProps) {
  const { t } = useCisecoI18n();
  const { items, status, error, pendingIds, toggleWishlist } = useWishlist({
    redirectOnLoad: true,
    redirectOnAction: true,
    slug: catalogSlug,
    loginHref,
  });
  const { profile, status: profileStatus } = useAccountProfile({
    redirectOnUnauthorized: true,
  });
  const displayItems = useMemo(() => {
    return items.map((item, index) => {
      if (!item.product) {
        const fallbackImage =
          WEBSITE_MEDIA_PLACEHOLDERS.products[
            index % WEBSITE_MEDIA_PLACEHOLDERS.products.length
          ];
        return {
          id: item.id,
          productId: item.productId,
          name: t("Product unavailable"),
          subtitle: t("This item is no longer available."),
          price: t("Unavailable"),
          rating: 0,
          reviewCount: 0,
          image: fallbackImage,
          colors: DEFAULT_SWATCHES.slice(0, 3),
          badge: t("Removed"),
          favorite: true,
          isMissing: true,
        } satisfies WishlistItem;
      }

      const gallery = normalizeGallery(item.product.gallery);
      const image =
        item.product.coverImageUrl ||
        gallery[0] ||
        WEBSITE_MEDIA_PLACEHOLDERS.products[
          index % WEBSITE_MEDIA_PLACEHOLDERS.products.length
        ];
      const variantColors = resolveVariantOptions(
        item.product.quoteFormSchema,
        item.product.optionConfig,
      ).colors;
      const colors = variantColors.length
        ? variantColors.map((color) => color.swatch)
        : DEFAULT_SWATCHES.slice(0, 4);
      const unitAmountCents = resolveUnitAmountCents({
        saleMode: item.product.saleMode,
        priceTTCCents: item.product.priceTTCCents,
        priceHTCents: item.product.priceHTCents,
        vatRate: item.product.vatRate,
        ...resolveProductDiscount(item.product),
      });

      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        subtitle: formatCisecoLabel(item.product.category, "Collection"),
        price: formatCisecoPrice({
          saleMode: item.product.saleMode,
          showPrices,
          amountCents: unitAmountCents,
        }),
        rating: resolveWishlistRating(index),
        reviewCount: resolveWishlistReviews(index),
        image,
        colors,
        badge: index < 2 ? t("New in") : undefined,
        favorite: true,
      } satisfies WishlistItem;
    });
  }, [items, showPrices, t]);

  const handleToggle = useCallback(
    (productId: string) => {
      void toggleWishlist(productId);
    },
    [toggleWishlist],
  );

  const isLoading = status === "loading";
  const showError = Boolean(error) && !isLoading;
  const isEmpty = status === "ready" && displayItems.length === 0 && !error;
  const headerDetails = useMemo(() => {
    const parts = [profile.email, profile.address].filter(
      (value) => value && value.trim().length > 0,
    ) as string[];
    return parts.join(" · ");
  }, [profile.address, profile.email]);
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
            "mx-auto px-6 pb-20 pt-8 sm:px-8 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          <div className="mx-auto max-w-5xl">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {t(heroSection?.title ?? "Account")}
              </h1>
              {heroSubtitle ? (
                <p className="text-sm text-slate-600">{t(heroSubtitle)}</p>
              ) : null}
              <p className="text-sm text-slate-500 sm:text-base">
                <span className="font-semibold text-slate-900">
                  {profile.name ||
                    (profileStatus === "loading" ? t("Loading...") : "—")}
                </span>
                {headerDetails
                  ? `, ${headerDetails}`
                  : profileStatus === "loading"
                    ? ` · ${t("Loading details...")}`
                    : null}
              </p>
            </div>
            <div className="mt-6 border-y border-black/5">
              <AccountTabs activeTab="Wishlists" />
            </div>
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {t("Wishlists")}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {t(
                  "Check out your wishlists. You can add or remove items from your wishlists.",
                )}
              </p>
              {isLoading ? (
                <WishlistSkeletonGrid />
              ) : null}
              {showError ? (
                <div className="mt-8 rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-rose-600">
                  {error ?? t("Unable to load wishlist.")}
                </div>
              ) : null}
              {isEmpty ? (
                <div className="mt-8 rounded-3xl border border-dashed border-black/10 bg-white p-6 text-sm text-slate-600">
                  {t("You have no saved items yet.")}
                </div>
              ) : null}
              {!isLoading && displayItems.length ? (
                <>
                  <WishlistGrid
                    items={displayItems}
                    pendingIds={pendingIds}
                    onToggle={handleToggle}
                  />
                  <div className="mt-12 flex justify-center">
                    <a
                      href="#"
                      className={clsx(
                        theme.buttonShape,
                        "bg-slate-900 px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-800",
                      )}
                    >
                      {t("Show me more")}
                    </a>
                  </div>
                </>
              ) : null}
            </section>
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

function WishlistGrid({
  items,
  pendingIds,
  onToggle,
}: {
  items: WishlistItem[];
  pendingIds: Set<string>;
  onToggle: (productId: string) => void;
}) {
  return (
    <div className="mt-8 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <WishlistCard
          key={item.id}
          item={item}
          onToggle={onToggle}
          isBusy={pendingIds.has(item.productId)}
        />
      ))}
    </div>
  );
}

function WishlistCard({
  item,
  onToggle,
  isBusy,
}: {
  item: WishlistItem;
  onToggle: (productId: string) => void;
  isBusy: boolean;
}) {
  const { t } = useCisecoI18n();
  const imageSrc = item.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  return (
    <article className="flex w-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-slate-50 p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        {item.badge ? (
          <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
            <SparkleIcon className="h-3 w-3 text-slate-600" />
            {item.badge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onToggle(item.productId)}
          disabled={isBusy}
          aria-busy={isBusy}
          className={clsx(
            "absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition",
            item.favorite
              ? "text-rose-500"
              : "text-slate-400 hover:text-rose-500",
            isBusy ? "cursor-wait opacity-70" : null,
          )}
          aria-label={t("Toggle wishlist")}
        >
          {isBusy ? (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500"
              aria-hidden="true"
            />
          ) : (
            <WishlistHeartIcon className="h-4 w-4" filled={item.favorite} />
          )}
        </button>
        <img
          src={imageSrc}
          alt={item.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
      <div className="mt-4 flex items-center gap-2">
        {item.colors.map((color, index) => (
          <span
            key={`${item.id}-color-${index}`}
            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">
        {item.name}
      </h3>
      <p className="text-xs text-slate-500">{item.subtitle}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="rounded-full border border-emerald-400 px-2 py-1 text-[11px] font-semibold text-emerald-600">
          {item.price}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <StarIcon className="h-3 w-3 text-amber-500" />
          <span className="font-semibold text-slate-700">
            {item.rating.toFixed(1)}
          </span>
          <span className="text-slate-400">
            ({item.reviewCount}{" "}
            {t(item.reviewCount === 1 ? "review" : "reviews")})
          </span>
        </div>
      </div>
    </article>
  );
}

function WishlistSkeletonGrid() {
  return (
    <div className="mt-8 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`wishlist-skeleton-${index}`}
          className="flex w-full flex-col animate-pulse"
        >
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-slate-100 shadow-sm ring-1 ring-black/5" />
          <div className="mt-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-100" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-100" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 h-4 w-32 rounded-full bg-slate-100" />
          <div className="mt-2 h-3 w-24 rounded-full bg-slate-100" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="h-6 w-16 rounded-full bg-slate-100" />
            <div className="h-4 w-20 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 4.5l1.7 3.6 4 .6-2.9 2.8.7 4-3.5-1.9-3.5 1.9.7-4-2.9-2.8 4-.6L12 4.5z"
        fill="currentColor"
      />
    </svg>
  );
}
