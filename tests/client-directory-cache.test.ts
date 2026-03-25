import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearClientCache,
  consumePendingClientRefetch,
  loadClientPage,
  primeClientCache,
  readClientCache,
  type ClientDirectoryQuery,
  type ClientDirectoryResponse,
} from "@/lib/client-directory-cache";

const query: ClientDirectoryQuery = {
  status: "all",
  page: 1,
  pageSize: 20,
};

function buildResponse(overrides: Partial<ClientDirectoryResponse> = {}): ClientDirectoryResponse {
  return {
    items: [
      {
        id: "client-1",
        displayName: "Client test",
        companyName: null,
        email: "client@example.com",
        phone: null,
        vatNumber: null,
        isActive: true,
        updatedAt: "2026-03-21T00:00:00.000Z",
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    pageCount: 1,
    ...overrides,
  };
}

describe("client directory cache", () => {
  beforeEach(() => {
    clearClientCache();
    consumePendingClientRefetch();
  });

  afterEach(() => {
    clearClientCache();
    consumePendingClientRefetch();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not let an invalidated in-flight request repopulate the cache", async () => {
    const staleResponse = buildResponse();
    let resolveFetch:
      | ((value: { ok: boolean; json: () => Promise<ClientDirectoryResponse> }) => void)
      | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const inFlightRequest = loadClientPage(query, { force: true });
    clearClientCache({ refetchOnNextLoad: true });

    const completeFetch = resolveFetch as
      | ((value: {
          ok: boolean;
          json: () => Promise<ClientDirectoryResponse>;
        }) => void)
      | null;
    if (!completeFetch) {
      throw new Error("Fetch resolver was not initialized.");
    }

    completeFetch({
      ok: true,
      json: async () => staleResponse,
    });

    await expect(inFlightRequest).resolves.toEqual(staleResponse);
    expect(readClientCache(query)).toBeNull();
    expect(consumePendingClientRefetch()).toBe(true);
    expect(consumePendingClientRefetch()).toBe(false);
  });

  it("stores only post-invalidation responses in the active cache generation", async () => {
    const firstResponse = buildResponse();
    const secondResponse = buildResponse({
      items: [
        {
          ...firstResponse.items[0]!,
          id: "client-2",
          displayName: "Client frais",
        },
      ],
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => secondResponse,
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(loadClientPage(query, { force: true })).resolves.toEqual(
      firstResponse,
    );
    expect(readClientCache(query)?.data).toEqual(firstResponse);

    clearClientCache({ refetchOnNextLoad: true });

    await expect(loadClientPage(query, { force: true })).resolves.toEqual(
      secondResponse,
    );
    expect(readClientCache(query)?.data).toEqual(secondResponse);
  });

  it("primes the cache with server-provided directory data", () => {
    const response = buildResponse();

    primeClientCache(query, response);

    const cacheHit = readClientCache(query);
    expect(cacheHit?.data).toEqual(response);
    expect(cacheHit?.isFresh).toBe(true);
  });
});
