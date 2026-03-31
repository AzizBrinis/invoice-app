import { NextResponse } from "next/server";
import {
  runAllMessagingCronTick,
  runMessagingCronTick,
  runMessagingLocalSyncCronTick,
  type MessagingCronScope,
} from "@/server/messaging-jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const scope = resolveScope(request);
  if (!scope) {
    return new NextResponse("Invalid cron scope", { status: 400 });
  }

  const summary =
    scope === "local-sync"
      ? await runMessagingLocalSyncCronTick()
      : scope === "all"
        ? await runAllMessagingCronTick()
        : await runMessagingCronTick();

  if (summary.queue.failed > 0) {
    console.error("[cron] Messagerie queue failures", {
      scope,
      failed: summary.queue.failed,
      details: summary.queue.details.filter((detail) => detail.status === "failed"),
    });
  } else if (summary.queue.retried > 0) {
    console.warn("[cron] Messagerie queue retries", {
      scope,
      retried: summary.queue.retried,
      details: summary.queue.details.filter((detail) => detail.status === "retry"),
    });
  }

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

function resolveScope(request: Request): MessagingCronScope | null {
  const headerScope = request.headers.get("x-cron-scope");
  const scope = headerScope?.trim() || new URL(request.url).searchParams.get("scope")?.trim() || "email";

  if (scope === "email" || scope === "local-sync" || scope === "all") {
    return scope;
  }
  return null;
}
