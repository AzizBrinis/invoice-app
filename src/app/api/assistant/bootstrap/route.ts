import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import {
  ensureConversation,
  loadConversationMessagesPage,
} from "@/server/assistant/conversations";
import { getUsageSummary } from "@/server/assistant/usage";
import { getActivePendingToolCall } from "@/server/assistant/pending-tools";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }
  try {
    ensureCanAccessAppSection(user, "assistant");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
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
