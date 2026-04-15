import type { Route } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSiteReviewAction } from "@/app/(app)/site-web/avis/actions";
import {
  listSiteReviews,
  parseSiteReviewStatusFilter,
  type SiteReviewStatus,
} from "@/server/site-reviews";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ReviewsPageProps = { searchParams?: Promise<SearchParams> };

const STATUS_LABELS: Record<SiteReviewStatus | "all", string> = {
  all: "Tous les statuts",
  PENDING: "En attente",
  APPROVED: "Approuvés",
  DECLINED: "Refusés",
};

const STATUS_VARIANTS: Record<SiteReviewStatus, "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  DECLINED: "danger",
};

function resolveParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function resolveMessage(
  searchParams: SearchParams,
  key: "message" | "error",
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function buildHref(base: string, params: Record<string, string>): Route {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return (query ? `${base}?${query}` : base) as Route;
}

function renderStars(rating: number) {
  return `${rating}/5`;
}

export default async function SiteReviewsPage({
  searchParams,
}: ReviewsPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const search = resolveParam(resolvedSearchParams.recherche).trim();
  const status = parseSiteReviewStatusFilter(resolvedSearchParams.statut);
  const page = Number(resolveParam(resolvedSearchParams.page) || "1") || 1;

  const result = await listSiteReviews({
    search: search || undefined,
    status,
    page,
  });

  const flashMessages: FlashMessage[] = [];
  const successMessage = resolveMessage(resolvedSearchParams, "message");
  const errorMessage = resolveMessage(resolvedSearchParams, "error");
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  const previousHref =
    page > 1
      ? buildHref("/site-web/avis", {
          ...(search ? { recherche: search } : {}),
          ...(status !== "all" ? { statut: status } : {}),
          page: String(page - 1),
        })
      : null;
  const nextHref =
    page < result.pageCount
      ? buildHref("/site-web/avis", {
          ...(search ? { recherche: search } : {}),
          ...(status !== "all" ? { statut: status } : {}),
          page: String(page + 1),
        })
      : null;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Avis du site
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Gérez les témoignages généraux affichés sur l&apos;accueil et la page À propos.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={"/site-web/avis-produits" as Route}>Avis produits</Link>
        </Button>
      </div>

      {!result.isReady ? (
        <Alert
          variant="error"
          title="Table d'avis site absente"
          description="Appliquez la migration SiteReview avant de créer ou publier des témoignages."
        />
      ) : null}

      <Alert
        variant="warning"
        title="Avis généraux uniquement"
        description="Ces avis ne sont liés à aucun produit. Les fiches produits et leur SEO continuent d'utiliser uniquement les avis produits."
      />

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Ajouter un avis site
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Les avis approuvés apparaissent dans les sections Testimonials de l&apos;accueil et de la page À propos.
          </p>
        </div>
        <form action={createSiteReviewAction} className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nom
            </label>
            <Input name="authorName" required placeholder="Nom du client" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <Input name="authorEmail" type="email" placeholder="client@example.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Rôle / contexte
            </label>
            <Input name="authorRole" placeholder="Cliente fidèle, architecte, entreprise..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Photo
            </label>
            <Input name="avatarUrl" placeholder="https://... ou /images/..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Note
            </label>
            <select
              name="rating"
              defaultValue="5"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value}/5
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Statut
            </label>
            <select
              name="status"
              defaultValue="PENDING"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {(["PENDING", "APPROVED", "DECLINED"] as const).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Titre optionnel
            </label>
            <Input name="title" placeholder="Très bonne expérience" />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Avis
            </label>
            <Textarea
              name="body"
              required
              minLength={10}
              maxLength={2000}
              placeholder="Saisissez le témoignage client..."
            />
          </div>
          <div className="lg:col-span-2">
            <FormSubmitButton disabled={!result.isReady}>
              Créer l&apos;avis site
            </FormSubmitButton>
          </div>
        </form>
      </section>

      <form method="get" className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
        <Input
          name="recherche"
          defaultValue={search}
          placeholder="Rechercher un auteur, rôle ou contenu"
        />
        <select
          name="statut"
          defaultValue={status}
          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {(["all", "PENDING", "APPROVED", "DECLINED"] as const).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <div className="card divide-y divide-zinc-200 overflow-hidden border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {result.items.length ? (
          result.items.map((review) => (
            <Link
              key={review.id}
              href={`/site-web/avis/${review.id}` as Route}
              className="grid gap-3 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40 md:grid-cols-[1fr_auto]"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {review.authorName}
                  </span>
                  <Badge variant={STATUS_VARIANTS[review.status]}>
                    {STATUS_LABELS[review.status]}
                  </Badge>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {renderStars(review.rating)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {review.authorEmail ?? "Email non renseigné"}
                  {review.authorRole ? ` · ${review.authorRole}` : null}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">
                  {(review.title ? `${review.title} — ` : "")}
                  {review.body.length > 180
                    ? `${review.body.slice(0, 180)}...`
                    : review.body}
                </p>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 md:text-right">
                {review.createdAt.toLocaleString("fr-FR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </Link>
          ))
        ) : (
          <div className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            {result.isReady
              ? "Aucun avis site ne correspond à ces critères."
              : "Aucun avis site disponible tant que la migration n'est pas appliquée."}
          </div>
        )}
      </div>

      {result.pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
          <span>
            Page {result.page} sur {result.pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" disabled={!previousHref}>
              {previousHref ? <Link href={previousHref}>Précédent</Link> : <span>Précédent</span>}
            </Button>
            <Button asChild variant="secondary" disabled={!nextHref}>
              {nextHref ? <Link href={nextHref}>Suivant</Link> : <span>Suivant</span>}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
