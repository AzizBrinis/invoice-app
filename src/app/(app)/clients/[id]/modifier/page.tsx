import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getClient } from "@/server/clients";
import { ClientForm } from "@/app/(app)/clients/client-form";
import { updateClientAction } from "@/app/(app)/clients/actions";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Modifier le client
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Mettez à jour les coordonnées et les préférences.
          </p>
        </div>
        <Link
          href="/clients"
          className="self-start text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 sm:self-auto"
        >
          Retour à la liste
        </Link>
        <Link
          href={
            `/assistant?contextType=client&contextId=${client.id}` as Route
          }
          className="inline-flex items-center justify-center rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/10"
        >
          Assistant AI
        </Link>
      </div>
      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        submitLabel="Enregistrer"
        defaultValues={client}
        redirectTo="/clients"
      />
    </div>
  );
}
