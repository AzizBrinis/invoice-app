"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { isRedirectError } from "@/lib/next";
import { OrderPaymentProofStatus } from "@/lib/db/prisma";
import {
  cancelOrder,
  markOrderDelivered,
  markOrderPaid,
  updateOrderInternalNotes,
  updateOrderPaymentProofStatus,
} from "@/server/orders";
import { createInvoiceFromOrder } from "@/server/invoices";
import { createQuoteFromOrder } from "@/server/quotes";
import { requireAppSectionAccess } from "@/lib/authorization";

const ORDER_LIST_PATH = "/site-web/commandes";

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

function revalidateOrderPaths(orderId: string) {
  revalidatePath(ORDER_LIST_PATH);
  revalidatePath(`/site-web/commandes/${orderId}`);
}

async function requireWebsiteAccess() {
  await requireAppSectionAccess("website");
}

export async function cancelOrderAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/commandes/${id}`,
  );
  try {
    await requireWebsiteAccess();
    await cancelOrder(id);
    revalidateOrderPaths(id);
    redirectWithFeedback(redirectTarget, {
      message: "Commande annulée",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[cancelOrderAction] Unable to cancel order", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible d'annuler la commande.",
    });
  }
}

export async function markOrderPaidAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/commandes/${id}`,
  );
  try {
    await requireWebsiteAccess();
    await markOrderPaid(id);
    revalidateOrderPaths(id);
    redirectWithFeedback(redirectTarget, {
      message: "Commande marquée payée",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[markOrderPaidAction] Unable to mark order paid", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de mettre à jour le paiement.",
    });
  }
}

export async function approveOrderPaymentProofAction(
  orderId: string,
  paymentId: string,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/commandes/${orderId}`,
  );
  try {
    await requireWebsiteAccess();
    await updateOrderPaymentProofStatus({
      paymentId,
      status: OrderPaymentProofStatus.APPROVED,
    });
    revalidateOrderPaths(orderId);
    redirectWithFeedback(redirectTarget, {
      message: "Preuve approuvée",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[approveOrderPaymentProofAction] Unable to approve proof", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible d'approuver la preuve.",
    });
  }
}

export async function rejectOrderPaymentProofAction(
  orderId: string,
  paymentId: string,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/commandes/${orderId}`,
  );
  try {
    await requireWebsiteAccess();
    await updateOrderPaymentProofStatus({
      paymentId,
      status: OrderPaymentProofStatus.REJECTED,
    });
    revalidateOrderPaths(orderId);
    redirectWithFeedback(redirectTarget, {
      warning: "Preuve rejetée",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[rejectOrderPaymentProofAction] Unable to reject proof", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de rejeter la preuve.",
    });
  }
}

export async function markOrderDeliveredAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/commandes/${id}`,
  );
  try {
    await requireWebsiteAccess();
    await markOrderDelivered(id);
    revalidateOrderPaths(id);
    redirectWithFeedback(redirectTarget, {
      message: "Commande marquée livrée",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error(
      "[markOrderDeliveredAction] Unable to mark order delivered",
      error,
    );
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de mettre à jour le statut.",
    });
  }
}

export async function updateOrderInternalNotesAction(
  id: string,
  formData: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/site-web/commandes/${id}`,
  );
  try {
    await requireWebsiteAccess();
    const rawNotes = formData.get("internalNotes")?.toString() ?? "";
    const normalizedNotes = rawNotes.trim();
    await updateOrderInternalNotes(id, normalizedNotes || null);
    revalidateOrderPaths(id);
    redirectWithFeedback(redirectTarget, {
      message: "Notes internes mises à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error(
      "[updateOrderInternalNotesAction] Unable to update notes",
      error,
    );
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de mettre à jour les notes internes.",
    });
  }
}

export async function createInvoiceFromOrderAction(id: string) {
  try {
    await requireWebsiteAccess();
    const invoice = await createInvoiceFromOrder(id);
    revalidateOrderPaths(id);
    revalidatePath("/factures");
    redirectWithFeedback(`/factures/${invoice.id}`, {
      message: "Facture générée depuis la commande",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error(
      "[createInvoiceFromOrderAction] Unable to create invoice",
      error,
    );
    redirectWithFeedback(`/site-web/commandes/${id}`, {
      error: "Impossible de générer la facture.",
    });
  }
}

export async function createQuoteFromOrderAction(id: string) {
  try {
    await requireWebsiteAccess();
    const quote = await createQuoteFromOrder(id);
    revalidateOrderPaths(id);
    revalidatePath("/devis");
    redirectWithFeedback(`/devis/${quote.id}/modifier`, {
      message: "Devis généré depuis la commande",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createQuoteFromOrderAction] Unable to create quote", error);
    redirectWithFeedback(`/site-web/commandes/${id}`, {
      error: "Impossible de générer le devis.",
    });
  }
}
