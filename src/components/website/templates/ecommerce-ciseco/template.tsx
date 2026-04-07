"use client";

import { useMemo, type CSSProperties } from "react";
import { CartProvider } from "@/components/website/cart/cart-context";
import type { CatalogPayload } from "@/server/website";
import type { ThemeTokens } from "./types";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { HomePage } from "./pages/HomePage";
import { BlogPage } from "./pages/BlogPage";
import { BlogDetailPage } from "./pages/BlogDetailPage";
import { CmsPage } from "./pages/CmsPage";
import { SearchPage } from "./pages/SearchPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ProductPage } from "./pages/ProductPage";
import { OrderSuccessPage } from "./pages/OrderSuccessPage";
import { AccountPage } from "./pages/AccountPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { WishlistsPage } from "./pages/WishlistsPage";
import { OrdersHistoryPage } from "./pages/OrdersHistoryPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { SignupPage } from "./pages/SignupPage";
import { resolveCisecoPageConfig } from "./builder-helpers";
import { CisecoLocaleProvider } from "./i18n";
import { AccountProfileProvider } from "./hooks/useAccountProfile";
import { CisecoCmsPagesProvider } from "./cms-context";
import {
  CisecoNavigationProvider,
  useCisecoLocation,
} from "./navigation";
import {
  buildHomeProducts,
  normalizePath,
  resolvePage,
  toCartProduct,
  withAlpha,
} from "./utils";
import {
  appendCisecoLocaleToHref,
  DEFAULT_CISECO_LOCALE,
  type CisecoLocale,
} from "./locale";

type TemplateProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
  initialLocale?: CisecoLocale;
};

type TemplateStyleVars = CSSProperties & {
  "--site-accent": string;
  "--site-accent-soft": string;
  "--site-accent-strong": string;
  "--ciseco-bg": string;
  "--ciseco-hero": string;
  "--ciseco-ink": string;
  "--ciseco-font-body": string;
  "--ciseco-font-display": string;
};

export function EcommerceCisecoHomeTemplate({
  data,
  mode,
  path,
  initialLocale,
}: TemplateProps) {
  const accent = data.website.accentColor ?? "#22c55e";
  const theme: ThemeTokens = {
    accent,
    containerClass: "max-w-[1240px]",
    sectionSpacing: "py-7 sm:py-9 lg:py-11",
    corner: "rounded-[30px]",
    buttonShape: "rounded-full",
  };
  const inlineStyles: TemplateStyleVars = {
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
  const companyName = data.website.contact?.companyName || "Your Brand";
  const locale = initialLocale ?? DEFAULT_CISECO_LOCALE;
  const rawBaseLink = (target: string) =>
    mode === "preview"
      ? `/preview?path=${encodeURIComponent(normalizePath(target))}`
      : `/catalogue/${data.website.slug}${normalizePath(target)}`;
  const baseLink = (target: string) =>
    appendCisecoLocaleToHref(rawBaseLink(target), locale);
  const homeHref = baseLink("/");
  const initialHref = baseLink(path ?? "/");
  const cartStorageKey = `catalog-cart:${data.website.id}`;
  const productSource = useMemo(
    () => (Array.isArray(data.products?.all) ? data.products.all : []),
    [data.products],
  );
  const cartCatalog = useMemo(
    () =>
      buildHomeProducts({
        products: productSource,
        showPrices: data.website.showPrices,
      }).map(toCartProduct),
    [productSource, data.website.showPrices],
  );
  const cmsPaths = useMemo(
    () => data.website.cmsPages.map((entry) => entry.path),
    [data.website.cmsPages],
  );

  return (
    <CisecoNavigationProvider
      mode={mode}
      slug={data.website.slug}
      initialHref={initialHref}
      initialPath={path}
      serverRoutedPaths={cmsPaths}
    >
      <CisecoLocaleProvider initialLocale={locale}>
        <CisecoCmsPagesProvider links={data.website.cmsPages}>
          <CartProvider storageKey={cartStorageKey} catalog={cartCatalog}>
            <AccountProfileProvider initialViewer={data.viewer}>
              <TemplateContent
                data={data}
                mode={mode}
                inlineStyles={inlineStyles}
                theme={theme}
                companyName={companyName}
                homeHref={homeHref}
                baseLink={baseLink}
                path={path}
                cmsPaths={cmsPaths}
              />
            </AccountProfileProvider>
          </CartProvider>
        </CisecoCmsPagesProvider>
      </CisecoLocaleProvider>
    </CisecoNavigationProvider>
  );
}

type TemplateContentProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  inlineStyles: TemplateStyleVars;
  theme: ThemeTokens;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  path?: string | null;
  cmsPaths: string[];
};

