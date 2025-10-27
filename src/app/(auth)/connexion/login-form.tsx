"use client";

import { useActionState } from "react";
import { authenticate, type LoginFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState<LoginFormState, FormData>(
    authenticate,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="space-y-2">
        <label htmlFor="email" className="label">
          Adresse e-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="admin@demo.fr"
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
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {state.error}
        </p>
      )}
      <FormSubmitButton className="w-full">
        Se connecter
      </FormSubmitButton>
    </form>
  );
}
