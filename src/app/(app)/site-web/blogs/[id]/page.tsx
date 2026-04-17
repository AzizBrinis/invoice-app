import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import {
  deleteSiteBlogPostAction,
  updateSiteBlogPostAction,
} from "@/app/(app)/site-web/blogs/actions";
import { BlogPostForm } from "@/app/(app)/site-web/blogs/_components/blog-post-form";
import { getSiteBlogPost } from "@/server/site-blog-posts";

type SearchParams = Record<string, string | string[] | undefined>;
type BlogPostDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
};

function resolveMessage(
  searchParams: SearchParams,
  key: "message" | "error",
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function BlogPostDetailPage({
  params,
  searchParams,
}: BlogPostDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const post = await getSiteBlogPost(id);

  if (!post) {
    notFound();
  }

  const flashMessages: FlashMessage[] = [];
  const successMessage = resolveMessage(resolvedSearchParams, "message");
  const errorMessage = resolveMessage(resolvedSearchParams, "error");
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  const publicHref = `/catalogue/${post.websiteSlug}/blog/${post.slug}` as Route;
  const previewHref = `/preview?path=${encodeURIComponent(`/blog/${post.slug}`)}` as Route;
  const redirectBase = `/site-web/blogs/${post.id}`;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {post.title}
            </h1>
            <Badge variant={post.isLive ? "success" : "warning"}>
              {post.isLive ? "En ligne" : post.status === "SCHEDULED" ? "Programmé" : "Brouillon"}
            </Badge>
            {post.featured ? <Badge variant="info">Mis en avant</Badge> : null}
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            /blog/{post.slug}
            {post.category ? ` · ${post.category}` : null}
            {post.authorName ? ` · ${post.authorName}` : null}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href={previewHref} target="_blank" rel="noreferrer">
              Prévisualiser
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={publicHref} target="_blank" rel="noreferrer">
              Ouvrir l&apos;article
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/site-web/blogs" as Route}>Retour à la liste</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Date publique</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {post.publishDate
              ? new Date(post.publishDate).toLocaleDateString("fr-FR", {
                  dateStyle: "medium",
                })
              : "Non définie"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Temps de lecture</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {post.readingTimeMinutes} min
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Mots</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {post.wordCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Sommaire</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {post.headings.length}
          </p>
        </div>
      </div>

      {!post.isLive ? (
        <Alert
          variant="warning"
          title="Article non visible publiquement"
          description={
            post.status === "SCHEDULED"
              ? "L'article sera affiché sur le blog public à la date indiquée."
              : "Cet article reste privé tant qu'il est en brouillon."
          }
        />
      ) : null}

      <BlogPostForm
        action={updateSiteBlogPostAction.bind(null, post.id)}
        submitLabel="Enregistrer les modifications"
        redirectTo={redirectBase}
        defaultValues={{
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          bodyHtml: post.bodyHtml,
          coverImageUrl: post.coverImageUrl ?? "",
          socialImageUrl: post.socialImageUrl ?? "",
          category: post.category ?? "",
          tags: post.tags.join(", "),
          authorName: post.authorName,
          status: post.status,
          publishDate: post.publishDate ?? "",
          featured: post.featured,
          metaTitle: post.metaTitle ?? "",
          metaDescription: post.metaDescription ?? "",
        }}
      />

      <section className="card space-y-4 border-red-200 p-6 dark:border-red-900/50">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Supprimer l&apos;article
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            La suppression retire immédiatement le billet des pages publiques et des métadonnées SEO.
          </p>
        </div>
        <form action={deleteSiteBlogPostAction.bind(null, post.id)} className="flex items-center justify-between gap-4">
          <input type="hidden" name="redirectTo" value={redirectBase} />
          <Button type="submit" variant="secondary" className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30">
            Supprimer définitivement
          </Button>
        </form>
      </section>
    </div>
  );
}
