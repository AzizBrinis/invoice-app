"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";

const clientFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Nom requis"),
  email: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? "")
    .refine(
      (value) => value.length === 0 || z.string().email().safeParse(value).success,
      "E-mail invalide",
    ),
});

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
  redirectTo?: string;
};

export function ClientForm({ action, submitLabel, defaultValues, redirectTo }: ClientFormProps) {
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"displayName" | "email", string>>
  >({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = {
      displayName: formData.get("displayName")?.toString() ?? "",
      email: formData.get("email")?.toString(),
    };
    const parsed = clientFormSchema.safeParse(values);
    if (!parsed.success) {
      event.preventDefault();
      const { fieldErrors: errors } = parsed.error.flatten();
      setFieldErrors({
        displayName: errors.displayName?.[0],
        email: errors.email?.[0],
      });
      setFormMessage("Veuillez corriger les champs signalés.");
      return;
    }
    setFieldErrors({});
    setFormMessage(null);
  };

  const target = redirectTo ?? "/clients";

  return (
    <form action={action} className="card space-y-5 p-6" onSubmit={handleSubmit}>
      <input type="hidden" name="redirectTo" value={target} />
      {formMessage ? <Alert variant="error" title={formMessage} /> : null}
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
            aria-invalid={Boolean(fieldErrors.displayName)}
            data-invalid={fieldErrors.displayName ? "true" : undefined}
          />
          {fieldErrors.displayName ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.displayName}
            </p>
          ) : null}
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
            aria-invalid={Boolean(fieldErrors.email)}
            data-invalid={fieldErrors.email ? "true" : undefined}
          />
          {fieldErrors.email ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.email}
            </p>
          ) : null}
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
