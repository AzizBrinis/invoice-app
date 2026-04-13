import { describe, expect, it, vi } from "vitest";
import { createDatabaseClient } from "@/lib/db";

function createFakeSqlClient(
  handler: (
    statement: string,
    values: readonly unknown[],
  ) => Promise<Record<string, unknown>[]>,
) {
  return {
    begin: vi.fn(),
    end: vi.fn(async () => undefined),
    unsafe: vi.fn(
      async (statement: string, values: readonly unknown[] = []) =>
        handler(statement, values),
    ),
  };
}

describe("db client write compatibility", () => {
  it("returns selected create scalars without a parent reread", async () => {
    const calls: string[] = [];
    const sqlClient = createFakeSqlClient(async (statement) => {
      calls.push(statement);
      if (statement.includes('INSERT INTO "public"."User"')) {
        return [{ id: "user-1" }];
      }
      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      user: {
        create: (args: Record<string, unknown>) => Promise<{ id: string }>;
      };
    };

    const user = await client.user.create({
      data: {
        email: "user@example.com",
        passwordHash: "hash",
      },
      select: { id: true },
    });

    expect(user).toEqual({ id: "user-1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('RETURNING "id"');
    expect(calls[0]).not.toContain("RETURNING *");
    expect(calls[0]).not.toContain("SELECT");
  });

  it("returns selected update scalars without a final parent reread", async () => {
    const calls: string[] = [];
    const sqlClient = createFakeSqlClient(async (statement) => {
      calls.push(statement);
      if (statement.startsWith("SELECT")) {
        return [
          {
            id: "user-1",
            email: "user@example.com",
            passwordHash: "hash",
          },
        ];
      }
      if (statement.includes('UPDATE "public"."User"')) {
        return [{ id: "user-1" }];
      }
      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      user: {
        update: (args: Record<string, unknown>) => Promise<{ id: string }>;
      };
    };

    const user = await client.user.update({
      where: { id: "user-1" },
      data: { name: "Updated" },
      select: { id: true },
    });

    expect(user).toEqual({ id: "user-1" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('RETURNING "id"');
    expect(calls[1]).not.toContain("RETURNING *");
  });

  it("uses narrow returning for atomic messaging local message upserts", async () => {
    const calls: string[] = [];
    const sqlClient = createFakeSqlClient(async (statement) => {
      calls.push(statement);
      if (statement.includes('INSERT INTO "public"."MessagingLocalMessage"')) {
        return [{ id: "message-1" }];
      }
      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      messagingLocalMessage: {
        upsert: (args: Record<string, unknown>) => Promise<{ id: string }>;
      };
    };

    const message = await client.messagingLocalMessage.upsert({
      where: {
        userId_mailbox_uidValidity_uid: {
          userId: "tenant-1",
          mailbox: "INBOX",
          uidValidity: 1,
          uid: 100,
        },
      },
      create: {
        userId: "tenant-1",
        mailbox: "INBOX",
        uidValidity: 1,
        uid: 100,
        subject: "Hello",
      },
      update: {
        seen: true,
      },
      select: { id: true },
    });

    expect(message).toEqual({ id: "message-1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("ON CONFLICT");
    expect(calls[0]).toContain('RETURNING "id"');
    expect(calls[0]).not.toContain("RETURNING *");
  });

  it("bulk inserts nested createMany children", async () => {
    const calls: string[] = [];
    const sqlClient = createFakeSqlClient(async (statement) => {
      calls.push(statement);
      if (statement.includes('INSERT INTO "public"."User"')) {
        return [{ id: "user-1" }];
      }
      if (statement.includes('INSERT INTO "public"."Session"')) {
        return [{ "?column?": 1 }, { "?column?": 1 }];
      }
      return [];
    });
    const client = createDatabaseClient(
      sqlClient as Parameters<typeof createDatabaseClient>[0],
    ) as {
      user: {
        create: (args: Record<string, unknown>) => Promise<{ id: string }>;
      };
    };

    const user = await client.user.create({
      data: {
        email: "user@example.com",
        passwordHash: "hash",
        sessions: {
          createMany: {
            data: [
              {
                tokenHash: "token-1",
                expiresAt: new Date("2026-04-12T00:00:00.000Z"),
              },
              {
                tokenHash: "token-2",
                expiresAt: new Date("2026-04-13T00:00:00.000Z"),
              },
            ],
            skipDuplicates: true,
          },
        },
      },
      select: { id: true },
    });

    const sessionInserts = calls.filter((statement) =>
      statement.includes('INSERT INTO "public"."Session"'),
    );

    expect(user).toEqual({ id: "user-1" });
    expect(calls).toHaveLength(2);
    expect(sessionInserts).toHaveLength(1);
    expect(sessionInserts[0]).toContain("), (");
    expect(sessionInserts[0]).toContain("ON CONFLICT DO NOTHING");
    expect(calls.some((statement) => statement.startsWith("SELECT"))).toBe(false);
  });
});
