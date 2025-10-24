import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/errors";
import type { UserRole } from "@prisma/client";
import {
  extractSignedToken,
  signSessionToken,
} from "@/lib/session-cookie";

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? "session_token";
const SESSION_DURATION_HOURS = parseInt(
  process.env.SESSION_DURATION_HOURS ?? "12",
  10,
);

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function persistSession(token: string, userId: string) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000,
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
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

export async function getSessionTokenFromCookie() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  return extractSignedToken(rawValue);
}

export async function getCurrentUser() {
  const token = await getSessionTokenFromCookie();
  if (!token) {
    return null;
  }

  const session = await findSessionByToken(token);

  if (!session) {
    await clearSessionCookie();
    return null;
  }

  return session.user;
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
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
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

export async function getUserFromSessionToken(token: string) {
  const session = await findSessionByToken(token);
  return session?.user ?? null;
}

export async function signIn(email: string, password: string) {
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

  const token = randomBytes(48).toString("hex");
  await persistSession(token, user.id);
  return user;
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
