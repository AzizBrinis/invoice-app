import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/db/prisma-server";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import {
  getClientFromSessionToken,
  getClientSessionTokenFromCookie,
  signOutClient,
} from "@/lib/client-auth";
import {
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

export const dynamic = "force-dynamic";

const wishlistActionSchema = z.object({
  productId: z.string().min(1),
});

function resolveDomainAndSlug(request: NextRequest) {
  const domain = resolveCatalogDomainFromHeaders(request.headers);
  const slug = domain
    ? null
    : normalizeCatalogSlugInput(request.nextUrl.searchParams.get("slug"));
  return { slug, domain };
}

async function requireClientAndWebsite(
  request: NextRequest,
  t: (text: string) => string,
) {
  const token = await getClientSessionTokenFromCookie();
  if (!token) {
    return { error: t("Please sign in."), status: 401 };
  }

  const client = await getClientFromSessionToken(token);
  if (!client) {
    await signOutClient();
    return { error: t("Please sign in."), status: 401 };
  }
  if (!client.isActive) {
    return { error: t("Account inactive."), status: 403 };
  }

  const { slug, domain } = resolveDomainAndSlug(request);
  const website = await resolveCatalogWebsite({
    slug,
    domain,
    preview: false,
  });
  if (!website) {
    return { error: t("Site unavailable."), status: 404 };
  }
  if (client.userId !== website.userId) {
    return { error: t("Access denied."), status: 403 };
  }

  return { client, website };
}

function getWishlistDelegate() {
  const delegate = (prisma as unknown as { wishlistItem?: unknown }).wishlistItem;
  return delegate ?? null;
}

function isWishlistTableMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

type WishlistDelegate = {
  findMany: (args: {
    where: { userId: string; clientId: string };
    orderBy: { createdAt: "desc" };
  }) => Promise<Array<{ id: string; productId: string; createdAt: Date }>>;
  upsert: (args: {
    where: { userId_clientId_productId: { userId: string; clientId: string; productId: string } };
    update: Record<string, never>;
    create: { userId: string; clientId: string; productId: string };
  }) => Promise<{ id: string }>;
  deleteMany: (args: {
    where: { userId: string; clientId: string; productId: string };
  }) => Promise<{ count: number }>;
};

export async function GET(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  const resolved = await requireClientAndWebsite(request, t);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  try {
    const wishlistDelegate = getWishlistDelegate();
    if (!wishlistDelegate || typeof wishlistDelegate !== "object") {
      console.warn("[catalogue/wishlist] prisma.wishlistItem missing");
      return NextResponse.json(
        { items: [] },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    }

    const items = await (wishlistDelegate as WishlistDelegate).findMany({
      where: {
        userId: resolved.website.userId,
        clientId: resolved.client.id,
      },
      orderBy: { createdAt: "desc" },
    });
    const productIds = items.map((item) => item.productId);
    const products = productIds.length
      ? await prisma.product.findMany({
          where: {
            id: { in: productIds },
            userId: resolved.website.userId,
          },
          select: {
            id: true,
            name: true,
            category: true,
            saleMode: true,
            priceHTCents: true,
            priceTTCCents: true,
            vatRate: true,
            defaultDiscountRate: true,
            defaultDiscountAmountCents: true,
            coverImageUrl: true,
            gallery: true,
            quoteFormSchema: true,
            optionConfig: true,
          },
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product]));

    return NextResponse.json(
      {
        items: items.map((item) => ({
          id: item.id,
          productId: item.productId,
          createdAt: item.createdAt.toISOString(),
          product: productMap.get(item.productId) ?? null,
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (isWishlistTableMissing(error)) {
      console.warn("[catalogue/wishlist] WishlistItem table missing");
      return NextResponse.json(
        { items: [] },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    console.error("[catalogue/wishlist] GET failed", error);
    return NextResponse.json(
      { error: t("Unable to load wishlist.") },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  const resolved = await requireClientAndWebsite(request, t);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  try {
    const wishlistDelegate = getWishlistDelegate();
    if (!wishlistDelegate || typeof wishlistDelegate !== "object") {
      console.warn("[catalogue/wishlist] prisma.wishlistItem missing");
      return NextResponse.json(
        { error: t("Wishlist is not available.") },
        { status: 503 },
      );
    }

    const payload = wishlistActionSchema.parse(await request.json());
    const product = await prisma.product.findFirst({
      where: {
        id: payload.productId,
        userId: resolved.website.userId,
      },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json(
        { error: t("Product not found.") },
        { status: 404 },
      );
    }

    const item = await (wishlistDelegate as WishlistDelegate).upsert({
      where: {
        userId_clientId_productId: {
          userId: resolved.website.userId,
          clientId: resolved.client.id,
          productId: product.id,
        },
      },
      update: {},
      create: {
        userId: resolved.website.userId,
        clientId: resolved.client.id,
        productId: product.id,
      },
    });

    return NextResponse.json({ status: "added", itemId: item.id });
  } catch (error) {
    if (isWishlistTableMissing(error)) {
      console.warn("[catalogue/wishlist] WishlistItem table missing");
      return NextResponse.json(
        { error: t("Wishlist is not available.") },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? t(error.message) : t("Unable to update wishlist.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  const resolved = await requireClientAndWebsite(request, t);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  try {
    const wishlistDelegate = getWishlistDelegate();
    if (!wishlistDelegate || typeof wishlistDelegate !== "object") {
      console.warn("[catalogue/wishlist] prisma.wishlistItem missing");
      return NextResponse.json(
        { error: t("Wishlist is not available.") },
        { status: 503 },
      );
    }

    const payload = wishlistActionSchema.parse(await request.json());
    await (wishlistDelegate as WishlistDelegate).deleteMany({
      where: {
        userId: resolved.website.userId,
        clientId: resolved.client.id,
        productId: payload.productId,
      },
    });

    return NextResponse.json({ status: "removed" });
  } catch (error) {
    if (isWishlistTableMissing(error)) {
      console.warn("[catalogue/wishlist] WishlistItem table missing");
      return NextResponse.json(
        { error: t("Wishlist is not available.") },
        { status: 503 },
      );
    }
    const message =
      error instanceof Error ? t(error.message) : t("Unable to update wishlist.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
