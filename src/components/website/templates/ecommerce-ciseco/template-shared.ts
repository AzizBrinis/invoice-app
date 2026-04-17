import type { CSSProperties } from "react";
import type { ThemeTokens } from "./types";
import { withAlpha } from "./utils";

export type TemplateProps = {
  data: import("@/server/website").CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
  initialLocale?: import("./locale").CisecoLocale;
  resolvedByDomain?: boolean;
};

export type TemplateStyleVars = CSSProperties & {
  "--site-accent": string;
  "--site-accent-soft": string;
  "--site-accent-strong": string;
  "--ciseco-bg": string;
  "--ciseco-hero": string;
  "--ciseco-ink": string;
  "--ciseco-font-body": string;
  "--ciseco-font-display": string;
};

export function buildCisecoTheme(accentColor: string | null | undefined): ThemeTokens {
  const accent = accentColor ?? "#22c55e";
  return {
    accent,
    containerClass: "max-w-[1240px]",
    sectionSpacing: "py-7 sm:py-9 lg:py-11",
    corner: "rounded-[30px]",
    buttonShape: "rounded-full",
  };
}

export function buildCisecoInlineStyles(theme: ThemeTokens): TemplateStyleVars {
  return {
    "--site-accent": theme.accent,
    "--site-accent-soft": withAlpha(theme.accent, "1a"),
    "--site-accent-strong": withAlpha(theme.accent, "33"),
    "--ciseco-bg": "#f5f6f7",
    "--ciseco-hero": "#d5ecd1",
    "--ciseco-ink": "#0f172a",
    "--ciseco-font-body":
      '"Avenir Next","Segoe UI","Helvetica Neue",var(--font-geist-sans),sans-serif',
    "--ciseco-font-display":
      '"Avenir Next","Helvetica Neue","Segoe UI",var(--font-geist-sans),sans-serif',
    fontFamily: "var(--ciseco-font-body)",
  };
}

export const CISECO_HOME_SERVER_ROUTED_PATHS = [
  "/",
  "/collections",
  "/about",
  "/blog",
  "/contact",
  "/search",
  "/cart",
  "/checkout",
  "/login",
  "/signup",
  "/forgot-password",
  "/confirmation",
  "/order-success",
  "/account",
  "/account/orders",
  "/account/orders-history",
  "/account/billing",
  "/account/wishlists",
  "/account/change-password",
];
