import type { Route } from "next";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listContactMessages } from "@/server/contact-messages";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ContactMessagesPageProps = { searchParams?: Promise<SearchParams> };

function resolveParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function buildHref(base: string, params: Record<string, string>): Route {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return (query ? `${base}?${query}` : base) as Route;
}

export default async function ContactMessagesPage({
  searchParams,
}: ContactMessagesPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const search = resolveParam(resolvedSearchParams.recherche).trim();
  const page = Number(resolveParam(resolvedSearchParams.page) || "1") || 1;

  const result = await listContactMessages({
    search: search || undefined,
    page,
  });

  const previousHref =
    page > 1
      ? buildHref("/site-web/messages-contact", {
          ...(search ? { recherche: search } : {}),
          page: String(page - 1),
        })
      : null;
  const nextHref =
    page < result.pageCount
      ? buildHref("/site-web/messages-contact", {
          ...(search ? { recherche: search } : {}),
          page: String(page + 1),
        })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Messages de contact
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Consultez les messages envoyes depuis la page Contact du site.
          </p>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          name="recherche"
          defaultValue={search}
          placeholder="Rechercher un nom, email ou message"
        />
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>

      <div className="card divide-y divide-zinc-200 overflow-hidden border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {result.items.length ? (
          result.items.map((message) => (
            <Link
              key={message.id}
              href={`/site-web/messages-contact/${message.id}`}
              className="flex flex-col gap-2 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {message.name}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {message.createdAt.toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {message.email}
                {message.sourcePath ? ` - ${message.sourcePath}` : null}
              </div>
              <div className="text-sm text-zinc-700 dark:text-zinc-200">
                {message.message.length > 160
                  ? `${message.message.slice(0, 160)}...`
                  : message.message}
              </div>
            </Link>
          ))
        ) : (
          <div className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aucun message recu pour le moment.
          </div>
        )}
      </div>

      {result.pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
          <span>
            Page {result.page} sur {result.pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" disabled={!previousHref}>
              {previousHref ? <Link href={previousHref}>Precedent</Link> : <span>Precedent</span>}
            </Button>
            <Button asChild variant="secondary" disabled={!nextHref}>
              {nextHref ? <Link href={nextHref}>Suivant</Link> : <span>Suivant</span>}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
