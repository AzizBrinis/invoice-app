import Link from "next/link";
import { RegisterForm } from "./register-form";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams: Promise<SearchParams> | SearchParams;
};

export default async function InscriptionPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/tableau-de-bord");
  }

  const resolvedParams =
    typeof (searchParams as Promise<SearchParams>)?.then === "function"
      ? await (searchParams as Promise<SearchParams>)
      : (searchParams as SearchParams);

  const messageParam = Array.isArray(resolvedParams?.message)
    ? resolvedParams.message[0]
    : resolvedParams?.message ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Créer un compte administrateur</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Renseignez vos informations pour accéder à l&apos;espace d&apos;administration.
          </p>
        </div>
        {messageParam && (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {messageParam}
          </p>
        )}
        <RegisterForm />
        <p className="mt-6 text-center text-xs text-zinc-500">
          Vous avez déjà un compte ?
          <Link href="/connexion" className="ml-1 font-medium text-blue-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
