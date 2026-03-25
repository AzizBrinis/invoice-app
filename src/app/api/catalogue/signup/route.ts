import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAppHostnames } from "@/lib/env";
import { createClientSession } from "@/lib/client-auth";
import { registerWebsiteSignup } from "@/server/website-signup";

const APP_HOSTS = new Set(getAppHostnames().map((host) => host.toLowerCase()));

function normalizeHost(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    return new URL(`https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeHost(entry))
    .filter((entry): entry is string => Boolean(entry)),
);

function resolveRequestHost(request: NextRequest) {
  const forwarded =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  return forwarded.split(",")[0]?.trim().toLowerCase() ?? "";
}

function resolveDomainFromHost(host: string) {
  if (!host) return null;
  const normalizedHost = normalizeHost(host);
  const isAppHost =
    APP_HOSTS.has(host) ||
    (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
  if (isAppHost) return null;
  return normalizedHost ?? host;
}

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
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const formData = await request.formData();
      payload = formDataToObject(formData);
    }

    const host = resolveRequestHost(request);
    const domain = resolveDomainFromHost(host);
    const email = typeof payload.email === "string" ? payload.email : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip")?.trim() ??
      null;

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

    if (result.clientId && result.status !== "preview-only") {
      await createClientSession(result.clientId);
    }

    const { clientId: _clientId, ...responsePayload } = result;
    void _clientId;

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
