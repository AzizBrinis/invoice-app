import { describe, expect, it } from "vitest";
import { ensureCanManageBilling, BILLING_MANAGER_ROLES } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { UserRole } from "@prisma/client";
import { getClientTenantId } from "@/server/clients";

describe("ensureCanManageBilling", () => {
  it("allows billing roles", () => {
    for (const role of BILLING_MANAGER_ROLES) {
      expect(() => ensureCanManageBilling({ role })).not.toThrow();
    }
  });

  it("rejects viewer role", () => {
    expect(() => ensureCanManageBilling({ role: UserRole.VIEWER })).toThrow(
      AuthorizationError,
    );
  });
});

describe("tenant scoping helpers", () => {
  it("prefers activeTenantId when present", () => {
    expect(
      getClientTenantId({
        id: "user-1",
        activeTenantId: "tenant-active",
        tenantId: "tenant-legacy",
      }),
    ).toBe("tenant-active");
  });

  it("prefers tenantId when present", () => {
    expect(getClientTenantId({ id: "user-1", tenantId: "tenant-1" })).toBe(
      "tenant-1",
    );
  });

  it("falls back to user id when tenantId is missing", () => {
    expect(getClientTenantId({ id: "user-1", tenantId: null })).toBe("user-1");
    expect(getClientTenantId({ id: "user-2" })).toBe("user-2");
  });
});
