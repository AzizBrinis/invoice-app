import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleWebhook } from "@/server/payments";

export async function POST(request: NextRequest) {
  try {
    const result = await handleWebhook(request);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook invalide.";
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
