"use client";

import { useActionState, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import {
  INITIAL_WEBSITE_CONTENT_FORM_STATE,
  INITIAL_WEBSITE_ECOMMERCE_FORM_STATE,
  type WebsiteCmsPageRecord,
  type WebsiteContentFormState,
  type WebsiteEcommerceFormState,
} from "@/app/(app)/site-web/form-state";
import {
  saveWebsiteContentAction,
  saveWebsiteEcommerceSettingsAction,
} from "@/app/(app)/site-web/actions";
import { useWebsiteProductList } from "@/app/(app)/site-web/_hooks/useWebsiteProductList";
import { WebsiteCmsPagesManager } from "@/app/(app)/site-web/_components/website-cms-pages-manager";
import {
  WEBSITE_TEMPLATES,
  type WebsiteTemplateKey,
} from "@/lib/website/templates";

type WebsiteContentFormProps = {
  websiteSlug: string;
  defaultValues: {
    slug: string;
    templateKey: WebsiteTemplateKey;
    heroEyebrow: string | null;
    heroTitle: string;
    heroSubtitle: string | null;
    heroPrimaryCtaLabel: string;
    heroSecondaryCtaLabel: string | null;
    heroSecondaryCtaUrl: string | null;
    aboutTitle: string | null;
    aboutBody: string | null;
    contactBlurb: string | null;
    contactEmailOverride: string | null;
    contactPhoneOverride: string | null;
    contactAddressOverride: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoKeywords: string | null;
    socialImageUrl: string | null;
    accentColor: string;
    theme: "SYSTEM" | "LIGHT" | "DARK";
    showPrices: boolean;
    showInactiveProducts: boolean;
    leadNotificationEmail: string | null;
    leadAutoTag: string | null;
    leadThanksMessage: string | null;
    spamProtectionEnabled: boolean;
    cmsPages: WebsiteCmsPageRecord[];
    ecommerceSettings: {
      payments: {
        methods: {
          card: boolean;
          bankTransfer: boolean;
          cashOnDelivery: boolean;
        };
        bankTransfer: {
          instructions: string;
        };
      };
      checkout: {
        requirePhone: boolean;
        allowNotes: boolean;
        termsUrl: string;
      };
      featuredProductIds: string[];
    };
  };
};

export function WebsiteContentForm({
  defaultValues,
  websiteSlug,
}: WebsiteContentFormProps) {
  const [state, formAction] = useActionState<
    WebsiteContentFormState,
    FormData
  >(saveWebsiteContentAction, INITIAL_WEBSITE_CONTENT_FORM_STATE);
  const [ecommerceState, ecommerceAction] = useActionState<
    WebsiteEcommerceFormState,
    FormData
  >(saveWebsiteEcommerceSettingsAction, INITIAL_WEBSITE_ECOMMERCE_FORM_STATE);
  const fieldErrors = state.fieldErrors ?? {};
  const ecommerceFieldErrors = ecommerceState.fieldErrors ?? {};
  const [featuredSearch, setFeaturedSearch] = useState("");
  const debouncedFeaturedSearch = useDebouncedValue(featuredSearch, 350);
  const {
    items: featuredProducts,
    loadingPage: featuredLoadingPage,
    error: featuredProductsError,
    hasMore: featuredProductsHasMore,
    loadMore: loadMoreFeaturedProducts,
    isEmpty: featuredProductsEmpty,
    isInitialLoading: featuredProductsInitialLoading,
  } = useWebsiteProductList({
    search: debouncedFeaturedSearch,
    visibility: "visible",
    includeInactive: false,
  });
  const [featuredSelection, setFeaturedSelection] = useState(
    () => new Set(defaultValues.ecommerceSettings.featuredProductIds),
  );
  const featuredProductIds = useMemo(
    () => Array.from(featuredSelection),
    [featuredSelection],
  );
  const featuredProductIdsValue = featuredProductIds.join(", ");
  const featuredCountLabel = featuredProductIds.length
    ? `${featuredProductIds.length} sélectionné${
      featuredProductIds.length > 1 ? "s" : ""
    }`
    : "Aucun produit sélectionné";

  const toggleFeaturedProduct = (productId: string) => {
    setFeaturedSelection((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <form action={formAction} className="card space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Contenu du site
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Mettez à jour le héro, les textes clés et la capture de leads. Les
            changements sont visibles instantanément.
          </p>
        </div>
        {state.status === "error" && state.message ? (
          <Alert variant="error" title={state.message} />
        ) : null}
        {state.status === "success" && state.message ? (
          <Alert variant="success" title={state.message} />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="slug" className="label">
              Slug public
            </label>
            <Input
              id="slug"
              name="slug"
              defaultValue={defaultValues.slug}
              aria-invalid={Boolean(fieldErrors.slug) || undefined}
            />
            {fieldErrors.slug ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.slug}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Utilisé pour l’URL {`/catalogue/${defaultValues.slug}`}.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="accentColor" className="label">
              Couleur d’accent
            </label>
            <Input
              id="accentColor"
              name="accentColor"
              type="color"
              defaultValue={defaultValues.accentColor ?? "#2563eb"}
            />
          </div>
          <div>
            <label htmlFor="theme" className="label">
              Thème
            </label>
            <select
              id="theme"
              name="theme"
              className="input"
              defaultValue={defaultValues.theme}
            >
              <option value="SYSTEM">Selon l’appareil</option>
              <option value="LIGHT">Clair</option>
              <option value="DARK">Sombre</option>
            </select>
          </div>
          <div>
            <label htmlFor="templateKey" className="label">
              Template
            </label>
            <select
              id="templateKey"
              name="templateKey"
              className="input"
              defaultValue={defaultValues.templateKey}
            >
              {WEBSITE_TEMPLATES.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </select>
            {fieldErrors.templateKey ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.templateKey}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Personnalisez l’apparence. D’autres templates arrivent bientôt.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="heroEyebrow" className="label">
              Sur-titre
            </label>
            <Input
              id="heroEyebrow"
              name="heroEyebrow"
              defaultValue={defaultValues.heroEyebrow ?? ""}
            />
          </div>
          <div>
            <label htmlFor="heroTitle" className="label">
              Titre principal *
            </label>
            <Input
              id="heroTitle"
              name="heroTitle"
              required
              defaultValue={defaultValues.heroTitle}
              aria-invalid={Boolean(fieldErrors.heroTitle) || undefined}
            />
            {fieldErrors.heroTitle ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.heroTitle}
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <label htmlFor="heroSubtitle" className="label">
            Sous-titre
          </label>
          <Textarea
            id="heroSubtitle"
            name="heroSubtitle"
            rows={3}
            defaultValue={defaultValues.heroSubtitle ?? ""}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="heroPrimaryCtaLabel" className="label">
              CTA principal *
            </label>
            <Input
              id="heroPrimaryCtaLabel"
              name="heroPrimaryCtaLabel"
              required
              defaultValue={defaultValues.heroPrimaryCtaLabel}
              aria-invalid={Boolean(fieldErrors.heroPrimaryCtaLabel) || undefined}
            />
            {fieldErrors.heroPrimaryCtaLabel ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.heroPrimaryCtaLabel}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="heroSecondaryCtaLabel" className="label">
                CTA secondaire
              </label>
              <Input
                id="heroSecondaryCtaLabel"
                name="heroSecondaryCtaLabel"
                defaultValue={defaultValues.heroSecondaryCtaLabel ?? ""}
              />
            </div>
            <div>
              <label htmlFor="heroSecondaryCtaUrl" className="label">
                Lien CTA secondaire
              </label>
              <Input
                id="heroSecondaryCtaUrl"
                name="heroSecondaryCtaUrl"
                placeholder="/catalogue"
                defaultValue={defaultValues.heroSecondaryCtaUrl ?? ""}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="aboutTitle" className="label">
              Bloc “À propos” — titre
            </label>
            <Input
              id="aboutTitle"
              name="aboutTitle"
              defaultValue={defaultValues.aboutTitle ?? ""}
            />
          </div>
          <div>
            <label htmlFor="contactBlurb" className="label">
              Bloc contact — résumé
            </label>
            <Input
              id="contactBlurb"
              name="contactBlurb"
              defaultValue={defaultValues.contactBlurb ?? ""}
            />
          </div>
        </div>
        <div>
          <label htmlFor="aboutBody" className="label">
            Texte de présentation
          </label>
          <Textarea
            id="aboutBody"
            name="aboutBody"
            rows={4}
            defaultValue={defaultValues.aboutBody ?? ""}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="contactEmailOverride" className="label">
              Email affiché
            </label>
            <Input
              id="contactEmailOverride"
              name="contactEmailOverride"
              placeholder="contact@exemple.com"
              defaultValue={defaultValues.contactEmailOverride ?? ""}
            />
          </div>
          <div>
            <label htmlFor="contactPhoneOverride" className="label">
              Téléphone affiché
            </label>
            <Input
              id="contactPhoneOverride"
              name="contactPhoneOverride"
              placeholder="+216..."
              defaultValue={defaultValues.contactPhoneOverride ?? ""}
            />
          </div>
          <div>
            <label htmlFor="contactAddressOverride" className="label">
              Adresse
            </label>
            <Input
              id="contactAddressOverride"
              name="contactAddressOverride"
              placeholder="Adresse commerciale"
              defaultValue={defaultValues.contactAddressOverride ?? ""}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="leadNotificationEmail" className="label">
              Email notifications leads
            </label>
            <Input
              id="leadNotificationEmail"
              name="leadNotificationEmail"
              placeholder="prospects@exemple.com"
              defaultValue={defaultValues.leadNotificationEmail ?? ""}
            />
          </div>
          <div>
            <label htmlFor="leadAutoTag" className="label">
              Tag appliqué dans Clients
            </label>
            <Input
              id="leadAutoTag"
              name="leadAutoTag"
              placeholder="Prospect web"
              defaultValue={defaultValues.leadAutoTag ?? ""}
            />
          </div>
          <div>
            <label htmlFor="leadThanksMessage" className="label">
              Message de remerciement
            </label>
            <Input
              id="leadThanksMessage"
              name="leadThanksMessage"
              placeholder="Nous revenons vers vous sous 24h…"
              defaultValue={defaultValues.leadThanksMessage ?? ""}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="showPrices"
              className="checkbox"
              defaultChecked={defaultValues.showPrices}
            />
            Afficher les prix TTC
          </label>
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="showInactiveProducts"
              className="checkbox"
              defaultChecked={defaultValues.showInactiveProducts}
            />
            Inclure les produits inactifs
          </label>
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="spamProtectionEnabled"
              className="checkbox"
              defaultChecked={defaultValues.spamProtectionEnabled}
            />
            Anti-spam activé
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="seoTitle" className="label">
              Titre SEO
            </label>
            <Input
              id="seoTitle"
              name="seoTitle"
              placeholder="Nom — Catalogue public"
              defaultValue={defaultValues.seoTitle ?? ""}
            />
          </div>
          <div>
            <label htmlFor="seoKeywords" className="label">
              Mots-clés
            </label>
            <Input
              id="seoKeywords"
              name="seoKeywords"
              placeholder="audit, intégration, conseil..."
              defaultValue={defaultValues.seoKeywords ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="seoDescription" className="label">
              Description SEO
            </label>
            <Textarea
              id="seoDescription"
              name="seoDescription"
              rows={3}
              defaultValue={defaultValues.seoDescription ?? ""}
            />
          </div>
          <div>
            <label htmlFor="socialImageUrl" className="label">
              Image de partage (URL)
            </label>
            <Input
              id="socialImageUrl"
              name="socialImageUrl"
              placeholder="https://…"
              defaultValue={defaultValues.socialImageUrl ?? ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <FormSubmitButton className="w-full sm:w-auto">
            Enregistrer les modifications
          </FormSubmitButton>
        </div>
      </form>

      <form action={ecommerceAction} className="card space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Configuration e-commerce
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Configurez les modes de paiement, les règles de checkout et la mise
            en avant des produits.
          </p>
        </div>
        {ecommerceState.status === "error" && ecommerceState.message ? (
          <Alert variant="error" title={ecommerceState.message} />
        ) : null}
        {ecommerceState.status === "success" && ecommerceState.message ? (
          <Alert variant="success" title={ecommerceState.message} />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="paymentMethodCard"
              className="checkbox"
              defaultChecked={
                defaultValues.ecommerceSettings.payments.methods.card
              }
            />
            Carte bancaire
          </label>
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="paymentMethodBankTransfer"
              className="checkbox"
              defaultChecked={
                defaultValues.ecommerceSettings.payments.methods.bankTransfer
              }
            />
            Virement bancaire
          </label>
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="paymentMethodCashOnDelivery"
              className="checkbox"
              defaultChecked={
                defaultValues.ecommerceSettings.payments.methods.cashOnDelivery
              }
            />
            Paiement à la livraison
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="bankTransferInstructions" className="label">
              Instructions virement
            </label>
            <Textarea
              id="bankTransferInstructions"
              name="bankTransferInstructions"
              rows={4}
              defaultValue={
                defaultValues.ecommerceSettings.payments.bankTransfer.instructions
              }
              aria-invalid={
                Boolean(ecommerceFieldErrors.bankTransferInstructions) ||
                undefined
              }
              data-invalid={
                ecommerceFieldErrors.bankTransferInstructions ? "true" : undefined
              }
            />
            {ecommerceFieldErrors.bankTransferInstructions ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {ecommerceFieldErrors.bankTransferInstructions}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="checkoutTermsUrl" className="label">
              Lien CGV / mentions
            </label>
            <Input
              id="checkoutTermsUrl"
              name="checkoutTermsUrl"
              placeholder="/conditions-generales"
              defaultValue={defaultValues.ecommerceSettings.checkout.termsUrl}
              aria-invalid={
                Boolean(ecommerceFieldErrors.checkoutTermsUrl) || undefined
              }
              data-invalid={
                ecommerceFieldErrors.checkoutTermsUrl ? "true" : undefined
              }
            />
            {ecommerceFieldErrors.checkoutTermsUrl ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {ecommerceFieldErrors.checkoutTermsUrl}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="checkoutRequirePhone"
              className="checkbox"
              defaultChecked={
                defaultValues.ecommerceSettings.checkout.requirePhone
              }
            />
            Téléphone requis au checkout
          </label>
          <label className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="checkoutAllowNotes"
              className="checkbox"
              defaultChecked={
                defaultValues.ecommerceSettings.checkout.allowNotes
              }
            />
            Autoriser les notes client
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label">Produits mis en avant</label>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {featuredCountLabel}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sélectionnez les produits affichés en priorité sur la page d’accueil.
          </p>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/50">
            <label className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
              Recherche
              <span className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
                <Input
                  className="h-10 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                  placeholder="Nom, SKU ou catégorie"
                  value={featuredSearch}
                  onChange={(event) => setFeaturedSearch(event.target.value)}
                  aria-label="Rechercher un produit"
                />
              </span>
            </label>
            {featuredProductsError ? (
              <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                {featuredProductsError}
              </p>
            ) : null}
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {featuredProductsInitialLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`featured-skeleton-${index}`}
                      className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
                    />
                  ))
                : featuredProducts.map((product) => {
                    const isSelected = featuredSelection.has(product.id);
                    return (
                      <label
                        key={product.id}
                        className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        <input
                          type="checkbox"
                          className="checkbox mt-1"
                          checked={isSelected}
                          onChange={() => toggleFeaturedProduct(product.id)}
                          aria-label={`Mettre en avant ${product.name}`}
                        />
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {product.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {product.sku ?? "SKU inconnu"} ·{" "}
                            {product.category ?? "Sans catégorie"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
              {featuredProductsEmpty && !featuredProductsInitialLoading ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Aucun produit visible ne correspond à votre recherche.
                </p>
              ) : null}
            </div>
            {featuredProductsHasMore ? (
              <button
                type="button"
                onClick={loadMoreFeaturedProducts}
                disabled={Boolean(featuredLoadingPage)}
                className="mt-3 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {featuredLoadingPage ? "Chargement..." : "Charger plus"}
              </button>
            ) : null}
          </div>
          {ecommerceFieldErrors.featuredProductIds ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {ecommerceFieldErrors.featuredProductIds}
            </p>
          ) : null}
          {featuredProductIdsValue ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words">
              IDs sélectionnés : {featuredProductIdsValue}
            </p>
          ) : null}
          <input
            type="hidden"
            name="featuredProductIds"
            value={featuredProductIdsValue}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <FormSubmitButton className="w-full sm:w-auto">
            Enregistrer la configuration e-commerce
          </FormSubmitButton>
        </div>
      </form>

      <WebsiteCmsPagesManager
        initialPages={defaultValues.cmsPages}
        websiteSlug={websiteSlug}
      />
    </div>
  );
}
