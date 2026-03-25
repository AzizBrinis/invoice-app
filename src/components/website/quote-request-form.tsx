"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type QuoteFieldOption = {
  label: string;
  value: string;
};

type QuoteField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "email" | "tel" | "number" | "url";
  required: boolean;
  placeholder?: string;
  help?: string;
  options?: QuoteFieldOption[];
};

type QuoteRequestFormProps = {
  slug: string;
  mode: "public" | "preview";
  productId: string | null;
  productName: string;
  formSchema?: unknown | null;
  spamProtectionEnabled: boolean;
  path?: string | null;
  className?: string;
};

const DEFAULT_THANKS =
  "Merci ! Votre demande de devis a bien ete transmise.";

const DEFAULT_FIELDS: QuoteField[] = [
  {
    id: "budget",
    label: "Budget estime",
    type: "text",
    required: false,
    placeholder: "Ex: 8 000 TND",
  },
  {
    id: "timeline",
    label: "Delai souhaite",
    type: "text",
    required: false,
    placeholder: "Ex: 4 a 6 semaines",
  },
];

const FIELD_TYPES = new Set([
  "text",
  "textarea",
  "select",
  "email",
  "tel",
  "number",
  "url",
]);

const RESERVED_FIELD_IDS = new Set([
  "name",
  "email",
  "phone",
  "company",
  "message",
  "productId",
  "slug",
  "mode",
  "path",
  "website",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeFieldId(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const trimmed = normalized.replace(/^-+|-+$/g, "");
  if (!trimmed) return null;
  if (RESERVED_FIELD_IDS.has(trimmed)) return null;
  return trimmed;
}

function normalizeOption(option: unknown): QuoteFieldOption | null {
  if (typeof option === "string") {
    const trimmed = option.trim();
    if (!trimmed) return null;
    return { label: trimmed, value: trimmed };
  }
  if (!isRecord(option)) return null;
  const rawLabel =
    typeof option.label === "string"
      ? option.label.trim()
      : typeof option.title === "string"
        ? option.title.trim()
        : "";
  const rawValue =
    typeof option.value === "string"
      ? option.value.trim()
      : typeof option.id === "string"
        ? option.id.trim()
        : rawLabel;
  if (!rawValue) return null;
  return {
    label: rawLabel || rawValue,
    value: rawValue,
  };
}

function normalizeQuoteFormSchema(schema: unknown): QuoteField[] {
  const source = Array.isArray(schema)
    ? schema
    : isRecord(schema) && Array.isArray(schema.fields)
      ? schema.fields
      : [];
  if (!source.length) return [];

  const normalized = source.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const rawId =
      typeof entry.id === "string"
        ? entry.id
        : typeof entry.name === "string"
          ? entry.name
          : typeof entry.key === "string"
            ? entry.key
            : "";
    const id = normalizeFieldId(rawId);
    if (!id) return [];
    const label =
      typeof entry.label === "string"
        ? entry.label.trim()
        : typeof entry.title === "string"
          ? entry.title.trim()
          : id;
    const rawType =
      typeof entry.type === "string" ? entry.type.toLowerCase() : "text";
    let type: QuoteField["type"] = FIELD_TYPES.has(rawType)
      ? (rawType as QuoteField["type"])
      : "text";
    const required = entry.required === true;
    const placeholder =
      typeof entry.placeholder === "string"
        ? entry.placeholder
        : typeof entry.hint === "string"
          ? entry.hint
          : undefined;
    const help = typeof entry.help === "string" ? entry.help : undefined;
    let options: QuoteFieldOption[] | undefined;

    if (type === "select") {
      const rawOptions = Array.isArray(entry.options)
        ? entry.options
        : Array.isArray(entry.choices)
          ? entry.choices
          : [];
      options = rawOptions
        .map(normalizeOption)
        .filter((option): option is QuoteFieldOption => Boolean(option));
      if (!options.length) {
        type = "text";
      }
    }

    return [
      {
        id,
        label,
        type,
        required,
        placeholder,
        help,
        options,
      },
    ];
  });

  return normalized;
}

