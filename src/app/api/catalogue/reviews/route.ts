import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import {
  assertSameOriginMutationRequest,
  buildPublicRateLimitKey,
  enforceRateLimit,
  getClientIpFromHeaders,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { createPublicProductReview } from "@/server/product-reviews";

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  try {
    assertSameOriginMutationRequest(request.headers, "Invalid request origin.");
    const payload = (await request.json()) as Record<string, unknown>;
    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const email =
      typeof payload.authorEmail === "string"
        ? payload.authorEmail.trim().toLowerCase()
        : "";
    const productId =
      typeof payload.productId === "string" ? payload.productId : "unknown";

    enforceRateLimit({
      key: buildPublicRateLimitKey({
        scope: "catalogue-reviews",
        headers: request.headers,
        parts: [productId, email || "anonymous"],
      }),
      limit: 4,
      windowMs: 15 * 60 * 1000,
      message: "Too many review attempts. Please wait before trying again.",
    });

    const mode =
      typeof payload.mode === "string" && payload.mode === "preview"
        ? "preview"
        : "public";
    const record = await createPublicProductReview({
      productId: String(payload.productId ?? ""),
      rating: payload.rating,
      title:
        typeof payload.title === "string" && payload.title.length > 0
          ? payload.title
          : null,
      body: String(payload.body ?? ""),
      authorName:
        typeof payload.authorName === "string" && payload.authorName.length > 0
          ? payload.authorName
          : null,
      authorEmail:
        typeof payload.authorEmail === "string" && payload.authorEmail.length > 0
          ? payload.authorEmail
          : null,
      slug:
        typeof payload.slug === "string" && payload.slug.length > 0
          ? payload.slug
          : null,
      domain,
      path:
        typeof payload.path === "string" && payload.path.length > 0
          ? payload.path
          : request.nextUrl.searchParams.get("path"),
      honeypot:
        typeof payload.website === "string" && payload.website.length > 0
          ? payload.website
          : undefined,
      mode,
      ip: getClientIpFromHeaders(request.headers),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      status: record.status,
      message:
        record.status === "preview-only"
          ? t("Preview mode: no review is saved.")
          : t("Thanks! Your review is awaiting moderation."),
    });
  } catch (error) {
    console.error("[catalogue/reviews] create failed", error);
    const message =
      error instanceof Error ? t(error.message) : t("Unable to submit your review.");
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json({ error: message }, init);
  }
}
