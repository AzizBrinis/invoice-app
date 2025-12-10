import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadConversationMessagesPage } from "@/server/assistant/conversations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "Conversation requise." },
      { status: 400 },
    );
  }
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit =
    limitParam && !Number.isNaN(Number(limitParam))
      ? Number(limitParam)
      : undefined;

  const page = await loadConversationMessagesPage({
    userId: user.id,
    conversationId,
    cursor: cursor || undefined,
    limit,
  });

  return NextResponse.json(page);
}
