import Link from "next/link";
import { ClientForm } from "@/app/(app)/clients/client-form";
import { createClientAction } from "@/app/(app)/clients/actions";

export default function NouveauClientPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Nouveau client
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Renseignez les informations de contact et les notes internes.
          </p>
        </div>
        <Link
          href="/clients"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Retour à la liste
        </Link>
      </div>
      <ClientForm action={createClientAction} submitLabel="Créer le client" />
    </div>
  );
}
