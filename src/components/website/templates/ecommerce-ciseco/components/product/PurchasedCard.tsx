import clsx from "clsx";
import type { PurchasedProductCard } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { StarIcon, WishlistHeartIcon } from "../shared/Icons";

type PurchasedCardProps = {
  product: PurchasedProductCard;
  onToggleWishlist?: () => void;
  isWishlisted?: boolean;
  isWishlistBusy?: boolean;
};

export function PurchasedCard({
  product,
  onToggleWishlist,
  isWishlisted = false,
  isWishlistBusy = false,
}: PurchasedCardProps) {
  const { t, localizeHref } = useCisecoI18n();
  const href = product.href?.trim() || null;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative overflow-hidden rounded-2xl bg-slate-50">
        {href ? (
          <a
            href={localizeHref(href)}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
          >
            <div className="aspect-[4/5]">
              <img
                src={product.image}
                alt={t(product.name)}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
          </a>
        ) : (
          <div className="aspect-[4/5]">
            <img
              src={product.image}
              alt={t(product.name)}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        )}
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            {t(product.badge)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggleWishlist}
          disabled={!onToggleWishlist || isWishlistBusy}
          aria-busy={isWishlistBusy}
          aria-label={
            isWishlisted ? t("Remove from wishlist") : t("Add to wishlist")
          }
          className={clsx(
            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-xs shadow-sm transition",
            isWishlisted
              ? "text-rose-500"
              : "text-slate-700 hover:text-rose-500",
            isWishlistBusy ? "cursor-wait opacity-70" : null,
          )}
        >
          {isWishlistBusy ? (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500"
              aria-hidden="true"
            />
          ) : (
            <WishlistHeartIcon className="h-4 w-4" filled={isWishlisted} />
          )}
        </button>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {href ? (
            <a
              href={localizeHref(href)}
              className="transition hover:text-slate-700"
            >
              {t(product.name)}
            </a>
          ) : (
            t(product.name)
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            {product.price}
          </span>
          {product.reviewCount > 0 ? (
            <div className="flex items-center gap-1">
              <StarIcon className="h-3 w-3 text-amber-500" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-slate-400">({product.reviewCount})</span>
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex items-center gap-1 pt-2">
          {product.colors.map((color, index) => (
            <span
              key={`${product.id}-color-${index}`}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
