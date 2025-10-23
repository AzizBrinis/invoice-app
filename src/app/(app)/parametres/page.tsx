import { getSettings } from "@/server/settings";
import { prisma } from "@/lib/prisma";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "@/app/(app)/parametres/actions";
import { normalizeTaxConfiguration, TAX_ORDER_ITEMS } from "@/lib/taxes";
import { fromCents } from "@/lib/money";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

export default async function ParametresPage() {
  const [settings, templates] = await Promise.all([
    getSettings(),
    prisma.pdfTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  const devisTemplates = templates.filter((tpl) => tpl.type === "DEVIS");
  const factureTemplates = templates.filter((tpl) => tpl.type === "FACTURE");
  const taxConfig = normalizeTaxConfiguration(settings.taxConfiguration);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Paramètres généraux</h1>
        <p className="text-sm text-zinc-600">
          Configurez les informations de votre société, les numérotations et les mentions légales.
        </p>
      </div>

      <form action={updateSettingsAction} className="space-y-6">
        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Société & identité</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="companyName" className="text-sm font-medium text-zinc-700">
                Dénomination sociale
              </label>
              <Input
                id="companyName"
                name="companyName"
                defaultValue={settings.companyName}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="logoUrl" className="text-sm font-medium text-zinc-700">
                URL du logo
              </label>
              <Input id="logoUrl" name="logoUrl" defaultValue={settings.logoUrl ?? ""} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="siren" className="text-sm font-medium text-zinc-700">
                SIREN
              </label>
              <Input id="siren" name="siren" defaultValue={settings.siren ?? ""} />
            </div>
            <div className="space-y-2">
              <label htmlFor="tvaNumber" className="text-sm font-medium text-zinc-700">
                Numéro TVA intracommunautaire
              </label>
              <Input
                id="tvaNumber"
                name="tvaNumber"
                defaultValue={settings.tvaNumber ?? ""}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="iban" className="text-sm font-medium text-zinc-700">
                IBAN
              </label>
              <Input id="iban" name="iban" defaultValue={settings.iban ?? ""} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-zinc-700">
                E-mail de contact
              </label>
              <Input id="email" name="email" defaultValue={settings.email ?? ""} />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-zinc-700">
                Téléphone
              </label>
              <Input id="phone" name="phone" defaultValue={settings.phone ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium text-zinc-700">
              Adresse complète
            </label>
            <Textarea id="address" name="address" rows={3} defaultValue={settings.address ?? ""} />
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Fiscalité & devises</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="defaultCurrency" className="text-sm font-medium text-zinc-700">
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
              <label htmlFor="defaultVatRate" className="text-sm font-medium text-zinc-700">
                Taux de TVA par défaut (%)
              </label>
              <Input
                id="defaultVatRate"
                name="defaultVatRate"
                type="number"
                min="0"
                step="0.1"
                defaultValue={settings.defaultVatRate}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="paymentTerms" className="text-sm font-medium text-zinc-700">
                Conditions de paiement
              </label>
              <Input
                id="paymentTerms"
                name="paymentTerms"
                defaultValue={settings.paymentTerms ?? ""}
                placeholder="Paiement à 30 jours..."
              />
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Paramètres fiscaux (Tunisie)</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-800">TVA</h3>
              <div className="space-y-2">
                <label htmlFor="tvaRatesJson" className="text-sm font-medium text-zinc-700">
                  Taux de TVA (JSON)
                </label>
                <Textarea
                  id="tvaRatesJson"
                  name="tvaRatesJson"
                  rows={6}
                  defaultValue={JSON.stringify(taxConfig.tva.rates, null, 2)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-zinc-500">
                  Exemple:&nbsp;
                  <code>
                    {'[{"code": "T19", "label": "TVA 19%", "rate": 19}]'}
                  </code>
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="tvaApplyMode" className="text-sm font-medium text-zinc-700">
                  Mode d&apos;application
                </label>
                <select
                  id="tvaApplyMode"
                  name="tvaApplyMode"
                  className="input"
                  defaultValue={taxConfig.tva.applyMode}
                >
                  <option value="line">Par ligne</option>
                  <option value="document">Sur le document</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="tvaAllowExemption"
                  defaultChecked={taxConfig.tva.allowExemption}
                  className="h-4 w-4"
                />
                Autoriser l&apos;exonération
              </label>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-800">FODEC</h3>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="fodecEnabled"
                  defaultChecked={taxConfig.fodec.enabled}
                  className="h-4 w-4"
                />
                Activer la FODEC
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="fodecRate" className="text-sm font-medium text-zinc-700">
                    Taux (%)
                  </label>
                  <Input
                    id="fodecRate"
                    name="fodecRate"
                    type="number"
                    step="0.1"
                    min="0"
                    defaultValue={taxConfig.fodec.rate}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="fodecApplication" className="text-sm font-medium text-zinc-700">
                    Application
                  </label>
                  <select
                    id="fodecApplication"
                    name="fodecApplication"
                    className="input"
                    defaultValue={taxConfig.fodec.application}
                  >
                    <option value="line">Par ligne</option>
                    <option value="document">Sur le document</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="fodecOrder" className="text-sm font-medium text-zinc-700">
                  Ordre de calcul
                </label>
                <select
                  id="fodecOrder"
                  name="fodecOrder"
                  className="input"
                  defaultValue={taxConfig.fodec.calculationOrder}
                >
                  <option value="BEFORE_TVA">Avant TVA</option>
                  <option value="AFTER_TVA">Après TVA</option>
                </select>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-800">Timbre fiscal</h3>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    name="timbreEnabled"
                    defaultChecked={taxConfig.timbre.enabled}
                    className="h-4 w-4"
                  />
                  Activer le timbre fiscal
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="timbreAmount" className="text-sm font-medium text-zinc-700">
                      Montant (TND)
                    </label>
                    <Input
                      id="timbreAmount"
                      name="timbreAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={fromCents(taxConfig.timbre.amountCents)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      name="timbreAutoApply"
                      defaultChecked={taxConfig.timbre.autoApply}
                      className="h-4 w-4"
                    />
                    Appliquer automatiquement
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-800">Ordre de calcul</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {taxConfig.order.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <label className="text-xs font-medium text-zinc-600">{index + 1}ᵉ position</label>
                    <select
                      name={`taxOrder${index + 1}`}
                      defaultValue={item}
                      className="input"
                    >
                      {TAX_ORDER_ITEMS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="roundingLine" className="text-sm font-medium text-zinc-700">
                  Arrondi (ligne)
                </label>
                <select
                  id="roundingLine"
                  name="roundingLine"
                  className="input"
                  defaultValue={taxConfig.rounding.line}
                >
                  <option value="nearest-cent">Au centime</option>
                  <option value="up">Arrondi supérieur</option>
                  <option value="down">Arrondi inférieur</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="roundingTotal" className="text-sm font-medium text-zinc-700">
                  Arrondi (total)
                </label>
                <select
                  id="roundingTotal"
                  name="roundingTotal"
                  className="input"
                  defaultValue={taxConfig.rounding.total}
                >
                  <option value="nearest-cent">Au centime</option>
                  <option value="up">Arrondi supérieur</option>
                  <option value="down">Arrondi inférieur</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Numérotation</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="quoteNumberPrefix" className="text-sm font-medium text-zinc-700">
                Préfixe devis
              </label>
              <Input
                id="quoteNumberPrefix"
                name="quoteNumberPrefix"
                defaultValue={settings.quoteNumberPrefix}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invoiceNumberPrefix" className="text-sm font-medium text-zinc-700">
                Préfixe factures
              </label>
              <Input
                id="invoiceNumberPrefix"
                name="invoiceNumberPrefix"
                defaultValue={settings.invoiceNumberPrefix}
              />
            </div>
            <div className="flex items-end gap-2">
              <input
                id="resetNumberingAnnually"
                name="resetNumberingAnnually"
                type="checkbox"
                defaultChecked={settings.resetNumberingAnnually}
                className="h-5 w-5 rounded border border-zinc-300"
              />
              <label htmlFor="resetNumberingAnnually" className="text-sm text-zinc-700">
                Réinitialisation annuelle
              </label>
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Modèles PDF</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="quoteTemplateId" className="text-sm font-medium text-zinc-700">
                Modèle de devis
              </label>
              <select
                id="quoteTemplateId"
                name="quoteTemplateId"
                className="input"
                defaultValue={settings.quoteTemplateId ?? ""}
              >
                <option value="">Modèle standard</option>
                {devisTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="invoiceTemplateId" className="text-sm font-medium text-zinc-700">
                Modèle de facture
              </label>
              <select
                id="invoiceTemplateId"
                name="invoiceTemplateId"
                className="input"
                defaultValue={settings.invoiceTemplateId ?? ""}
              >
                <option value="">Modèle standard</option>
                {factureTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="defaultQuoteFooter" className="text-sm font-medium text-zinc-700">
                Pied de page des devis
              </label>
              <Textarea
                id="defaultQuoteFooter"
                name="defaultQuoteFooter"
                rows={3}
                defaultValue={settings.defaultQuoteFooter ?? ""}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="defaultInvoiceFooter" className="text-sm font-medium text-zinc-700">
                Pied de page des factures
              </label>
              <Textarea
                id="defaultInvoiceFooter"
                name="defaultInvoiceFooter"
                rows={3}
                defaultValue={settings.defaultInvoiceFooter ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="legalFooter" className="text-sm font-medium text-zinc-700">
              Mentions légales
            </label>
            <Textarea
              id="legalFooter"
              name="legalFooter"
              rows={3}
              defaultValue={settings.legalFooter ?? ""}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultConditions" className="text-sm font-medium text-zinc-700">
              Conditions générales de vente
            </label>
            <Textarea
              id="defaultConditions"
              name="defaultConditions"
              rows={4}
              defaultValue={settings.defaultConditions ?? ""}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit">Enregistrer les paramètres</Button>
        </div>
      </form>
    </div>
  );
}
