"use client";

import { useActionState, useEffect } from "react";
import { authenticate, type LoginFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast-provider";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState<LoginFormState, FormData>(
    authenticate,
    {},
  );
  const { addToast } = useToast();

  const emailError = state?.fieldErrors?.email;
  const passwordError = state?.fieldErrors?.password;
  const hasFieldError = Boolean(emailError || passwordError);

  useEffect(() => {
    if (state?.message && !hasFieldError) {
      addToast({
        variant: "error",
        title: state.message,
      });
    }
  }, [addToast, hasFieldError, state?.message]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {state?.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}
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
          aria-invalid={Boolean(emailError)}
          data-invalid={emailError ? "true" : undefined}
        />
        {emailError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{emailError}</p>
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
          autoComplete="current-password"
          required
          aria-invalid={Boolean(passwordError)}
          data-invalid={passwordError ? "true" : undefined}
        />
        {passwordError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p>
        ) : null}
      </div>
      <FormSubmitButton className="w-full">
        Se connecter
      </FormSubmitButton>
    </form>
  );
}
