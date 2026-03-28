import { getMessagingSettingsSummary } from "@/server/messaging";
import { getMessagingLocalSyncOverview } from "@/server/messaging-local-sync";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";
import { loadInitialMailboxData } from "@/app/(app)/messagerie/load-initial-mailbox-data";

export const dynamic = "force-dynamic";

export default async function SpamPage() {
  const [summary, localSyncOverview] = await Promise.all([
    getMessagingSettingsSummary(),
    getMessagingLocalSyncOverview(),
  ]);
  const { initialPage, initialError } = await loadInitialMailboxData({
    mailbox: "spam",
    enabled: summary.imapConfigured,
    fallbackError: "Erreur lors du chargement du dossier spam.",
  });

  return (
    <MailboxClient
      mailbox="spam"
      title="Spam"
      description="Messages signalés comme indésirables."
      isConfigured={summary.imapConfigured}
      localSyncOverview={localSyncOverview}
      initialPage={initialPage}
      initialError={initialError}
      emptyStateMessage="Aucun message indésirable détecté."
    />
  );
}
