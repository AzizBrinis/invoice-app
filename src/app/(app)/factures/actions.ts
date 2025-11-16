"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { ZodError } from "zod";
import {
  invoiceInputSchema,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  changeInvoiceStatus,
  recordPayment,
  deletePayment,
  invoiceListTag,
  invoiceDetailTag,
  invoiceStatsTag,
} from "@/server/invoices";
import { InvoiceStatus, UserRole } from "@prisma/client";
import { isUniqueConstraintViolation } from "@/lib/db-errors";
import { getMessagingSettingsSummary } from "@/server/messaging";
import { queueInvoiceEmailJob } from "@/server/document-email-jobs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  ensureCanManageBilling,
  BILLING_MANAGER_ROLES,
} from "@/lib/authorization";
import { isRedirectError } from "@/lib/next";
import type { InvoiceFormState } from "@/app/(app)/factures/form-state";
import type { Route } from "next";
import type {
  DocumentEmailActionInput,
  DocumentEmailActionResult,
} from "@/types/document-email";

async function requireBillingAccess() {
  const user = await requireUser();
  const managerRoles: UserRole[] = [...BILLING_MANAGER_ROLES];
  if (!managerRoles.includes(user.role)) {
    const billingManagerCount = await prisma.user.count({
      where: {
        role: {
          in: managerRoles,
        },
      },
    });
    if (billingManagerCount === 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.ADMIN },
      });
      const elevatedUser = { ...user, role: UserRole.ADMIN };
      ensureCanManageBilling(elevatedUser);
      return elevatedUser;
    }
  }
  ensureCanManageBilling(user);
  return user;
}

