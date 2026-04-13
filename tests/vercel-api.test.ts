import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureVercelProjectDomain,
  MissingVercelConfigError,
  VercelApiError,
} from "@/lib/vercel-api";

type MockResponseOptions = {
  status?: number;
  headers?: Record<string, string>;
};

function createJsonResponse(body: unknown, options: MockResponseOptions = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

describe("vercel api helpers", () => {
  const originalEnv = {
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
  };
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    process.env.VERCEL_PROJECT_ID = "project_123";
    process.env.VERCEL_TOKEN = "token_123";
    delete process.env.VERCEL_TEAM_ID;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env.VERCEL_PROJECT_ID = originalEnv.VERCEL_PROJECT_ID;
    process.env.VERCEL_TOKEN = originalEnv.VERCEL_TOKEN;
    process.env.VERCEL_TEAM_ID = originalEnv.VERCEL_TEAM_ID;
    vi.unstubAllGlobals();
  });

  it("requires Vercel credentials", async () => {
    delete process.env.VERCEL_PROJECT_ID;
    await expect(ensureVercelProjectDomain("www.example.com")).rejects.toBeInstanceOf(
      MissingVercelConfigError,
    );
  });

  it("stops after the domain is already verified", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        name: "www.example.com",
        verified: true,
      }),
    );

    await expect(
      ensureVercelProjectDomain("www.example.com"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks Vercel to verify domains that are not yet verified", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          name: "www.example.com",
          verified: false,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          name: "www.example.com",
          verified: true,
        }),
      );

    await expect(
      ensureVercelProjectDomain("www.example.com"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain("/verify");
  });

  it("loads an existing domain before retrying verification on conflict", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            error: {
              code: "domain_already_exists",
              message: "Domain already exists.",
            },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          name: "www.example.com",
          verified: false,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          name: "www.example.com",
          verified: true,
        }),
      );

    await expect(
      ensureVercelProjectDomain("www.example.com"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain(
      "/domains/www.example.com",
    );
  });

  it("throws when Vercel still does not confirm the domain", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          name: "www.example.com",
          verified: false,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          name: "www.example.com",
          verified: false,
          verification: [
            {
              type: "TXT",
              domain: "_vercel.www.example.com",
              value: "vc-domain-verify=abc123",
            },
          ],
        }),
      );

    await expect(
      ensureVercelProjectDomain("www.example.com"),
    ).rejects.toBeInstanceOf(VercelApiError);
  });
});
