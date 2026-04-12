import { z } from "zod";
import { prisma } from "@/lib/db";
import { ClientSource, Prisma } from "@/lib/db/prisma-server";
import { hashClientPassword } from "@/lib/client-auth";
import { revalidateClientFilters } from "@/server/clients";
import { revalidateQuoteFilterClients } from "@/server/quotes";
import {
  resolveCatalogWebsite,
  resolveEcommerceSettingsFromWebsite,
} from "@/server/website";

const signupIntentSchema = z.object({
  intent: z.literal("password"),
  email: z.string().email(),
  password: z.string().min(8),
});

const signupRequestSchema = z
  .object({
    slug: z.string().nullable().optional(),
    domain: z.string().nullable().optional(),
    path: z.string().nullable().optional(),
    mode: z.enum(["public", "preview"]).default("public"),
    ip: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
  })
  .and(signupIntentSchema);

export type WebsiteSignupInput = z.infer<typeof signupRequestSchema>;

export type WebsiteSignupResult = {
  status: "created" | "existing" | "preview-only";
  message?: string;
  redirectTo: string;
  clientId?: string;
};

function resolveSignupValidationMessage(input: unknown) {
  const intent =
    input && typeof input === "object" && "intent" in input
      ? (input as Record<string, unknown>).intent
      : null;
  if (intent === "password") {
    return "Please enter a valid email and a password of at least 8 characters.";
  }
  return "Invalid signup request.";
}

function isRowLevelSecurityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("row-level security") ||
    message.includes("row level security") ||
    message.includes("permission denied")
  );
}

function resolveSignupRedirectTarget(target?: "home" | "account" | null) {
  return target === "account" ? "/account" : "/";
}

type SignupClientResult = {
  client: { id: string; email: string | null; passwordHash: string | null };
  created: boolean;
  alreadyRegistered: boolean;
};

async function findExistingClient(
  tenantId: string,
  emailLower: string,
) {
  return prisma.client.findFirst({
    where: {
      userId: tenantId,
      email: {
        equals: emailLower,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
      passwordHash: true,
    },
  });
}

async function upsertClientForSignup(options: {
  tenantId: string;
  websiteId: string;
  slug: string;
  domain: string | null;
  email: string;
  passwordHash: string;
  provider: string;
  path?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<SignupClientResult> {
  const emailLower = options.email.toLowerCase();
  const existing = await findExistingClient(options.tenantId, emailLower);

  if (existing?.passwordHash) {
    return { client: existing, created: false, alreadyRegistered: true };
  }

  if (existing) {
    const updateData: Record<string, unknown> = {};
    if (!existing.email || existing.email.toLowerCase() !== emailLower) {
      updateData.email = emailLower;
    }
    if (!existing.passwordHash) {
      updateData.passwordHash = options.passwordHash;
    }
    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.client.update({
        where: { id: existing.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          passwordHash: true,
        },
      });
      return { client: updated, created: false, alreadyRegistered: false };
    }
    return { client: existing, created: false, alreadyRegistered: false };
  }

  const displayName = emailLower || "Client";
  try {
    const client = await prisma.client.create({
      data: {
        userId: options.tenantId,
        displayName,
        email: emailLower,
        passwordHash: options.passwordHash,
        source: ClientSource.WEBSITE_LEAD,
        leadMetadata: {
          signupProvider: options.provider,
          path: options.path ?? null,
          domain: options.domain,
          slug: options.slug,
          websiteId: options.websiteId,
          ip: options.ip ?? null,
          userAgent: options.userAgent ?? null,
        },
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    return { client, created: true, alreadyRegistered: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await findExistingClient(options.tenantId, emailLower);
      if (existing) {
        return {
          client: existing,
          created: false,
          alreadyRegistered: Boolean(existing.passwordHash),
        };
      }
    }
    throw error;
  }
}

async function createClientForSignup(
  options: Parameters<typeof upsertClientForSignup>[0],
) {
  try {
    return await upsertClientForSignup(options);
  } catch (error) {
    if (isRowLevelSecurityError(error)) {
      throw new Error(
        "Signup blocked by access policy. Please contact support.",
      );
    }
    throw error;
  }
}

export async function registerWebsiteSignup(
  input: WebsiteSignupInput,
): Promise<WebsiteSignupResult> {
  const parsedResult = signupRequestSchema.safeParse(input);
  if (!parsedResult.success) {
    throw new Error(resolveSignupValidationMessage(input));
  }
  const parsed = parsedResult.data;
  const website = await resolveCatalogWebsite({
    slug: parsed.slug ?? null,
    domain: parsed.domain ?? null,
    preview: parsed.mode === "preview",
  });
  if (!website) {
    throw new Error("Site unavailable.");
  }
  if (parsed.domain && parsed.slug && website.slug !== parsed.slug) {
    throw new Error(
      "Signup link does not match this site. Please reload and try again.",
    );
  }

  const settings = resolveEcommerceSettingsFromWebsite(website);
  const redirectTo = resolveSignupRedirectTarget(
    settings.signup.redirectTarget,
  );

  if (parsed.mode === "preview") {
    return {
      status: "preview-only",
      message: "Preview mode: no signup recorded.",
      redirectTo,
    };
  }

  const passwordHash = await hashClientPassword(parsed.password);
  const { client, created, alreadyRegistered } = await createClientForSignup({
    tenantId: website.userId,
    websiteId: website.id,
    slug: website.slug,
    domain: website.customDomain,
    email: parsed.email.toLowerCase(),
    passwordHash,
    provider: "password",
    path: parsed.path,
    ip: parsed.ip ?? null,
    userAgent: parsed.userAgent ?? null,
  });

  if (alreadyRegistered) {
    throw new Error("Account already exists. Please sign in.");
  }

  revalidateClientFilters(website.userId);
  revalidateQuoteFilterClients(website.userId);

  return {
    status: created ? "created" : "existing",
    message: created ? "Signup successful." : "Account linked. Thanks!",
    redirectTo,
    clientId: client.id,
  };
}
