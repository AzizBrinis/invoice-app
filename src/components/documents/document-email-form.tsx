"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import type {
  DocumentEmailActionInput,
  DocumentEmailActionResult,
} from "@/types/document-email";

type DocumentEmailFormProps = {
  action: (
    input: DocumentEmailActionInput,
  ) => Promise<DocumentEmailActionResult>;
  defaultEmail?: string | null;
  defaultSubject: string;
  disabled?: boolean;
  submitLabel: string;
  helperText?: string;
};

export function DocumentEmailForm({
  action,
  defaultEmail,
  defaultSubject,
  disabled = false,
  submitLabel,
  helperText,
}: DocumentEmailFormProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [subject, setSubject] = useState(defaultSubject);
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || pending) {
      return;
    }
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    if (!trimmedEmail) {
      addToast({
        variant: "error",
        title: "Adresse e-mail requise",
        description: "Veuillez saisir un destinataire avant l'envoi.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await action({
          email: trimmedEmail,
          subject: trimmedSubject.length ? trimmedSubject : undefined,
        });
        addToast({
          variant: result.variant,
          title: result.message,
        });
        if (result.variant === "success") {
          setEmail(trimmedEmail);
          setSubject(trimmedSubject.length ? trimmedSubject : defaultSubject);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Envoi impossible pour le moment.";
        addToast({
          variant: "error",
          title: "Échec de la mise en file d'attente",
          description: message,
        });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="space-y-1 sm:col-span-1">
        <label htmlFor="document-email-form-to" className="label">
          Destinataire
        </label>
        <Input
          id="document-email-form-to"
          name="email"
          type="email"
          value={email}
          required
          disabled={disabled}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="space-y-1 sm:col-span-1">
        <label htmlFor="document-email-form-subject" className="label">
          Objet
        </label>
        <Input
          id="document-email-form-subject"
          name="subject"
          value={subject}
          disabled={disabled}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      {helperText ? (
        <p className="sm:col-span-2 text-sm text-zinc-500 dark:text-zinc-400">
          {helperText}
        </p>
      ) : null}
      <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          loading={pending}
          disabled={disabled}
          className="w-full sm:w-auto"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
