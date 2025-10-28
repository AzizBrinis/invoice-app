"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Package,
  Users,
  Settings,
  Mail,
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

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
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
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
