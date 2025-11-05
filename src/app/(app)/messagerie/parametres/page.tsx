import { getMessagingSettingsSummary } from "@/server/messaging";
import { listSavedResponses } from "@/server/messaging-responses";
import { ParametersClient } from "@/app/(app)/messagerie/_components/parameters-client";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const summary = await getMessagingSettingsSummary();
  const savedResponses = await listSavedResponses();
  return <ParametersClient summary={summary} savedResponses={savedResponses} />;
}
