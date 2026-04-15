import clsx from "clsx";
import { ArrowRight, Check, ShoppingBag } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { useCart, type CartProduct } from "@/components/website/cart/cart-context";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { ProductColorOption } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { CatalogImage } from "../shared/CatalogImage";
import { StarIcon, WishlistHeartIcon } from "../shared/Icons";

export type CollectionProduct = {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  href?: string;
  cartProduct?: CartProduct | null;
  saleMode?: "INSTANT" | "QUOTE";
  image: string;
  colorOptions?: ProductColorOption[];
  sizeCount?: number;
  availabilityLabel?: string | null;
  badge?: string | null;
  rating?: number | null;
  reviewCount?: number;
  colors?: string[];
  favorite?: boolean;
  showActions?: boolean;
};

type ProductGridCardProps = {
  product: CollectionProduct;
  isWishlisted?: boolean;
  isWishlistBusy?: boolean;
  onToggleWishlist?: () => Promise<boolean> | void;
  className?: string;
};

export function ProductGridCard({
  product,
  isWishlisted = false,
  isWishlistBusy = false,
  onToggleWishlist,
  className,
}: ProductGridCardProps) {
  const { t, localizeHref } = useCisecoI18n();
  const { addItem } = useCart();
  const imageSrc = product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const productHref = localizeHref(product.href ?? "#");
  const productName = t(product.name);
  const [showCartFeedback, setShowCartFeedback] = useState(false);
  const showReviews =
    typeof product.rating === "number" &&
    Number.isFinite(product.rating) &&
    typeof product.reviewCount === "number" &&
    product.reviewCount > 0;
  const reviewLabel = showReviews
    ? t("{{reviewCount}} Reviews").replace(
        "{{reviewCount}}",
        String(product.reviewCount ?? 0),
      )
    : null;
  const showActions = product.showActions !== false;

  useEffect(() => {
    if (!showCartFeedback) return;
    const timeout = window.setTimeout(() => {
      setShowCartFeedback(false);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [showCartFeedback]);

  const handleAddToCartClick = () => {
    if (!product.cartProduct) return;
    const didAdd = addItem(product.cartProduct);
    if (didAdd) {
      setShowCartFeedback(true);
    }
  };

  const handleWishlistClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onToggleWishlist || isWishlistBusy) return;
    await onToggleWishlist();
  };

  return (
    <article
      className={clsx(
        "group self-start w-full overflow-hidden rounded-[28px] border border-black/5 bg-white/95 p-3 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.48)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)] sm:p-3.5",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(241,245,249,0.95)_44%,_rgba(226,232,240,0.92))]">
        <a
          href={productHref}
          className="block rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        >
          <div className="relative aspect-square overflow-hidden p-2 sm:p-2.5">
            <CatalogImage
              src={imageSrc}
              alt={productName}
              className="h-full w-full scale-[1.06] object-contain transition duration-500 ease-out group-hover:scale-[1.12]"
              sizes="(min-width: 1700px) 20vw, (min-width: 1280px) 30vw, (min-width: 1024px) 34vw, (min-width: 768px) 42vw, 92vw"
              loading="lazy"
            />
          </div>
        </a>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-wrap gap-2">
            {product.badge ? (
              <span className="inline-flex rounded-full border border-white/75 bg-white/90 px-2.5 py-1 text-[9px] font-semibold tracking-[0.08em] text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.65)] backdrop-blur-sm">
                {t(product.badge)}
              </span>
            ) : null}
            {product.availabilityLabel ? (
              <span className="inline-flex rounded-full border border-white/80 bg-white/88 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.65)] backdrop-blur-sm">
                {t(product.availabilityLabel)}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={handleWishlistClick}
          disabled={!onToggleWishlist || isWishlistBusy}
          aria-label={
            isWishlisted || product.favorite
              ? `${t("Remove from wishlist")} ${productName}`
              : `${t("Add to wishlist")} ${productName}`
          }
          aria-pressed={isWishlisted || product.favorite}
          aria-busy={isWishlistBusy}
          className={clsx(
            "absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/85 bg-white/92 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.75)] backdrop-blur-sm transition-[transform,color,background-color,border-color] duration-200 hover:-translate-y-0.5 sm:h-11 sm:w-11",
            isWishlisted
              ? "border-rose-200/80 bg-rose-50 text-rose-600"
              : "text-slate-500 hover:border-rose-100 hover:text-rose-500",
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
              className="h-[18px] w-[18px] transition-transform duration-300"
              filled={isWishlisted || product.favorite}
              strokeWidth={1.9}
            />
          )}
        </button>
      </div>

      <div className="pt-3.5">
        <div className="space-y-1.5">
          {product.subtitle ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:text-[11px]">
              {t(product.subtitle)}
            </p>
          ) : null}
          <h3 className="text-[15px] font-semibold leading-[1.42] text-slate-950 sm:text-[16px] lg:text-[17px]">
            <a
              href={productHref}
              aria-label={`${t("View details")} ${productName}`}
              className="line-clamp-3 rounded-sm transition-colors duration-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
            >
              {productName}
            </a>
          </h3>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
            style={{
              backgroundColor: "var(--site-accent-soft)",
              borderColor: "var(--site-accent-strong)",
            }}
          >
            {product.price}
          </span>
          {showReviews ? (
            <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-2.5 py-1 font-medium text-slate-600">
                <StarIcon className="h-3.5 w-3.5 text-amber-500" />
                <span className="tabular-nums text-slate-700">
                  {product.rating!.toFixed(1)}
                </span>
                <span className="text-slate-400">{reviewLabel}</span>
              </div>
            </div>
          ) : null}
        </div>

        {showActions ? (
          <div
            className={clsx(
              "relative z-10 mt-4 grid gap-2.5",
              product.cartProduct ? "sm:grid-cols-2" : "grid-cols-1",
            )}
          >
            <a
              href={productHref}
              aria-label={`${t("View details")} ${productName}`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-3 text-center text-[12px] font-semibold leading-tight text-slate-700 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.42)] transition-[transform,color,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-black/15 hover:bg-white hover:text-slate-950 hover:shadow-[0_18px_28px_-24px_rgba(15,23,42,0.42)] sm:text-[13px]"
            >
              <span>{t("Details")}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
            </a>
            {product.cartProduct ? (
              <button
                type="button"
                onClick={handleAddToCartClick}
                className={clsx(
                  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-4 py-3 text-center text-[12px] font-semibold leading-tight tracking-[0.005em] shadow-[0_16px_28px_-20px_rgba(15,23,42,0.85)] transition-[transform,box-shadow,background-color,color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(15,23,42,0.75)] sm:text-[13px]",
                  showCartFeedback
                    ? "bg-emerald-50 text-emerald-700 shadow-[0_16px_28px_-22px_rgba(16,185,129,0.55)]"
                    : "bg-slate-950 text-white",
                )}
              >
                {showCartFeedback ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={2.2} />
                ) : (
                  <ShoppingBag
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                    strokeWidth={1.9}
                  />
                )}
                <span>{showCartFeedback ? t("Added") : t("Add to cart")}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
