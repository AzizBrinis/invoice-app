import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

type ClientFormProps = {
  action: (formData: FormData) => void;
  submitLabel: string;
  defaultValues?: {
    displayName?: string | null;
    companyName?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
    notes?: string | null;
    isActive?: boolean;
  };
};

export function ClientForm({ action, submitLabel, defaultValues }: ClientFormProps) {
  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="displayName" className="label">
            Nom / Raison sociale
          </label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={defaultValues?.displayName ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="companyName" className="label">
            Raison sociale secondaire
          </label>
          <Input
            id="companyName"
            name="companyName"
            defaultValue={defaultValues?.companyName ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="email" className="label">
            E-mail
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="phone" className="label">
            Téléphone
          </label>
          <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="vatNumber" className="label">
            Numéro de TVA
          </label>
          <Input
            id="vatNumber"
            name="vatNumber"
            defaultValue={defaultValues?.vatNumber ?? ""}
          />
        </div>
        <div className="space-y-2">
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
      </div>

      <div className="space-y-2">
        <label htmlFor="address" className="label">
          Adresse
        </label>
        <Textarea
          id="address"
          name="address"
          rows={3}
          defaultValue={defaultValues?.address ?? ""}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="label">
          Notes internes
        </label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaultValues?.notes ?? ""}
        />
      </div>

      <div className="flex justify-end gap-3">
        <FormSubmitButton>{submitLabel}</FormSubmitButton>
      </div>
    </form>
  );
}
