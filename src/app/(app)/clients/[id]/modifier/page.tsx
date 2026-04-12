import { AccountPermission } from "@/lib/db/prisma";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getClient } from "@/server/clients";
import {
  canAccessAppSection,
  requireAccountPermission,
} from "@/lib/authorization";
import { ClientForm } from "@/app/(app)/clients/client-form";
import { updateClientFormAction } from "@/app/(app)/clients/actions";
import { PrefetchLink } from "@/components/ui/prefetch-link";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAccountPermission(AccountPermission.CLIENTS_MANAGE, {
    redirectOnFailure: true,
  });
  const { id } = await params;
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const client = await getClient(id, tenantId);

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
        <PrefetchLink
          href={`/clients/${client.id}` as Route}
          className="self-start text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 sm:self-auto"
        >
          Retour au dossier
        </PrefetchLink>
        {canAccessAppSection(user, "assistant") ? (
          <PrefetchLink
            href={
              `/assistant?contextType=client&contextId=${client.id}` as Route
            }
            className="inline-flex items-center justify-center rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/10"
          >
            Assistant AI
          </PrefetchLink>
        ) : null}
      </div>
      <ClientForm
        action={updateClientFormAction.bind(null, client.id)}
        submitLabel="Enregistrer"
        defaultValues={client}
        redirectTo={`/clients/${client.id}`}
      />
    </div>
  );
}
