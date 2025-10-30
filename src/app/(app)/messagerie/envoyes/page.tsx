import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";

export const dynamic = "force-dynamic";

export default async function EnvoyesPage() {
  const summary = await getMessagingSettingsSummary();

  return (
    <MailboxClient
      mailbox="sent"
      title="Messages envoyés"
      description="Historique des e-mails expédiés."
      isConfigured={summary.imapConfigured}
      initialPage={null}
      initialError={null}
      emptyStateMessage="Aucun e-mail envoyé trouvé."
    />
  );
}
