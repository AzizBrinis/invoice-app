import type { Route } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { Input } from "@/components/ui/input";
import {
  listSiteBlogPostCategories,
  listSiteBlogPosts,
  parseSiteBlogPostFeaturedFilter,
  parseSiteBlogPostStatusFilter,
  type SiteBlogPostStatus,
} from "@/server/site-blog-posts";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type BlogsPageProps = { searchParams?: Promise<SearchParams> };

const STATUS_LABELS: Record<SiteBlogPostStatus | "all" | "LIVE", string> = {
  all: "Tous les statuts",
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  SCHEDULED: "Programmé",
  LIVE: "En ligne",
};

const STATUS_VARIANTS: Record<
  SiteBlogPostStatus | "LIVE",
  "success" | "warning" | "neutral"
> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  LIVE: "success",
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

function buildHref(base: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return (query ? `${base}?${query}` : base) as Route;
}

export default async function BlogsPage({ searchParams }: BlogsPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const search = resolveParam(resolvedSearchParams.recherche).trim();
  const category = resolveParam(resolvedSearchParams.categorie).trim();
  const status = parseSiteBlogPostStatusFilter(resolvedSearchParams.statut);
  const featured = parseSiteBlogPostFeaturedFilter(resolvedSearchParams.miseEnAvant);
  const page = Number(resolveParam(resolvedSearchParams.page) || "1") || 1;

  const [result, categories] = await Promise.all([
    listSiteBlogPosts({
      search: search || undefined,
      category: category || undefined,
      status,
      featured,
      page,
    }),
    listSiteBlogPostCategories(),
  ]);

  const flashMessages: FlashMessage[] = [];
  const successMessage = resolveMessage(resolvedSearchParams, "message");
  const errorMessage = resolveMessage(resolvedSearchParams, "error");
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  const sharedParams = {
    ...(search ? { recherche: search } : {}),
    ...(category ? { categorie: category } : {}),
    ...(status !== "all" ? { statut: status } : {}),
    ...(featured !== "all" ? { miseEnAvant: featured } : {}),
  };

  const previousHref =
    page > 1
      ? buildHref("/site-web/blogs", {
          ...sharedParams,
          page: String(page - 1),
        })
      : null;
  const nextHref =
    page < result.pageCount
      ? buildHref("/site-web/blogs", {
          ...sharedParams,
          page: String(page + 1),
        })
      : null;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Blogs
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Gérez les articles reliés au blog public du template Ciseco.
          </p>
        </div>
        <Button asChild>
          <Link href={"/site-web/blogs/nouveau" as Route}>Nouvel article</Link>
        </Button>
      </div>

      {!result.isReady ? (
        <Alert
          variant="error"
          title="Table des articles absente"
          description="Appliquez la migration WebsiteBlogPost avant de créer ou publier des billets."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Articles trouvés</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {result.total}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">En ligne</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {result.items.filter((item) => item.isLive).length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Mis en avant</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {result.items.filter((item) => item.featured).length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Catégories</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {categories.length}
          </p>
        </div>
      </div>

      <form method="get" className="grid gap-2 xl:grid-cols-[1fr_220px_200px_auto]">
        <Input
          name="recherche"
          defaultValue={search}
          placeholder="Rechercher un titre, slug, tag ou auteur"
        />
        <select
          name="categorie"
          defaultValue={category}
          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
          <select
            name="statut"
            defaultValue={status}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {(["all", "DRAFT", "PUBLISHED", "SCHEDULED"] as const).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            name="miseEnAvant"
            defaultValue={featured}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="all">Tous les placements</option>
            <option value="featured">Mis en avant</option>
            <option value="standard">Standard</option>
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <div className="card divide-y divide-zinc-200 overflow-hidden border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {result.items.length ? (
          result.items.map((post) => (
            <Link
              key={post.id}
              href={`/site-web/blogs/${post.id}` as Route}
              className="grid gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40 lg:grid-cols-[minmax(0,1fr)_220px]"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {post.title}
                  </span>
                  <Badge variant={STATUS_VARIANTS[post.effectiveStatus]}>
                    {STATUS_LABELS[post.effectiveStatus]}
                  </Badge>
                  {post.featured ? <Badge variant="info">Mise en avant</Badge> : null}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  /blog/{post.slug}
                  {post.category ? ` · ${post.category}` : null}
                  {post.authorName ? ` · ${post.authorName}` : null}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">
                  {post.excerpt
                    ? post.excerpt
                    : "Aucun extrait manuel. Un résumé sera dérivé du contenu public."}
                </p>
                {post.tags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400 lg:text-right">
                <p>
                  Publication:{" "}
                  {post.publishDate
                    ? new Date(post.publishDate).toLocaleDateString("fr-FR", {
                        dateStyle: "medium",
                      })
                    : "Non définie"}
                </p>
                <p>{post.readingTimeMinutes} min de lecture</p>
                <p>
                  Mise à jour:{" "}
                  {post.updatedAt.toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Aucun article pour ces filtres
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Créez votre premier billet pour alimenter les pages `/blog` et `/blog/[slug]`.
            </p>
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
