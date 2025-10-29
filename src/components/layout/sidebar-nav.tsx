"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Package,
  Users,
  Settings,
  Mail,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

export type NavIcon =
  | "dashboard"
  | "mail"
  | "quotes"
  | "invoices"
  | "products"
  | "clients"
  | "settings";

export type NavChildItem = {
  label: string;
  href: string;
};

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  children?: NavChildItem[];
};

export const NAV_ICON_MAP: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  mail: Mail,
  quotes: FileText,
  invoices: Receipt,
  products: Package,
  clients: Users,
  settings: Settings,
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <nav className="hidden w-64 flex-shrink-0 border-r border-zinc-200 bg-white px-4 py-6 transition-colors dark:border-zinc-800 dark:bg-zinc-950 lg:flex lg:flex-col">
      <div className="mb-8 px-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          Menu principal
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = NAV_ICON_MAP[item.icon];
          const active = pathname?.startsWith(item.href);
          const hasChildren = Boolean(item.children?.length);
          const isExpanded =
            hasChildren && (expanded[item.href] ?? active ?? false);

          return (
            <li key={item.href}>
              <div
                className={clsx(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                )}
              >
                <Link
                  href={item.href}
                  className="flex flex-1 items-center gap-3"
                >
                  <Icon className="h-4 w-4" />
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
                <ul className="mt-1 space-y-1 pl-9">
                  {item.children!.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={clsx(
                            "block rounded-md px-3 py-2 text-sm transition",
                            childActive
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
