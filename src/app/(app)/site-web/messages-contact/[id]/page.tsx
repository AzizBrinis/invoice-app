import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getContactMessage } from "@/server/contact-messages";

export const dynamic = "force-dynamic";

type ContactMessageDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactMessageDetailPage({
  params,
}: ContactMessageDetailPageProps) {
  const { id } = await params;
  const message = await getContactMessage(id);
  if (!message) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Message de contact
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Recu le{" "}
            {message.createdAt.toLocaleString("fr-FR", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/site-web/messages-contact">Retour a la liste</Link>
        </Button>
      </div>

      <div className="card space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Nom
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {message.name}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Email
            </p>
            <a
              className="text-sm font-semibold text-[var(--site-accent)] hover:underline"
              href={`mailto:${message.email}`}
            >
              {message.email}
            </a>
          </div>
          {message.sourcePath ? (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Page
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                {message.sourcePath}
              </p>
            </div>
          ) : null}
          {message.sourceDomain ? (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Domaine
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                {message.sourceDomain}
              </p>
            </div>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            Message
          </p>
          <div className="mt-2 whitespace-pre-line rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            {message.message}
          </div>
        </div>
      </div>
    </div>
  );
}
