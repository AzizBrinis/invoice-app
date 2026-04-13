import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toCatalogClientProfile } from "@/lib/catalog-viewer";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import {
  getClientFromSessionToken,
  getClientSessionTokenFromCookie,
  signOutClient,
} from "@/lib/client-auth";
import { revalidateClientFilters } from "@/server/clients";
import { revalidateQuoteFilterClients } from "@/server/quotes";
import {
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name is required.").max(160),
  email: z.string().email("Invalid email address.").max(160).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  address: z.string().max(240).optional().or(z.literal("")),
  notes: z.string().max(1200).optional().or(z.literal("")),
});

function normalizeOptional(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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

export async function GET(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  const resolved = await requireClientAndWebsite(request, t);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  return NextResponse.json(
    { profile: toCatalogClientProfile(resolved.client) },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function PATCH(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  const resolved = await requireClientAndWebsite(request, t);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  try {
    const payload = updateProfileSchema.parse(await request.json());
    const name = payload.name.trim();

    const updated = await prisma.client.update({
      where: { id: resolved.client.id },
      data: {
        displayName: name,
        email: normalizeOptional(payload.email),
        phone: normalizeOptional(payload.phone),
        address: normalizeOptional(payload.address),
        notes: normalizeOptional(payload.notes),
      },
      select: {
        displayName: true,
        email: true,
        phone: true,
        address: true,
        companyName: true,
        vatNumber: true,
        notes: true,
      },
    });

    revalidateClientFilters(resolved.client.userId);
    revalidateQuoteFilterClients(resolved.client.userId);

    return NextResponse.json({ profile: toCatalogClientProfile(updated) });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? t(error.issues[0]?.message ?? "Unable to update account.")
        : error instanceof Error
          ? t(error.message)
          : t("Unable to update account.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
