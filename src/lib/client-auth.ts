import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { extractSignedToken, signSessionToken } from "@/lib/session-cookie";

export const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME ?? "client_session_token";

const CLIENT_SESSION_DURATION_HOURS = parseInt(
  process.env.CLIENT_SESSION_DURATION_HOURS ?? "24",
  10,
);

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashClientPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyClientPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getClientSessionTokenFromCookie() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(CLIENT_SESSION_COOKIE_NAME)?.value ?? null;
  return extractSignedToken(rawValue);
}

export async function createClientSession(clientId: string) {
  const token = randomBytes(48).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + CLIENT_SESSION_DURATION_HOURS * 60 * 60 * 1000,
  );

  await prisma.clientSession.create({
    data: {
      clientId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  const signature = await signSessionToken(token);
  cookieStore.set(CLIENT_SESSION_COOKIE_NAME, `${token}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/",
  });
}

export async function getClientFromSessionToken(token: string) {
  const session = await prisma.clientSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      client: true,
    },
  });

  return session?.client ?? null;
}

export async function signOutClient() {
  const token = await getClientSessionTokenFromCookie();
  if (!token) {
    return;
  }

  await prisma.clientSession.deleteMany({
    where: {
      tokenHash: hashToken(token),
    },
  });

  try {
    const cookieStore = await cookies();
    if (typeof cookieStore.delete === "function") {
      cookieStore.delete(CLIENT_SESSION_COOKIE_NAME);
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
