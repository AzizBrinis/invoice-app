import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import { calculateLineTotals } from "@/lib/documents";
import { createConfirmationToken } from "@/lib/confirmation-token";
import {
  assertSameOriginMutationRequest,
  buildPublicRateLimitKey,
  enforceRateLimit,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import {
  getClientFromSessionToken,
  getClientSessionTokenFromCookie,
} from "@/lib/client-auth";
import {
  calculateSelectedOptionAdjustmentCents,
  formatSelectedOptionsSummary,
  type ProductOptionSelection,
} from "@/lib/product-options";
import {
  computeAdjustedUnitPriceHTCents,
  resolveProductDiscount,
  resolveLineDiscountInput,
} from "@/lib/product-pricing";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { createOrder } from "@/server/orders";
import { getSettings } from "@/server/settings";
import {
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveEcommerceSettingsFromWebsite,
  resolveCatalogCurrencyCode,
  resolveCatalogWebsite,
} from "@/server/website";
import {
  listCatalogClientOrders,
  requireCatalogClientContext,
} from "@/server/catalogue-orders";
import { generateOrderNumberCandidate } from "@/server/order-numbers";
import { OrderStatus } from "@/lib/db/prisma-server";

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
  selectedOptions: z
    .array(
      z.object({
        kind: z.enum(["color", "size", "custom"]).nullable().optional(),
        groupId: z.string().max(120).nullable().optional(),
        valueId: z.string().max(120).nullable().optional(),
        name: z.string().min(1).max(80),
        value: z.string().min(1).max(120),
        priceAdjustmentCents: z.number().int().nullable().optional(),
      }),
    )
    .max(12)
    .nullable()
    .optional(),
});

const orderCustomerSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(40).nullable().optional(),
  type: z.enum(["individual", "company"]).default("individual"),
  company: z.string().max(120).nullable().optional(),
  vatNumber: z.string().max(80).nullable().optional(),
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

const orderHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(6),
  status: z
    .union([z.nativeEnum(OrderStatus), z.literal("all")])
    .default("all"),
});

