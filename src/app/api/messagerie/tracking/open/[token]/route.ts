import { NextRequest, NextResponse } from "next/server";
import { recordOpenEvent } from "@/server/email-tracking";

const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5nJioAAAAASUVORK5CYII=",
  "base64",
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeToken(raw: string | string[] | undefined): string | null {
  if (!raw || Array.isArray(raw)) {
    return null;
  }
  return raw.replace(/\.png$/i, "").trim() || null;
}

export async function GET(
  request: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> },
) {
  let rawToken: string | null = null;
  try {
    const params = await Promise.resolve(context.params);
    rawToken = params?.token ?? null;
  } catch (error) {
    console.warn("[email-tracking] unable to resolve token params", error);
  }
  const token = sanitizeToken(rawToken ?? undefined);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  console.log("[email-tracking] open hit", {
    token: token ?? null,
    originalToken: rawToken,
    url: request.url,
    userAgent: request.headers.get("user-agent") ?? null,
    via: request.headers.get("via") ?? null,
    forwardedFor: request.headers.get("x-forwarded-for") ?? null,
  });
  if (token) {
    try {
      await recordOpenEvent({
        token,
        userAgent: request.headers.get("user-agent"),
        ipAddress: ip,
      });
    } catch (error) {
      console.warn("Suivi d'ouverture impossible:", error);
    }
  }

  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRANSPARENT_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> },
) {
  let rawToken: string | null = null;
  try {
    const params = await Promise.resolve(context.params);
    rawToken = params?.token ?? null;
  } catch (error) {
    console.warn("[email-tracking] unable to resolve token params (HEAD)", error);
  }
  const sanitized = sanitizeToken(rawToken ?? undefined);
  console.log("[email-tracking] open HEAD", {
    token: sanitized ?? null,
    originalToken: rawToken,
    url: request.url,
    userAgent: request.headers.get("user-agent") ?? null,
    forwardedFor: request.headers.get("x-forwarded-for") ?? null,
  });
  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRANSPARENT_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
