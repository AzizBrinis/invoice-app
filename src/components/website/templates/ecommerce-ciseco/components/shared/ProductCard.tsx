import clsx from "clsx";
import { ArrowRight, Check, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import type { ProductCardData } from "../../types";
import { WishlistHeartIcon } from "./Icons";
import { useCisecoI18n } from "../../i18n";
import { CatalogImage } from "./CatalogImage";

type ProductCardProps = {
  product: ProductCardData;
  variant?: "default" | "compact";
  href?: string;
  onAddToCart?: () => boolean;
  onToggleWishlist?: () => Promise<boolean> | void;
  isWishlisted?: boolean;
  isWishlistBusy?: boolean;
};

type ProductCardSkeletonProps = {
  variant?: "default" | "compact";
};

export function ProductCard({
  product,
  variant = "default",
  href,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  isWishlistBusy = false,
}: ProductCardProps) {
  const { t, localizeHref } = useCisecoI18n();
  const isCompact = variant === "compact";
  const [showCartFeedback, setShowCartFeedback] = useState(false);
  const productName = t(product.name);
  const productCategory = t(product.category);
  const productBadge = product.badge ? t(product.badge) : null;
  const productHref = localizeHref(href ?? "#");
  const showReviews =
    typeof product.rating === "number" &&
    Number.isFinite(product.rating) &&
    (product.reviewCount ?? 0) > 0;
  const reviewLabel = showReviews
    ? t("{{reviewCount}} Reviews").replace(
        "{{reviewCount}}",
        String(product.reviewCount ?? 0),
      )
    : null;

  useEffect(() => {
    if (!showCartFeedback) return;
    const timeout = window.setTimeout(() => {
      setShowCartFeedback(false);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [showCartFeedback]);

  const handleWishlistClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onToggleWishlist || isWishlistBusy) return;
    await onToggleWishlist();
  };

  const handleAddToCartClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onAddToCart) return;
    const didAdd = onAddToCart();
    if (didAdd) {
      setShowCartFeedback(true);
    }
  };

  return (
    <article
      className={clsx(
        "group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white/95 p-3.5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.55)] transition-transform duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_28px_60px_-36px_rgba(15,23,42,0.48)] sm:p-3",
        isCompact && "rounded-[24px] p-2.5",
      )}
    >
      <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(241,245,249,0.95)_44%,_rgba(226,232,240,0.92))]">
        <a
          href={productHref}
          className="block"
          aria-label={`${t("View details")} ${productName}`}
        >
          <div className="relative aspect-square overflow-hidden">
            <CatalogImage
              src={product.image}
              alt={productName}
              className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.05]"
              sizes={
                isCompact
                  ? "(min-width: 1024px) 16vw, (min-width: 640px) 24vw, 42vw"
                  : "(min-width: 1024px) 22vw, (min-width: 640px) 44vw, 92vw"
              }
              loading="lazy"
            />
          </div>
        </a>
        {productBadge ? (
          <span className="absolute left-3 top-3 z-20 rounded-full border border-white/75 bg-white/90 px-2.5 py-1 text-[9px] font-semibold tracking-[0.08em] text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.65)] backdrop-blur-sm">
            {productBadge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleWishlistClick}
          disabled={!onToggleWishlist || isWishlistBusy}
          aria-label={
            isWishlisted
              ? `${t("Remove from wishlist")} ${productName}`
              : `${t("Add to wishlist")} ${productName}`
          }
          aria-pressed={isWishlisted}
          aria-busy={isWishlistBusy}
          className={clsx(
            "absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/85 bg-white/92 text-xs shadow-[0_16px_32px_-24px_rgba(15,23,42,0.75)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-0.5 active:scale-95 sm:h-10 sm:w-10",
            isWishlisted
              ? "border-rose-200/80 bg-rose-50 text-rose-600 shadow-[0_18px_34px_-24px_rgba(244,63,94,0.65)]"
              : "text-slate-600 hover:border-rose-100 hover:bg-white hover:text-rose-500",
            isWishlistBusy ? "cursor-wait opacity-80" : null,
          )}
        >
          {isWishlistBusy ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500"
              aria-hidden="true"
            />
          ) : (
            <WishlistHeartIcon
              key={isWishlisted ? "wishlisted" : "idle"}
              className={clsx(
                "h-[18px] w-[18px] transition-transform duration-300",
                isWishlisted && "animate-ciseco-heart-pop",
              )}
              filled={isWishlisted}
              strokeWidth={1.9}
            />
          )}
        </button>
      </div>

      <div className={clsx("flex flex-1 flex-col", isCompact ? "mt-2.5" : "mt-3.5")}>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
          <span className="ciseco-card-meta">
            {productCategory}
          </span>
          <span
            className="ciseco-price-chip inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
            style={{
              backgroundColor: "var(--site-accent-soft)",
              borderColor: "var(--site-accent-strong)",
            }}
          >
            {product.price}
          </span>
        </div>

        <h3 className="mt-2 ciseco-card-title line-clamp-2 text-[17px] leading-[1.32] text-slate-950">
          <a
            href={productHref}
            className="rounded-sm transition-colors duration-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
          >
            {productName}
          </a>
        </h3>

        {showReviews ? (
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100/80 px-2.5 py-1 font-medium text-slate-600">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-500">
                <path
                  d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                  fill="currentColor"
                />
              </svg>
              <span className="tabular-nums text-slate-700">
                {product.rating!.toFixed(1)}
              </span>
              <span className="text-slate-400">{reviewLabel}</span>
            </div>
          </div>
        ) : null}

        <div className="relative z-20 mt-3.5 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <a
            href={productHref}
            aria-label={`${t("View details")} ${productName}`}
            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-slate-600 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.42)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-black/15 hover:bg-white hover:text-slate-950 hover:shadow-[0_18px_28px_-24px_rgba(15,23,42,0.42)] lg:min-h-0 lg:w-auto lg:justify-start lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none"
          >
            <span>{t("View details")}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
          </a>
          {!isCompact && onAddToCart ? (
            <button
              type="button"
              onClick={handleAddToCartClick}
              className={clsx(
                "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-semibold leading-none tracking-[0.005em] shadow-[0_16px_28px_-20px_rgba(15,23,42,0.85)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(15,23,42,0.75)] active:translate-y-0 lg:min-h-10 lg:w-auto lg:px-3.5 lg:py-2 lg:text-[12px] xl:px-4 xl:text-[13px]",
                showCartFeedback
                  ? "bg-emerald-50 text-emerald-700 shadow-[0_16px_28px_-22px_rgba(16,185,129,0.55)]"
                  : "bg-slate-950 text-white",
              )}
            >
              {showCartFeedback ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.2} />
              ) : (
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
              )}
              <span className="whitespace-nowrap text-center">
                {showCartFeedback ? t("Added") : t("Add to cart")}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton({
  variant = "default",
}: ProductCardSkeletonProps) {
  const isCompact = variant === "compact";
  return (
    <div
      className={clsx(
        "flex h-full animate-pulse flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white/95 p-3.5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.35)] sm:p-3",
        isCompact && "rounded-[24px] p-2.5",
      )}
    >
      <div className="relative overflow-hidden rounded-[24px] bg-slate-50">
        <div className="aspect-square bg-slate-100" />
      </div>
      <div className={clsx("flex flex-1 flex-col", isCompact ? "mt-2.5" : "mt-3.5")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-3 w-20 rounded-full bg-slate-100" />
          <div className="h-9 w-24 rounded-full bg-slate-100" />
        </div>
        <div className="mt-2 h-5 w-36 rounded-full bg-slate-100" />
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="h-7 w-16 rounded-full bg-slate-100" />
          <div className="h-7 w-28 rounded-full bg-slate-100" />
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-3 w-20 rounded-full bg-slate-100" />
          {!isCompact ? <div className="h-11 w-full rounded-full bg-slate-100 sm:h-10 sm:w-28" /> : null}
        </div>
      </div>
    </div>
  );
}
