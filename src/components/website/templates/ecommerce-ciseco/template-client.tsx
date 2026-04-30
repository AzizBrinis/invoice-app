"use client";

import { useMemo } from "react";
import { CartProvider } from "@/components/website/cart/cart-context";
import type { CatalogPayload } from "@/server/website";
import { resolveCisecoPageConfig } from "./builder-helpers";
import { CisecoLocaleProvider } from "./i18n";
import {
  appendCisecoLocaleToHref,
  DEFAULT_CISECO_LOCALE,
} from "./locale";
import {
  CisecoNavigationProvider,
  useCisecoLocation,
} from "./navigation";
import { AccountProfileProvider } from "./hooks/useAccountProfile";
import { CisecoCmsPagesProvider } from "./cms-context";
import { CisecoFooterProvider } from "./footer-context";
import { HomePage } from "./pages/HomePage";
import { AboutPage } from "./pages/AboutPage";
import { AccountPage } from "./pages/AccountPage";
import { BillingPage } from "./pages/BillingPage";
import { BlogDetailPage } from "./pages/BlogDetailPage";
import { BlogPage } from "./pages/BlogPage";
import { CartPage } from "./pages/CartPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CmsPage } from "./pages/CmsPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { ContactPage } from "./pages/ContactPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrderSuccessPage } from "./pages/OrderSuccessPage";
import { OrdersHistoryPage } from "./pages/OrdersHistoryPage";
import { ProductPage } from "./pages/ProductPage";
import { SearchPage } from "./pages/SearchPage";
import { SignupPage } from "./pages/SignupPage";
import { WishlistsPage } from "./pages/WishlistsPage";
import { buildPublicWebsiteHref } from "@/lib/website/custom-domain";
import { buildCisecoInlineStyles, buildCisecoTheme, type TemplateProps, type TemplateStyleVars } from "./template-shared";
import {
  buildCartCatalogProducts,
  normalizePath,
  resolvePage,
} from "./utils";

export function EcommerceCisecoHomeTemplateClient({
  data,
  mode,
  path,
  initialLocale,
  resolvedByDomain = false,
}: TemplateProps) {
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
  const productSource = useMemo(
    () => (Array.isArray(data.products?.all) ? data.products.all : []),
    [data.products],
  );
  const cartCatalog = useMemo(
    () =>
      buildCartCatalogProducts({
        products: productSource,
        showPrices: data.website.showPrices,
      }),
    [productSource, data.website.showPrices],
  );
  const cmsPaths = useMemo(
    () => data.website.cmsPages.map((entry) => entry.path),
    [data.website.cmsPages],
  );
  const prefetchLocalPage = useMemo(
    () => (logicalPath: string) => {
      const resolvedPage = resolvePage(logicalPath, { cmsPaths });
      switch (resolvedPage.page) {
        case "product":
          return;
        case "cart":
          return;
        case "checkout":
          return;
        case "order-success":
          return;
        case "login":
          return;
        case "signup":
          return;
        case "forgot-password":
          return;
        case "account":
          return;
        case "account-billing":
          return;
        case "account-change-password":
          return;
        case "account-wishlists":
          return;
        case "account-orders-history":
          return;
        case "account-order-detail":
          return;
        case "collections":
          return;
        case "blog":
          return;
        case "blog-detail":
          return;
        case "search":
          return;
        case "about":
          return;
        case "contact":
          return;
        case "cms":
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
      publicBasePath={resolvedByDomain ? "/" : undefined}
      onPrefetchRoute={prefetchLocalPage}
    >
      <CisecoLocaleProvider initialLocale={locale}>
        <CisecoCmsPagesProvider links={data.website.cmsPages}>
          <CisecoFooterProvider config={data.website.builder?.footer}>
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
          </CisecoFooterProvider>
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
  const serverPath = normalizePath(path);
  const page = resolvePage(currentPath, { cmsPaths });

  if (page.page === "not-found") {
    return (
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
    );
  }

  const pageBuilder = resolveCisecoPageConfig(data.website.builder, page.page);

  if (page.page === "product") {
    return (
      <ProductPage
        key={page.productSlug}
        theme={theme}
        inlineStyles={inlineStyles}
        companyName={companyName}
        homeHref={homeHref}
        catalogSlug={data.website.slug}
        baseLink={baseLink}
        products={data.products}
        showPrices={data.website.showPrices}
        productSlug={page.productSlug}
        mode={mode}
        requiresClientProductData={
          mode === "public" && serverPath !== normalizePath(currentPath)
        }
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
  if (page.page === "account-billing") {
    return (
      <BillingPage
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
        baseLink={baseLink}
        catalogSlug={data.website.slug}
        products={data.products}
        showPrices={data.website.showPrices}
        collectionSlug={page.collectionSlug}
        builder={pageBuilder}
        customizeHref={
          mode === "preview"
            ? "/site-web/personnalisation-avancee?page=collections"
            : undefined
        }
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
        blogPosts={data.blogPosts}
        products={data.products}
      />
    );
  }
  if (page.page === "blog-detail") {
    return (
      <BlogDetailPage
        key={page.slug}
        theme={theme}
        inlineStyles={inlineStyles}
        companyName={companyName}
        homeHref={homeHref}
        baseLink={baseLink}
        catalogSlug={data.website.slug}
        mode={mode}
        postSlug={page.slug}
        post={data.currentBlogPost?.slug === page.slug ? data.currentBlogPost : null}
        blogPosts={data.blogPosts}
        products={data.products}
        requiresClientPostData={
          serverPath !== normalizePath(currentPath) ||
          data.currentBlogPost?.slug !== page.slug
        }
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
        siteReviews={data.siteReviews}
        builder={pageBuilder}
        productCount={data.products.all.length}
        categoryCount={
          new Set(
            data.products.all
              .map((product) => product.category?.trim())
              .filter((value): value is string => Boolean(value)),
          ).size
        }
        blogPostCount={data.blogPosts?.length ?? 0}
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
  if (page.page === "cms") {
    return (
      <CmsPage
        key={page.cmsPath}
        theme={theme}
        inlineStyles={inlineStyles}
        companyName={companyName}
        homeHref={homeHref}
        catalogSlug={data.website.slug}
        mode={mode}
        pagePath={page.cmsPath}
        page={data.currentCmsPage?.path === page.cmsPath ? data.currentCmsPage : null}
        requiresClientPageData={
          serverPath !== page.cmsPath
        }
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
      siteReviews={data.siteReviews}
      blogPosts={data.blogPosts}
      showPrices={data.website.showPrices}
      builder={pageBuilder}
    />
  );
}
