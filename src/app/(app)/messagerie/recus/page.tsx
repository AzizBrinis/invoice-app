import {
  fetchMailboxMessages,
  getMessagingSettingsSummary,
} from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";

export const dynamic = "force-dynamic";

export default async function RecusPage() {
  const summary = await getMessagingSettingsSummary();

  let initialError: string | null = null;
  let initialPage = null;

  if (summary.imapConfigured) {
    try {
      initialPage = await fetchMailboxMessages({
        mailbox: "inbox",
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
