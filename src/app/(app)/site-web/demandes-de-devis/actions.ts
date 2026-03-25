"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "@/lib/next";
import { convertQuoteRequestToQuote } from "@/server/quote-requests";
import { requireAppSectionAccess } from "@/lib/authorization";

const REQUEST_LIST_PATH = "/site-web/demandes-de-devis";

function resolveRedirectTarget(
  formData: FormData | undefined,
  fallback: string,
) {
  const redirectTo = formData?.get("redirectTo")?.toString();
  if (redirectTo && redirectTo.startsWith("/")) {
    return redirectTo;
  }
  return fallback;
}

function redirectWithFeedback(
  target: string,
  feedback: { message?: string; error?: string; warning?: string },
): never {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  ["message", "error", "warning"].forEach((key) => {
    params.delete(key);
  });
  if (feedback.message) params.set("message", feedback.message);
  if (feedback.error) params.set("error", feedback.error);
  if (feedback.warning) params.set("warning", feedback.warning);
  const nextQuery = params.toString();
  const href = (nextQuery ? `${path}?${nextQuery}` : path) as Route;
  return redirect(href);
}

function revalidateQuoteRequestPaths(requestId: string) {
  revalidatePath(REQUEST_LIST_PATH);
  revalidatePath(`/site-web/demandes-de-devis/${requestId}`);
}

async function requireWebsiteAccess() {
  await requireAppSectionAccess("website");
}

export async function convertQuoteRequestAction(
  id: string,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/demandes-de-devis/${id}`,
  );
  try {
    await requireWebsiteAccess();
    const quote = await convertQuoteRequestToQuote(id);
    revalidateQuoteRequestPaths(id);
    revalidatePath("/devis");
    redirectWithFeedback(`/devis/${quote.id}/modifier`, {
      message: "Devis cree depuis la demande",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error(
      "[convertQuoteRequestAction] Unable to convert quote request",
      error,
    );
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de convertir la demande.",
    });
  }
}
