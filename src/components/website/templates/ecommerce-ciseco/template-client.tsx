"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { CartProvider } from "@/components/website/cart/cart-context";
import type { CatalogPayload } from "@/server/website";
import { resolveCisecoPageConfig } from "./builder-helpers";
import { CisecoLocaleProvider } from "./i18n";
import {
  appendCisecoLocaleToHref,
  DEFAULT_CISECO_LOCALE,
  type CisecoLocale,
} from "./locale";
import {
  CisecoNavigationProvider,
  useCisecoLocation,
} from "./navigation";
import { AccountProfileProvider } from "./hooks/useAccountProfile";
import { CisecoCmsPagesProvider } from "./cms-context";
import { HomePage } from "./pages/HomePage";
import { buildCisecoInlineStyles, buildCisecoTheme, type TemplateProps, type TemplateStyleVars } from "./template-shared";
import {
  buildHomeProducts,
  normalizePath,
  resolvePage,
  toCartProduct,
} from "./utils";

const loadAboutPage = () =>
  import("./pages/AboutPage").then((mod) => mod.AboutPage);
const loadAccountPage = () =>
  import("./pages/AccountPage").then((mod) => mod.AccountPage);
const loadBlogDetailPage = () =>
  import("./pages/BlogDetailPage").then((mod) => mod.BlogDetailPage);
const loadBlogPage = () =>
  import("./pages/BlogPage").then((mod) => mod.BlogPage);
const loadCartPage = () =>
  import("./pages/CartPage").then((mod) => mod.CartPage);
const loadChangePasswordPage = () =>
  import("./pages/ChangePasswordPage").then((mod) => mod.ChangePasswordPage);
const loadCheckoutPage = () =>
  import("./pages/CheckoutPage").then((mod) => mod.CheckoutPage);
const loadCmsPage = () =>
  import("./pages/CmsPage").then((mod) => mod.CmsPage);
const loadCollectionsPage = () =>
  import("./pages/CollectionsPage").then((mod) => mod.CollectionsPage);
const loadContactPage = () =>
  import("./pages/ContactPage").then((mod) => mod.ContactPage);
const loadForgotPasswordPage = () =>
  import("./pages/ForgotPasswordPage").then((mod) => mod.ForgotPasswordPage);
const loadLoginPage = () =>
  import("./pages/LoginPage").then((mod) => mod.LoginPage);
const loadOrderDetailPage = () =>
  import("./pages/OrderDetailPage").then((mod) => mod.OrderDetailPage);
const loadOrderSuccessPage = () =>
  import("./pages/OrderSuccessPage").then((mod) => mod.OrderSuccessPage);
const loadOrdersHistoryPage = () =>
  import("./pages/OrdersHistoryPage").then((mod) => mod.OrdersHistoryPage);
const loadProductPage = () =>
  import("./pages/ProductPage").then((mod) => mod.ProductPage);
const loadSearchPage = () =>
  import("./pages/SearchPage").then((mod) => mod.SearchPage);
const loadSignupPage = () =>
  import("./pages/SignupPage").then((mod) => mod.SignupPage);
const loadWishlistsPage = () =>
  import("./pages/WishlistsPage").then((mod) => mod.WishlistsPage);

const AboutPage = dynamic(loadAboutPage);
const AccountPage = dynamic(loadAccountPage);
const BlogDetailPage = dynamic(loadBlogDetailPage);
const BlogPage = dynamic(loadBlogPage);
const CartPage = dynamic(loadCartPage);
const ChangePasswordPage = dynamic(loadChangePasswordPage);
const CheckoutPage = dynamic(loadCheckoutPage);
const CmsPage = dynamic(loadCmsPage);
const CollectionsPage = dynamic(loadCollectionsPage);
const ContactPage = dynamic(loadContactPage);
const ForgotPasswordPage = dynamic(loadForgotPasswordPage);
const LoginPage = dynamic(loadLoginPage);
const OrderDetailPage = dynamic(loadOrderDetailPage);
const OrderSuccessPage = dynamic(loadOrderSuccessPage);
const OrdersHistoryPage = dynamic(loadOrdersHistoryPage);
const ProductPage = dynamic(loadProductPage);
const SearchPage = dynamic(loadSearchPage);
const SignupPage = dynamic(loadSignupPage);
const WishlistsPage = dynamic(loadWishlistsPage);

export function EcommerceCisecoHomeTemplateClient({
  data,
  mode,
  path,
  initialLocale,
}: TemplateProps) {
  const theme = buildCisecoTheme(data.website.accentColor);
  const inlineStyles = buildCisecoInlineStyles(theme);
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
  const productPaths = useMemo(
    () =>
      cartCatalog.map((product) => normalizePath(`/produit/${product.slug}`)),
    [cartCatalog],
  );
  const serverRoutedPaths = useMemo(
    () => Array.from(new Set([...cmsPaths, ...productPaths])),
    [cmsPaths, productPaths],
  );
  const prefetchLocalPage = useMemo(
    () => (logicalPath: string) => {
      const resolvedPage = resolvePage(logicalPath, { cmsPaths });
      switch (resolvedPage.page) {
        case "product":
          void loadProductPage();
          return;
        case "cart":
          void loadCartPage();
          return;
        case "checkout":
          void loadCheckoutPage();
          return;
        case "order-success":
          void loadOrderSuccessPage();
          return;
        case "login":
          void loadLoginPage();
          return;
        case "signup":
          void loadSignupPage();
          return;
        case "forgot-password":
          void loadForgotPasswordPage();
          return;
        case "account":
          void loadAccountPage();
          return;
        case "account-change-password":
          void loadChangePasswordPage();
          return;
        case "account-wishlists":
          void loadWishlistsPage();
          return;
        case "account-orders-history":
          void loadOrdersHistoryPage();
          return;
        case "account-order-detail":
          void loadOrderDetailPage();
          return;
        case "collections":
          void loadCollectionsPage();
          return;
        case "blog":
          void loadBlogPage();
          return;
        case "blog-detail":
          void loadBlogDetailPage();
          return;
        case "search":
          void loadSearchPage();
          return;
        case "about":
          void loadAboutPage();
          return;
        case "contact":
          void loadContactPage();
          return;
        case "cms":
          void loadCmsPage();
          return;
        default:
          return;
      }
    },
    [cmsPaths],
  );

  return (
    <CisecoNavigationProvider
      mode={mode}
      slug={data.website.slug}
      initialHref={initialHref}
      initialPath={path}
      serverRoutedPaths={serverRoutedPaths}
      onPrefetchRoute={prefetchLocalPage}
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
  theme: ReturnType<typeof buildCisecoTheme>;
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
}
