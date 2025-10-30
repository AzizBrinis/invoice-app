import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";

export const dynamic = "force-dynamic";

export default async function RecusPage() {
  const summary = await getMessagingSettingsSummary();

  return (
    <MailboxClient
      mailbox="inbox"
      title="Boîte de réception"
      description="Consultez les messages reçus les plus récents."
      isConfigured={summary.imapConfigured}
      initialPage={null}
      initialError={null}
      emptyStateMessage="Aucun message récent trouvé pour le moment."
    />
  );
}
