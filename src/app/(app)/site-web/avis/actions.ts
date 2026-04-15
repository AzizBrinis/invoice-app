"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { isRedirectError } from "@/lib/next";
import { requireAppSectionAccess } from "@/lib/authorization";
import {
  createSiteReview,
  updateSiteReview,
  updateSiteReviewStatus,
  type SiteReviewInput,
  type SiteReviewStatus,
} from "@/server/site-reviews";

function resolveRedirectTarget(formData: FormData | undefined, fallback: string) {
  const redirectTo = formData?.get("redirectTo")?.toString();
  if (redirectTo && redirectTo.startsWith("/")) {
    return redirectTo;
  }
  return fallback;
}

function redirectWithFeedback(
  target: string,
  feedback: { message?: string; error?: string },
): never {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  params.delete("message");
  params.delete("error");
  if (feedback.message) params.set("message", feedback.message);
  if (feedback.error) params.set("error", feedback.error);
  const nextQuery = params.toString();
  return redirect((nextQuery ? `${path}?${nextQuery}` : path) as Route);
}

async function requireWebsiteAccess() {
  await requireAppSectionAccess("website");
}

function formText(formData: FormData, key: string) {
  return formData.get(key)?.toString() ?? "";
}

function readReviewInput(formData: FormData): SiteReviewInput {
  return {
    authorName: formText(formData, "authorName"),
    authorEmail: formText(formData, "authorEmail"),
    authorRole: formText(formData, "authorRole"),
    avatarUrl: formText(formData, "avatarUrl"),
    rating: formText(formData, "rating"),
    title: formText(formData, "title"),
    body: formText(formData, "body"),
    status: formText(formData, "status") as SiteReviewStatus,
    sourcePath: formText(formData, "sourcePath"),
  };
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Impossible de traiter l'avis site.";
}

export async function createSiteReviewAction(formData: FormData) {
  try {
    await requireWebsiteAccess();
    await createSiteReview(readReviewInput(formData));
    redirectWithFeedback("/site-web/avis", {
      message: "Avis site créé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createSiteReviewAction] Unable to create review", error);
    redirectWithFeedback("/site-web/avis", {
      error: resolveErrorMessage(error),
    });
  }
}

export async function updateSiteReviewAction(id: string, formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, `/site-web/avis/${id}`);
  try {
    await requireWebsiteAccess();
    await updateSiteReview(id, readReviewInput(formData), {
      reason: formData.get("reason")?.toString() ?? null,
    });
    redirectWithFeedback(redirectTarget, {
      message: "Avis site mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateSiteReviewAction] Unable to update review", error);
    redirectWithFeedback(redirectTarget, {
      error: resolveErrorMessage(error),
    });
  }
}

async function moderateSiteReviewAction(
  id: string,
  status: SiteReviewStatus,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(formData, `/site-web/avis/${id}`);
  try {
    await requireWebsiteAccess();
    await updateSiteReviewStatus(id, status, {
      reason: formData?.get("reason")?.toString() ?? null,
    });
    redirectWithFeedback(redirectTarget, {
      message:
        status === "APPROVED"
          ? "Avis site approuvé"
          : status === "DECLINED"
            ? "Avis site refusé"
            : "Avis site remis en attente",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[moderateSiteReviewAction] Unable to update review", error);
    redirectWithFeedback(redirectTarget, {
      error: resolveErrorMessage(error),
    });
  }
}

export async function approveSiteReviewAction(id: string, formData?: FormData) {
  await moderateSiteReviewAction(id, "APPROVED", formData);
}

export async function declineSiteReviewAction(id: string, formData?: FormData) {
  await moderateSiteReviewAction(id, "DECLINED", formData);
}

export async function markSiteReviewPendingAction(
  id: string,
  formData?: FormData,
) {
  await moderateSiteReviewAction(id, "PENDING", formData);
}
