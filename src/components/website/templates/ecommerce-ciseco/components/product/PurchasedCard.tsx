import clsx from "clsx";
import type { PurchasedProductCard } from "../../types";
import { StarIcon } from "../shared/Icons";

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
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative overflow-hidden rounded-2xl bg-slate-50">
        <div className="aspect-[4/5]">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            {product.badge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggleWishlist}
          disabled={!onToggleWishlist || isWishlistBusy}
          aria-busy={isWishlistBusy}
          aria-label={
            isWishlisted ? "Remove from wishlist" : "Add to wishlist"
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
            <HeartIcon className="h-4 w-4" filled={isWishlisted} />
          )}
        </button>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            {product.price}
          </span>
          <div className="flex items-center gap-1">
            <StarIcon className="h-3 w-3 text-amber-500" />
            <span>{product.rating.toFixed(1)}</span>
            <span className="text-slate-400">({product.reviewCount})</span>
          </div>
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

type HeartIconProps = {
  className?: string;
  filled?: boolean;
};

function HeartIcon({ className, filled }: HeartIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 20s-6.5-3.7-8.5-7.6C1.6 9.4 3.1 6 6.4 6c1.9 0 3.2 1 3.6 2.1C10.4 7 11.7 6 13.6 6c3.3 0 4.8 3.4 2.9 6.4C18.5 16.3 12 20 12 20z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
