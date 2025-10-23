"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  quoteInputSchema,
  createQuote,
  updateQuote,
  deleteQuote,
  duplicateQuote,
  changeQuoteStatus,
  convertQuoteToInvoice,
} from "@/server/quotes";
import { QuoteStatus } from "@prisma/client";
import { sendQuoteEmail } from "@/server/email";

function parsePayload(formData: FormData) {
  const rawPayload = formData.get("payload");
  if (!rawPayload) {
    throw new Error("Payload manquant");
  }
  const json = JSON.parse(rawPayload.toString());
  return quoteInputSchema.parse(json);
}

export async function createQuoteAction(formData: FormData) {
  const payload = parsePayload(formData);
  await createQuote(payload);
  revalidatePath("/devis");
  redirect("/devis");
}

export async function updateQuoteAction(id: string, formData: FormData) {
  const payload = parsePayload(formData);
  await updateQuote(id, payload);
  revalidatePath("/devis");
  redirect("/devis");
}

export async function deleteQuoteAction(id: string) {
  await deleteQuote(id);
  revalidatePath("/devis");
  redirect("/devis");
}

export async function duplicateQuoteAction(id: string) {
  await duplicateQuote(id);
  revalidatePath("/devis");
  redirect("/devis");
}

export async function changeQuoteStatusAction(id: string, status: QuoteStatus) {
  await changeQuoteStatus(id, status);
  revalidatePath("/devis");
}

export async function convertQuoteToInvoiceAction(id: string) {
  await convertQuoteToInvoice(id);
  revalidatePath("/factures");
  revalidatePath("/devis");
  redirect("/factures");
}

export async function sendQuoteEmailAction(id: string, formData: FormData) {
  const to = formData.get("email")?.toString();
  const subject = formData.get("subject")?.toString() || undefined;
  const message = formData.get("message")?.toString() || undefined;
  if (!to) {
    redirect(`/devis/${id}/modifier?error=${encodeURIComponent("Adresse e-mail requise")}`);
  }
  try {
    await sendQuoteEmail({ quoteId: id, to, subject, message });
    revalidatePath(`/devis/${id}/modifier`);
    redirect(`/devis/${id}/modifier?message=${encodeURIComponent("Devis envoyé par e-mail")}`);
  } catch (error) {
    console.error("Erreur lors de l'envoi du devis", error);
    const errorMessage =
      error instanceof Error ? error.message : "Échec de l'envoi de l'e-mail";
    revalidatePath(`/devis/${id}/modifier`);
    redirect(`/devis/${id}/modifier?error=${encodeURIComponent(errorMessage)}`);
  }
}
