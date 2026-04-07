import clsx from "clsx";
import { useEffect, useState } from "react";
import { useCart, type CartProduct } from "@/components/website/cart/cart-context";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import { useCisecoI18n } from "../../i18n";
import { StarIcon, WishlistHeartIcon } from "../shared/Icons";

export type CollectionProduct = {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  href?: string;
  cartProduct?: CartProduct | null;
  rating: number;
  reviewCount: number;
  image: string;
  colors: string[];
  badge?: string;
  favorite?: boolean;
  showActions?: boolean;
};

type ProductGridCardProps = {
  product: CollectionProduct;
};

export function ProductGridCard({ product }: ProductGridCardProps) {
  const { t, localizeHref } = useCisecoI18n();
  const { addItem } = useCart();
  const imageSrc = product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const [showCartFeedback, setShowCartFeedback] = useState(false);

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

  return (
    <article className="group flex h-full flex-col">
      <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-white p-3 shadow-sm">
        <a
          href={localizeHref(product.href ?? "#")}
          className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        >
          <div className="relative overflow-hidden rounded-2xl bg-slate-50 p-6">
            <div className="aspect-square">
              <img
                src={imageSrc}
                alt={t(product.name)}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </a>
        {product.badge ? (
          <span className="absolute left-4 top-4 z-10 inline-flex items-center rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
            {t(product.badge)}
          </span>
        ) : null}
        <button
          type="button"
          className={clsx(
            "absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition",
            product.favorite
              ? "text-rose-500"
              : "text-slate-400 hover:text-rose-500",
          )}
          aria-label={t("Toggle wishlist")}
        >
          <WishlistHeartIcon className="h-4 w-4" filled={product.favorite} />
        </button>
        {product.showActions ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-center gap-1.5 rounded-[22px] bg-white/95 px-2.5 py-2.5 shadow-sm opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
            <button
              type="button"
              onClick={handleAddToCartClick}
              disabled={!product.cartProduct}
              className={clsx(
                "inline-flex min-h-8 min-w-0 flex-1 items-center justify-center rounded-full px-2.5 py-1.5 text-[9px] font-semibold leading-none transition sm:px-3 sm:text-[10px]",
                showCartFeedback
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-900 text-white",
                !product.cartProduct && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="whitespace-nowrap text-center">
                {showCartFeedback ? t("Added") : t("Add to bag")}
              </span>
            </button>
            <a
              href={localizeHref(product.href ?? "#")}
              className="inline-flex min-h-8 min-w-0 flex-1 items-center justify-center rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-[9px] font-semibold leading-none text-slate-600 sm:px-3 sm:text-[10px]"
            >
              <span className="whitespace-nowrap text-center">
                {t("Quick view")}
              </span>
            </a>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {product.colors.map((color, index) => (
          <span
            key={`${product.id}-color-${index}`}
            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">
        <a href={localizeHref(product.href ?? "#")} className="transition hover:text-slate-700">
          {t(product.name)}
        </a>
      </h3>
      <p className="text-xs text-slate-500">{t(product.subtitle)}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="rounded-full border border-emerald-400 px-2 py-1 text-[11px] font-semibold text-emerald-600">
          {product.price}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <StarIcon className="h-3 w-3 text-amber-500" />
          <span className="font-semibold text-slate-700">
            {product.rating.toFixed(1)}
          </span>
          <span className="text-slate-400">
            ({product.reviewCount} {t("reviews")})
          </span>
        </div>
      </div>
    </article>
  );
}
