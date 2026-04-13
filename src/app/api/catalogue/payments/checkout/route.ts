import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { createCheckoutSession } from "@/server/payments";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import {
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const PROVIDER_KEYS = ["stub", "stripe"] as const;

const checkoutPayloadSchema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(PROVIDER_KEYS).optional(),
  method: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  path: z.string().max(180).nullable().optional(),
  successUrl: z.string().min(1),
  cancelUrl: z.string().min(1),
});

function resolveReturnUrl(value: string, request: NextRequest) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Invalid return URL.");
  }
  const base = new URL(request.url);
  const resolved = new URL(trimmed, `${base.protocol}//${base.host}`);
  if (resolved.host !== base.host) {
    throw new Error("Invalid return URL.");
  }
  return resolved.toString();
}

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  try {
    const payload = checkoutPayloadSchema.parse(await request.json());
    if (payload.mode === "preview") {
      throw new Error("Payment is unavailable in preview mode.");
    }
    if (payload.method && payload.method !== "card") {
      throw new Error("Select a valid payment method.");
    }
    if (payload.path && !normalizeCatalogPathInput(payload.path)) {
      throw new Error("Invalid path.");
    }

    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const slug = domain ? null : normalizeCatalogSlugInput(payload.slug);

    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: false,
    });
    if (!website) {
      throw new Error("Site unavailable.");
    }

    const successUrl = resolveReturnUrl(payload.successUrl, request);
    const cancelUrl = resolveReturnUrl(payload.cancelUrl, request);

    const session = await createCheckoutSession(
      {
        orderId: payload.orderId,
        provider: payload.provider,
        method: payload.method ?? null,
        metadata: payload.metadata ?? null,
        successUrl,
        cancelUrl,
      },
      website.userId,
    );

    return NextResponse.json({
      status: "created",
      checkoutUrl: session.checkoutUrl,
      paymentId: session.paymentId,
      provider: session.provider,
      externalReference: session.externalReference,
    });
  } catch (error) {
    console.error("[catalogue/payments] checkout failed", error);
    const message =
      error instanceof Error
        ? t(error.message)
        : t("Unable to create the payment session.");
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
