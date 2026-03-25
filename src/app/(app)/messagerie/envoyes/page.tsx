import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";
import {
  loadInitialMailboxData,
  loadInitialMailboxSearchData,
} from "@/app/(app)/messagerie/load-initial-mailbox-data";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function EnvoyesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const summary = await getMessagingSettingsSummary();
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawQuery =
    typeof resolvedSearchParams.q === "string"
      ? resolvedSearchParams.q
      : Array.isArray(resolvedSearchParams.q)
        ? resolvedSearchParams.q[0]
        : "";
  const { initialSearchPage, initialSearchError, initialSearchQuery } =
    await loadInitialMailboxSearchData({
      mailbox: "sent",
      query: rawQuery,
      enabled: summary.imapConfigured,
      fallbackError:
        "Erreur lors de la recherche dans les messages envoyés.",
    });
  const { initialPage, initialError } = initialSearchPage
    ? { initialPage: null, initialError: null }
    : await loadInitialMailboxData({
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
      initialSearchPage={initialSearchPage}
      initialSearchError={initialSearchError}
      initialSearchQuery={initialSearchQuery}
      emptyStateMessage="Aucun e-mail envoyé trouvé."
    />
  );
}
