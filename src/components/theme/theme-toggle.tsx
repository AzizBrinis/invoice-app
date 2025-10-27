"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  type Theme,
  useTheme,
} from "@/components/theme/theme-provider";

const OPTIONS: Array<{
  value: Theme;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Mode clair", icon: Sun },
  { value: "dark", label: "Mode sombre", icon: Moon },
  { value: "system", label: "Suivre le système", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Sélection du thème"
      className="flex items-center gap-2"
    >
      <span className="hidden text-sm font-medium text-zinc-600 dark:text-zinc-300 xl:inline">
        Thème
      </span>
      <div className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const isChecked = theme === value;
          const effectiveResolvedTheme = mounted ? resolvedTheme : undefined;
          const isSystemResolved =
            mounted &&
            theme === "system" &&
            value !== "system" &&
            effectiveResolvedTheme === value;
          const isActive = isChecked || isSystemResolved;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isChecked}
              aria-label={label}
              title={
                value === "system" && mounted && effectiveResolvedTheme
                  ? `${label} (${effectiveResolvedTheme === "dark" ? "sombre" : "clair"})`
                  : label
              }
              onClick={() => setTheme(value)}
              className={clsx(
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100",
                isActive &&
                  "text-zinc-900 dark:text-zinc-100",
                isChecked &&
                  "bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-500",
                isSystemResolved &&
                  "ring-2 ring-blue-400/60 dark:ring-blue-400/70",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
