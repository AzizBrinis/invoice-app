"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CART_ITEM_ADDED_EVENT,
  useCart,
} from "@/components/website/cart/cart-context";
import { NAV_ITEMS } from "../../data/navigation";
import type { ThemeTokens } from "../../types";
import {
  buildCisecoHref,
  buildCisecoHrefWithQuery,
  resolveCisecoNavigationHref,
} from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { useCisecoLocation, useCisecoNavigation } from "../../navigation";

const CartDrawer = dynamic(
  () => import("../cart/CartDrawer").then((mod) => mod.CartDrawer),
  {
    ssr: false,
    loading: () => null,
  },
);
const AccountMenu = dynamic(
  () => import("./AccountMenu").then((mod) => mod.AccountMenu),
);
const LocaleCurrencyMenu = dynamic(
  () =>
    import("./LocaleCurrencyMenu").then((mod) => mod.LocaleCurrencyMenu),
);

type NavbarProps = {
  theme: ThemeTokens;
  companyName: string;
  homeHref?: string;
};

export function Navbar({ theme, companyName, homeHref = "#" }: NavbarProps) {
  const { t, localizeHref } = useCisecoI18n();
  const { searchParams } = useCisecoLocation();
  const { navigate } = useCisecoNavigation();
  const { totalItems, isHydrated } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const cartCount = isHydrated ? totalItems : 0;
  const cartHref = useMemo(
    () => localizeHref(buildCisecoHref(homeHref, "/cart")),
    [homeHref, localizeHref],
  );
  const checkoutHref = useMemo(
    () => localizeHref(buildCisecoHref(homeHref, "/checkout")),
    [homeHref, localizeHref],
  );
  const searchHref = useMemo(
    () => localizeHref(buildCisecoHref(homeHref, "/search")),
    [homeHref, localizeHref],
  );
  const mobileLinks = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        resolvedHref: resolveCisecoNavigationHref({
          href: item.href,
          homeHref,
        }),
      })),
    [homeHref],
  );
  const mobileLogoSizeClassName =
    companyName.length > 16
      ? "text-[clamp(0.95rem,4vw,1.05rem)]"
      : companyName.length > 11
        ? "text-[clamp(1rem,4.35vw,1.12rem)]"
        : "text-[clamp(1.05rem,4.7vw,1.18rem)]";

  useEffect(() => {
    const handleCartItemAdded = () => {
      setCartOpen(true);
    };
    window.addEventListener(CART_ITEM_ADDED_EVENT, handleCartItemAdded);
    return () => {
      window.removeEventListener(CART_ITEM_ADDED_EVENT, handleCartItemAdded);
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSearchOpen(false);
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchPanelRef.current?.contains(target)) return;
      if (searchTriggerRef.current?.contains(target)) return;
      setSearchOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMobileMenuOpen(false);
    };

    const docEl = document.documentElement;
    const previousOverflow = docEl.style.overflow;
    const previousPaddingRight = docEl.style.paddingRight;
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;

    docEl.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      docEl.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      docEl.style.overflow = previousOverflow;
      docEl.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen((current) => {
      const next = !current;
      if (next) {
        setSearchOpen(false);
      }
      return next;
    });
  };

  const toggleSearch = () => {
    const nextQuery = searchParams.get("q") ?? "";
    setSearchOpen((current) => {
      const next = !current;
      if (next) {
        setSearchValue(nextQuery);
        setMobileMenuOpen(false);
      }
      return next;
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(
      localizeHref(
        buildCisecoHrefWithQuery(homeHref, "/search", {
          q: searchValue.trim() || undefined,
        }),
      ),
    );
  };

  return (
    <header className="relative z-[60] border-b border-black/5 bg-white">
      <div
        className={clsx(
          "mx-auto flex h-[68px] items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8",
          theme.containerClass,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3 lg:flex-none">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 text-slate-700 lg:hidden"
            aria-label={mobileMenuOpen ? t("Close menu") : t("Open menu")}
            aria-controls="ciseco-mobile-nav"
            aria-expanded={mobileMenuOpen}
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M7 7l10 10M17 7L7 17"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
          <a
            href={localizeHref(homeHref)}
            className={clsx(
              "inline-flex min-w-0 flex-1 items-baseline whitespace-nowrap font-bold leading-none tracking-tight text-slate-900 sm:flex-none sm:text-[25px] lg:text-[30px]",
              "max-w-[calc(100vw-12rem)] sm:max-w-[15rem] lg:max-w-none",
              mobileLogoSizeClassName,
            )}
          >
            <span>{companyName}</span>
            <span className="shrink-0 text-[var(--site-accent)]">.</span>
          </a>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
          {mobileLinks.map((item) => (
            <a
              key={item.label}
              href={localizeHref(item.resolvedHref)}
              className="transition hover:text-slate-900"
            >
              {t(item.label)}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LocaleCurrencyMenu />
          <button
            ref={searchTriggerRef}
            type="button"
            className="hidden h-11 w-11 items-center justify-center rounded-full border border-black/10 text-slate-700 transition hover:border-black/20 hover:text-slate-900 sm:flex"
            aria-label={t("Search")}
            aria-controls="ciseco-search-panel"
            aria-expanded={searchOpen}
            onClick={toggleSearch}
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
            className="relative flex min-h-11 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:border-black/20 hover:text-slate-900 sm:gap-2 sm:text-xs"
            aria-label={t("Cart")}
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
            <span className="hidden sm:inline">{t("Cart")}</span>
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px]",
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

      <div
        ref={searchPanelRef}
        id="ciseco-search-panel"
        className={clsx(
          "fixed inset-x-0 top-[68px] z-[75] px-3 pt-3 transition-[opacity,transform] duration-200 sm:absolute sm:top-full sm:px-4 lg:px-0",
          searchOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0",
        )}
      >
        <div
          className={clsx(
            "mx-auto",
            theme.containerClass,
          )}
        >
          <div className="overflow-hidden rounded-[24px] border border-black/5 bg-white/97 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.38)] backdrop-blur sm:rounded-[30px]">
            <form
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4"
              onSubmit={handleSearchSubmit}
            >
              <div className="flex flex-1 items-center gap-3 rounded-full border border-black/10 bg-slate-50/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" aria-hidden="true">
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
                <input
                  type="search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={t("Search products, collections, or categories")}
                  aria-label={t("Search catalogue")}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none sm:text-base"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={clsx(
                    theme.buttonShape,
                    "inline-flex h-11 flex-1 items-center justify-center bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 sm:flex-none sm:px-5",
                  )}
                >
                  {t("Search")}
                </button>
                {searchParams.get("q") ? (
                  <a
                    href={searchHref}
                    className={clsx(
                      theme.buttonShape,
                      "inline-flex h-11 flex-1 items-center justify-center border border-black/10 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none sm:px-5",
                    )}
                  >
                    {t("Clear")}
                  </a>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      </div>

      <div
        id="ciseco-mobile-nav"
        className={clsx(
          "fixed inset-0 top-[68px] z-50 lg:hidden sm:top-[72px]",
          mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          className={clsx(
            "absolute inset-0 bg-slate-950/18 transition-opacity duration-200",
            mobileMenuOpen ? "opacity-100" : "opacity-0",
          )}
          aria-label={t("Close menu")}
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={clsx(
            "absolute inset-x-3 top-3 rounded-[30px] border border-black/5 bg-white p-4 shadow-[0_24px_64px_rgba(15,23,42,0.18)] transition-[opacity,transform] duration-200 sm:inset-x-6",
            mobileMenuOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0",
          )}
        >
          <div className="space-y-1">
            {mobileLinks.map((item) => (
              <a
                key={`mobile-${item.label}`}
                href={localizeHref(item.resolvedHref)}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{t(item.label)}</span>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" aria-hidden="true">
                  <path
                    d="M9 6.5L14.5 12 9 17.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </a>
            ))}
          </div>
          <div className="mt-4 grid gap-2 border-t border-black/5 pt-4 sm:grid-cols-2">
            <button
              type="button"
              className={clsx(
                theme.buttonShape,
                "inline-flex h-11 items-center justify-center border border-black/10 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50",
              )}
              onClick={() => {
                setMobileMenuOpen(false);
                setSearchValue(searchParams.get("q") ?? "");
                setSearchOpen(true);
              }}
            >
              {t("Search")}
            </button>
            <a
              href={cartHref}
              className={clsx(
                theme.buttonShape,
                "inline-flex h-11 items-center justify-center bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800",
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("View cart")}
            </a>
          </div>
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
