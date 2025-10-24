import { describe, expect, it } from "vitest";
import { ensureCanManageBilling, BILLING_MANAGER_ROLES } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { UserRole } from "@prisma/client";

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
