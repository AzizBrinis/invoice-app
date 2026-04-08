"use client";

import type { ReactNode } from "react";
import type { CartProduct } from "@/components/website/cart/cart-context";
import { CartProvider } from "@/components/website/cart/cart-context";
import { CisecoLocaleProvider } from "./i18n";
import type { CisecoLocale } from "./locale";
import { CisecoNavigationProvider } from "./navigation";

type HomeClientProvidersProps = {
  children: ReactNode;
  mode: "public" | "preview";
  slug: string;
  initialHref: string;
  initialPath?: string | null;
  initialLocale: CisecoLocale;
  serverRoutedPaths: string[];
  cartStorageKey: string;
  cartCatalog: CartProduct[];
};

export function HomeClientProviders({
  children,
  mode,
  slug,
  initialHref,
  initialPath,
  initialLocale,
  serverRoutedPaths,
  cartStorageKey,
  cartCatalog,
}: HomeClientProvidersProps) {
  return (
    <CisecoNavigationProvider
      mode={mode}
      slug={slug}
      initialHref={initialHref}
      initialPath={initialPath}
      serverRoutedPaths={serverRoutedPaths}
    >
      <CisecoLocaleProvider initialLocale={initialLocale}>
        <CartProvider storageKey={cartStorageKey} catalog={cartCatalog}>
          {children}
        </CartProvider>
      </CisecoLocaleProvider>
    </CisecoNavigationProvider>
  );
}
