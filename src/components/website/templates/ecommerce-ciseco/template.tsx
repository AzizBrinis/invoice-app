import { resolveCisecoPageConfig } from "./builder-helpers";
import { HomeClientProviders } from "./home-client-providers";
import {
  appendCisecoLocaleToHref,
  DEFAULT_CISECO_LOCALE,
} from "./locale";
import { HomePageServer } from "./pages/HomePageServer";
import {
  buildCisecoInlineStyles,
  buildCisecoTheme,
  CISECO_HOME_SERVER_ROUTED_PATHS,
  type TemplateProps,
} from "./template-shared";
import { EcommerceCisecoHomeTemplateClient } from "./template-client";
import {
  buildHomeProducts,
  normalizePath,
  resolvePage,
  toCartProduct,
} from "./utils";

export function EcommerceCisecoHomeTemplate({
  data,
  mode,
  path,
  initialLocale,
}: TemplateProps) {
  const locale = initialLocale ?? DEFAULT_CISECO_LOCALE;
  const theme = buildCisecoTheme(data.website.accentColor);
  const inlineStyles = buildCisecoInlineStyles(theme);
  const rawBaseLink = (target: string) =>
    mode === "preview"
      ? `/preview?path=${encodeURIComponent(normalizePath(target))}`
      : `/catalogue/${data.website.slug}${normalizePath(target)}`;
  const baseLink = (target: string) =>
    appendCisecoLocaleToHref(rawBaseLink(target), locale);
  const companyName = data.website.contact?.companyName || "Your Brand";
  const homeHref = baseLink("/");
  const initialHref = baseLink(path ?? "/");
  const currentPath = path || "/";
  const cmsPaths = data.website.cmsPages.map((entry) => entry.path);
  const page = resolvePage(currentPath, { cmsPaths });
  const pageBuilder = resolveCisecoPageConfig(data.website.builder, page.page);

  if (page.page !== "home" || !pageBuilder) {
    return (
      <EcommerceCisecoHomeTemplateClient
        data={data}
        mode={mode}
        path={path}
        initialLocale={initialLocale}
      />
    );
  }

  const cartCatalog = buildHomeProducts({
    products: Array.isArray(data.products?.all) ? data.products.all : [],
    showPrices: data.website.showPrices,
  }).map(toCartProduct);
  const productPaths = cartCatalog.map((product) =>
    normalizePath(`/produit/${product.slug}`),
  );
  const homeServerRoutedPaths = Array.from(
    new Set([
      ...CISECO_HOME_SERVER_ROUTED_PATHS,
      ...cmsPaths,
      ...productPaths,
    ]),
  );

  return (
    <HomeClientProviders
      mode={mode}
      slug={data.website.slug}
      initialHref={initialHref}
      initialPath={path}
      initialLocale={locale}
      serverRoutedPaths={homeServerRoutedPaths}
      cartStorageKey={`catalog-cart:${data.website.id}`}
      cartCatalog={cartCatalog}
    >
      <HomePageServer
        theme={theme}
        inlineStyles={inlineStyles}
        companyName={companyName}
        homeHref={homeHref}
        catalogSlug={data.website.slug}
        locale={locale}
        mode={mode}
        rawBaseLink={rawBaseLink}
        baseLink={baseLink}
        products={data.products}
        showPrices={data.website.showPrices}
        builder={pageBuilder}
        viewerAuthStatus={data.viewer?.authStatus ?? "unauthenticated"}
        cmsPages={data.website.cmsPages}
      />
    </HomeClientProviders>
  );
}
