import { NextRequest, NextResponse } from "next/server";
import { recordClickEvent } from "@/server/email-tracking";
type RouteParams = { token: string };

function sanitizeToken(raw: string | string[] | undefined): string | null {
  if (!raw || Array.isArray(raw)) {
    return null;
  }
  return raw.trim() || null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  let rawToken: string | null = null;
  try {
    const params = await context.params;
    rawToken = params.token ?? null;
  } catch (error) {
    console.warn("[email-tracking] unable to resolve click token params", error);
  }
  const token = sanitizeToken(rawToken ?? undefined);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  console.log("[email-tracking] click hit", {
    token: token ?? null,
    originalToken: rawToken,
    url: request.url,
    userAgent: request.headers.get("user-agent") ?? null,
    via: request.headers.get("via") ?? null,
    forwardedFor: request.headers.get("x-forwarded-for") ?? null,
  });
  let targetUrl: string | null = null;

  if (token) {
    try {
      const result = await recordClickEvent({
        token,
        userAgent: request.headers.get("user-agent"),
        ipAddress: ip,
      });
      targetUrl = result?.url ?? null;
    } catch (error) {
      console.warn("Suivi de clic impossible:", error);
    }
  }

  if (!targetUrl) {
    targetUrl = new URL("/", request.url).toString();
  }

  return NextResponse.redirect(targetUrl, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
