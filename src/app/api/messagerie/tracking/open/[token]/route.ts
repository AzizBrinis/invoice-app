import { NextRequest, NextResponse } from "next/server";
import { recordOpenEvent } from "@/server/email-tracking";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { extractSignedToken } from "@/lib/session-cookie";

const TRANSPARENT_PIXEL: Uint8Array = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5nJioAAAAASUVORK5CYII=",
  "base64",
);
const CSS_PROBE: Uint8Array = Buffer.from("/* email tracking css probe */", "utf8");
const IMPORT_PROBE: Uint8Array = Buffer.from(
  "@media all {.et-import-probe{display:none !important;background:url('about:blank') no-repeat;}}",
  "utf8",
);
const FONT_PROBE: Uint8Array = Buffer.from("E", "utf8");

type VariantPayload = {
  body: Uint8Array;
  contentType: string;
};

type RouteParams = { token: string };

const VARIANT_PAYLOADS: Record<string, VariantPayload> = {
  img: { body: TRANSPARENT_PIXEL, contentType: "image/png" },
  fallback: { body: TRANSPARENT_PIXEL, contentType: "image/png" },
  bg: { body: TRANSPARENT_PIXEL, contentType: "image/png" },
  noscript: { body: TRANSPARENT_PIXEL, contentType: "image/png" },
  table: { body: TRANSPARENT_PIXEL, contentType: "image/png" },
  mso: { body: TRANSPARENT_PIXEL, contentType: "image/png" },
  css: { body: CSS_PROBE, contentType: "text/css" },
  font: { body: FONT_PROBE, contentType: "font/woff2" },
  import: { body: IMPORT_PROBE, contentType: "text/css" },
};

function getVariantPayload(variantParam: string | null): VariantPayload {
  const normalized = (variantParam ?? "").toLowerCase();
  return VARIANT_PAYLOADS[normalized] ?? VARIANT_PAYLOADS.img;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeToken(raw: string | string[] | undefined): string | null {
  if (!raw || Array.isArray(raw)) {
    return null;
  }
  return raw.replace(/\.png$/i, "").trim() || null;
}

async function resolveViewerContext(request: NextRequest): Promise<{
  sessionToken: string | null;
  userId: string | null;
}> {
  try {
    const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
    if (!rawCookie) {
      return { sessionToken: null, userId: null };
    }
    const sessionToken = await extractSignedToken(rawCookie);
    if (!sessionToken) {
      return { sessionToken: null, userId: null };
    }
    const user = await getUserFromSessionToken(sessionToken);
    return { sessionToken, userId: user?.id ?? null };
  } catch (error) {
    console.warn("[email-tracking] unable to resolve viewer context", error);
    return { sessionToken: null, userId: null };
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  let rawToken: string | null = null;
  try {
    const params = await context.params;
    rawToken = params.token ?? null;
  } catch (error) {
    console.warn("[email-tracking] unable to resolve token params", error);
  }
  const token = sanitizeToken(rawToken ?? undefined);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const variant = new URL(request.url).searchParams.get("variant");
  const payload = getVariantPayload(variant);
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
      const viewerContext = await resolveViewerContext(request);
      await recordOpenEvent({
        token,
        userAgent: request.headers.get("user-agent"),
        ipAddress: ip,
        sessionToken: viewerContext.sessionToken,
        viewerUserId: viewerContext.userId,
      });
    } catch (error) {
      console.warn("Suivi d'ouverture impossible:", error);
    }
  }

  return new NextResponse(toArrayBuffer(payload.body), {
    status: 200,
    headers: {
      "Content-Type": payload.contentType,
      "Content-Length": String(payload.body.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  let rawToken: string | null = null;
  try {
    const params = await context.params;
    rawToken = params.token ?? null;
  } catch (error) {
    console.warn("[email-tracking] unable to resolve token params (HEAD)", error);
  }
  const token = sanitizeToken(rawToken ?? undefined);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const variant = new URL(request.url).searchParams.get("variant");
  const payload = getVariantPayload(variant);
  console.log("[email-tracking] open HEAD", {
    token: token ?? null,
    originalToken: rawToken,
    url: request.url,
    userAgent: request.headers.get("user-agent") ?? null,
    forwardedFor: request.headers.get("x-forwarded-for") ?? null,
    variant: variant ?? null,
  });
  if (token) {
    try {
      const viewerContext = await resolveViewerContext(request);
      await recordOpenEvent({
        token,
        userAgent: request.headers.get("user-agent"),
        ipAddress: ip,
        sessionToken: viewerContext.sessionToken,
        viewerUserId: viewerContext.userId,
      });
    } catch (error) {
      console.warn("Suivi d'ouverture impossible (HEAD):", error);
    }
  }
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": payload.contentType,
      "Content-Length": String(payload.body.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
