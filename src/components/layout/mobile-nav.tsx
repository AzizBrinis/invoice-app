"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  type NavItem,
  NAV_ICON_MAP,
  navSubmenuId,
} from "@/components/layout/sidebar-nav";

const FOCUSABLE_SELECTORS =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const portalTarget = mounted ? document.body : null;

  useEffect(() => {
    // Allowed: we need to delay portal rendering until after hydration completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

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
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimeout);
      docEl.style.overflow = previousOverflow;
      docEl.style.paddingRight = previousPaddingRight;
      body.style.touchAction = previousTouchAction;
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return;
      }

      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
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
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggleDrawer = () => setOpen((prev) => !prev);
  const closeDrawer = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={toggleDrawer}
        aria-expanded={open}
        aria-controls="mobile-sidebar"
        aria-label={
          open ? "Fermer le menu principal" : "Ouvrir le menu principal"
        }
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {open ? (
          <X aria-hidden="true" className="h-5 w-5" />
        ) : (
          <Menu aria-hidden="true" className="h-5 w-5" />
        )}
        <span className="sr-only">
          {open ? "Fermer le menu principal" : "Ouvrir le menu principal"}
        </span>
      </button>

      {portalTarget
        ? createPortal(
            <>
              <div
                className={clsx(
                  "fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm transition-opacity duration-300",
                  open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
                aria-hidden="true"
                onClick={closeDrawer}
              />

              <aside
                ref={drawerRef}
                id="mobile-sidebar"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation principale"
                tabIndex={-1}
                className={clsx(
                  "fixed inset-y-0 left-0 z-[80] flex w-full max-w-sm flex-col border-r border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950",
                  open ? "translate-x-0" : "-translate-x-full",
                )}
                style={{
                  maxWidth: "min(22rem, calc(100vw - 2rem))",
                  paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
                  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
                }}
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-400">
                        Menu principal
                      </p>
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        Navigation
                      </p>
                    </div>
                    <button
                      ref={closeButtonRef}
                      type="button"
                      onClick={closeDrawer}
                      aria-label="Fermer le menu"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      <X aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </div>
                  <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
                    {items.map((item) => {
                      const Icon = NAV_ICON_MAP[item.icon];
                      const hasChildren = Boolean(item.children?.length);
                      const active = pathname?.startsWith(item.href);
                      const isExpanded =
                        hasChildren && (expanded[item.href] ?? active ?? false);
                      const submenuId = hasChildren
                        ? navSubmenuId(item.href)
                        : undefined;
                      const childTabIndex = isExpanded ? 0 : -1;

                      return (
                        <div key={item.href} className="space-y-1">
                          <div
                            className={clsx(
                              "flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium transition-colors",
                              active
                                ? "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-500/20 dark:text-blue-200"
                                : "text-zinc-700 hover:bg-blue-50 hover:text-blue-600 dark:text-zinc-200 dark:hover:bg-blue-500/20 dark:hover:text-blue-200",
                            )}
                          >
                            <Link
                              href={item.href as Route}
                              onClick={closeDrawer}
                              className="flex flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
                            >
                              <Icon aria-hidden="true" className="h-5 w-5" />
                              <span>{item.label}</span>
                            </Link>
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((current) => ({
                                    ...current,
                                    [item.href]: !(current[item.href] ?? active),
                                  }))
                                }
                                className="rounded-md p-1 text-current transition hover:bg-blue-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-500/20"
                                aria-label={
                                  isExpanded
                                    ? `Masquer les sous-sections ${item.label}`
                                    : `Afficher les sous-sections ${item.label}`
                                }
                                aria-controls={submenuId}
                                aria-expanded={isExpanded}
                              >
                                <ChevronDown
                                  aria-hidden="true"
                                  className={clsx(
                                    "h-5 w-5 transition-transform",
                                    isExpanded ? "rotate-180" : "",
                                  )}
                                />
                              </button>
                            ) : null}
                          </div>
                          {hasChildren ? (
                            <div
                              id={submenuId}
                              className={clsx(
                                "space-y-1 overflow-hidden pl-11 transition-all duration-300 ease-in-out",
                                isExpanded
                                  ? "max-h-[480px] opacity-100"
                                  : "pointer-events-none max-h-0 opacity-0",
                              )}
                              aria-hidden={!isExpanded}
                            >
                              {item.children!.map((child) => {
                                const childActive = pathname === child.href;
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href as Route}
                                    onClick={closeDrawer}
                                    tabIndex={childTabIndex}
                                    className={clsx(
                                      "block rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
                                      childActive
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                                        : "text-zinc-600 hover:bg-blue-50 hover:text-blue-600 dark:text-zinc-300 dark:hover:bg-blue-500/20 dark:hover:text-blue-200",
                                    )}
                                  >
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </nav>
                </div>
              </aside>
            </>,
            portalTarget,
          )
        : null}
    </div>
  );
}
