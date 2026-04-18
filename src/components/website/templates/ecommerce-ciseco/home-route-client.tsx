"use client";

import { CartProvider } from "@/components/website/cart/cart-context";
import { buildPublicWebsiteHref } from "@/lib/website/custom-domain";
import { resolveCisecoPageConfig } from "./builder-helpers";
import { CisecoCmsPagesProvider } from "./cms-context";
import { CisecoFooterProvider } from "./footer-context";
import { AccountProfileProvider } from "./hooks/useAccountProfile";
import { CisecoLocaleProvider } from "./i18n";
import {
  appendCisecoLocaleToHref,
  DEFAULT_CISECO_LOCALE,
  type CisecoLocale,
} from "./locale";
import { CisecoNavigationProvider } from "./navigation";
import { HomePage } from "./pages/HomePage";
import {
  buildCisecoInlineStyles,
  buildCisecoTheme,
  CISECO_HOME_SERVER_ROUTED_PATHS,
} from "./template-shared";
import { buildCartCatalogProducts, normalizePath } from "./utils";
import type { CatalogPayload } from "@/server/website";

type CisecoHomeRouteClientProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
  initialLocale?: CisecoLocale;
  resolvedByDomain?: boolean;
};

export function CisecoHomeRouteClient({
  data,
  mode,
  path,
  initialLocale,
  resolvedByDomain = false,
}: CisecoHomeRouteClientProps) {
  const theme = buildCisecoTheme(data.website.accentColor);
  const inlineStyles = buildCisecoInlineStyles(theme);
  const companyName = data.website.contact?.companyName || "Your Brand";
  const locale = initialLocale ?? DEFAULT_CISECO_LOCALE;
  const rawBaseLink = (target: string) =>
    buildPublicWebsiteHref({
      slug: data.website.slug,
      targetPath: normalizePath(target),
      mode,
      customDomain: data.website.customDomain,
      domainStatus: data.website.domainStatus,
      useCustomDomainPaths: resolvedByDomain,
    });
  const baseLink = (target: string) =>
    appendCisecoLocaleToHref(rawBaseLink(target), locale);
  const homeHref = baseLink("/");
  const initialHref = baseLink(path ?? "/");
  const cartStorageKey = `catalog-cart:${data.website.id}`;
  const cartCatalog = buildCartCatalogProducts({
    products: Array.isArray(data.products?.all) ? data.products.all : [],
    showPrices: data.website.showPrices,
  });

  return (
    <CisecoNavigationProvider
      mode={mode}
      slug={data.website.slug}
      initialHref={initialHref}
      initialPath={path}
      publicBasePath={resolvedByDomain ? "/" : undefined}
      serverRoutedPaths={CISECO_HOME_SERVER_ROUTED_PATHS}
    >
      <CisecoLocaleProvider initialLocale={locale}>
        <CisecoCmsPagesProvider links={data.website.cmsPages}>
          <CisecoFooterProvider config={data.website.builder?.footer}>
            <CartProvider storageKey={cartStorageKey} catalog={cartCatalog}>
              <AccountProfileProvider initialViewer={data.viewer}>
                <HomePage
                  theme={theme}
                  inlineStyles={inlineStyles}
                  companyName={companyName}
                  homeHref={homeHref}
                  catalogSlug={data.website.slug}
                  baseLink={baseLink}
                  products={data.products}
                  siteReviews={data.siteReviews}
                  blogPosts={data.blogPosts}
                  showPrices={data.website.showPrices}
                  builder={resolveCisecoPageConfig(data.website.builder, "home")}
                />
              </AccountProfileProvider>
            </CartProvider>
          </CisecoFooterProvider>
        </CisecoCmsPagesProvider>
      </CisecoLocaleProvider>
    </CisecoNavigationProvider>
  );
}
