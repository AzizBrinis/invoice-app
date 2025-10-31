import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";

export const dynamic = "force-dynamic";

export default async function BrouillonsPage() {
  const summary = await getMessagingSettingsSummary();

  return (
    <MailboxClient
      mailbox="drafts"
      title="Brouillons"
      description="Messages enregistrés avant envoi."
      isConfigured={summary.imapConfigured}
      initialPage={null}
      initialError={null}
      emptyStateMessage="Aucun brouillon trouvé."
    />
  );
}
