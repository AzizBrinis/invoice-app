import type { Route } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listProductReviews,
  parseProductReviewStatusFilter,
  type ProductReviewStatus,
} from "@/server/product-reviews";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ReviewsPageProps = { searchParams?: Promise<SearchParams> };

const STATUS_LABELS: Record<ProductReviewStatus | "all", string> = {
  all: "Tous les statuts",
  PENDING: "En attente",
  APPROVED: "Approuvés",
  DECLINED: "Refusés",
};

const STATUS_VARIANTS: Record<ProductReviewStatus, "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  DECLINED: "danger",
};

function resolveParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildHref(base: string, params: Record<string, string>): Route {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return (query ? `${base}?${query}` : base) as Route;
}

function renderStars(rating: number) {
  return `${rating}/5`;
}

export default async function ProductReviewsPage({
  searchParams,
}: ReviewsPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const search = resolveParam(resolvedSearchParams.recherche).trim();
  const status = parseProductReviewStatusFilter(resolvedSearchParams.statut);
  const page = Number(resolveParam(resolvedSearchParams.page) || "1") || 1;

  const result = await listProductReviews({
    search: search || undefined,
    status,
    page,
  });

  const previousHref =
    page > 1
      ? buildHref("/site-web/avis-produits", {
          ...(search ? { recherche: search } : {}),
          ...(status !== "all" ? { statut: status } : {}),
          page: String(page - 1),
        })
      : null;
  const nextHref =
    page < result.pageCount
      ? buildHref("/site-web/avis-produits", {
          ...(search ? { recherche: search } : {}),
          ...(status !== "all" ? { statut: status } : {}),
          page: String(page + 1),
        })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Avis produits
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Modérez uniquement les avis envoyés depuis les fiches produits.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={"/site-web/avis" as Route}>Avis du site</Link>
        </Button>
      </div>

      <Alert
        variant="warning"
        title="Flux séparé"
        description="Ces avis restent liés à un produit et n'alimentent pas les témoignages Accueil ou À propos."
      />

      <form method="get" className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
        <Input
          name="recherche"
          defaultValue={search}
          placeholder="Rechercher un client, produit ou contenu"
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
              href={`/site-web/avis-produits/${review.id}` as Route}
              className="grid gap-3 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40 md:grid-cols-[1fr_auto]"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {review.productName}
                  </span>
                  <Badge variant={STATUS_VARIANTS[review.status]}>
                    {STATUS_LABELS[review.status]}
                  </Badge>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {renderStars(review.rating)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {review.authorName}
                  {review.authorEmail ? ` · ${review.authorEmail}` : null}
                  {review.productSku ? ` · ${review.productSku}` : null}
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
            Aucun avis produit ne correspond à ces critères.
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
