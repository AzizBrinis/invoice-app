"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { fromCents } from "@/lib/money";
import type { CurrencyCode } from "@/lib/currency";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast-provider";
import {
  submitProductFormAction,
} from "@/app/(app)/produits/actions";
import {
  INITIAL_PRODUCT_FORM_STATE,
  type ProductFormState,
} from "@/app/(app)/produits/form-state";
import type { Route } from "next";

type ProductFormProps = {
  submitLabel: string;
  currencyCode: CurrencyCode;
  defaultValues?: {
    id?: string;
    sku?: string;
    name?: string;
    description?: string | null;
    category?: string | null;
    unit?: string;
    priceHTCents?: number;
    vatRate?: number;
    defaultDiscountRate?: number | null;
    isActive?: boolean;
    isListedInCatalog?: boolean;
  };
  redirectTo?: string;
};

export function ProductForm({
  submitLabel,
  defaultValues,
  currencyCode,
  redirectTo,
}: ProductFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [formState, formAction] = useActionState<ProductFormState, FormData>(
    submitProductFormAction,
    INITIAL_PRODUCT_FORM_STATE,
  );

  useEffect(() => {
    if (formState.status === "success") {
      addToast({
        variant: "success",
        title: formState.message ?? "Produit enregistré",
      });
      const destination =
        redirectTo && redirectTo.startsWith("/")
          ? redirectTo
          : "/produits";
      router.push(destination as Route);
    }
  }, [
    addToast,
    formState.message,
    formState.status,
    redirectTo,
    router,
  ]);

  const fieldErrors = formState.fieldErrors ?? {};
  const target = redirectTo ?? "/produits";

  return (
    <form action={formAction} className="card space-y-5 p-4 sm:p-6">
      <input type="hidden" name="redirectTo" value={target} />
      <input type="hidden" name="productId" value={defaultValues?.id ?? ""} />
      {formState.status === "error" && formState.message ? (
        <Alert variant="error" title={formState.message} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <label htmlFor="sku" className="label">
            SKU / Référence
          </label>
          <Input
            id="sku"
            name="sku"
            defaultValue={defaultValues?.sku ?? ""}
            required
            aria-invalid={Boolean(fieldErrors.sku) || undefined}
            data-invalid={fieldErrors.sku ? "true" : undefined}
          />
          {fieldErrors.sku ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.sku}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2 sm:col-span-2 md:col-span-2">
          <label htmlFor="name" className="label">
            Nom du produit ou service
          </label>
          <Input
            id="name"
            name="name"
            defaultValue={defaultValues?.name ?? ""}
            required
            aria-invalid={Boolean(fieldErrors.name) || undefined}
            data-invalid={fieldErrors.name ? "true" : undefined}
          />
          {fieldErrors.name ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="label">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 space-y-2">
          <label htmlFor="category" className="label">
            Catégorie
          </label>
          <Input
            id="category"
            name="category"
            defaultValue={defaultValues?.category ?? ""}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="unit" className="label">
            Unité
          </label>
          <Input
            id="unit"
            name="unit"
            defaultValue={defaultValues?.unit ?? "unité"}
            aria-invalid={Boolean(fieldErrors.unit) || undefined}
            data-invalid={fieldErrors.unit ? "true" : undefined}
          />
          {fieldErrors.unit ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.unit}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="isActive" className="label">
            Statut
          </label>
          <select
            id="isActive"
            name="isActive"
            className="input"
            defaultValue={defaultValues?.isActive === false ? "false" : "true"}
          >
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="isListedInCatalog" className="label">
            Catalogue public
          </label>
          <select
            id="isListedInCatalog"
            name="isListedInCatalog"
            className="input"
            defaultValue={
              defaultValues?.isListedInCatalog === false ? "false" : "true"
            }
          >
            <option value="true">Visible</option>
            <option value="false">Masqué</option>
          </select>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Masquez un produit si vous ne souhaitez pas l’afficher sur le site.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <label htmlFor="priceHT" className="label">
            {`Prix HT (${currencyCode})`}
          </label>
          <Input
            id="priceHT"
            name="priceHT"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              defaultValues?.priceHTCents != null
                ? fromCents(defaultValues.priceHTCents, currencyCode)
                : ""
            }
            required
            aria-invalid={Boolean(fieldErrors.priceHTCents) || undefined}
            data-invalid={fieldErrors.priceHTCents ? "true" : undefined}
          />
          {fieldErrors.priceHTCents ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.priceHTCents}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="vatRate" className="label">
            Taux de TVA (%)
          </label>
          <Input
            id="vatRate"
            name="vatRate"
            type="number"
            min="0"
            step="0.5"
            defaultValue={defaultValues?.vatRate ?? 20}
            required
            aria-invalid={Boolean(fieldErrors.vatRate) || undefined}
            data-invalid={fieldErrors.vatRate ? "true" : undefined}
          />
          {fieldErrors.vatRate ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.vatRate}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="defaultDiscountRate" className="label">
            Remise par défaut (%)
          </label>
          <Input
            id="defaultDiscountRate"
            name="defaultDiscountRate"
            type="number"
            min="0"
            step="0.5"
            defaultValue={
              defaultValues?.defaultDiscountRate != null
                ? defaultValues.defaultDiscountRate
                : ""
            }
            aria-invalid={Boolean(fieldErrors.defaultDiscountRate) || undefined}
            data-invalid={
              fieldErrors.defaultDiscountRate ? "true" : undefined
            }
          />
          {fieldErrors.defaultDiscountRate ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.defaultDiscountRate}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <FormSubmitButton className="w-full sm:w-auto">
          {submitLabel}
        </FormSubmitButton>
      </div>
    </form>
  );
}
