import Link from "next/link";
import { RegisterForm } from "./register-form";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { FlashMessages } from "@/components/ui/flash-messages";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6 transition-colors dark:from-zinc-950 dark:via-zinc-950 dark:to-blue-950">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg transition-colors dark:border dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Créer un compte administrateur
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Renseignez vos informations pour accéder à l&apos;espace d&apos;administration.
          </p>
        </div>
        <FlashMessages
          messages={messageParam ? [{ variant: "success", title: messageParam }] : []}
        />
        {messageParam ? (
          <Alert
            className="mb-4"
            variant="success"
            title={messageParam}
          />
        ) : null}
        <RegisterForm />
        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Vous avez déjà un compte ?
          <Link
            href="/connexion"
            className="ml-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
