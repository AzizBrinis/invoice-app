import { afterEach, describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/postgres", () => ({ executeStatement: query }));
import { GET } from "@/app/api/internal/document-precision/route";

describe("read-only document precision deployment probe", () => {
  const originalSecret = process.env.CRON_SECRET_TOKEN;
  afterEach(() => { process.env.CRON_SECRET_TOKEN = originalSecret; vi.resetAllMocks(); });
  it("requires the deployment verification credential without accessing database data", async () => {
    process.env.CRON_SECRET_TOKEN = "test-secret";
    for (const authorization of ["", "Bearer wrong", "Bearer ééééééééééé"]) {
      expect((await GET(new Request("https://example.test/api/internal/document-precision", { headers: { authorization } }))).status).toBe(404);
    }
    expect(query).not.toHaveBeenCalled();
  });
  it("verifies the real NUMERIC parser and reports only schema metadata", async () => {
    process.env.CRON_SECRET_TOKEN = "test-secret";
    query.mockResolvedValueOnce([{ amount: 1234.5 }]).mockResolvedValueOnce([]);
    const response = await GET(new Request("https://example.test/api/internal/document-precision", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ adapterVersion: 2, compatible: true, numericProbe: 1234.5 });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("fails verification when an old numeric parser returns strings", async () => {
    process.env.CRON_SECRET_TOKEN = "test-secret";
    query.mockResolvedValueOnce([{ amount: "1234.500" }]).mockResolvedValueOnce([]);
    expect((await GET(new Request("https://example.test/api/internal/document-precision", { headers: { authorization: "Bearer test-secret" } }))).status).toBe(503);
  });
});
