import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recordWebsiteLead } from "@/server/website";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import {
  assertSameOriginMutationRequest,
  buildPublicRateLimitKey,
  enforceRateLimit,
  getClientIpFromHeaders,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";

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
    const email =
      typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    enforceRateLimit({
      key: buildPublicRateLimitKey({
        scope: "catalogue-leads",
        headers: request.headers,
        parts: [email || "anonymous"],
      }),
      limit: 5,
      windowMs: 10 * 60 * 1000,
      message: "Too many lead requests. Please wait before trying again.",
    });
    const ipAddress = getClientIpFromHeaders(request.headers);
    const mode =
      typeof payload.mode === "string" && payload.mode === "preview"
        ? "preview"
        : "public";
    const record = await recordWebsiteLead({
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      phone:
        payload.phone && String(payload.phone).length > 0
          ? String(payload.phone)
          : null,
      company:
        payload.company && String(payload.company).length > 0
          ? String(payload.company)
          : null,
      needs: String(payload.needs ?? ""),
      slug:
        payload.slug && String(payload.slug).length > 0
          ? String(payload.slug)
          : null,
      domain,
      path:
        payload.path && String(payload.path).length > 0
          ? String(payload.path)
          : request.nextUrl.searchParams.get("path"),
      honeypot:
        payload.website &&
        typeof payload.website === "string" &&
        payload.website.length > 0
          ? String(payload.website)
          : undefined,
      mode,
      ip: ipAddress,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({
      status: record.status,
      message:
        record.status === "preview-only"
          ? t("Preview mode: no data is saved.")
          : t(record.thanks ?? "Thank you! Your request has been forwarded to the team."),
    });
  } catch (error) {
    const message =
      error instanceof Error ? t(error.message) : t("Unable to save the request.");
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json(
      { error: message },
      init,
    );
  }
}
