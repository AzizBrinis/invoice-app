import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";
import { loadInitialMailboxData } from "@/app/(app)/messagerie/load-initial-mailbox-data";

export const dynamic = "force-dynamic";

export default async function RecusPage() {
  const summary = await getMessagingSettingsSummary();
  const { initialPage, initialError } = await loadInitialMailboxData({
    mailbox: "inbox",
    enabled: summary.imapConfigured,
    fallbackError: "Erreur lors du chargement des messages reçus.",
  });

  return (
    <MailboxClient
      mailbox="inbox"
      title="Boîte de réception"
      description="Consultez les messages reçus les plus récents."
      isConfigured={summary.imapConfigured}
      initialPage={initialPage}
      initialError={initialError}
      emptyStateMessage="Aucun message récent trouvé pour le moment."
    />
  );
}
