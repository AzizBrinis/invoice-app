import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/errors";
import type {
  AccountMembershipRole,
  AccountPermission,
  AccountType,
  User,
  UserRole,
} from "@prisma/client";
import {
  extractSignedToken,
  signSessionToken,
} from "@/lib/session-cookie";
import {
  ensureOwnedAccountContext,
  resolveUserAccountContext,
  setSessionActiveTenant,
} from "@/server/accounts";

export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? "session_token";
const SESSION_DURATION_HOURS = parseInt(
  process.env.SESSION_DURATION_HOURS ?? "12",
  10,
);

export type AuthenticatedUser = User & {
  sessionId: string;
  tenantId: string;
  activeTenantId: string;
  accountType: AccountType;
  accountDisplayName: string | null;
  membershipId: string;
  membershipRole: AccountMembershipRole;
  permissions: AccountPermission[];
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function persistSession(
  token: string,
  userId: string,
  activeTenantId?: string,
) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000,
  );

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      activeTenantId: activeTenantId ?? userId,
    },
  });

  const cookieStore = await cookies();
  const signature = await signSessionToken(token);
  cookieStore.set(SESSION_COOKIE_NAME, `${token}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/",
  });

  return session;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
) {
  return bcrypt.compare(password, hash);
}

const getSessionTokenFromCookieCached = cache(async () => {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  return extractSignedToken(rawValue);
});

export async function getSessionTokenFromCookie() {
  return getSessionTokenFromCookieCached();
}

const getCurrentUserCached = cache(async () => {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return null;
  }

  const session = await findSessionByToken(token);

  if (!session) {
    await clearSessionCookie();
    return null;
  }

  return hydrateSessionUser(session);
});

export async function getCurrentUser() {
  return getCurrentUserCached();
}

export async function requireUser(options?: { roles?: readonly UserRole[] }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion");
  }
  if (options?.roles && !options.roles.includes(user.role)) {
    throw new AuthorizationError();
  }
  return user;
}

async function clearSessionCookie() {
  try {
    const cookieStore = await cookies();
    if (typeof cookieStore.delete === "function") {
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("Cookies can only be modified")
    ) {
      throw error;
    }
  }
}

async function findSessionByToken(token: string) {
  return prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });
}

async function hydrateSessionUser(session: {
  id: string;
  userId: string;
  activeTenantId: string | null;
  user: User;
}): Promise<AuthenticatedUser> {
  const accountContext = await resolveUserAccountContext(
    session.userId,
    session.activeTenantId ?? session.userId,
  );

  if (session.activeTenantId !== accountContext.accountId) {
    await prisma.session.updateMany({
      where: {
        id: session.id,
      },
      data: {
        activeTenantId: accountContext.accountId,
      },
    });
  }

  return {
    ...session.user,
    sessionId: session.id,
    tenantId: accountContext.accountId,
    activeTenantId: accountContext.accountId,
    accountType: accountContext.accountType,
    accountDisplayName: accountContext.accountDisplayName,
    membershipId: accountContext.membershipId,
    membershipRole: accountContext.membershipRole,
    permissions: accountContext.permissions,
  };
}

export async function getUserFromSessionToken(token: string) {
  const session = await findSessionByToken(token);
  if (!session) {
    return null;
  }
  return hydrateSessionUser(session);
}

export async function signIn(
  email: string,
  password: string,
  options?: { activeTenantId?: string | null },
) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  await ensureOwnedAccountContext(user.id);

  const token = randomBytes(48).toString("hex");
  const session = await persistSession(token, user.id, options?.activeTenantId ?? user.id);
  return hydrateSessionUser({
    ...session,
    user,
  });
}

export async function signOut() {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return;
  }

  await prisma.session.deleteMany({
    where: {
      tokenHash: hashToken(token),
    },
  });

  await clearSessionCookie();
}

export async function setCurrentSessionActiveTenant(accountId: string) {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return null;
  }

  const session = await findSessionByToken(token);
  if (!session) {
    await clearSessionCookie();
    return null;
  }

  return setSessionActiveTenant(session.id, session.userId, accountId);
}
