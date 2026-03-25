import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppHostnames } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createQuoteRequest } from "@/server/quote-requests";
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

const jsonObjectOrArraySchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const quoteRequestCustomerSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  email: z.string().email("E-mail invalide"),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(120).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
});

const quoteRequestPayloadSchema = z.object({
  productId: z.string().min(1, "Produit requis"),
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
    throw new Error("Formulaire invalide.");
  }
  const result = jsonObjectOrArraySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Formulaire invalide.");
  }
  return result.data;
}

function containsExternalLinks(value: string) {
  return /\bhttps?:\/\//i.test(value) || /www\./i.test(value);
}

export async function POST(request: NextRequest) {
  try {
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

    if (parsed.honeypot && parsed.honeypot.trim().length > 0) {
      throw new Error("Requete bloquee.");
    }

    if (parsed.mode === "preview") {
      return NextResponse.json({
        status: "preview-only",
        message: "Mode previsualisation : aucune demande enregistree.",
      });
    }

    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const normalizedHost = normalizeCatalogDomainInput(host);
    const isAppHost =
      APP_HOSTS.has(host) ||
      (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
    const domain = isAppHost ? null : normalizedHost;
    const slug = isAppHost ? normalizeCatalogSlugInput(parsed.slug) : null;
    const resolvedPath = normalizeCatalogPathInput(parsed.path);
    if (parsed.path && !resolvedPath) {
      throw new Error("Chemin invalide.");
    }
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: false,
    });
    if (!website) {
      throw new Error("Site introuvable.");
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
      throw new Error("Produit introuvable.");
    }
    if (product.saleMode !== "QUOTE") {
      throw new Error("Ce produit ne peut pas etre demande en devis.");
    }

    const normalizedEmail = parsed.customer.email.trim().toLowerCase();
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
          "Nous avons bien recu votre demande. Merci de patienter avant de renvoyer un message.",
        );
      }
      if (parsed.message && containsExternalLinks(parsed.message)) {
        throw new Error(
          "La description ne doit pas contenir de liens externes.",
        );
      }
      if (formDataValue && containsExternalLinks(JSON.stringify(formDataValue))) {
        throw new Error(
          "Les champs ne doivent pas contenir de liens externes.",
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
      message:
        "Merci ! Votre demande de devis a bien ete transmise a l'equipe.",
      quoteRequestId: created.id,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'enregistrer la demande.";
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
