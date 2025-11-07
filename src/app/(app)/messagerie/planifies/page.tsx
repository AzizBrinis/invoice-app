import { listScheduledEmails } from "@/server/messaging-scheduled";
import { ScheduledEmailsClient } from "@/app/(app)/messagerie/_components/scheduled-emails-client";

export const dynamic = "force-dynamic";

export default async function PlanifiesPage() {
  const items = await listScheduledEmails();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          E-mails planifiés
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Consultez, ajustez ou annulez les envois programmés. Nous vérifions les planifications toutes les minutes.
        </p>
      </div>
      <ScheduledEmailsClient items={items} />
    </div>
  );
}
