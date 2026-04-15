import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  approveSiteReviewAction,
  declineSiteReviewAction,
  markSiteReviewPendingAction,
  updateSiteReviewAction,
} from "@/app/(app)/site-web/avis/actions";
import {
  getSiteReview,
  type SiteReviewStatus,
} from "@/server/site-reviews";

export const dynamic = "force-dynamic";

type PageParams = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;
type ReviewDetailPageProps = {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
};

const STATUS_LABELS: Record<SiteReviewStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  DECLINED: "Refusé",
};

const STATUS_VARIANTS: Record<SiteReviewStatus, "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  DECLINED: "danger",
};

function resolveMessage(
  searchParams: SearchParams,
  key: "message" | "error",
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function SiteReviewDetailPage({
  params,
  searchParams,
}: ReviewDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const review = await getSiteReview(id);
  if (!review) {
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

  const redirectBase = `/site-web/avis/${review.id}`;

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Avis du site
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Créé le{" "}
            {review.createdAt.toLocaleString("fr-FR", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Badge variant={STATUS_VARIANTS[review.status]}>
            {STATUS_LABELS[review.status]}
          </Badge>
          <Button asChild variant="secondary">
            <Link href={"/site-web/avis" as Route}>Retour à la liste</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card space-y-6 p-6">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Contenu affiché
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Les champs ci-dessous alimentent uniquement les témoignages généraux du site.
            </p>
          </div>

          <form
            action={updateSiteReviewAction.bind(null, review.id)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="redirectTo" value={redirectBase} />
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Nom
              </label>
              <Input
                name="authorName"
                required
                defaultValue={review.authorName}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <Input
                name="authorEmail"
                type="email"
                defaultValue={review.authorEmail ?? ""}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Rôle / contexte
              </label>
              <Input
                name="authorRole"
                defaultValue={review.authorRole ?? ""}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Photo
              </label>
              <Input
                name="avatarUrl"
                defaultValue={review.avatarUrl ?? ""}
                placeholder="https://... ou /images/..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Note
              </label>
              <select
                name="rating"
                defaultValue={String(review.rating)}
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
                defaultValue={review.status}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {(["PENDING", "APPROVED", "DECLINED"] as const).map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Page source
              </label>
              <Input
                name="sourcePath"
                defaultValue={review.sourcePath ?? ""}
                placeholder="/"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Titre optionnel
              </label>
              <Input name="title" defaultValue={review.title ?? ""} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Avis
              </label>
              <Textarea
                name="body"
                required
                minLength={10}
                maxLength={2000}
                defaultValue={review.body}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Motif interne
              </label>
              <Textarea
                name="reason"
                defaultValue={review.moderationReason ?? ""}
                placeholder="Visible uniquement côté administration"
              />
            </div>
            <div className="sm:col-span-2">
              <FormSubmitButton>Enregistrer</FormSubmitButton>
            </div>
          </form>
        </section>

        <aside className="card h-fit space-y-4 p-6">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Modération site
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Seuls les avis approuvés sont visibles dans les témoignages Accueil et À propos.
            </p>
          </div>
          {review.moderatedAt ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Dernière modération le{" "}
              {review.moderatedAt.toLocaleString("fr-FR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          <form
            action={approveSiteReviewAction.bind(null, review.id)}
            className="space-y-3"
          >
            <input type="hidden" name="redirectTo" value={redirectBase} />
            <FormSubmitButton
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={review.status === "APPROVED"}
            >
              Approuver
            </FormSubmitButton>
          </form>
          <form
            action={declineSiteReviewAction.bind(null, review.id)}
            className="space-y-3"
          >
            <Textarea
              name="reason"
              defaultValue={review.moderationReason ?? ""}
              placeholder="Motif interne optionnel"
            />
            <input type="hidden" name="redirectTo" value={redirectBase} />
            <FormSubmitButton
              variant="ghost"
              className="w-full text-red-600 dark:text-red-400"
              disabled={review.status === "DECLINED"}
            >
              Refuser
            </FormSubmitButton>
          </form>
          <form
            action={markSiteReviewPendingAction.bind(null, review.id)}
            className="space-y-3"
          >
            <input type="hidden" name="redirectTo" value={redirectBase} />
            <FormSubmitButton
              variant="secondary"
              className="w-full"
              disabled={review.status === "PENDING"}
            >
              Remettre en attente
            </FormSubmitButton>
          </form>

          <div className="border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <p>Site : {review.sourceDomain ?? review.sourceSlug ?? review.websiteSlug}</p>
            <p>Client lié : {review.clientName ?? review.clientEmail ?? "Aucun"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
