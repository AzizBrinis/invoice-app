import Link from "next/link";
import { LoginForm } from "./login-form";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const resolvedParams =
    typeof (searchParams as Promise<SearchParams>)?.then === "function"
      ? await (searchParams as Promise<SearchParams>)
      : (searchParams as SearchParams);

  const redirectParam = resolvedParams?.redirect;
  const redirectToParam = Array.isArray(redirectParam)
    ? redirectParam[0]
    : redirectParam ?? "/tableau-de-bord";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6 transition-colors dark:from-zinc-950 dark:via-zinc-950 dark:to-blue-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg transition-colors dark:border dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Application de facturation
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Connectez-vous pour accéder au tableau de bord administrateur.
          </p>
        </div>
        <LoginForm redirectTo={redirectToParam} />
        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Besoin d&apos;aide ?
          <Link
            href="mailto:contact@demo.fr"
            className="ml-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Contactez le support
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Nouveau dans l&apos;espace ?
          <Link
            href="/inscription"
            className="ml-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
