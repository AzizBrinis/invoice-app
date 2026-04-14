import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createClientSession,
  getCatalogClientProfileById,
} from "@/lib/client-auth";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import {
  assertSameOriginMutationRequest,
  buildPublicRateLimitKey,
  enforceRateLimit,
  getClientIpFromHeaders,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { registerWebsiteSignup } from "@/server/website-signup";

function formDataToObject(formData: FormData) {
  const entries: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") {
      entries[key] = value;
    }
  });
  return entries;
}

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  try {
    assertSameOriginMutationRequest(request.headers, "Invalid request origin.");
    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const formData = await request.formData();
      payload = formDataToObject(formData);
    }

    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const email = typeof payload.email === "string" ? payload.email : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const normalizedEmail = email.trim().toLowerCase();
    enforceRateLimit({
      key: buildPublicRateLimitKey({
        scope: "catalogue-signup",
        headers: request.headers,
        parts: [normalizedEmail || "anonymous"],
      }),
      limit: 5,
      windowMs: 30 * 60 * 1000,
      message: "Too many account creation attempts. Please wait before trying again.",
    });

    const ipAddress = getClientIpFromHeaders(request.headers);

    const result = await registerWebsiteSignup({
      intent: "password",
      email,
      password,
      slug:
        payload.slug && String(payload.slug).length > 0
          ? String(payload.slug)
          : null,
      domain,
      path:
        payload.path && String(payload.path).length > 0
          ? String(payload.path)
          : request.nextUrl.searchParams.get("path"),
      mode:
        typeof payload.mode === "string" && payload.mode === "preview"
          ? "preview"
          : "public",
      ip: ipAddress,
      userAgent: request.headers.get("user-agent"),
    });

    let profile = null;
    if (result.clientId && result.status !== "preview-only") {
      await createClientSession(result.clientId);
      profile = await getCatalogClientProfileById(result.clientId);
    }

    const { clientId: _clientId, ...responsePayload } = result;
    void _clientId;

    return NextResponse.json({
      ...responsePayload,
      profile,
      message: responsePayload.message ? t(responsePayload.message) : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? t(error.message)
        : t("Unable to create account.");
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json({ error: message }, init);
  }
}
