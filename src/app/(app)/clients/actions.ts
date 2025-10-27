"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { clientSchema, createClient, updateClient, deleteClient } from "@/server/clients";
import { isRedirectError } from "@/lib/next";

function parseClientForm(formData: FormData) {
  const payload = {
    displayName: formData.get("displayName")?.toString() ?? "",
    companyName: formData.get("companyName")?.toString() || null,
    address: formData.get("address")?.toString() || null,
    email: formData.get("email")?.toString() || null,
    phone: formData.get("phone")?.toString() || null,
    vatNumber: formData.get("vatNumber")?.toString() || null,
    notes: formData.get("notes")?.toString() || null,
    isActive:
      (formData.get("isActive")?.toString() ?? "true").toLowerCase() !==
      "false",
  } satisfies Record<string, unknown>;

  return clientSchema.parse(payload);
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
) {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  ["message", "error", "warning"].forEach((key) => {
    params.delete(key);
  });
  if (feedback.message) params.set("message", feedback.message);
  if (feedback.error) params.set("error", feedback.error);
  if (feedback.warning) params.set("warning", feedback.warning);
  const nextQuery = params.toString();
  redirect(nextQuery ? `${path}?${nextQuery}` : path);
}

export async function createClientAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/clients");
  try {
    const data = parseClientForm(formData);
    await createClient(data);
    revalidatePath("/clients");
    redirectWithFeedback(redirectTarget, {
      message: "Client créé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createClientAction] Échec de création de client", error);
    const message =
      error instanceof ZodError
        ? "Informations client invalides."
        : "Impossible de créer le client.";
    redirectWithFeedback(redirectTarget, {
      error: message,
    });
  }
}

export async function updateClientAction(id: string, formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/clients");
  try {
    const data = parseClientForm(formData);
    await updateClient(id, data);
    revalidatePath("/clients");
    redirectWithFeedback(redirectTarget, {
      message: "Client mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateClientAction] Échec de mise à jour de client", error);
    const message =
      error instanceof ZodError
        ? "Informations client invalides."
        : "Impossible de mettre à jour le client.";
    redirectWithFeedback(redirectTarget, {
      error: message,
    });
  }
}

export async function deleteClientAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/clients");
  try {
    await deleteClient(id);
    revalidatePath("/clients");
    redirectWithFeedback(redirectTarget, {
      message: "Client supprimé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteClientAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de supprimer ce client.",
    });
  }
}
