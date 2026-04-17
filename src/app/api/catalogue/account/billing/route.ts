import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertSameOriginMutationRequest,
  buildPublicRateLimitKey,
  enforceRateLimit,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import {
  getCatalogBillingOverview,
  submitCatalogInvoiceRequest,
} from "@/server/invoice-requests";
import { requireCatalogClientContext } from "@/server/catalogue-orders";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(6),
});

const requestSchema = z.object({
  orderId: z.string().min(1),
  companyName: z
    .string()
    .trim()
    .min(2, "Company name is required.")
    .max(160),
  vatNumber: z
    .string()
    .trim()
    .min(2, "VAT number is required.")
    .max(80),
  address: z
    .string()
    .trim()
    .min(5, "Full billing address is required.")
    .max(400),
});

export async function GET(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);

  try {
    const resolved = await requireCatalogClientContext(request, t);
    if ("error" in resolved) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const query = querySchema.parse({
      page: request.nextUrl.searchParams.get("page") ?? "1",
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? "6",
    });

    const overview = await getCatalogBillingOverview({
      tenantUserId: resolved.website.userId,
      clientId: resolved.client.id,
      page: query.page,
      pageSize: query.pageSize,
    });

    return NextResponse.json(overview, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? t(error.issues[0]?.message ?? "Unable to load billing.")
        : error instanceof Error
          ? t(error.message)
          : t("Unable to load billing.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);

  try {
    const resolved = await requireCatalogClientContext(request, t);
    if ("error" in resolved) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    assertSameOriginMutationRequest(request.headers, "Invalid request origin.");
    const payload = requestSchema.parse(await request.json());

    enforceRateLimit({
      key: buildPublicRateLimitKey({
        scope: "catalogue-invoice-request",
        headers: request.headers,
        parts: [resolved.client.id, payload.orderId],
      }),
      limit: 6,
      windowMs: 10 * 60 * 1000,
      message: "Too many invoice requests. Please wait before trying again.",
    });

    const result = await submitCatalogInvoiceRequest({
      tenantUserId: resolved.website.userId,
      clientId: resolved.client.id,
      orderId: payload.orderId,
      companyName: payload.companyName,
      vatNumber: payload.vatNumber,
      billingAddress: payload.address,
      deliveryEmail: resolved.client.email,
    });

    return NextResponse.json({
      message: t(
        `Your invoice request has been received. The invoice will be sent to ${result.deliveryEmail} as soon as possible.`,
      ),
      request: result.request,
      billingProfile: result.billingProfile,
    });
  } catch (error) {
    const fieldErrors: Partial<
      Record<"companyName" | "vatNumber" | "address", string>
    > = {};
    if (error instanceof z.ZodError) {
      error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (
          typeof field === "string" &&
          (field === "companyName" || field === "vatNumber" || field === "address") &&
          !fieldErrors[field]
        ) {
          fieldErrors[field] = t(issue.message);
        }
      });
    }
    const message =
      error instanceof z.ZodError
        ? t(error.issues[0]?.message ?? "Unable to submit the invoice request.")
        : error instanceof Error
          ? t(error.message)
          : t("Unable to submit the invoice request.");
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json({ error: message, fieldErrors }, init);
  }
}
