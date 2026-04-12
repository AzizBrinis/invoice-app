import Link from "next/link";
import { notFound } from "next/navigation";
import type { QuoteRequestStatus } from "@/lib/db/prisma";
import { getQuoteRequest } from "@/server/quote-requests";
import { convertQuoteRequestAction } from "@/app/(app)/site-web/demandes-de-devis/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { formatDate } from "@/lib/formatters";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";

const STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  CONVERTED: "Converti",
  CLOSED: "Clos",
};

const STATUS_VARIANTS: Record<
  QuoteRequestStatus,
  "info" | "success" | "warning" | "danger" | "neutral"
> = {
  NEW: "warning",
  IN_PROGRESS: "info",
  CONVERTED: "success",
  CLOSED: "neutral",
};

type PageParams = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;
type DemandeDetailPageProps = {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
};

type FormEntry = {
  label: string;
  value: string;
};

function formatFormValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function normalizeFormEntries(formData: unknown): FormEntry[] {
  if (!formData) {
    return [];
  }
  if (Array.isArray(formData)) {
    return formData.map((entry, index) => ({
      label: `Champ ${index + 1}`,
      value: formatFormValue(entry),
    }));
  }
  if (typeof formData === "object") {
    return Object.entries(formData as Record<string, unknown>).map(
      ([key, value]) => ({
        label: key,
        value: formatFormValue(value),
      }),
    );
  }
  return [{ label: "Valeur", value: formatFormValue(formData) }];
}

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  const units = ["octets", "ko", "Mo", "Go"] as const;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const display = exponent === 0 ? value : value.toFixed(1);
  return `${display} ${units[exponent]}`;
}

export default async function DemandeDevisDetailPage({
  params,
  searchParams,
}: DemandeDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const request = await getQuoteRequest(resolvedParams.id);
  if (!request) {
    notFound();
  }

  const successMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams?.message ?? null;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error ?? null;
  const warningMessage = Array.isArray(resolvedSearchParams?.warning)
    ? resolvedSearchParams.warning[0]
    : resolvedSearchParams?.warning ?? null;

  const flashMessages: FlashMessage[] = [];
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (warningMessage) {
    flashMessages.push({ variant: "warning", title: warningMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  const hasQuote = Boolean(request.quoteId);
  const quoteLabel = request.quote?.number
    ? `Devis ${request.quote.number}`
    : "Voir devis";
  const formEntries = normalizeFormEntries(request.formData);
  const redirectBase = `/site-web/demandes-de-devis/${request.id}`;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Demande de devis
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Recue le {formatDate(request.createdAt)} - Client :{" "}
            {request.customerName}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Badge variant={STATUS_VARIANTS[request.status]} className="w-full justify-center sm:w-auto">
            {STATUS_LABELS[request.status]}
          </Badge>
          {hasQuote ? (
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href={`/devis/${request.quoteId}/modifier`}>
                {quoteLabel}
              </Link>
            </Button>
          ) : (
            <form
              action={convertQuoteRequestAction.bind(null, request.id)}
              className="w-full sm:w-auto"
            >
              <FormSubmitButton
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Convertir en devis
              </FormSubmitButton>
              <input type="hidden" name="redirectTo" value={redirectBase} />
            </form>
          )}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Client
          </h2>
          <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {request.customerName}
            </p>
            <p>{request.customerEmail}</p>
            {request.customerPhone ? <p>{request.customerPhone}</p> : null}
            {request.customerCompany ? <p>{request.customerCompany}</p> : null}
            {request.customerAddress ? <p>{request.customerAddress}</p> : null}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Produit
          </h2>
          <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {request.product?.name ?? "Produit supprime"}
            </p>
            {request.product?.id ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                ID: {request.product.id}
              </p>
            ) : null}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Suivi
          </h2>
          <div className="mt-2 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                Cree le
              </p>
              <p>{formatDate(request.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                Derniere mise a jour
              </p>
              <p>{formatDate(request.updatedAt)}</p>
            </div>
            {request.sourcePath ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  Source
                </p>
                <p className="break-all">{request.sourcePath}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Message
        </h2>
        <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
          {request.message ?? "Aucun message fourni."}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Champs supplementaires
        </h2>
        {formEntries.length ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {formEntries.map((entry) => (
              <div key={entry.label} className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-zinc-400">
                  {entry.label}
                </dt>
                <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Aucun champ supplementaire.
          </p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Fichiers
        </h2>
        {request.attachments.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {request.attachments.map((attachment) => {
              const sizeLabel = formatFileSize(attachment.sizeBytes);
              return (
                <li
                  key={attachment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {sizeLabel ?? "Taille inconnue"}
                      {attachment.mimeType ? ` - ${attachment.mimeType}` : ""}
                    </p>
                  </div>
                  <a
                    href={attachment.fileUrl}
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Aucun fichier associe.
          </p>
        )}
      </section>
    </div>
  );
}
