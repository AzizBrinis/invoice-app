import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";

export const dynamic = "force-dynamic";

export default async function SpamPage() {
  const summary = await getMessagingSettingsSummary();

  return (
    <MailboxClient
      mailbox="spam"
      title="Spam"
      description="Messages signalés comme indésirables."
      isConfigured={summary.imapConfigured}
      initialPage={null}
      initialError={null}
      emptyStateMessage="Aucun message indésirable détecté."
    />
  );
}
