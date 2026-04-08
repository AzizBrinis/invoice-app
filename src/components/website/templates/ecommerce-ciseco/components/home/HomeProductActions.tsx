"use client";

import clsx from "clsx";
import { Check, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/components/website/cart/cart-context";
import type { HomeProduct } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { useWishlist } from "../../hooks/useWishlist";
import { toCartProduct } from "../../utils";
import { WishlistHeartIcon } from "../shared/Icons";

type HomeProductActionsProps = {
  product: HomeProduct;
  catalogSlug: string;
  loginHref: string;
  loadWishlistOnMount: boolean;
};

export function HomeProductActions({
  product,
  catalogSlug,
  loginHref,
  loadWishlistOnMount,
}: HomeProductActionsProps) {
  const { t } = useCisecoI18n();
  const { addItem } = useCart();
  const [showCartFeedback, setShowCartFeedback] = useState(false);
  const { isWishlisted, toggleWishlist, pendingIds } = useWishlist({
    redirectOnLoad: false,
    redirectOnAction: true,
    slug: catalogSlug,
    loginHref,
    loadStrategy: loadWishlistOnMount ? "idle" : "manual",
  });
  const isWishlistBusy = pendingIds.has(product.id);
  const wishlisted = isWishlisted(product.id);

  useEffect(() => {
    if (!showCartFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setShowCartFeedback(false);
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [showCartFeedback]);

  return (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
      <button
        type="button"
        onClick={() => {
          void toggleWishlist(product.id);
        }}
        disabled={isWishlistBusy}
        aria-label={
          wishlisted
            ? `${t("Remove from wishlist")} ${t(product.name)}`
            : `${t("Add to wishlist")} ${t(product.name)}`
        }
        aria-pressed={wishlisted}
        aria-busy={isWishlistBusy}
        className={clsx(
          "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:border-black/15 hover:text-slate-900",
          isWishlistBusy ? "cursor-wait opacity-80" : null,
          wishlisted ? "border-rose-200/80 bg-rose-50 text-rose-600" : null,
        )}
      >
        {isWishlistBusy ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500"
            aria-hidden="true"
          />
        ) : (
          <WishlistHeartIcon
            className={clsx(
              "h-[18px] w-[18px] transition-transform duration-300",
              wishlisted && "animate-ciseco-heart-pop",
            )}
            filled={wishlisted}
            strokeWidth={1.9}
          />
        )}
        <span>{t("Wishlist")}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          const didAdd = addItem(toCartProduct(product));
          if (didAdd) {
            setShowCartFeedback(true);
          }
        }}
        className={clsx(
          "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-semibold leading-none tracking-[0.005em] shadow-[0_16px_28px_-20px_rgba(15,23,42,0.85)] transition-[transform,box-shadow,background-color,color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(15,23,42,0.75)] active:translate-y-0",
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
        <span>{showCartFeedback ? t("Added") : t("Add to cart")}</span>
      </button>
    </div>
  );
}