function parsePayload(formData: FormData) {
  const rawPayload = formData.get("payload");
  if (!rawPayload) {
    throw new Error("Payload manquant");
  }
  const json = JSON.parse(rawPayload.toString());
  return invoiceInputSchema.parse(json);
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

function revalidateInvoiceData(
  user: { id: string; tenantId?: string | null },
  invoiceId?: string,
) {
  const tenantId = user.tenantId ?? user.id;
  revalidateTag(invoiceListTag(tenantId), "max");
  revalidateTag(invoiceStatsTag(tenantId), "max");
  if (invoiceId) {
    revalidateTag(invoiceDetailTag(tenantId, invoiceId), "max");
  }
}

function normalizeZodInvoiceErrors(error: ZodError): {
  fieldErrors: Partial<Record<string, string>>;
  issueMap: Record<string, string>;
} {
  const fieldErrors: Partial<Record<string, string>> = {};
  const issueMap: Record<string, string> = {};

  for (const issue of error.issues) {
    const filteredPath = issue.path
      .map((segment) =>
        typeof segment === "number" ? segment : segment?.toString() ?? "",
      )
      .filter((segment) => segment !== "");
    const key = filteredPath.join(".");
    if (key) {
      issueMap[key] = issue.message;
    }

    const firstSegment = issue.path[0];
    if (typeof firstSegment === "string") {
      if (!fieldErrors[firstSegment]) {
        fieldErrors[firstSegment] = issue.message;
      }
      if (firstSegment === "lines" && !fieldErrors.lines) {
        fieldErrors.lines = "Veuillez corriger les lignes en surbrillance.";
      }
    }
  }

  return { fieldErrors, issueMap };
}

export async function submitInvoiceFormAction(
  _prevState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  try {
    const user = await requireBillingAccess();
    const payload = parsePayload(formData);
    const invoiceId = formData.get("invoiceId")?.toString() || undefined;

    if (invoiceId) {
      const updated = await updateInvoice(invoiceId, payload);
      revalidateInvoiceData(user, invoiceId);
      return {
        status: "success",
        message: "Facture mise à jour",
        invoiceId: updated.id,
      };
    }

    const created = await createInvoice(payload);
    revalidateInvoiceData(user, created.id);
    return {
      status: "success",
      message: "Facture créée",
      invoiceId: created.id,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const { fieldErrors, issueMap } = normalizeZodInvoiceErrors(error);
      return {
        status: "error",
        message:
          "Certaines données sont invalides. Veuillez corriger les champs indiqués.",
        fieldErrors,
        issueMap,
      };
    }

    if (isUniqueConstraintViolation(error)) {
      const targetMeta = (error as { meta?: { target?: unknown } }).meta?.target;
      const target = Array.isArray(targetMeta)
        ? targetMeta.filter((entry): entry is string => typeof entry === "string")
        : [];
      const fieldErrors: Partial<Record<string, string>> = {};
      if (target.includes("number")) {
        fieldErrors.number = "Ce numéro de facture est déjà utilisé.";
      }
      return {
        status: "error",
        message:
          "Impossible d'enregistrer la facture. Vérifiez les champs signalés.",
        fieldErrors,
      };
    }

    console.error("[submitInvoiceFormAction] Unexpected error", error);
    return {
      status: "error",
      message: "Une erreur inattendue est survenue. Veuillez réessayer.",
    };
  }
}

export async function createInvoiceAction(formData: FormData) {
  const user = await requireBillingAccess();
  const redirectTarget = resolveRedirectTarget(formData, "/factures");
  try {
    const payload = parsePayload(formData);
    const created = await createInvoice(payload);
    revalidateInvoiceData(user, created.id);
    redirectWithFeedback(redirectTarget, {
      message: "Facture créée avec succès",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createInvoiceAction] Échec de création de facture", error);
    const message =
      error instanceof ZodError
        ? "Données de facture invalides. Vérifiez le formulaire."
        : "Impossible de créer la facture pour le moment.";
    redirectWithFeedback(redirectTarget, {
      error: message,
    });
  }
}

export async function updateInvoiceAction(id: string, formData: FormData) {
  const user = await requireBillingAccess();
  const redirectTarget = resolveRedirectTarget(formData, "/factures");
  try {
    const payload = parsePayload(formData);
    const updated = await updateInvoice(id, payload);
    revalidateInvoiceData(user, updated.id);
    redirectWithFeedback(redirectTarget, {
      message: "Facture mise à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateInvoiceAction] Échec de mise à jour", error);
    const message =
      error instanceof ZodError
        ? "Données invalides pour la facture."
        : "Impossible de mettre à jour la facture.";
    redirectWithFeedback(redirectTarget, {
      error: message,
    });
  }
}

export async function deleteInvoiceAction(id: string, formData?: FormData) {
  const user = await requireBillingAccess();
  const redirectTarget = resolveRedirectTarget(formData, "/factures");
  try {
    const outcome = await deleteInvoice(id);
    revalidateInvoiceData(user, id);
    const message =
      outcome === "deleted"
        ? "Facture supprimée"
        : outcome === "cancelled"
          ? "Facture annulée"
          : "Facture déjà annulée";
    redirectWithFeedback(redirectTarget, {
      message,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteInvoiceAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error: "Suppression impossible pour le moment.",
    });
  }
}

export async function changeInvoiceStatusAction(
  id: string,
  status: InvoiceStatus,
  formData?: FormData,
) {
  await changeInvoiceStatusActionInternal(id, status, formData);
}

async function changeInvoiceStatusActionInternal(
  id: string,
  status: InvoiceStatus,
  formData?: FormData,
) {
  const user = await requireBillingAccess();
  const redirectTarget = resolveRedirectTarget(formData, "/factures");
  try {
    await changeInvoiceStatus(id, status);
    revalidateInvoiceData(user, id);
    redirectWithFeedback(redirectTarget, {
      message: "Statut de la facture mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[changeInvoiceStatusAction] Échec de mise à jour", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de mettre à jour le statut.",
    });
  }
}

export async function recordPaymentAction(formData: FormData) {
  const user = await requireBillingAccess();
  const invoiceId = formData.get("invoiceId")?.toString();
  const fallback = invoiceId ? `/factures/${invoiceId}` : "/factures";
  const redirectTarget = resolveRedirectTarget(formData, fallback);
  try {
    const amount = Number(formData.get("amount") ?? 0);
    const method = formData.get("method")?.toString() || null;
    const date = formData.get("date")?.toString();
    const note = formData.get("note")?.toString() || null;

    if (!invoiceId || !date) {
      throw new Error("Informations de paiement incomplètes");
    }

    await recordPayment({
      invoiceId,
      amount,
      method,
      date: new Date(date),
      note,
    });

    revalidateInvoiceData(user, invoiceId);
    redirectWithFeedback(redirectTarget, {
      message: "Paiement enregistré",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[recordPaymentAction] Échec d'enregistrement du paiement", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible d'enregistrer ce paiement.",
    });
  }
}

export async function deletePaymentAction(
  paymentId: string,
  invoiceId: string,
  formData?: FormData,
) {
  const user = await requireBillingAccess();
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/factures/${invoiceId}`,
  );
  try {
    await deletePayment(paymentId);
    revalidateInvoiceData(user, invoiceId);
    redirectWithFeedback(redirectTarget, {
      message: "Paiement supprimé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deletePaymentAction] Échec de suppression du paiement", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de supprimer ce paiement.",
    });
  }
}

export async function sendInvoiceEmailAction(
  id: string,
  input: DocumentEmailActionInput,
): Promise<DocumentEmailActionResult> {
  const user = await requireBillingAccess();
  const messagingSummary = await getMessagingSettingsSummary(user.id);
  const email = input.email?.trim() ?? "";
  const subject = input.subject?.trim();

  if (!messagingSummary.smtpConfigured) {
    return {
      status: "config-missing",
      variant: "warning",
      message:
        "Veuillez configurer la messagerie (SMTP/IMAP) avant d'envoyer des factures.",
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
    const queueResult = await queueInvoiceEmailJob({
      userId: user.id,
      invoiceId: id,
      to: email,
      subject,
    });
    if (queueResult.deduped) {
      return {
        status: "duplicate",
        variant: "warning",
        message: "Un envoi est déjà en cours pour cette facture.",
        jobId: queueResult.jobId,
        deduped: true,
      };
    }
    return {
      status: "queued",
      variant: "success",
      message: "Facture en cours d'envoi en arrière-plan.",
      jobId: queueResult.jobId,
      deduped: false,
    };
  } catch (error) {
    console.error("[sendInvoiceEmailAction] Erreur de mise en file", error);
    return {
      status: "error",
      variant: "error",
      message:
        "Impossible de planifier cet envoi. Veuillez réessayer dans un instant.",
    };
  }
}
