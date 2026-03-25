import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppHostnames } from "@/lib/env";
import { generateId } from "@/lib/id";
import { prisma } from "@/lib/prisma";
import { calculateLineTotals } from "@/lib/documents";
import { createConfirmationToken } from "@/lib/confirmation-token";
import { createOrder } from "@/server/orders";
import { getSettings } from "@/server/settings";
import {
  normalizeCatalogDomainInput,
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveEcommerceSettingsFromWebsite,
  resolveCatalogCurrencyCode,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeCatalogDomainInput(entry))
    .filter((entry): entry is string => Boolean(entry)),
);
const MAX_ORDER_ITEMS = 50;

const quantitySchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
  },
  z.number().int().min(1).max(100),
);

const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: quantitySchema,
});

const orderCustomerSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("E-mail invalide"),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(120).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
});

const orderPayloadSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(MAX_ORDER_ITEMS),
  customer: orderCustomerSchema,
  notes: z.string().max(1200).nullable().optional(),
  paymentMethod: z.enum(["card", "bank_transfer", "cash_on_delivery"]).nullable().optional(),
  termsAccepted: z.boolean().optional(),
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  path: z.string().max(180).nullable().optional(),
});

function normalizeOptional(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = orderPayloadSchema.parse(await request.json());
    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const normalizedHost = normalizeCatalogDomainInput(host);
    const isAppHost =
      APP_HOSTS.has(host) ||
      (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
    const domain = isAppHost ? null : normalizedHost;
    const slug = isAppHost ? normalizeCatalogSlugInput(payload.slug) : null;
    if (payload.path && !normalizeCatalogPathInput(payload.path)) {
      throw new Error("Chemin invalide.");
    }
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: payload.mode === "preview",
    });
    if (!website) {
      throw new Error("Site introuvable.");
    }
    if (!website.showPrices) {
      throw new Error(
        "Les tarifs sont masqués pour ce site. Contactez-nous pour finaliser la commande.",
      );
    }
    const ecommerceSettings = resolveEcommerceSettingsFromWebsite(website);
    const checkoutSettings = ecommerceSettings.checkout ?? {};
    const normalizedPhone = normalizeOptional(payload.customer.phone);
    if (checkoutSettings.requirePhone && !normalizedPhone) {
      throw new Error("Téléphone requis pour finaliser la commande.");
    }
    const termsUrl = checkoutSettings.termsUrl?.trim() ?? "";
    if (termsUrl && !payload.termsAccepted) {
      throw new Error("Veuillez accepter les conditions générales.");
    }
    const paymentMethods = ecommerceSettings.payments?.methods ?? {};
    const enabledMethods = [
      paymentMethods.card ? "card" : null,
      paymentMethods.bankTransfer ? "bank_transfer" : null,
      paymentMethods.cashOnDelivery ? "cash_on_delivery" : null,
    ].filter((method): method is NonNullable<typeof method> => Boolean(method));
    const resolvedPaymentMethod =
      payload.paymentMethod && enabledMethods.includes(payload.paymentMethod)
        ? payload.paymentMethod
        : null;
    if (enabledMethods.length > 0) {
      if (!resolvedPaymentMethod) {
        throw new Error("Veuillez sélectionner un mode de paiement.");
      }
    }

    const quantities = new Map<string, number>();
    payload.items.forEach((item) => {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    });
    const productIds = Array.from(quantities.keys());
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        userId: website.userId,
        isActive: true,
        isListedInCatalog: true,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        priceHTCents: true,
        priceTTCCents: true,
        vatRate: true,
        defaultDiscountRate: true,
        saleMode: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new Error("Produit introuvable.");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderItems = productIds.map((productId, index) => {
      const product = productMap.get(productId);
      if (!product) {
        throw new Error("Produit introuvable.");
      }
      if (product.saleMode !== "INSTANT") {
        throw new Error("Ce produit ne peut pas être acheté en ligne.");
      }
      return {
        productId: product.id,
        description: product.name,
        quantity: quantities.get(productId) ?? 1,
        unit: product.unit,
        unitPriceHTCents: product.priceHTCents,
        vatRate: product.vatRate,
        discountRate: product.defaultDiscountRate ?? null,
        position: index,
      };
    });

    const computedLines = orderItems.map((line) =>
      calculateLineTotals({
        quantity: line.quantity,
        unitPriceHTCents: line.unitPriceHTCents,
        vatRate: line.vatRate,
        discountRate: line.discountRate ?? null,
        discountAmountCents: null,
      }),
    );

    const totals = computedLines.reduce(
      (acc, line) => ({
        subtotalHTCents: acc.subtotalHTCents + line.totalHTCents,
        totalDiscountCents: acc.totalDiscountCents + line.discountAmountCents,
        totalTVACents: acc.totalTVACents + line.totalTVACents,
        totalTTCCents: acc.totalTTCCents + line.totalTTCCents,
      }),
      {
        subtotalHTCents: 0,
        totalDiscountCents: 0,
        totalTVACents: 0,
        totalTTCCents: 0,
      },
    );

    const summaryItems = orderItems.map((line, index) => ({
      productId: line.productId,
      title: line.description,
      quantity: line.quantity,
      unitAmountCents: productMap.get(line.productId)?.priceTTCCents ?? null,
      lineTotalCents: computedLines[index]?.totalTTCCents ?? null,
    }));

    const settings = await getSettings(website.userId);
    const currencyCode = resolveCatalogCurrencyCode(
      website,
      settings.defaultCurrency,
    );
    const orderInput = {
      currency: currencyCode,
      customer: {
        name: payload.customer.name.trim(),
        email: payload.customer.email.trim(),
        phone: normalizedPhone,
        company: normalizeOptional(payload.customer.company),
        address: normalizeOptional(payload.customer.address),
      },
      notes: normalizeOptional(payload.notes),
      items: orderItems,
      paymentMethod: resolvedPaymentMethod,
    };

    if (payload.mode === "preview") {
      return NextResponse.json({
        status: "preview-only",
        message: "Mode prévisualisation : aucune commande enregistrée.",
        order: {
          id: null,
          orderNumber: generateId("cmd-preview"),
          currency: currencyCode,
          totalTTCCents: totals.totalTTCCents,
          confirmationToken: null,
          items: summaryItems,
        },
      });
    }

    const created = await createOrder(orderInput, website.userId);
    const confirmationToken = await createConfirmationToken(created.id);
    return NextResponse.json({
      status: "created",
      order: {
        id: created.id,
        orderNumber: created.orderNumber,
        currency: created.currency,
        totalTTCCents: created.totalTTCCents,
        confirmationToken,
        items: summaryItems,
      },
    });
  } catch (error) {
    console.error("[catalogue/orders] create failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de créer la commande.";
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
