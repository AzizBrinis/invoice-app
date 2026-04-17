import type { Route } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { requireUser } from "@/lib/auth";
import { createSiteBlogPostAction } from "@/app/(app)/site-web/blogs/actions";
import { BlogPostForm } from "@/app/(app)/site-web/blogs/_components/blog-post-form";

type SearchParams = Record<string, string | string[] | undefined>;
type NewBlogPostPageProps = { searchParams?: Promise<SearchParams> };

function resolveMessage(
  searchParams: SearchParams,
  key: "message" | "error",
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function NewBlogPostPage({
  searchParams,
}: NewBlogPostPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const user = await requireUser();

  const flashMessages: FlashMessage[] = [];
  const successMessage = resolveMessage(resolvedSearchParams, "message");
  const errorMessage = resolveMessage(resolvedSearchParams, "error");
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Nouvel article
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Créez un billet tenant-scopé pour alimenter le blog public.
          </p>
        </div>
        <Link
          href={"/site-web/blogs" as Route}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Retour à la liste
        </Link>
      </div>

      <Alert
        variant="warning"
        title="Publication pragmatique"
        description="Le corps de l'article accepte du HTML sécurisé. Les extraits, titres SEO et temps de lecture sont calculés proprement pour le rendu public."
      />

      <BlogPostForm
        action={createSiteBlogPostAction}
        submitLabel="Créer l'article"
        defaultValues={{
          title: "",
          slug: "",
          excerpt: "",
          bodyHtml: "",
          coverImageUrl: "",
          socialImageUrl: "",
          category: "",
          tags: "",
          authorName: user.name?.trim() || user.accountDisplayName?.trim() || "",
          status: "DRAFT",
          publishDate: "",
          featured: false,
          metaTitle: "",
          metaDescription: "",
        }}
      />
    </div>
  );
}