function normalizeOptional(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveAuthenticatedClientId(websiteUserId: string) {
  const token = await getClientSessionTokenFromCookie();
  if (!token) {
    return null;
  }
  const client = await getClientFromSessionToken(token);
  if (!client || !client.isActive || client.userId !== websiteUserId) {
    return null;
  }
  return client.id;
}

export async function GET(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  try {
    const context = await requireCatalogClientContext(request, t);
    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const query = orderHistoryQuerySchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? "1",
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? "6",
      status: request.nextUrl.searchParams.get("status") ?? "all",
    });

    const result = await listCatalogClientOrders({
      tenantUserId: context.website.userId,
      clientId: context.client.id,
      customerEmail: context.client.email,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? t(error.issues[0]?.message ?? "Unable to load orders.")
        : error instanceof Error
          ? t(error.message)
          : t("Unable to load orders.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  try {
    assertSameOriginMutationRequest(request.headers, "Invalid request origin.");
    const payload = orderPayloadSchema.parse(await request.json());
    const normalizedEmail = payload.customer.email.trim().toLowerCase();
    enforceRateLimit({
      key: buildPublicRateLimitKey({
        scope: "catalogue-orders",
        headers: request.headers,
        parts: [normalizedEmail],
      }),
      limit: 8,
      windowMs: 15 * 60 * 1000,
      message: "Too many order attempts. Please wait before trying again.",
    });
    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const slug = domain ? null : normalizeCatalogSlugInput(payload.slug);
    if (payload.path && !normalizeCatalogPathInput(payload.path)) {
      throw new Error("Invalid path.");
    }
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: payload.mode === "preview",
    });
    if (!website) {
      throw new Error("Site unavailable.");
    }
    if (!website.showPrices) {
      throw new Error(
        "Pricing is hidden for this shop. Please contact us.",
      );
    }
    const ecommerceSettings = resolveEcommerceSettingsFromWebsite(website);
    const checkoutSettings = ecommerceSettings.checkout ?? {};
    const normalizedPhone = normalizeOptional(payload.customer.phone);
    const normalizedCompany = normalizeOptional(payload.customer.company);
    const normalizedVatNumber = normalizeOptional(payload.customer.vatNumber);
    const normalizedAddress = normalizeOptional(payload.customer.address);
    if (checkoutSettings.requirePhone && !normalizedPhone) {
      throw new Error("Phone number is required to place this order.");
    }
    if (!normalizedAddress) {
      throw new Error("Address is required to place this order.");
    }
    if (payload.customer.type === "company") {
      if (!normalizedCompany) {
        throw new Error("Company name is required.");
      }
      if (!normalizedVatNumber) {
        throw new Error("Tax registration number is required.");
      }
    }
    const termsUrl = checkoutSettings.termsUrl?.trim() ?? "";
    if (termsUrl && !payload.termsAccepted) {
      throw new Error("Please accept the terms and conditions.");
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
        throw new Error("Payment method is required.");
      }
    }

    const productIds = Array.from(
      new Set(payload.items.map((item) => item.productId)),
    );
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
        defaultDiscountAmountCents: true,
        saleMode: true,
        optionConfig: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new Error("Product not found.");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderItems = payload.items.map((item, index) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error("Product not found.");
      }
      if (product.saleMode !== "INSTANT") {
        throw new Error("This product cannot be purchased online.");
      }
      const optionSelections = (item.selectedOptions ??
        []) as ProductOptionSelection[];
      const trustedSelections = optionSelections.map((selection) => ({
        kind: selection.kind,
        groupId: selection.groupId,
        valueId: selection.valueId,
        name: selection.name,
        value: selection.value,
      }));
      const selectedOptionsSummary = formatSelectedOptionsSummary(trustedSelections);
      const optionAdjustmentCents = calculateSelectedOptionAdjustmentCents(
        product.optionConfig,
        trustedSelections,
      );
      const discount = resolveProductDiscount(product);
      const lineDiscount = resolveLineDiscountInput({
        quantity: item.quantity,
        discountRate: discount.discountRate,
        discountAmountCents: discount.discountAmountCents,
      });
      return {
        productId: product.id,
        description: selectedOptionsSummary
          ? `${product.name} (${selectedOptionsSummary})`
          : product.name,
        quantity: item.quantity,
        unit: product.unit,
        unitPriceHTCents:
          computeAdjustedUnitPriceHTCents(
            product.priceHTCents,
            optionAdjustmentCents,
          ) ?? product.priceHTCents,
        vatRate: product.vatRate,
        discountRate: lineDiscount.discountRate,
        discountAmountCents: lineDiscount.discountAmountCents,
        position: index,
      };
    });

    const computedLines = orderItems.map((line) =>
      calculateLineTotals({
        quantity: line.quantity,
        unitPriceHTCents: line.unitPriceHTCents,
        vatRate: line.vatRate,
        discountRate: line.discountRate ?? null,
        discountAmountCents: line.discountAmountCents ?? null,
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
      unitAmountCents: computedLines[index]?.totalTTCCents
        ? Math.round(computedLines[index].totalTTCCents / line.quantity)
        : null,
      lineTotalCents: computedLines[index]?.totalTTCCents ?? null,
    }));

    const settings = await getSettings(website.userId);
    const currencyCode = resolveCatalogCurrencyCode(
      website,
      settings.defaultCurrency,
    );
    const orderInput = {
      currency: currencyCode,
      clientId: await resolveAuthenticatedClientId(website.userId),
      customer: {
        name: payload.customer.name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        type: payload.customer.type,
        company: normalizedCompany,
        vatNumber: normalizedVatNumber,
        address: normalizedAddress,
      },
      notes: normalizeOptional(payload.notes),
      items: orderItems,
      paymentMethod: resolvedPaymentMethod,
    };

    if (payload.mode === "preview") {
      return NextResponse.json({
        status: "preview-only",
        message: t("Preview mode: no order recorded."),
        order: {
          id: null,
          orderNumber: generateOrderNumberCandidate(),
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
      error instanceof z.ZodError
        ? t(error.issues[0]?.message ?? "Invalid form data.")
        : error instanceof Error
          ? t(error.message)
          : t("Unable to create your order right now.");
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json(
      { error: message },
      init,
    );
  }
}
