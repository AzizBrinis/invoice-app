import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import {
  assertSameOriginMutationRequest,
  buildPublicRateLimitKey,
  enforceRateLimit,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { createQuoteRequest } from "@/server/quote-requests";
import {
  normalizeCatalogPathInput,
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const jsonObjectOrArraySchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const quoteRequestCustomerSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(120).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
});

const quoteRequestPayloadSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  customer: quoteRequestCustomerSchema,
  message: z.string().max(2000).nullable().optional(),
  formData: z.union([jsonObjectOrArraySchema, z.string()]).nullable().optional(),
  slug: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
  path: z.string().max(180).nullable().optional(),
  honeypot: z.string().optional(),
});

function formDataToObject(formData: FormData) {
  const entries: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") {
      entries[key] = value;
    }
  });
  return entries;
}

function normalizeOptional(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseFormDataValue(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid form data.");
  }
  const result = jsonObjectOrArraySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Invalid form data.");
  }
  return result.data;
}

function containsExternalLinks(value: string) {
  return /\bhttps?:\/\//i.test(value) || /www\./i.test(value);
}

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  try {
    assertSameOriginMutationRequest(request.headers, "Invalid request origin.");
    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const formData = await request.formData();
      payload = formDataToObject(formData);
    }

    const normalizedPayload = {
      ...payload,
      customer:
        payload.customer && typeof payload.customer === "object"
          ? payload.customer
          : {
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              company: payload.company,
              address: payload.address,
            },
    };

    const parsed = quoteRequestPayloadSchema.parse(normalizedPayload);
    const normalizedEmail = parsed.customer.email.trim().toLowerCase();
    enforceRateLimit({
      key: buildPublicRateLimitKey({
        scope: "catalogue-quote-requests",
        headers: request.headers,
        parts: [normalizedEmail],
      }),
      limit: 5,
      windowMs: 10 * 60 * 1000,
      message: "Too many quote requests. Please wait before sending another one.",
    });

    if (parsed.honeypot && parsed.honeypot.trim().length > 0) {
      throw new Error("Request blocked.");
    }

    if (parsed.mode === "preview") {
      return NextResponse.json({
        status: "preview-only",
        message: t("Preview mode: no quote request recorded."),
      });
    }

    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const slug = domain ? null : normalizeCatalogSlugInput(parsed.slug);
    const resolvedPath = normalizeCatalogPathInput(parsed.path);
    if (parsed.path && !resolvedPath) {
      throw new Error("Invalid path.");
    }
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: false,
    });
    if (!website) {
      throw new Error("Site unavailable.");
    }

    const product = await prisma.product.findFirst({
      where: {
        id: parsed.productId,
        userId: website.userId,
        isActive: true,
        isListedInCatalog: true,
      },
      select: {
        id: true,
        saleMode: true,
      },
    });
    if (!product) {
      throw new Error("Product not found.");
    }
    if (product.saleMode !== "QUOTE") {
      throw new Error("This product cannot be requested as a quote.");
    }

    const formDataValue =
      typeof parsed.formData === "string"
        ? parseFormDataValue(parsed.formData)
        : parsed.formData ?? null;

    if (website.spamProtectionEnabled) {
      const duplicateCount = await prisma.quoteRequest.count({
        where: {
          userId: website.userId,
          customerEmail: normalizedEmail,
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000),
          },
        },
      });
      if (duplicateCount > 0) {
        throw new Error(
          "We already received your request. Please wait before sending another message.",
        );
      }
      if (parsed.message && containsExternalLinks(parsed.message)) {
        throw new Error(
          "Description must not contain external links.",
        );
      }
      if (formDataValue && containsExternalLinks(JSON.stringify(formDataValue))) {
        throw new Error(
          "Form fields must not contain external links.",
        );
      }
    }

    const fallbackPath = normalizeCatalogPathInput(
      request.nextUrl.searchParams.get("path"),
    );
    const sourcePath = resolvedPath ?? fallbackPath ?? null;
    const created = await createQuoteRequest(
      {
        productId: product.id,
        customer: {
          name: parsed.customer.name.trim(),
          email: normalizedEmail,
          phone: normalizeOptional(parsed.customer.phone),
          company: normalizeOptional(parsed.customer.company),
          address: normalizeOptional(parsed.customer.address),
        },
        message: normalizeOptional(parsed.message),
        formData: formDataValue ?? null,
        sourcePath,
      },
      website.userId,
    );

    return NextResponse.json({
      status: "created",
      message: t("Thanks! Your quote request has been sent to the team."),
      quoteRequestId: created.id,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? t(error.issues[0]?.message ?? "Invalid form data.")
        : error instanceof Error
          ? t(error.message)
          : t("Unable to save the request.");
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json(
      { error: message },
      init,
    );
  }
}
