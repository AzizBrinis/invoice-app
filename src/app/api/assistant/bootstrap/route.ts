import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  ensureConversation,
  loadConversationMessagesPage,
} from "@/server/assistant/conversations";
import { getUsageSummary } from "@/server/assistant/usage";
import { getActivePendingToolCall } from "@/server/assistant/pending-tools";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId") ?? undefined;
  const conversation = await ensureConversation(user.id, conversationId);

  const [page, usage, pendingConfirmation] = await Promise.all([
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

  return NextResponse.json({
    conversationId: conversation.id,
    messages: page.messages,
    hasMore: page.hasMore,
    cursor: page.cursor,
    usage,
    context: null,
    pendingConfirmation,
  });
}
