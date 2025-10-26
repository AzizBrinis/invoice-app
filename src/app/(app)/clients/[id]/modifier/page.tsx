import Link from "next/link";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Modifier le client
          </h1>
          <p className="text-sm text-zinc-600">
            Mettez à jour les coordonnées et les préférences.
          </p>
        </div>
        <Link
          href="/clients"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Retour à la liste
        </Link>
      </div>
      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        submitLabel="Enregistrer"
        defaultValues={client}
      />
    </div>
  );
}
