"use client";

import { useActionState } from "react";
import { registerAction, type RegisterFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

export function RegisterForm() {
  const [state, formAction] = useActionState<RegisterFormState, FormData>(
    registerAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="label">
          Nom complet
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Alex Dupont"
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="label">
          Adresse e-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="admin@exemple.fr"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="label">
          Mot de passe
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="********"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="label">
          Confirmation du mot de passe
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="********"
          autoComplete="new-password"
          required
        />
      </div>
      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {state.error}
        </p>
      )}
      <FormSubmitButton className="w-full">
        Créer le compte
      </FormSubmitButton>
    </form>
  );
}
