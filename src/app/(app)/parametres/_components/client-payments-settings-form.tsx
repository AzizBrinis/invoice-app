"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { useToast } from "@/components/ui/toast-provider";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { updateClientPaymentSettingsInlineAction } from "@/app/(app)/parametres/actions";
import {
  type ClientPaymentSettingsActionState,
} from "@/app/(app)/parametres/actions";
import { INITIAL_CLIENT_PAYMENT_SETTINGS_ACTION_STATE } from "@/app/(app)/parametres/form-state";
import { getSettings } from "@/server/settings";

const POSITION_OPTIONS = [
  { value: "top-left", label: "Haut gauche" },
  { value: "top-right", label: "Haut droite" },
  { value: "bottom-left", label: "Bas gauche" },
  { value: "bottom-right", label: "Bas droite" },
] as const;

type ClientPaymentsSettingsFormProps = {
  settings: Awaited<ReturnType<typeof getSettings>>;
};

export function ClientPaymentsSettingsForm({
  settings,
}: ClientPaymentsSettingsFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState(() => [
    ...settings.clientPaymentMethods,
  ]);
  const [state, formAction] = useActionState<
    ClientPaymentSettingsActionState,
    FormData
  >(
    updateClientPaymentSettingsInlineAction,
    INITIAL_CLIENT_PAYMENT_SETTINGS_ACTION_STATE,
  );

  useEffect(() => {
    if (!state.status || !state.message) {
      return;
    }

    addToast({
      variant: state.status === "success" ? "success" : "error",
      title: state.message,
    });

    if (state.status === "success") {
      router.refresh();
    }
  }, [addToast, router, state.message, state.status]);

  const hasConfiguredLogo = Boolean(settings.logoData || settings.logoUrl);
  const hasUploadedLogo = Boolean(settings.logoData);
  const hasStampImage = Boolean(settings.stampImage);
  const hasSignatureImage = Boolean(settings.signatureImage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Paramètres des paiements
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Configurez uniquement les informations nécessaires à l&apos;affichage
          des paiements, à la liste des modes de règlement et à la génération
          des reçus du compte paiements clients.
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        {state.status === "error" && state.message ? (
          <Alert variant="error" title={state.message} />
        ) : null}

        <section className="card space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Société & affichage
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Informations visibles sur les reçus et dans les écrans de
              paiements.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="companyName" className="label">
              Nom affiché
            </label>
            <Input
              id="companyName"
              name="companyName"
              defaultValue={settings.companyName}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="defaultCurrency" className="label">
                Devise par défaut
              </label>
              <select
                id="defaultCurrency"
                name="defaultCurrency"
                className="input"
                defaultValue={settings.defaultCurrency}
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="label">
                E-mail de contact
              </label>
              <Input id="email" name="email" defaultValue={settings.email ?? ""} />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="label">
                Téléphone
              </label>
              <Input id="phone" name="phone" defaultValue={settings.phone ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className="label">
              Adresse complète
            </label>
            <Textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={settings.address ?? ""}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="iban" className="label">
              Coordonnées bancaires / IBAN
            </label>
            <Textarea
              id="iban"
              name="iban"
              rows={3}
              defaultValue={settings.iban ?? ""}
              placeholder={"BIAT - TN05...\nAttijari - TN75..."}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Optionnel. Indiquez un IBAN par ligne si vous souhaitez afficher
              plusieurs comptes sur vos reçus.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="legalFooter" className="label">
              Pied de page du reçu
            </label>
            <Textarea
              id="legalFooter"
              name="legalFooter"
              rows={3}
              defaultValue={settings.legalFooter ?? ""}
              placeholder="Merci pour votre paiement..."
            />
          </div>
        </section>

        <section className="card space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Modes de paiement
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Cette liste alimente directement le menu déroulant utilisé lors de
              l&apos;enregistrement d&apos;un paiement.
            </p>
          </div>

          <div className="space-y-3">
            {paymentMethods.map((method, index) => (
              <div
                key={`payment-method-${index}`}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <Input
                  name="clientPaymentMethods"
                  value={method}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setPaymentMethods((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? nextValue : entry,
                      ),
                    );
                  }}
                  placeholder="Ex. Paiement mobile"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:self-start"
                  disabled={paymentMethods.length === 1}
                  onClick={() => {
                    setPaymentMethods((current) => {
                      if (current.length === 1) {
                        return current;
                      }

                      return current.filter(
                        (_entry, entryIndex) => entryIndex !== index,
                      );
                    });
                  }}
                >
                  Supprimer
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPaymentMethods((current) => [...current, ""]);
              }}
            >
              Ajouter un mode
            </Button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Les lignes vides sont ignorées à l&apos;enregistrement. Gardez au
              moins un mode actif.
            </p>
          </div>
        </section>

        <section className="card space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Identité visuelle
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Éléments graphiques utilisés pour les reçus PDF.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="logoFile" className="label">
                Logo du reçu
              </label>
              <Input
                id="logoFile"
                name="logoFile"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {hasConfiguredLogo ? "Logo configuré." : "Aucun logo configuré."}
              </p>
              {hasUploadedLogo ? (
                <label className="label flex flex-wrap items-center gap-2">
                  <input type="checkbox" name="logoClear" className="checkbox" />
                  Supprimer le logo importé
                </label>
              ) : null}
              <label htmlFor="logoUrl" className="label">
                Logo via URL
              </label>
              <Input
                id="logoUrl"
                name="logoUrl"
                defaultValue={settings.logoUrl ?? ""}
                placeholder="https://.../logo.png"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                L&apos;image importée est prioritaire sur l&apos;URL.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="stampFile" className="label">
                Cachet
              </label>
              <Input
                id="stampFile"
                name="stampFile"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {hasStampImage
                  ? `Cachet configuré (${settings.stampPosition}).`
                  : "Aucun cachet configuré."}
              </p>
              {hasStampImage ? (
                <label className="label flex flex-wrap items-center gap-2">
                  <input type="checkbox" name="stampClear" className="checkbox" />
                  Supprimer le cachet
                </label>
              ) : null}
              <label htmlFor="stampPosition" className="label">
                Position dans le PDF
              </label>
              <select
                id="stampPosition"
                name="stampPosition"
                className="input"
                defaultValue={settings.stampPosition ?? "bottom-right"}
              >
                {POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="signatureFile" className="label">
                Signature
              </label>
              <Input
                id="signatureFile"
                name="signatureFile"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {hasSignatureImage
                  ? `Signature configurée (${settings.signaturePosition}).`
                  : "Aucune signature configurée."}
              </p>
              {hasSignatureImage ? (
                <label className="label flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    name="signatureClear"
                    className="checkbox"
                  />
                  Supprimer la signature
                </label>
              ) : null}
              <label htmlFor="signaturePosition" className="label">
                Position dans le PDF
              </label>
              <select
                id="signaturePosition"
                name="signaturePosition"
                className="input"
                defaultValue={settings.signaturePosition ?? "bottom-right"}
              >
                {POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="card space-y-3 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Cadre de ce compte
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Cet espace reste volontairement limité aux réglages utiles pour les
            reçus et l&apos;affichage du compte.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Les données fiscales et orientées facture/devis déjà stockées sont
            conservées, mais non exposées ici : TVA, FODEC, timbre fiscal,
            modèles PDF facture/devis, numérotation facture/devis et conditions
            générales associées.
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <FormSubmitButton className="w-full sm:w-auto">
            Enregistrer les paramètres
          </FormSubmitButton>
        </div>
      </form>
    </div>
  );
}
