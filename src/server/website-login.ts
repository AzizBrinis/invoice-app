import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyClientPassword } from "@/lib/client-auth";
import {
  resolveCatalogWebsite,
  resolveEcommerceSettingsFromWebsite,
} from "@/server/website";

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  slug: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
});

export type WebsiteLoginInput = z.infer<typeof loginRequestSchema>;

export type WebsiteLoginResult = {
  status: "authenticated" | "preview-only";
  message?: string;
  redirectTo: string;
  clientId?: string;
};

function resolveLoginValidationMessage(input: unknown) {
  if (input && typeof input === "object" && "email" in input) {
    return "Please enter a valid email and password.";
  }
  return "Invalid login request.";
}

function resolveLoginRedirectTarget(target?: "home" | "account" | null) {
  return target === "account" ? "/account" : "/";
}

async function findClientForLogin(tenantId: string, emailLower: string) {
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
      isActive: true,
    },
  });
}

export async function authenticateWebsiteLogin(
  input: WebsiteLoginInput,
): Promise<WebsiteLoginResult> {
  const parsedResult = loginRequestSchema.safeParse(input);
  if (!parsedResult.success) {
    throw new Error(resolveLoginValidationMessage(input));
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
      "Login link does not match this site. Please reload and try again.",
    );
  }

  const settings = resolveEcommerceSettingsFromWebsite(website);
  const redirectTo = resolveLoginRedirectTarget(
    settings.signup.redirectTarget,
  );

  if (parsed.mode === "preview") {
    return {
      status: "preview-only",
      message: "Preview mode: no login recorded.",
      redirectTo,
    };
  }

  const emailLower = parsed.email.toLowerCase();
  const client = await findClientForLogin(website.userId, emailLower);
  if (!client || !client.passwordHash) {
    throw new Error("Invalid email or password.");
  }
  if (!client.isActive) {
    throw new Error("Invalid email or password.");
  }

  const validPassword = await verifyClientPassword(
    parsed.password,
    client.passwordHash,
  );
  if (!validPassword) {
    throw new Error("Invalid email or password.");
  }

  return {
    status: "authenticated",
    message: "Login successful.",
    redirectTo,
    clientId: client.id,
  };
}
