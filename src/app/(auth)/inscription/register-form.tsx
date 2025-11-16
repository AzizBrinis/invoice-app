"use client";

import { useActionState, useEffect } from "react";
import { registerAction, type RegisterFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast-provider";

export function RegisterForm() {
  const [state, formAction] = useActionState<RegisterFormState, FormData>(
    registerAction,
    {},
  );
  const { addToast } = useToast();

  const fieldErrors = state?.fieldErrors ?? {};
  const hasFieldErrors = Object.values(fieldErrors ?? {}).some(Boolean);

  useEffect(() => {
    if (state?.message && !hasFieldErrors) {
      addToast({
        variant: "error",
        title: state.message,
      });
    }
  }, [addToast, hasFieldErrors, state?.message]);

  return (
    <form action={formAction} className="space-y-5">
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
          aria-invalid={Boolean(fieldErrors?.name)}
          data-invalid={fieldErrors?.name ? "true" : undefined}
        />
        {fieldErrors?.name ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.name}
          </p>
        ) : null}
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
          aria-invalid={Boolean(fieldErrors?.email)}
          data-invalid={fieldErrors?.email ? "true" : undefined}
        />
        {fieldErrors?.email ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.email}
          </p>
        ) : null}
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
          aria-invalid={Boolean(fieldErrors?.password)}
          data-invalid={fieldErrors?.password ? "true" : undefined}
        />
        {fieldErrors?.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.password}
          </p>
        ) : null}
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
          aria-invalid={Boolean(fieldErrors?.confirmPassword)}
          data-invalid={fieldErrors?.confirmPassword ? "true" : undefined}
        />
        {fieldErrors?.confirmPassword ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>
      {state?.message ? <Alert variant="error" title={state.message} /> : null}
      <FormSubmitButton className="w-full">
        Créer le compte
      </FormSubmitButton>
    </form>
  );
}
