import type { User, UserRole } from "@prisma/client";
import { AuthorizationError } from "@/lib/errors";

export const BILLING_MANAGER_ROLES =
  ["ADMIN", "ACCOUNTANT"] as const satisfies readonly UserRole[];

export function ensureCanManageBilling(user: Pick<User, "role">) {
  if (!BILLING_MANAGER_ROLES.includes(user.role)) {
    throw new AuthorizationError("Accès facturation refusé");
  }
}
