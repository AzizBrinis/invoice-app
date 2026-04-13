import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createClientSession,
  getCatalogClientProfileById,
} from "@/lib/client-auth";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { authenticateWebsiteLogin } from "@/server/website-login";

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

    const result = await authenticateWebsiteLogin({
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
      error instanceof Error ? t(error.message) : t("Unable to sign in.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
