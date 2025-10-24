"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  invoiceInputSchema,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  changeInvoiceStatus,
  recordPayment,
  deletePayment,
  reconcileInvoiceStatus,
} from "@/server/invoices";
import { InvoiceStatus } from "@prisma/client";
import { toCents } from "@/lib/money";
import { sendInvoiceEmail } from "@/server/email";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureCanManageBilling } from "@/lib/authorization";

async function requireBillingAccess() {
  const user = await requireUser();
  ensureCanManageBilling(user);
}

function parsePayload(formData: FormData) {
  const rawPayload = formData.get("payload");
  if (!rawPayload) {
    throw new Error("Payload manquant");
  }
  const json = JSON.parse(rawPayload.toString());
  return invoiceInputSchema.parse(json);
}

export async function createInvoiceAction(formData: FormData) {
  await requireBillingAccess();
  const payload = parsePayload(formData);
  await createInvoice(payload);
  revalidatePath("/factures");
  redirect("/factures");
}

export async function updateInvoiceAction(id: string, formData: FormData) {
  await requireBillingAccess();
  const payload = parsePayload(formData);
  await updateInvoice(id, payload);
  revalidatePath("/factures");
  redirect("/factures");
}

export async function deleteInvoiceAction(id: string) {
  await requireBillingAccess();
  await deleteInvoice(id);
  revalidatePath("/factures");
  redirect("/factures");
}

export async function changeInvoiceStatusAction(
  id: string,
  status: InvoiceStatus,
) {
  await requireBillingAccess();
  await changeInvoiceStatus(id, status);
  await reconcileInvoiceStatus(id);
  revalidatePath("/factures");
}

export async function recordPaymentAction(formData: FormData) {
  await requireBillingAccess();
  const invoiceId = formData.get("invoiceId")?.toString();
  const amount = Number(formData.get("amount") ?? 0);
  const method = formData.get("method")?.toString() || null;
  const date = formData.get("date")?.toString();
  const note = formData.get("note")?.toString() || null;

  if (!invoiceId || !date) {
    throw new Error("Informations de paiement incomplètes");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { currency: true },
  });

  if (!invoice) {
    throw new Error("Facture introuvable");
  }

  await recordPayment({
    invoiceId,
    amountCents: toCents(amount, invoice.currency),
    method,
    date: new Date(date),
    note,
  });

  await reconcileInvoiceStatus(invoiceId);
  revalidatePath(`/factures/${invoiceId}`);
}

export async function deletePaymentAction(paymentId: string, invoiceId: string) {
  await requireBillingAccess();
  await deletePayment(paymentId);
  await reconcileInvoiceStatus(invoiceId);
  revalidatePath(`/factures/${invoiceId}`);
}

export async function sendInvoiceEmailAction(id: string, formData: FormData) {
  await requireBillingAccess();
  const to = formData.get("email")?.toString();
  const subject = formData.get("subject")?.toString() || undefined;
  const message = formData.get("message")?.toString() || undefined;
  if (!to) {
    redirect(`/factures/${id}?error=${encodeURIComponent("Adresse e-mail requise")}`);
  }
  try {
    await sendInvoiceEmail({ invoiceId: id, to, subject, message });
    revalidatePath(`/factures/${id}`);
    redirect(`/factures/${id}?message=${encodeURIComponent("Facture envoyée par e-mail")}`);
  } catch (error) {
    console.error("Erreur lors de l'envoi de la facture", error);
    const errorMessage =
      error instanceof Error ? error.message : "Échec de l'envoi de l'e-mail";
    revalidatePath(`/factures/${id}`);
    redirect(`/factures/${id}?error=${encodeURIComponent(errorMessage)}`);
  }
}
