import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";
import { loadInitialMailboxData } from "@/app/(app)/messagerie/load-initial-mailbox-data";

export const dynamic = "force-dynamic";

export default async function EnvoyesPage() {
  const summary = await getMessagingSettingsSummary();
  const { initialPage, initialError } = await loadInitialMailboxData({
    mailbox: "sent",
    enabled: summary.imapConfigured,
    fallbackError: "Erreur lors du chargement des messages envoyés.",
  });

  return (
    <MailboxClient
      mailbox="sent"
      title="Messages envoyés"
      description="Historique des e-mails expédiés."
      isConfigured={summary.imapConfigured}
      initialPage={initialPage}
      initialError={initialError}
      emptyStateMessage="Aucun e-mail envoyé trouvé."
    />
  );
}
