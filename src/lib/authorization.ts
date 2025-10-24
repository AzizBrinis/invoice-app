import type { User } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { AuthorizationError } from "@/lib/errors";

export const BILLING_MANAGER_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.ACCOUNTANT,
];

export function ensureCanManageBilling(user: Pick<User, "role">) {
  if (!BILLING_MANAGER_ROLES.includes(user.role)) {
    throw new AuthorizationError("Accès facturation refusé");
  }
}
