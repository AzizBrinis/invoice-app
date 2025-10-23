"use client";

import { useState } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import {
  type NavItem,
  NAV_ICON_MAP,
} from "@/components/layout/sidebar-nav";

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        <span className="sr-only">Menu</span>
      </button>
      <div
        className={clsx(
          "fixed inset-x-0 top-16 z-40 border-b border-zinc-200 bg-white shadow-lg transition-transform",
          open ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <nav className="space-y-1 px-4 py-4">
          {items.map((item) => {
            const Icon = NAV_ICON_MAP[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-blue-50 hover:text-blue-600"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
