import { NextResponse } from "next/server";
import { runMessagingCronTick } from "@/server/messaging-jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const summary = await runMessagingCronTick();
  console.info("[cron] Messagerie", summary);
  return NextResponse.json(summary);
}

export const POST = GET;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET_TOKEN;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const provided = extractToken(request);
  return provided === secret;
}

function extractToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("x-cron-secret");
  if (header) {
    const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
    return bearerMatch ? bearerMatch[1]?.trim() ?? null : header.trim();
  }
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  return queryToken ? queryToken.trim() : null;
}
