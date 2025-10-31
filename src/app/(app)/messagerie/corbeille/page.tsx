import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";

export const dynamic = "force-dynamic";

export default async function CorbeillePage() {
  const summary = await getMessagingSettingsSummary();

  return (
    <MailboxClient
      mailbox="trash"
      title="Corbeille"
      description="Messages supprimés récemment."
      isConfigured={summary.imapConfigured}
      initialPage={null}
      initialError={null}
      emptyStateMessage="Aucun message dans la corbeille."
    />
  );
}
