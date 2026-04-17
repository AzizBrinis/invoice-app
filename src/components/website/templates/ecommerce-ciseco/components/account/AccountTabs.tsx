"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { useCisecoI18n } from "../../i18n";
import { useCisecoLocation } from "../../navigation";

const ACCOUNT_TABS = [
  "Settings",
  "Wishlists",
  "Orders history",
  "Change password",
  "Billing",
];

type AccountTabsProps = {
  activeTab?: string;
};

export function AccountTabs({ activeTab = "Settings" }: AccountTabsProps) {
  const { pathname } = useCisecoLocation();
  const { t, localizeHref } = useCisecoI18n();
  const basePath = useMemo(() => {
    if (!pathname) return "";
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "catalogue" && segments[1]) {
      return `/catalogue/${segments[1]}`;
    }
    return "";
  }, [pathname]);

  const resolveHref = (tab: string) => {
    switch (tab) {
      case "Settings":
        return `${basePath}/account`;
      case "Wishlists":
        return `${basePath}/account/wishlists`;
      case "Orders history":
        return `${basePath}/account/orders-history`;
      case "Change password":
        return `${basePath}/account/change-password`;
      case "Billing":
        return `${basePath}/account/billing`;
      default:
        return "#";
    }
  };

  return (
    <div className="grid grid-cols-5 gap-2 py-4 text-[11px] font-semibold text-slate-500 sm:flex sm:gap-8 sm:text-sm">
      {ACCOUNT_TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <a
            key={tab}
            href={localizeHref(resolveHref(tab))}
            className={clsx(
              "relative pb-3 text-left transition sm:pb-4",
              isActive
                ? "text-slate-900"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <span className="block truncate">{t(tab)}</span>
            {isActive ? (
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[var(--site-accent)]" />
            ) : null}
          </a>
        );
      })}
    </div>
  );
}
