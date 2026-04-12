import { AccountPermission } from "@/lib/db/prisma";
import { requireAccountPermission } from "@/lib/authorization";
import { ClientForm } from "@/app/(app)/clients/client-form";
import { createClientFormAction } from "@/app/(app)/clients/actions";
import { PrefetchLink } from "@/components/ui/prefetch-link";

export default async function NouveauClientPage() {
  await requireAccountPermission(AccountPermission.CLIENTS_MANAGE, {
    redirectOnFailure: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Nouveau client
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Renseignez les informations de contact et les notes internes.
          </p>
        </div>
        <PrefetchLink
          href="/clients"
          className="self-start text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 sm:self-auto"
        >
          Retour à la liste
        </PrefetchLink>
      </div>
      <ClientForm
        action={createClientFormAction}
        submitLabel="Créer le client"
        redirectTo="/clients"
      />
    </div>
  );
}
