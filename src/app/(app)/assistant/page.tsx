import { requireUser } from "@/lib/auth";
import {
  ensureConversation,
  loadConversationMessagesPage,
} from "@/server/assistant/conversations";
import { getUsageSummary } from "@/server/assistant/usage";
import { getActivePendingToolCall } from "@/server/assistant/pending-tools";
import { AssistantClient } from "@/app/(app)/assistant/assistant-client";
import type { AssistantContextSummary } from "@/types/assistant";

type SearchParams = {
  conversationId?: string;
};

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const conversation = await ensureConversation(
    user.id,
    resolvedSearchParams.conversationId,
  );
  const [messagePage, usage, pendingConfirmation] = await Promise.all([
    loadConversationMessagesPage({
      userId: user.id,
      conversationId: conversation.id,
    }),
    getUsageSummary(user.id),
    getActivePendingToolCall({
      userId: user.id,
      conversationId: conversation.id,
    }),
  ]);

  const quickContext: AssistantContextSummary | null = null;

  return (
    <AssistantClient
      initialConversationId={conversation.id}
      initialMessages={messagePage.messages}
      initialHasMore={messagePage.hasMore}
      initialCursor={messagePage.cursor}
      usage={usage}
      context={quickContext}
      initialPendingConfirmation={pendingConfirmation}
    />
  );
}
