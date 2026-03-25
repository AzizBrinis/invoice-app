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
import {
  buildHomeProducts,
  normalizePath,
  resolvePage,
  toCartProduct,
  withAlpha,
} from "./utils";

type TemplateProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
};

type TemplateStyleVars = CSSProperties & {
  "--site-accent": string;
  "--site-accent-soft": string;
  "--site-accent-strong": string;
  "--ciseco-bg": string;
  "--ciseco-hero": string;
  "--ciseco-ink": string;
};

export function EcommerceCisecoHomeTemplate({
  data,
  mode,
  path,
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
    fontFamily: 'var(--font-geist-sans), "Sora", "DM Sans", sans-serif',
  };
  const companyName = data.website.contact?.companyName || "Ciseco";
  const page = resolvePage(path);
  const pageBuilder = resolveCisecoPageConfig(data.website.builder, page.page);
  const baseLink = (target: string) =>
    mode === "preview"
      ? `/preview?path=${encodeURIComponent(normalizePath(target))}`
      : `/catalogue/${data.website.slug}${normalizePath(target)}`;
  const homeHref = baseLink("/");
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

  const content = (() => {
    if (page.page === "product") {
      return (
        <ProductPage
          theme={theme}
          inlineStyles={inlineStyles}
          companyName={companyName}
          homeHref={homeHref}
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
          path={path}
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
          path={path}
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
          path={path}
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
          path={path}
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
          path={path}
          spamProtectionEnabled={data.website.spamProtectionEnabled}
          builder={pageBuilder}
        />
      );
    }

    return (
      <HomePage
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
  })();

  return (
    <CartProvider storageKey={cartStorageKey} catalog={cartCatalog}>
      {content}
    </CartProvider>
  );
}
