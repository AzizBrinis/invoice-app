import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppHostnames } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { parseConfirmationToken } from "@/lib/confirmation-token";
import {
  normalizeCatalogDomainInput,
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeCatalogDomainInput(entry))
    .filter((entry): entry is string => Boolean(entry)),
);

const paramsSchema = z.object({
  id: z.string().min(1),
});

const querySchema = z.object({
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  token: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const query = querySchema.parse({
      slug: request.nextUrl.searchParams.get("slug"),
      mode: request.nextUrl.searchParams.get("mode") ?? "public",
      token: request.nextUrl.searchParams.get("token"),
    });
    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const normalizedHost = normalizeCatalogDomainInput(host);
    const isAppHost =
      APP_HOSTS.has(host) ||
      (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
    const domain = isAppHost ? null : normalizedHost;
    const slug = isAppHost ? normalizeCatalogSlugInput(query.slug) : null;
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: query.mode === "preview",
    });
    if (!website) {
      throw new Error("Site introuvable.");
    }

    const tokenPayload = await parseConfirmationToken(query.token);
    if (!tokenPayload || tokenPayload.orderId !== id) {
      throw new Error("Confirmation invalide.");
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId: website.userId,
      },
      select: {
        id: true,
        orderNumber: true,
        currency: true,
        totalTTCCents: true,
        items: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            productId: true,
            description: true,
            quantity: true,
            totalTTCCents: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Commande introuvable.");
    }

    const summaryItems = order.items.map((item) => ({
      productId: item.productId ?? item.id,
      title: item.description,
      quantity: item.quantity,
      unitAmountCents:
        Number.isFinite(item.quantity) && item.quantity > 0
          ? Math.round(item.totalTTCCents / item.quantity)
          : null,
      lineTotalCents: item.totalTTCCents,
    }));

    return NextResponse.json({
      status: "summary",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        currency: order.currency,
        totalTTCCents: order.totalTTCCents,
        items: summaryItems,
      },
    });
  } catch (error) {
    console.error("[catalogue/orders] summary failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de récupérer la commande.";
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
