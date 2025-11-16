"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import {
  INITIAL_WEBSITE_CONTENT_FORM_STATE,
  type WebsiteContentFormState,
} from "@/app/(app)/site-web/form-state";
import { saveWebsiteContentAction } from "@/app/(app)/site-web/actions";
import {
  WEBSITE_TEMPLATES,
  type WebsiteTemplateKey,
} from "@/lib/website/templates";

type WebsiteContentFormProps = {
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
  };
};

export function WebsiteContentForm({ defaultValues }: WebsiteContentFormProps) {
  const [state, formAction] = useActionState<
    WebsiteContentFormState,
    FormData
  >(saveWebsiteContentAction, INITIAL_WEBSITE_CONTENT_FORM_STATE);
  const fieldErrors = state.fieldErrors ?? {};

  return (
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
  );
}
