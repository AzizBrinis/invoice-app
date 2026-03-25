import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxClient } from "@/app/(app)/messagerie/_components/mailbox-client";
import {
  loadInitialMailboxData,
  loadInitialMailboxSearchData,
} from "@/app/(app)/messagerie/load-initial-mailbox-data";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function RecusPage({
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
      mailbox: "inbox",
      query: rawQuery,
      enabled: summary.imapConfigured,
      fallbackError: "Erreur lors de la recherche dans les messages reçus.",
    });
  const { initialPage, initialError } = initialSearchPage
    ? { initialPage: null, initialError: null }
    : await loadInitialMailboxData({
        mailbox: "inbox",
        enabled: summary.imapConfigured,
        fallbackError: "Erreur lors du chargement des messages reçus.",
      });

  return (
    <MailboxClient
      mailbox="inbox"
      title="Boîte de réception"
      description="Consultez les messages reçus les plus récents."
      isConfigured={summary.imapConfigured}
      initialPage={initialPage}
      initialError={initialError}
      initialSearchPage={initialSearchPage}
      initialSearchError={initialSearchError}
      initialSearchQuery={initialSearchQuery}
      emptyStateMessage="Aucun message récent trouvé pour le moment."
    />
  );
}
