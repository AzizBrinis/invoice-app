"use client";

import { useState } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  type NavItem,
  NAV_ICON_MAP,
} from "@/components/layout/sidebar-nav";

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        <span className="sr-only">Menu</span>
      </button>
      <div
        className={clsx(
          "fixed inset-x-0 top-16 z-40 border-b border-zinc-200 bg-white shadow-lg transition-transform dark:border-zinc-800 dark:bg-zinc-950",
          open ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <nav className="space-y-1 px-4 py-4">
          {items.map((item) => {
            const Icon = NAV_ICON_MAP[item.icon];
            const hasChildren = Boolean(item.children?.length);
            const active = pathname?.startsWith(item.href);
            const isExpanded =
              hasChildren && (expanded[item.href] ?? active ?? false);

            return (
              <div key={item.href} className="space-y-1">
                <div
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                      : "text-zinc-700 hover:bg-blue-50 hover:text-blue-600 dark:text-zinc-200 dark:hover:bg-blue-500/20 dark:hover:text-blue-200",
                  )}
                >
                  <Link
                    href={item.href}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="flex flex-1 items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
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
                    >
                      <ChevronDown
                        className={clsx(
                          "h-4 w-4 transition-transform",
                          isExpanded ? "rotate-180" : "",
                        )}
                      />
                    </button>
                  ) : null}
                </div>
                {hasChildren && isExpanded ? (
                  <div className="space-y-1 pl-9">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className={clsx(
                            "block rounded-md px-3 py-2 text-sm transition-colors",
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
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
