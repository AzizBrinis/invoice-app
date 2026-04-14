import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import { parseConfirmationToken } from "@/lib/confirmation-token";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import {
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

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
  const { t } = createCisecoRequestTranslator(request);
  try {
    const { id } = paramsSchema.parse(await context.params);
    const query = querySchema.parse({
      slug: request.nextUrl.searchParams.get("slug"),
      mode: request.nextUrl.searchParams.get("mode") ?? "public",
      token: request.nextUrl.searchParams.get("token"),
    });
    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const slug = domain ? null : normalizeCatalogSlugInput(query.slug);
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: query.mode === "preview",
    });
    if (!website) {
      throw new Error("Site unavailable.");
    }

    const tokenPayload = await parseConfirmationToken(query.token, {
      orderId: id,
    });
    if (!tokenPayload) {
      throw new Error("Invalid confirmation.");
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId: website.userId,
      },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        currency: true,
        paymentStatus: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        customerCompany: true,
        customerAddress: true,
        subtotalHTCents: true,
        totalDiscountCents: true,
        totalTVACents: true,
        totalTTCCents: true,
        items: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            productId: true,
            description: true,
            quantity: true,
            totalTTCCents: true,
            product: {
              select: {
                name: true,
                coverImageUrl: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            method: true,
            status: true,
            proofStatus: true,
            proofUploadedAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found.");
    }

    const summaryItems = order.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? item.id,
      title: item.description,
      quantity: item.quantity,
      image: item.product?.coverImageUrl ?? null,
      productName: item.product?.name ?? null,
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
        createdAt: order.createdAt,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.payments[0]?.method ?? null,
        paymentProofStatus: order.payments[0]?.proofStatus ?? null,
        paymentProofUploadedAt: order.payments[0]?.proofUploadedAt ?? null,
        customer: {
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
          company: order.customerCompany,
          address: order.customerAddress,
        },
        subtotalHTCents: order.subtotalHTCents,
        totalDiscountCents: order.totalDiscountCents,
        totalTVACents: order.totalTVACents,
        totalTTCCents: order.totalTTCCents,
        items: summaryItems,
      },
    });
  } catch (error) {
    console.error("[catalogue/orders] summary failed", error);
    const message =
      error instanceof Error ? t(error.message) : t("Unable to fetch order.");
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
