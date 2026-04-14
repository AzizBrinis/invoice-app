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
import { Textarea } from "@/components/ui/textarea";
import {
  approveProductReviewAction,
  declineProductReviewAction,
  markProductReviewPendingAction,
} from "@/app/(app)/site-web/avis/actions";
import {
  getProductReview,
  type ProductReviewStatus,
} from "@/server/product-reviews";

export const dynamic = "force-dynamic";

type PageParams = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;
type ReviewDetailPageProps = {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
};

const STATUS_LABELS: Record<ProductReviewStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  DECLINED: "Refusé",
};

const STATUS_VARIANTS: Record<ProductReviewStatus, "success" | "warning" | "danger"> = {
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

export default async function ReviewDetailPage({
  params,
  searchParams,
}: ReviewDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const review = await getProductReview(id);
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
            Avis produit
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Reçu le{" "}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Produit
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {review.productName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {review.productSku}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Note
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {review.rating}/5
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Auteur
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {review.authorName}
              </p>
              {review.authorEmail ? (
                <a
                  className="text-xs font-medium text-[var(--site-accent)] hover:underline"
                  href={`mailto:${review.authorEmail}`}
                >
                  {review.authorEmail}
                </a>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Client lié
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                {review.clientName ?? review.clientEmail ?? "Invité"}
              </p>
            </div>
            {review.sourcePath ? (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                  Page source
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">
                  {review.sourcePath}
                </p>
              </div>
            ) : null}
            {review.sourceDomain || review.sourceSlug ? (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                  Site
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">
                  {review.sourceDomain ?? review.sourceSlug}
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Avis
            </p>
            <div className="mt-2 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              {review.title ? (
                <p className="font-semibold">{review.title}</p>
              ) : null}
              <p className="whitespace-pre-line">{review.body}</p>
            </div>
          </div>
        </section>

        <aside className="card h-fit space-y-4 p-6">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Modération
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Seuls les avis approuvés sont visibles sur la fiche produit et dans les données SEO.
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
            action={approveProductReviewAction.bind(null, review.id)}
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
            action={declineProductReviewAction.bind(null, review.id)}
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
            action={markProductReviewPendingAction.bind(null, review.id)}
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
        </aside>
      </div>
    </div>
  );
}
