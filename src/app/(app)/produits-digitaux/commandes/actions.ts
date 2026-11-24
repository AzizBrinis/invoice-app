"use server";

import type { Route } from "next";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppSectionAccess } from "@/lib/authorization";
import { revalidateClientList } from "@/server/clients";
import { notifyShopForReview, sendReviewedDigitalOrder } from "@/server/digital-products/fulfilment";
import { postgresFulfilmentStore } from "@/server/digital-products/fulfilment-store";
import { OrderEmailError } from "@/server/digital-products/order-email";
import { parseReviewedEmail, ReviewEmailError } from "@/server/digital-products/review-email";
import { invoiceDetailTag, invoiceListTag, invoiceStatsTag } from "@/server/invoices";

const FULFILMENT_ID = /^dlful-[0-9a-f-]{36}$/;

export type SendReviewedOrderState = { error: string | null };

/**
 * "Envoyer" on the review page: e-mails the reviewed order (as edited) to the
 * customer once, then tells PrestaShop. Errors come back to the form so that
 * nothing typed there is lost.
 */
export async function sendReviewedOrderAction(
  _previous: SendReviewedOrderState,
  formData: FormData,
): Promise<SendReviewedOrderState> {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const id = String(formData.get("fulfilmentId") ?? "");
  if (!FULFILMENT_ID.test(id)) return { error: "Commande introuvable." };
  const page = `/produits-digitaux/commandes/${id}`;

  const expectedVersion = String(formData.get("reviewVersion") ?? "");
  if (!/^[0-9a-f]{64}$/.test(expectedVersion)) return { error: "Formulaire expiré. Rechargez la page." };

  const review = await postgresFulfilmentStore.findReview(tenantId, id);
  if (!review) return { error: "Commande introuvable." };

  let result: Awaited<ReturnType<typeof sendReviewedDigitalOrder>>;
  try {
    const email = await parseReviewedEmail(formData, review.licenceOrderIds);
    result = await sendReviewedDigitalOrder({ tenantId, fulfilmentId: id, userId: user.id, email, expectedVersion });
  } catch (error) {
    if (error instanceof ReviewEmailError || error instanceof OrderEmailError) return { error: error.message };
    console.error("[digital-orders] review_send_error", { error: error instanceof Error ? error.name : typeof error });
    return { error: "Erreur interne. Rechargez la page avant de réessayer." };
  }
  if (!result.ok) return { error: `${result.message} (${result.code})` };

  // The e-mail is out: from here nothing may look like a failed send.
  await notifyShopForReview({ tenantId, fulfilmentId: id }).catch(() => undefined);

  const now = { expire: 0 };
  revalidateTag(invoiceListTag(tenantId), now);
  revalidateTag(invoiceStatsTag(tenantId), now);
  revalidateClientList(tenantId);
  // The invoice page shows the e-mail log entry.
  if (result.invoiceId) revalidateTag(invoiceDetailTag(tenantId, result.invoiceId), now);
  revalidatePath(page);
  redirect(`${page}?envoye=${result.alreadySent ? "deja" : "1"}` as Route);
}

/** "Mettre à jour PrestaShop": calls the shop again for an order already sent (no e-mail). */
export async function notifyShopAction(formData: FormData) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const id = String(formData.get("fulfilmentId") ?? "");
  if (!FULFILMENT_ID.test(id)) redirect("/produits-digitaux" as Route);
  await notifyShopForReview({ tenantId, fulfilmentId: id }).catch(() => undefined);
  const page = `/produits-digitaux/commandes/${id}`;
  revalidatePath(page);
  redirect(page as Route);
}
