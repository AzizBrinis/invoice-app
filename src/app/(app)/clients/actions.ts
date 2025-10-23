"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clientSchema, createClient, updateClient, deleteClient } from "@/server/clients";

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

export async function createClientAction(formData: FormData) {
  const data = parseClientForm(formData);
  await createClient(data);
  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClientAction(id: string, formData: FormData) {
  const data = parseClientForm(formData);
  await updateClient(id, data);
  revalidatePath("/clients");
  redirect("/clients");
}

export async function deleteClientAction(id: string) {
  await deleteClient(id);
  revalidatePath("/clients");
  redirect("/clients");
}
