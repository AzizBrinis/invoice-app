"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useAccountProfile } from "../../hooks/useAccountProfile";
import { useCisecoI18n } from "../../i18n";
import { useCisecoLocation, useCisecoNavigation } from "../../navigation";

const FOCUSABLE_SELECTORS =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

const DEFAULT_NAME = "Eden Smith";
const DEFAULT_LOCATION = "Los Angeles, CA";

type MenuItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: (props: { className?: string }) => JSX.Element;
};

function resolveBasePath(pathname: string | null) {
  if (!pathname) return "";
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "catalogue" && segments[1]) {
    return `/catalogue/${segments[1]}`;
  }
  return "";
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function AccountMenu() {
  const { t, localizeHref } = useCisecoI18n();
  const { pathname } = useCisecoLocation();
  const { navigate } = useCisecoNavigation();
  const basePath = useMemo(() => resolveBasePath(pathname), [pathname]);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [renderMenu, setRenderMenu] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const { profile, authStatus, clearProfile, loginHref, refreshProfile } = useAccountProfile({
    redirectOnUnauthorized: false,
    loadStrategy: "manual",
  });

  const displayName = profile.name?.trim() || DEFAULT_NAME;
  const location = profile.address?.trim() || DEFAULT_LOCATION;
  const isAuthenticated = authStatus === "authenticated";
  const signupHref = basePath ? `${basePath}/signup` : "/signup";
  const helpHref = `${basePath}/contact`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setRenderMenu(true);
      const frame = window.requestAnimationFrame(() => {
        setMenuVisible(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setMenuVisible(false);
    const timeout = window.setTimeout(() => {
      setRenderMenu(false);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (!isMobile || event.key !== "Tab" || !menuRef.current) {
        return;
      }

      const focusable = menuRef.current.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTORS,
      );
      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || isMobile) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || !isMobile) {
      return;
    }

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    const triggerElement = triggerRef.current;

    const docEl = document.documentElement;
    const body = document.body;
    const previousOverflow = docEl.style.overflow;
    const previousPaddingRight = docEl.style.paddingRight;
    const previousTouchAction = body.style.touchAction;
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;

    docEl.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      docEl.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.style.touchAction = "none";

    const focusTimeout = window.setTimeout(() => {
      const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTORS,
      );
      if (focusable?.length) {
        focusable[0].focus();
      } else {
        menuRef.current?.focus();
      }
    }, 0);

    return () => {
      window.clearTimeout(focusTimeout);
      docEl.style.overflow = previousOverflow;
      docEl.style.paddingRight = previousPaddingRight;
      body.style.touchAction = previousTouchAction;
      triggerElement?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || authStatus !== "authenticated") {
      return;
    }

    refreshProfile();
  }, [authStatus, open, refreshProfile]);

  const closeMenu = () => setOpen(false);
  const toggleMenu = () => {
    setOpen((prev) => !prev);
  };

  const menuItemsPrimary: MenuItem[] = isAuthenticated
    ? [
        {
          label: t("My Account"),
          href: localizeHref(`${basePath}/account`),
          icon: UserIcon,
        },
        {
          label: t("My Orders"),
          href: localizeHref(`${basePath}/account/orders-history`),
          icon: OrdersIcon,
        },
        {
          label: t("Billing"),
          href: localizeHref(`${basePath}/account/billing`),
          icon: OrdersIcon,
        },
        {
          label: t("Wishlist"),
          href: localizeHref(`${basePath}/account/wishlists`),
          icon: HeartIcon,
        },
      ]
    : [
        {
          label: t("Sign in"),
          href: localizeHref(loginHref),
          icon: LoginIcon,
        },
        {
          label: t("Sign up"),
          href: localizeHref(signupHref),
          icon: UserPlusIcon,
        },
      ];

  const handleLogout = async () => {
    try {
      clearProfile();
      const response = await fetch("/api/catalogue/logout", {
        method: "POST",
      });
      if (!response.ok) {
        console.warn("[AccountMenu] Logout failed.");
      }
    } catch (error) {
      console.warn("[AccountMenu] Logout failed.", error);
    } finally {
      closeMenu();
      navigate(localizeHref(loginHref));
    }
  };

  const menuItemsSecondary: MenuItem[] = isAuthenticated
    ? [
        {
          label: t("Help"),
          href: localizeHref(helpHref),
          icon: HelpIcon,
        },
        {
          label: t("Log out"),
          onClick: handleLogout,
          icon: LogoutIcon,
        },
      ]
    : [
        {
          label: t("Help"),
          href: localizeHref(helpHref),
          icon: HelpIcon,
        },
      ];

  const menuCard = (
    <div
      ref={menuRef}
      id="account-menu"
      role="menu"
      aria-label={t("Account menu")}
      tabIndex={-1}
      className={clsx(
        "w-[min(22rem,calc(100vw-2.5rem))] rounded-[24px] border border-slate-100 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:w-[280px]",
        "px-5 py-4 text-slate-900",
        "origin-top-right transition duration-200 ease-out",
        menuVisible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-2 scale-95 opacity-0",
      )}
    >
      {isAuthenticated ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {displayName}
            </p>
            <p className="text-xs text-slate-500">{location}</p>
          </div>
          <div className="my-4 h-px w-full bg-slate-100" />
        </>
      ) : null}
      <div className="space-y-1">
        {menuItemsPrimary.map((item) => (
          <MenuItemRow key={item.label} item={item} onClose={closeMenu} />
        ))}
      </div>
      {menuItemsSecondary.length ? (
        <>
          <div className="my-3 h-px w-full bg-slate-100" />
          <div className="space-y-1">
            {menuItemsSecondary.map((item) => (
              <MenuItemRow
                key={item.label}
                item={item}
                onClose={closeMenu}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-haspopup="menu"
        aria-label={t("Account menu")}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-slate-700 transition hover:border-black/20 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <circle
            cx="12"
            cy="8"
            r="3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </button>

      {renderMenu && !isMobile ? (
        <div
          className={clsx(
            "absolute right-0 top-full z-[90] mt-3",
            menuVisible ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          {menuCard}
        </div>
      ) : null}

      {mounted && renderMenu && isMobile
        ? createPortal(
            <>
              <div
                className={clsx(
                  "fixed inset-0 z-[80] bg-slate-900/20 backdrop-blur-[2px] transition-opacity duration-200",
                  menuVisible
                    ? "opacity-100"
                    : "pointer-events-none opacity-0",
                )}
                aria-hidden="true"
                onClick={closeMenu}
              />
              <div
                className={clsx(
                  "fixed inset-0 z-[90] flex items-start justify-center px-6 pt-24 transition-opacity duration-200",
                  menuVisible ? "opacity-100" : "opacity-0",
                )}
                role="dialog"
                aria-modal="true"
              >
                {menuCard}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuItemRow({
  item,
  onClose,
}: {
  item: MenuItem;
  onClose: () => void;
}) {
  const Icon = item.icon;
  const className =
    "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900";

  if (item.href) {
    return (
      <a
        href={item.href}
        role="menuitem"
        className={className}
        onClick={onClose}
      >
        <Icon className="h-5 w-5 text-slate-500 transition group-hover:text-slate-700" />
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={() => {
        item.onClick?.();
        onClose();
      }}
    >
      <Icon className="h-5 w-5 text-slate-500 transition group-hover:text-slate-700" />
      <span>{item.label}</span>
    </button>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function LoginIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20H14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 8l-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 12h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="11"
        cy="8"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M5.5 20c1.6-3 4.3-4.5 7.5-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M17 9v6M14 12h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="5"
        y="4"
        width="14"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M9 4.5h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 10h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 14h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 20s-6.5-4.1-8.4-8.1c-1.4-3.1 0.7-6.5 3.9-6.5 1.9 0 3.4 1 4.5 2.4 1.1-1.4 2.6-2.4 4.5-2.4 3.2 0 5.3 3.4 3.9 6.5C18.5 15.9 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M9.6 9.1a2.6 2.6 0 0 1 4.8 1.3c0 2-2.4 2-2.4 3.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 12H10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
