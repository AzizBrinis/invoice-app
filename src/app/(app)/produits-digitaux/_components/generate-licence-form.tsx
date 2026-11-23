"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_LICENCE_QUANTITY } from "@/lib/digital-products/kaspersky-catalog";
import {
  getDigitalProductFamily,
  variantGroup,
  variantDurationLabel,
  variantGroupKey,
  type DigitalProductFamilyId,
} from "@/lib/digital-products/catalog";
import { generateLicenceAction, type GenerateLicenceActionState } from "../actions";

type Props = {
  familyId: DigitalProductFamilyId;
  formToken: string;
  defaultSku: string;
  available: Record<string, number>;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-600 dark:text-red-400">{message}</p> : null;
}

export function GenerateLicenceForm({ familyId, formToken, defaultSku, available }: Props) {
  const family = getDigitalProductFamily(familyId);
  const [state, formAction] = useActionState<GenerateLicenceActionState, FormData>(generateLicenceAction, {});
  const [sku, setSku] = useState(defaultSku);
  const [quantity, setQuantity] = useState(1);
  const stock = available[sku] ?? 0;
  const variant = useMemo(() => family.variants.find((item) => item.sku === sku), [family, sku]);
  const enough = quantity >= 1 && quantity <= stock;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" autoComplete="off">
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="family" value={family.id} />
      <div className="card space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="space-y-1.5">
            <label htmlFor="sku" className="label">Produit et nombre de postes</label>
            <Select id="sku" name="sku" value={sku} onChange={(event) => setSku(event.target.value)} required>
              {family.groups.map((group) => (
                <optgroup key={group.key} label={group.label}>
                  {family.variants.filter((item) => variantGroupKey(item) === group.key).map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.label} — {available[item.sku] ?? 0} dispo.
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <FieldError message={errors.sku} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="quantity" className="label">Quantité</label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={MAX_LICENCE_QUANTITY}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.trunc(Number(event.target.value) || 0))}
              required
              aria-describedby="quantity-hint"
            />
            <FieldError message={errors.quantity} />
          </div>
        </div>
        <p
          id="quantity-hint"
          className={enough ? "text-xs text-zinc-500 dark:text-zinc-400" : "text-xs text-amber-600 dark:text-amber-400"}
        >
          {stock === 0
            ? "Aucun code disponible pour cette variante. Ajoutez des codes avant de générer."
            : enough
              ? `${quantity} code(s) seront réservés automatiquement sur ${stock} disponible(s). ${family.documentHint}`
              : `Stock insuffisant : ${stock} code(s) disponible(s).`}
        </p>

        <fieldset className="space-y-4 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <legend className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Client et commande <span className="font-normal text-zinc-400">(facultatif)</span>
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="customerName" className="label">Nom du client</label>
              <Input id="customerName" name="customerName" maxLength={120} />
              <FieldError message={errors.customerName} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="customerEmail" className="label">E-mail du client</label>
              <Input id="customerEmail" name="customerEmail" type="email" maxLength={254} />
              <FieldError message={errors.customerEmail} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="orderReference" className="label">Référence de commande</label>
              <Input id="orderReference" name="orderReference" maxLength={64} placeholder="Ex. CMD-2026-001" />
              <FieldError message={errors.orderReference} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="activationRegion" className="label">Région d’activation</label>
              <Input id="activationRegion" name="activationRegion" maxLength={60} placeholder="Ex. Maghreb uniquement" />
              <FieldError message={errors.activationRegion} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="useBefore" className="label">Date limite d’utilisation du code</label>
              <Input id="useBefore" name="useBefore" type="date" />
              <FieldError message={errors.useBefore} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="notes" className="label">Note interne <span className="font-normal text-zinc-400">(non imprimée)</span></label>
            <Textarea id="notes" name="notes" rows={2} maxLength={500} />
            <FieldError message={errors.notes} />
          </div>
        </fieldset>

        {state.status === "error" && state.message ? <Alert variant="error" title={state.message} /> : null}
      </div>

      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-4">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Récapitulatif</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">Produit</dt>
            <dd className="text-right font-medium text-zinc-900 dark:text-zinc-100">
              {variant ? (variantGroup(variant)?.label ?? variant.label) : family.name}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">Appareils / licence</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{variant?.devices ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">Durée</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {variant ? variantDurationLabel(variant) : family.durationLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">Codes à attribuer</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{quantity > 0 ? quantity : "—"}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Les codes sont réservés dès la validation, puis marqués « utilisés » à la première génération du PDF.
        </p>
        <FormSubmitButton className="w-full" disabled={!enough} pendingLabel="Attribution des codes…">
          Créer la licence
        </FormSubmitButton>
      </aside>
    </form>
  );
}
