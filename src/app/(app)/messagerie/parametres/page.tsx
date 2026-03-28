import { getMessagingSettingsSummary } from "@/server/messaging";
import { getMessagingLocalSyncOverview } from "@/server/messaging-local-sync";
import { getMessagingLocalSyncMetricsSnapshot } from "@/server/messaging-local-sync-ops";
import { listSavedResponses } from "@/server/messaging-responses";
import { ParametersClient } from "@/app/(app)/messagerie/_components/parameters-client";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const [summary, localSyncOverview, localSyncMetrics, savedResponses] = await Promise.all([
    getMessagingSettingsSummary(),
    getMessagingLocalSyncOverview(),
    getMessagingLocalSyncMetricsSnapshot(),
    listSavedResponses(),
  ]);
  return (
    <ParametersClient
      summary={summary}
      localSyncOverview={localSyncOverview}
      localSyncMetrics={localSyncMetrics}
      savedResponses={savedResponses}
    />
  );
}
