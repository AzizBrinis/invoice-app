import { MailboxSkeleton } from "@/app/(app)/messagerie/_components/mailbox-skeleton";
import { Spinner } from "@/components/ui/spinner";

export default function RecusLoading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center py-6">
        <Spinner label="Chargement des messages..." />
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <MailboxSkeleton rows={6} />
      </div>
    </div>
  );
}
