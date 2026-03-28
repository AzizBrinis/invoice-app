import { getMessagingSettingsSummary } from "@/server/messaging";
import { getMessagingLocalSyncOverview } from "@/server/messaging-local-sync";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";
import { loadInitialMailboxData } from "@/app/(app)/messagerie/load-initial-mailbox-data";

export const dynamic = "force-dynamic";

export default async function CorbeillePage() {
  const [summary, localSyncOverview] = await Promise.all([
    getMessagingSettingsSummary(),
    getMessagingLocalSyncOverview(),
  ]);
  const { initialPage, initialError } = await loadInitialMailboxData({
    mailbox: "trash",
    enabled: summary.imapConfigured,
    fallbackError: "Erreur lors du chargement de la corbeille.",
  });

  return (
    <MailboxClient
      mailbox="trash"
      title="Corbeille"
      description="Messages supprimés récemment."
      isConfigured={summary.imapConfigured}
      localSyncOverview={localSyncOverview}
      initialPage={initialPage}
      initialError={initialError}
      emptyStateMessage="Aucun message dans la corbeille."
    />
  );
}
