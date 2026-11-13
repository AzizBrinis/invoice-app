import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, sessionLookup } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), delete: vi.fn() },
  sessionLookup: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { session: { findFirst: sessionLookup } },
}));

import HomePage from "@/app/page";
import { requireUser } from "@/lib/auth";
import { signSessionToken } from "@/lib/session-cookie";

describe("home redirect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionLookup.mockRejectedValue(new Error("Database unavailable"));
  });

  it("sends visitors without a cookie to login without querying the database", async () => {
    await expect(HomePage()).rejects.toThrow("redirect:/connexion");
    expect(sessionLookup).not.toHaveBeenCalled();
  });

  it("rejects a tampered cookie without querying the database", async () => {
    const signature = await signSessionToken("original-token");
    cookieStore.get.mockReturnValue({ value: `tampered-token.${signature}` });

    await expect(HomePage()).rejects.toThrow("redirect:/connexion");
    expect(sessionLookup).not.toHaveBeenCalled();
  });

  it("redirects signed cookies without waiting for an unavailable database", async () => {
    const token = "signed-token";
    cookieStore.get.mockReturnValue({
      value: `${token}.${await signSessionToken(token)}`,
    });

    await expect(HomePage()).rejects.toThrow("redirect:/tableau-de-bord");
    expect(sessionLookup).not.toHaveBeenCalled();
  });

  it("still denies expired or revoked sessions at the protected app's auth guard", async () => {
    const token = "revoked-token";
    cookieStore.get.mockReturnValue({
      value: `${token}.${await signSessionToken(token)}`,
    });
    sessionLookup.mockResolvedValue(null);

    await expect(HomePage()).rejects.toThrow("redirect:/tableau-de-bord");
    await expect(requireUser()).rejects.toThrow("redirect:/connexion");
    expect(sessionLookup).toHaveBeenCalledOnce();
    expect(sessionLookup).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(cookieStore.delete).toHaveBeenCalledOnce();
  });
});
