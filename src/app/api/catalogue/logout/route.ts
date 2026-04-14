import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  assertSameOriginMutationRequest,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import { signOutClient } from "@/lib/client-auth";

export async function POST(request: NextRequest) {
  try {
    assertSameOriginMutationRequest(request.headers, "Invalid request origin.");
    await signOutClient();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json({ error: "Unable to sign out." }, init);
  }
}
