import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAppHostnames } from "@/lib/env";
import { recordContactMessage } from "@/server/contact-messages";

const APP_HOSTS = new Set(getAppHostnames());

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
    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const domain = APP_HOSTS.has(host) ? null : host;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip")?.trim() ??
      null;
    const mode =
      typeof payload.mode === "string" && payload.mode === "preview"
        ? "preview"
        : "public";

    const record = await recordContactMessage({
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      message: String(payload.message ?? ""),
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
          ? "Preview mode: no data is saved."
          : "Thanks! Your message has been sent.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to send your message.";
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
