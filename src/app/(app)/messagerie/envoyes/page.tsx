import {
  fetchMailboxMessages,
  getMessagingSettingsSummary,
  listMessagingClients,
} from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";

export const dynamic = "force-dynamic";

export default async function EnvoyesPage() {
  const summary = await getMessagingSettingsSummary();
  const clients = await listMessagingClients();

  let initialError: string | null = null;
  let initialPage = null;

  if (summary.imapConfigured) {
    try {
      initialPage = await fetchMailboxMessages({
        mailbox: "sent",
        page: 1,
      });
    } catch (error) {
      initialError =
        error instanceof Error
          ? error.message
          : "Échec de chargement des messages.";
    }
  }

  return (
    <MailboxClient
      mailbox="sent"
      title="Messages envoyés"
      description="Historique des e-mails expédiés."
      isConfigured={summary.imapConfigured}
      initialPage={initialPage}
      initialError={initialError}
      emptyStateMessage="Aucun e-mail envoyé trouvé."
      clients={clients}
    />
  );
}
