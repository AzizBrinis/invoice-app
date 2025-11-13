import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";
import { loadInitialMailboxData } from "@/app/(app)/messagerie/load-initial-mailbox-data";

export const dynamic = "force-dynamic";

export default async function BrouillonsPage() {
  const summary = await getMessagingSettingsSummary();
  const { initialPage, initialError } = await loadInitialMailboxData({
    mailbox: "drafts",
    enabled: summary.imapConfigured,
    fallbackError: "Erreur lors du chargement des brouillons.",
  });

  return (
    <MailboxClient
      mailbox="drafts"
      title="Brouillons"
      description="Messages enregistrés avant envoi."
      isConfigured={summary.imapConfigured}
      initialPage={initialPage}
      initialError={initialError}
      emptyStateMessage="Aucun brouillon trouvé."
    />
  );
}