function TemplateContent({
  data,
  mode,
  inlineStyles,
  theme,
  companyName,
  homeHref,
  baseLink,
  path,
  cmsPaths,
}: TemplateContentProps) {
  const { logicalPath } = useCisecoLocation();
  const currentPath = logicalPath || path || "/";
  const page = resolvePage(currentPath, { cmsPaths });
  const pageBuilder = resolveCisecoPageConfig(data.website.builder, page.page);

  return (() => {
    if (page.page === "product") {
      return (
        <ProductPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          catalogSlug={data.website.slug}
          baseLink={baseLink}
          products={data.products}
          showPrices={data.website.showPrices}
          productSlug={page.productSlug}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "cart") {
      return (
        <CartPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "checkout") {
      return (
        <CheckoutPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          baseLink={baseLink}
          slug={data.website.slug}
          mode={mode}
          path={currentPath}
          showPrices={data.website.showPrices}
          ecommerceSettings={data.website.ecommerceSettings}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "order-success") {
      return (
        <OrderSuccessPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          slug={data.website.slug}
          mode={mode}
          ecommerceSettings={data.website.ecommerceSettings}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "login") {
      return (
        <LoginPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          baseLink={baseLink}
          mode={mode}
          slug={data.website.slug}
          path={currentPath}
          signupSettings={data.website.ecommerceSettings.signup}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "signup") {
      return (
        <SignupPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          baseLink={baseLink}
          mode={mode}
          slug={data.website.slug}
          path={currentPath}
          signupSettings={data.website.ecommerceSettings.signup}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "forgot-password") {
      return (
        <ForgotPasswordPage
          theme={theme}
          inlineStyles={inlineStyles}
          baseLink={baseLink}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "account") {
      return (
        <AccountPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "account-change-password") {
      return (
        <ChangePasswordPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "account-wishlists") {
      return (
        <WishlistsPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          catalogSlug={data.website.slug}
          loginHref={baseLink("/login")}
          showPrices={data.website.showPrices}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "account-orders-history") {
      return (
        <OrdersHistoryPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "account-order-detail") {
      return (
        <OrderDetailPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "collections") {
      return (
        <CollectionsPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          products={data.products}
          showPrices={data.website.showPrices}
          collectionSlug={page.collectionSlug}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "blog") {
      return (
        <BlogPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          baseLink={baseLink}
          path={currentPath}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "blog-detail") {
      return (
        <BlogDetailPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          baseLink={baseLink}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "search") {
      return (
        <SearchPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          baseLink={baseLink}
          products={data.products}
          showPrices={data.website.showPrices}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "about") {
      return (
        <AboutPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "contact") {
      return (
        <ContactPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          contactIntro={data.website.contactBlurb}
          contact={data.website.contact}
          socialLinks={data.website.socialLinks}
          slug={data.website.slug}
          mode={mode}
          path={currentPath}
          spamProtectionEnabled={data.website.spamProtectionEnabled}
          builder={pageBuilder}
        />
      );
    }
    if (page.page === "cms" && data.currentCmsPage) {
      return (
        <CmsPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
          page={data.currentCmsPage}
        />
      );
    }

    return (
      <HomePage
        theme={theme}
        inlineStyles={inlineStyles}
        companyName={companyName}
        homeHref={homeHref}
        catalogSlug={data.website.slug}
        baseLink={baseLink}
        products={data.products}
        showPrices={data.website.showPrices}
        builder={pageBuilder}
      />
    );
  })();
}
