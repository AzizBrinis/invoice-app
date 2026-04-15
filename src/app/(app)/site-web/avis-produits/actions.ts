"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { isRedirectError } from "@/lib/next";
import { requireAppSectionAccess } from "@/lib/authorization";
import {
  updateProductReviewStatus,
  type ProductReviewStatus,
} from "@/server/product-reviews";

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

async function moderateReviewAction(
  id: string,
  status: ProductReviewStatus,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/avis-produits/${id}`,
  );
  try {
    await requireWebsiteAccess();
    await updateProductReviewStatus(id, status, {
      reason: formData?.get("reason")?.toString() ?? null,
    });
    redirectWithFeedback(redirectTarget, {
      message:
        status === "APPROVED"
          ? "Avis produit approuvé"
          : status === "DECLINED"
            ? "Avis produit refusé"
            : "Avis produit remis en attente",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[moderateProductReviewAction] Unable to update review", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de mettre à jour l'avis produit.",
    });
  }
}

export async function approveProductReviewAction(id: string, formData?: FormData) {
  await moderateReviewAction(id, "APPROVED", formData);
}

export async function declineProductReviewAction(id: string, formData?: FormData) {
  await moderateReviewAction(id, "DECLINED", formData);
}

export async function markProductReviewPendingAction(
  id: string,
  formData?: FormData,
) {
  await moderateReviewAction(id, "PENDING", formData);
}
