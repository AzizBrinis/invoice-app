"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  quoteInputSchema,
  createQuote,
  updateQuote,
  deleteQuote,
  duplicateQuote,
  changeQuoteStatus,
  convertQuoteToInvoice,
  deleteQuotesBulk,
  changeQuotesStatusBulk,
} from "@/server/quotes";
import { QuoteStatus } from "@prisma/client";
import { getMessagingSettingsSummary } from "@/server/messaging";
import { queueQuoteEmailJob } from "@/server/document-email-jobs";
import { requireUser } from "@/lib/auth";
import { isRedirectError } from "@/lib/next";
import type { Route } from "next";
import type {
  DocumentEmailActionInput,
  DocumentEmailActionResult,
} from "@/types/document-email";

function parsePayload(formData: FormData) {
  const rawPayload = formData.get("payload");
  if (!rawPayload) {
    throw new Error("Payload manquant");
  }
  const json = JSON.parse(rawPayload.toString());
  return quoteInputSchema.parse(json);
}

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

function extractIds(formData: FormData) {
  return formData
    .getAll("quoteIds")
    .map((value) => value?.toString() ?? "")
    .filter((value) => value.length > 0);
}

export async function createQuoteAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/devis");
  try {
    const payload = parsePayload(formData);
    await createQuote(payload);
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: "Devis créé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createQuoteAction] Échec de création de devis", error);
    const message =
      error instanceof ZodError
        ? "Les informations du devis sont invalides."
        : "Impossible de créer le devis.";
    redirectWithFeedback(redirectTarget, { error: message });
  }
}

export async function updateQuoteAction(id: string, formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/devis");
  try {
    const payload = parsePayload(formData);
    await updateQuote(id, payload);
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: "Devis mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateQuoteAction] Échec de mise à jour du devis", error);
    const message =
      error instanceof ZodError
        ? "Les informations du devis sont invalides."
        : "Impossible de mettre à jour le devis.";
    redirectWithFeedback(redirectTarget, { error: message });
  }
}

export async function deleteQuoteAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/devis");
  try {
    await deleteQuote(id);
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: "Devis supprimé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteQuoteAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de supprimer ce devis.",
    });
  }
}

export async function duplicateQuoteAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/devis");
  try {
    await duplicateQuote(id);
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: "Devis dupliqué",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[duplicateQuoteAction] Échec de duplication", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de dupliquer ce devis.",
    });
  }
}

export async function changeQuoteStatusAction(
  id: string,
  status: QuoteStatus,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(formData, "/devis");
  try {
    await changeQuoteStatus(id, status);
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: "Statut du devis mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[changeQuoteStatusAction] Échec de mise à jour", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de mettre à jour le statut du devis.",
    });
  }
}

export async function convertQuoteToInvoiceAction(
  id: string,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(formData, "/factures");
  try {
    await convertQuoteToInvoice(id);
    revalidatePath("/factures");
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: "Devis converti en facture",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[convertQuoteToInvoiceAction] Conversion échouée", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de convertir ce devis pour le moment.",
    });
  }
}

export async function sendQuoteEmailAction(
  id: string,
  input: DocumentEmailActionInput,
): Promise<DocumentEmailActionResult> {
  const user = await requireUser();
  const messagingSummary = await getMessagingSettingsSummary(user.id);
  const email = input.email?.trim() ?? "";
  const subject = input.subject?.trim();

  if (!messagingSummary.smtpConfigured) {
    return {
      status: "config-missing",
      variant: "warning",
      message:
        "Veuillez configurer la messagerie (SMTP/IMAP) avant d'envoyer des devis.",
    };
  }

  if (!email) {
    return {
      status: "invalid",
      variant: "error",
      message: "Adresse e-mail requise.",
    };
  }

  try {
    const queueResult = await queueQuoteEmailJob({
      userId: user.id,
      quoteId: id,
      to: email,
      subject,
    });
    if (queueResult.deduped) {
      return {
        status: "duplicate",
        variant: "warning",
        message: "Un envoi est déjà en cours pour ce devis.",
        jobId: queueResult.jobId,
        deduped: true,
      };
    }
    return {
      status: "queued",
      variant: "success",
      message: "Devis en cours d'envoi en arrière-plan.",
      jobId: queueResult.jobId,
      deduped: false,
    };
  } catch (error) {
    console.error("[sendQuoteEmailAction] Échec de mise en file", error);
    return {
      status: "error",
      variant: "error",
      message:
        "Impossible de planifier cet envoi. Veuillez réessayer dans un instant.",
    };
  }
}

export async function bulkDeleteQuotesAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/devis");
  const ids = extractIds(formData);
  if (ids.length === 0) {
    redirectWithFeedback(redirectTarget, {
      warning: "Sélectionnez au moins un devis.",
    });
  }
  try {
    const deleted = await deleteQuotesBulk(ids);
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: `${deleted} devis supprimé${deleted > 1 ? "s" : ""}`,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[bulkDeleteQuotesAction] Échec de suppression groupée", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de supprimer ces devis pour le moment.",
    });
  }
}

export async function bulkChangeQuotesStatusAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/devis");
  const statusValue = formData.get("status")?.toString() ?? "";
  const ids = extractIds(formData);
  if (ids.length === 0) {
    redirectWithFeedback(redirectTarget, {
      warning: "Sélectionnez au moins un devis.",
    });
  }
  if (!Object.values(QuoteStatus).includes(statusValue as QuoteStatus)) {
    redirectWithFeedback(redirectTarget, {
      error: "Statut de devis invalide.",
    });
  }
  try {
    const updated = await changeQuotesStatusBulk(ids, statusValue as QuoteStatus);
    revalidatePath("/devis");
    redirectWithFeedback(redirectTarget, {
      message: `${updated} devis mis à jour`,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[bulkChangeQuotesStatusAction] Échec de mise à jour groupée", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de mettre à jour ces devis.",
    });
  }
}
