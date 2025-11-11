"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

type LeadCaptureFormProps = {
  slug: string;
  mode: "public" | "preview";
  thanksMessage?: string | null;
  spamProtectionEnabled: boolean;
  path?: string | null;
  className?: string;
};

const DEFAULT_THANKS =
  "Merci ! Nous revenons vers vous dans les plus brefs délais.";

export function LeadCaptureForm({
  slug,
  mode,
  thanksMessage,
  spamProtectionEnabled,
  path,
  className,
}: LeadCaptureFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolvedPath = useMemo(() => {
    if (path) return path;
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "/";
  }, [path]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setMessage(null);

    if (mode === "preview") {
      setStatus("success");
      setMessage(
        thanksMessage ??
          "Mode prévisualisation : aucune donnée n'est enregistrée.",
      );
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("slug", slug);
    formData.set("mode", mode);
    formData.set("path", resolvedPath);

    try {
      const response = await fetch("/api/catalogue/leads", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        status?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || result.error) {
        throw new Error(
          result.error ?? "Impossible d'enregistrer votre demande.",
        );
      }
      form.reset();
      setStatus("success");
      setMessage(result.message ?? thanksMessage ?? DEFAULT_THANKS);
    } catch (submissionError) {
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Impossible d'enregistrer votre demande.",
      );
    }
  }

  const disabled = status === "loading" || status === "success";

  return (
    <form
      className={className}
      onSubmit={handleSubmit}
      aria-live="polite"
    >
      {message ? <Alert variant="success" title={message} /> : null}
      {error ? <Alert variant="error" title={error} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-name" className="label">
            Nom complet *
          </label>
          <Input
            id="lead-name"
            name="name"
            placeholder="Nom et prénom"
            required
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="lead-company" className="label">
            Entreprise
          </label>
          <Input
            id="lead-company"
            name="company"
            placeholder="Société (optionnel)"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-email" className="label">
            Email *
          </label>
          <Input
            id="lead-email"
            name="email"
            type="email"
            placeholder="vous@exemple.com"
            required
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="lead-phone" className="label">
            Téléphone
          </label>
          <Input
            id="lead-phone"
            name="phone"
            placeholder="+216 ..."
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <label htmlFor="lead-needs" className="label">
          Votre besoin *
        </label>
        <Textarea
          id="lead-needs"
          name="needs"
          rows={5}
          placeholder="Expliquez vos attentes, budget ou délai."
          required
          disabled={disabled}
        />
      </div>
      {spamProtectionEnabled ? (
        <div className="sr-only" aria-hidden>
          <label htmlFor="website-field">Ne pas remplir ce champ</label>
          <input
            id="website-field"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={disabled}>
          {status === "loading" ? "Envoi en cours…" : "Envoyer la demande"}
        </Button>
      </div>
    </form>
  );
}
