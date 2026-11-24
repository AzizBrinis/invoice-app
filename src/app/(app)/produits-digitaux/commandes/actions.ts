"use server";

import type { Route } from "next";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppSectionAccess } from "@/lib/authorization";
import { revalidateClientList } from "@/server/clients";
import { sendReviewedDigitalOrder } from "@/server/digital-products/fulfilment";
import { invoiceDetailTag, invoiceListTag, invoiceStatsTag } from "@/server/invoices";

const FULFILMENT_ID = /^dlful-[0-9a-f-]{36}$/;

/** "Envoyer" on the review page: e-mails the reviewed order to the customer (once). */
export async function sendReviewedOrderAction(formData: FormData) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const id = String(formData.get("fulfilmentId") ?? "");
  if (!FULFILMENT_ID.test(id)) redirect("/produits-digitaux" as Route);
  const page = `/produits-digitaux/commandes/${id}`;

  const result = await sendReviewedDigitalOrder({
    tenantId,
    fulfilmentId: id,
    userId: user.id,
  }).catch(() => ({ ok: false as const, code: "INTERNAL_ERROR", message: "Erreur interne." }));

  const now = { expire: 0 };
  revalidateTag(invoiceListTag(tenantId), now);
  revalidateTag(invoiceStatsTag(tenantId), now);
  revalidateClientList(tenantId);
  if (result.ok && result.invoiceId) {
    // The invoice page shows the e-mail log entry.
    revalidateTag(invoiceDetailTag(tenantId, result.invoiceId), now);
  }
  revalidatePath(page);

  const query = result.ok
    ? new URLSearchParams({ envoye: result.alreadySent ? "deja" : "1" })
    : new URLSearchParams({ erreur: `${result.message} (${result.code})` });
  redirect(`${page}?${query.toString()}` as Route);
}
