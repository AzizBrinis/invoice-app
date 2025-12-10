import { NextResponse } from "next/server";
import { runAssistantTurn } from "@/server/assistant/orchestrator";
import type { AssistantStreamEvent } from "@/types/assistant";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