function readField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function toOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function QuoteRequestForm({
  slug,
  mode,
  productId,
  productName,
  formSchema,
  spamProtectionEnabled,
  path,
  className,
}: QuoteRequestFormProps) {
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

  const dynamicFields = useMemo(() => {
    const normalized = normalizeQuoteFormSchema(formSchema);
    return normalized.length ? normalized : DEFAULT_FIELDS;
  }, [formSchema]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setMessage(null);

    if (!productId) {
      setStatus("error");
      setError("Produit indisponible pour une demande de devis.");
      return;
    }

    if (mode === "preview") {
      setStatus("success");
      setMessage(
        "Mode previsualisation : aucune donnee n'est enregistree.",
      );
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = readField(formData, "name");
    const email = readField(formData, "email");
    const phone = readField(formData, "phone");
    const company = readField(formData, "company");
    const messageValue = readField(formData, "message");
    const honeypot = readField(formData, "website");

    const extraData: Record<string, string> = {};
    dynamicFields.forEach((field) => {
      const value = readField(formData, field.id);
      if (value) {
        extraData[field.id] = value;
      }
    });

    try {
      const response = await fetch("/api/catalogue/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          slug,
          mode,
          path: resolvedPath,
          honeypot: honeypot || undefined,
          customer: {
            name,
            email,
            phone: toOptional(phone),
            company: toOptional(company),
          },
          message: toOptional(messageValue),
          formData: Object.keys(extraData).length ? extraData : null,
        }),
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
      setMessage(result.message ?? DEFAULT_THANKS);
    } catch (submissionError) {
      console.error("[quote-request] submit failed", submissionError);
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
          <label htmlFor="quote-name" className="label">
            Nom complet *
          </label>
          <Input
            id="quote-name"
            name="name"
            placeholder="Nom et prenom"
            required
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="quote-company" className="label">
            Entreprise
          </label>
          <Input
            id="quote-company"
            name="company"
            placeholder="Societe (optionnel)"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-email" className="label">
            Email *
          </label>
          <Input
            id="quote-email"
            name="email"
            type="email"
            placeholder="vous@exemple.com"
            required
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="quote-phone" className="label">
            Telephone
          </label>
          <Input
            id="quote-phone"
            name="phone"
            placeholder="+216 ..."
            disabled={disabled}
          />
        </div>
      </div>
      {dynamicFields.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {dynamicFields.map((field) => {
            const fieldId = `quote-${field.id}`;
            if (field.type === "textarea") {
              return (
                <div key={field.id} className="sm:col-span-2">
                  <label htmlFor={fieldId} className="label">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <Textarea
                    id={fieldId}
                    name={field.id}
                    rows={4}
                    placeholder={field.placeholder}
                    required={field.required}
                    disabled={disabled}
                  />
                  {field.help ? (
                    <p className="text-xs text-slate-500">{field.help}</p>
                  ) : null}
                </div>
              );
            }
            if (field.type === "select") {
              return (
                <div key={field.id}>
                  <label htmlFor={fieldId} className="label">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <Select
                    id={fieldId}
                    name={field.id}
                    defaultValue=""
                    required={field.required}
                    disabled={disabled}
                  >
                    <option value="">Selectionner</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  {field.help ? (
                    <p className="text-xs text-slate-500">{field.help}</p>
                  ) : null}
                </div>
              );
            }
            return (
              <div key={field.id}>
                <label htmlFor={fieldId} className="label">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <Input
                  id={fieldId}
                  name={field.id}
                  type={field.type}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={disabled}
                />
                {field.help ? (
                  <p className="text-xs text-slate-500">{field.help}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      <div>
        <label htmlFor="quote-message" className="label">
          Votre besoin *
        </label>
        <Textarea
          id="quote-message"
          name="message"
          rows={5}
          placeholder={`Expliquez les objectifs de ${productName}.`}
          required
          disabled={disabled}
        />
      </div>
      {spamProtectionEnabled ? (
        <div className="sr-only" aria-hidden>
          <label htmlFor="quote-website">Ne pas remplir ce champ</label>
          <input
            id="quote-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={disabled}>
          {status === "loading"
            ? "Envoi en cours..."
            : "Envoyer la demande"}
        </Button>
      </div>
    </form>
  );
}
