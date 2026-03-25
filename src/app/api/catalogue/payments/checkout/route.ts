import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppHostnames } from "@/lib/env";
import { createCheckoutSession } from "@/server/payments";
import {
  normalizeCatalogDomainInput,
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeCatalogDomainInput(entry))
    .filter((entry): entry is string => Boolean(entry)),
);

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
    throw new Error("URL de retour invalide.");
  }
  const base = new URL(request.url);
  const resolved = new URL(trimmed, `${base.protocol}//${base.host}`);
  if (resolved.host !== base.host) {
    throw new Error("URL de retour invalide.");
  }
  return resolved.toString();
}

export async function POST(request: NextRequest) {
  try {
    const payload = checkoutPayloadSchema.parse(await request.json());
    if (payload.mode === "preview") {
      throw new Error("Le paiement est indisponible en prévisualisation.");
    }
    if (payload.method && payload.method !== "card") {
      throw new Error("Mode de paiement invalide.");
    }
    if (payload.path && !normalizeCatalogPathInput(payload.path)) {
      throw new Error("Chemin invalide.");
    }

    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const normalizedHost = normalizeCatalogDomainInput(host);
    const isAppHost =
      APP_HOSTS.has(host) ||
      (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
    const domain = isAppHost ? null : normalizedHost;
    const slug = isAppHost ? normalizeCatalogSlugInput(payload.slug) : null;

    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: false,
    });
    if (!website) {
      throw new Error("Site introuvable.");
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
        ? error.message
        : "Impossible de créer la session de paiement.";
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
