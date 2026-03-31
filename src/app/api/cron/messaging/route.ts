import { after, NextResponse } from "next/server";
import {
  processMessagingCronQueue,
  runAllMessagingCronTick,
  runMessagingCronTick,
  scheduleMessagingCronTick,
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

  if (scope === "local-sync") {
    const scheduled = await scheduleMessagingCronTick(new Date(), scope);
    after(async () => {
      try {
        const queue = await processMessagingCronQueue(scope);
        logCronSummary({
          ...scheduled,
          queue,
        });
      } catch (error) {
        console.error("[cron] Messagerie local-sync deferred processing failed", {
          scope,
          error,
        });
      }
    });

    const accepted = {
      ...scheduled,
      processing: "deferred" as const,
      queue: {
        processed: 0,
        completed: 0,
        failed: 0,
        retried: 0,
        skipped: 0,
        details: [],
        deferred: true,
      },
    };
    console.info("[cron] Messagerie local-sync scheduled", accepted);
    return NextResponse.json(accepted, { status: 202 });
  }

  const summary =
    scope === "all"
      ? await runAllMessagingCronTick(new Date())
      : await runMessagingCronTick(new Date());
  logCronSummary(summary);
  return NextResponse.json(summary);
}

export const POST = GET;

function logCronSummary(summary: {
  scope: MessagingCronScope;
  queue: {
    failed: number;
    retried: number;
    details: Array<{
      status: "success" | "failed" | "retry" | "skipped";
    }>;
  };
}) {
  if (summary.queue.failed > 0) {
    console.error("[cron] Messagerie queue failures", {
      scope: summary.scope,
      failed: summary.queue.failed,
      details: summary.queue.details.filter((detail) => detail.status === "failed"),
    });
  } else if (summary.queue.retried > 0) {
    console.warn("[cron] Messagerie queue retries", {
      scope: summary.scope,
      retried: summary.queue.retried,
      details: summary.queue.details.filter((detail) => detail.status === "retry"),
    });
  }

  console.info("[cron] Messagerie", summary);
}

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
