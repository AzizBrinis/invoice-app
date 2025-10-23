import { getSettings } from "@/server/settings";
import { prisma } from "@/lib/prisma";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "@/app/(app)/parametres/actions";

export default async function ParametresPage() {
  const [settings, templates] = await Promise.all([
    getSettings(),
    prisma.pdfTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  const devisTemplates = templates.filter((tpl) => tpl.type === "DEVIS");
  const factureTemplates = templates.filter((tpl) => tpl.type === "FACTURE");

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
              <Input
                id="defaultCurrency"
                name="defaultCurrency"
                defaultValue={settings.defaultCurrency}
                placeholder="EUR"
              />
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
