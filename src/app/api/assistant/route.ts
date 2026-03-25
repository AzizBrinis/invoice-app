import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { runAssistantTurn } from "@/server/assistant/orchestrator";
import type { AssistantStreamEvent } from "@/types/assistant";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
  const payload = await request.json();
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: AssistantStreamEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };
      runAssistantTurn(payload, send)
        .catch((error) => {
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Assistant indisponible.",
          });
        })
        .finally(() => {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        });
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
