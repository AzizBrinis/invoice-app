import { getMessagingSettingsSummary } from "@/server/messaging";
import { ParametersClient } from "@/app/(app)/messagerie/_components/parameters-client";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const summary = await getMessagingSettingsSummary();
  return <ParametersClient summary={summary} />;
}
