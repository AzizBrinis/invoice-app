"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { useCart } from "@/components/website/cart/cart-context";
import { NAV_ITEMS } from "../../data/navigation";
import type { ThemeTokens } from "../../types";
import { buildCisecoHref } from "../../utils";
import { CartDrawer } from "../cart/CartDrawer";
import { AccountMenu } from "./AccountMenu";

type NavbarProps = {
  theme: ThemeTokens;
  companyName: string;
  homeHref?: string;
};

export function Navbar({ theme, companyName, homeHref = "#" }: NavbarProps) {
  const { totalItems, isHydrated } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const cartCount = isHydrated ? totalItems : 0;
  const cartHref = useMemo(
    () => buildCisecoHref(homeHref, "/cart"),
    [homeHref],
  );
  const checkoutHref = useMemo(
    () => buildCisecoHref(homeHref, "/checkout"),
    [homeHref],
  );

  return (
    <header className="relative z-[60] border-b border-black/5 bg-white">
      <div
        className={clsx(
          "mx-auto flex h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8",
          theme.containerClass,
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-slate-700 lg:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <a href={homeHref} className="text-[30px] font-bold leading-none tracking-tight text-slate-900">
            {companyName}
            <span className="text-[var(--site-accent)]">.</span>
          </a>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href="#"
              className="transition hover:text-slate-900"
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-black/10 text-slate-700 sm:flex"
            aria-label="Search"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r="6.5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M16 16l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <AccountMenu />
          <button
            type="button"
            className="relative flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-900"
            aria-label="Cart"
            aria-controls="cart-drawer"
            aria-expanded={cartOpen}
            aria-haspopup="dialog"
            onClick={() => setCartOpen((current) => !current)}
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
            <span className="hidden sm:inline">Cart</span>
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                cartCount > 0
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-600",
              )}
            >
              {cartCount}
            </span>
          </button>
        </div>
      </div>
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartHref={cartHref}
        checkoutHref={checkoutHref}
      />
    </header>
  );
}
