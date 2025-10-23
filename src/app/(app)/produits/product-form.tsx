import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { fromCents } from "@/lib/money";
import type { CurrencyCode } from "@/lib/currency";

type ProductFormProps = {
  action: (formData: FormData) => void;
  submitLabel: string;
  currencyCode: CurrencyCode;
  defaultValues?: {
    sku?: string;
    name?: string;
    description?: string | null;
    category?: string | null;
    unit?: string;
    priceHTCents?: number;
    vatRate?: number;
    defaultDiscountRate?: number | null;
    isActive?: boolean;
  };
};

export function ProductForm({
  action,
  submitLabel,
  defaultValues,
  currencyCode,
}: ProductFormProps) {
  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="sku" className="text-sm font-medium text-zinc-700">
            SKU / Référence
          </label>
          <Input
            id="sku"
            name="sku"
            defaultValue={defaultValues?.sku ?? ""}
            required
          />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700">
            Nom du produit ou service
          </label>
          <Input
            id="name"
            name="name"
            defaultValue={defaultValues?.name ?? ""}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium text-zinc-700">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="category" className="text-sm font-medium text-zinc-700">
            Catégorie
          </label>
          <Input
            id="category"
            name="category"
            defaultValue={defaultValues?.category ?? ""}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="unit" className="text-sm font-medium text-zinc-700">
            Unité
          </label>
          <Input
            id="unit"
            name="unit"
            defaultValue={defaultValues?.unit ?? "unité"}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="isActive" className="text-sm font-medium text-zinc-700">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="priceHT" className="text-sm font-medium text-zinc-700">
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
                ? fromCents(defaultValues.priceHTCents)
                : ""
            }
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="vatRate" className="text-sm font-medium text-zinc-700">
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
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="defaultDiscountRate" className="text-sm font-medium text-zinc-700">
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
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
