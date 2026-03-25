import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { loadConversationMessagesPage } from "@/server/assistant/conversations";

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
