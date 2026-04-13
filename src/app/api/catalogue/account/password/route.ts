import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import { prisma } from "@/lib/db";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import {
  getClientFromSessionToken,
  getClientSessionTokenFromCookie,
  hashClientPassword,
  signOutClient,
  verifyClientPassword,
} from "@/lib/client-auth";
import {
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(1),
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

function resolvePasswordValidationMessage(input: unknown) {
  if (
    input &&
    typeof input === "object" &&
    ("currentPassword" in input || "newPassword" in input)
  ) {
    return "Please enter your current password and a new password of at least 8 characters.";
  }
  return "Invalid password update request.";
}

export async function POST(request: NextRequest) {
  const { t } = createCisecoRequestTranslator(request);
  const resolved = await requireClientAndWebsite(request, t);
  if ("error" in resolved) {
    return NextResponse.json(
      { message: resolved.error },
      { status: resolved.status },
    );
  }

  try {
    const payload = passwordSchema.parse(await request.json());

    if (payload.newPassword !== payload.confirmPassword) {
      return NextResponse.json(
        { message: t("New password and confirmation do not match.") },
        { status: 400 },
      );
    }

    if (!resolved.client.passwordHash) {
      return NextResponse.json(
        { message: t("Password cannot be updated for this account.") },
        { status: 400 },
      );
    }

    const isValid = await verifyClientPassword(
      payload.currentPassword,
      resolved.client.passwordHash,
    );
    if (!isValid) {
      return NextResponse.json(
        { message: t("Current password is incorrect.") },
        { status: 400 },
      );
    }

    const newHash = await hashClientPassword(payload.newPassword);
    await prisma.client.update({
      where: { id: resolved.client.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({
      message: t("Password updated successfully."),
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? t(resolvePasswordValidationMessage({ currentPassword: true }))
        : error instanceof Error
          ? t(error.message)
          : t("Unable to update password.");
    return NextResponse.json({ message }, { status: 400 });
  }
}
