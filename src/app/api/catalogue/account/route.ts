import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppHostnames } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  getClientFromSessionToken,
  getClientSessionTokenFromCookie,
  signOutClient,
} from "@/lib/client-auth";
import { revalidateClientFilters } from "@/server/clients";
import { revalidateQuoteFilterClients } from "@/server/quotes";
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

const updateProfileSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().max(160).optional().or(z.literal("")),
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
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const normalizedHost = normalizeCatalogDomainInput(host);
  const isAppHost =
    APP_HOSTS.has(host) ||
    (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);
  const slug = isAppHost
    ? normalizeCatalogSlugInput(request.nextUrl.searchParams.get("slug"))
    : null;
  const domain = isAppHost ? null : normalizedHost;
  return { slug, domain };
}

async function requireClientAndWebsite(request: NextRequest) {
  const token = await getClientSessionTokenFromCookie();
  if (!token) {
    return { error: "Please sign in.", status: 401 };
  }

  const client = await getClientFromSessionToken(token);
  if (!client) {
    await signOutClient();
    return { error: "Please sign in.", status: 401 };
  }
  if (!client.isActive) {
    return { error: "Account inactive.", status: 403 };
  }

  const { slug, domain } = resolveDomainAndSlug(request);
  const website = await resolveCatalogWebsite({
    slug,
    domain,
    preview: false,
  });
  if (!website) {
    return { error: "Site unavailable.", status: 404 };
  }
  if (client.userId !== website.userId) {
    return { error: "Access denied.", status: 403 };
  }

  return { client, website };
}

function buildProfileResponse(client: {
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}) {
  return {
    name: client.displayName,
    email: client.email,
    phone: client.phone,
    address: client.address,
    notes: client.notes,
    avatarUrl: null,
  };
}

export async function GET(request: NextRequest) {
  const resolved = await requireClientAndWebsite(request);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  return NextResponse.json(
    { profile: buildProfileResponse(resolved.client) },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function PATCH(request: NextRequest) {
  const resolved = await requireClientAndWebsite(request);
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
        notes: true,
      },
    });

    revalidateClientFilters(resolved.client.userId);
    revalidateQuoteFilterClients(resolved.client.userId);

    return NextResponse.json({ profile: buildProfileResponse(updated) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
