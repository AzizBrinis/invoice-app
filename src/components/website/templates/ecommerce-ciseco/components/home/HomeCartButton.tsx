"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useCart } from "@/components/website/cart/cart-context";
import { useCisecoI18n } from "../../i18n";
import { buildCisecoHref } from "../../utils";

const CartDrawer = dynamic(
  () => import("../cart/CartDrawer").then((mod) => mod.CartDrawer),
  {
    ssr: false,
    loading: () => null,
  },
);

type HomeCartButtonProps = {
  homeHref: string;
};

export function HomeCartButton({ homeHref }: HomeCartButtonProps) {
  const { t, localizeHref } = useCisecoI18n();
  const { totalItems, isHydrated } = useCart();
  const [open, setOpen] = useState(false);
  const total = isHydrated ? totalItems : 0;
  const cartHref = useMemo(
    () => localizeHref(buildCisecoHref(homeHref, "/cart")),
    [homeHref, localizeHref],
  );
  const checkoutHref = useMemo(
    () => localizeHref(buildCisecoHref(homeHref, "/checkout")),
    [homeHref, localizeHref],
  );

  return (
    <>
      <button
        type="button"
        className="relative flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-900"
        aria-label={t("Cart")}
        aria-controls="cart-drawer"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M6 7h13l-2 9H8L6 7z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="9" cy="19" r="1.5" fill="currentColor" />
          <circle cx="16" cy="19" r="1.5" fill="currentColor" />
        </svg>
        <span className="hidden sm:inline">{t("Cart")}</span>
        <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {total}
        </span>
      </button>
      <CartDrawer
        open={open}
        onClose={() => setOpen(false)}
        cartHref={cartHref}
        checkoutHref={checkoutHref}
      />
    </>
  );
}
