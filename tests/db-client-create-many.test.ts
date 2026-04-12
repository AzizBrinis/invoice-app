import { describe, expect, it, vi } from "vitest";
import { createDatabaseClient } from "@/lib/db";

function createFakeSqlClient() {
  return {
    begin: vi.fn(),
    end: vi.fn(async () => undefined),
    unsafe: vi.fn(async () => [{}]),
  };
}

describe("db client createMany compatibility", () => {
  it("accepts a single object payload like Prisma createMany", async () => {
    const sqlClient = createFakeSqlClient();
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      session: {
        createMany: (args: {
          data:
            | {
                userId: string;
                tokenHash: string;
                expiresAt: Date;
              }
            | Array<{
                userId: string;
                tokenHash: string;
                expiresAt: Date;
              }>;
        }) => Promise<{ count: number }>;
      };
    };

    const result = await client.session.createMany({
      data: {
        userId: "user-1",
        tokenHash: "token-hash",
        expiresAt: new Date("2026-04-12T00:00:00.000Z"),
      },
    });

    expect(result).toEqual({ count: 1 });
    expect(sqlClient.unsafe).toHaveBeenCalledOnce();
    expect(String(sqlClient.unsafe.mock.calls[0]?.[0] ?? "")).toContain(
      'INSERT INTO "public"."Session"',
    );
  });
});
