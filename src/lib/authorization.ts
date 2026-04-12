import { redirect } from "next/navigation";
import {
  AccountMembershipRole,
  AccountPermission,
  AccountType,
  type User,
  type UserRole,
} from "@/lib/db/prisma";
import { AuthorizationError } from "@/lib/errors";
import { requireUser, type AuthenticatedUser } from "@/lib/auth";

export const BILLING_MANAGER_ROLES: readonly UserRole[] = [
  "ADMIN",
  "ACCOUNTANT",
];

export type AppSection =
  | "dashboard"
  | "clients"
  | "services"
  | "payments"
  | "collaborators"
  | "quotes"
  | "invoices"
  | "products"
  | "website"
  | "messaging"
  | "assistant"
  | "settings";

const CLIENT_PAYMENTS_SECTION_PERMISSIONS: Partial<
  Record<AppSection, AccountPermission>
> = {
  dashboard: AccountPermission.DASHBOARD_VIEW,
  clients: AccountPermission.CLIENTS_VIEW,
  services: AccountPermission.CLIENTS_VIEW,
  payments: AccountPermission.CLIENTS_VIEW,
  collaborators: AccountPermission.COLLABORATORS_MANAGE,
};

const FOCUSED_ACCOUNT_ONLY_SECTIONS = new Set<AppSection>([
  "services",
  "payments",
  "collaborators",
]);

const CLIENT_PAYMENTS_SETTINGS_ROLES: readonly AccountMembershipRole[] = [
  AccountMembershipRole.OWNER,
  AccountMembershipRole.ADMIN,
];

const APP_SECTION_LABELS: Record<AppSection, string> = {
  dashboard: "tableau de bord",
  clients: "clients",
  services: "services",
  payments: "paiements",
  collaborators: "collaborateurs",
  quotes: "devis",
  invoices: "factures",
  products: "produits",
  website: "site web",
  messaging: "messagerie",
  assistant: "assistant",
  settings: "paramètres",
};

export function ensureCanManageBilling(user: Pick<User, "role">) {
  if (!BILLING_MANAGER_ROLES.includes(user.role)) {
    throw new AuthorizationError("Accès facturation refusé");
  }
}

export function isClientPaymentsAccount(
  user: Pick<AuthenticatedUser, "accountType">,
) {
  return user.accountType === AccountType.CLIENT_PAYMENTS;
}

export function hasAccountPermission(
  user: Pick<AuthenticatedUser, "accountType" | "permissions">,
  permission: AccountPermission,
) {
  if (!isClientPaymentsAccount(user)) {
    return true;
  }
  return user.permissions.includes(permission);
}

export function canAccessAppSection(
  user: Pick<
    AuthenticatedUser,
    "accountType" | "permissions" | "membershipRole"
  >,
  section: AppSection,
) {
  if (!isClientPaymentsAccount(user)) {
    return !FOCUSED_ACCOUNT_ONLY_SECTIONS.has(section);
  }

  if (section === "settings") {
    return CLIENT_PAYMENTS_SETTINGS_ROLES.includes(user.membershipRole);
  }

  const requiredPermission = CLIENT_PAYMENTS_SECTION_PERMISSIONS[section];
  if (!requiredPermission) {
    return false;
  }
  return hasAccountPermission(user, requiredPermission);
}

export function resolveDefaultAppHref(
  user: Pick<
    AuthenticatedUser,
    "accountType" | "permissions" | "membershipRole"
  >,
) {
  if (canAccessAppSection(user, "dashboard")) {
    return "/tableau-de-bord";
  }
  if (canAccessAppSection(user, "clients")) {
    return "/clients";
  }
  return "/connexion";
}

export function ensureCanAccessAppSection(
  user: Pick<
    AuthenticatedUser,
    "accountType" | "permissions" | "membershipRole"
  >,
  section: AppSection,
) {
  if (!canAccessAppSection(user, section)) {
    throw new AuthorizationError(
      `Accès ${APP_SECTION_LABELS[section]} refusé`,
    );
  }
}

export function ensureHasAccountPermission(
  user: Pick<AuthenticatedUser, "accountType" | "permissions">,
  permission: AccountPermission,
  message = "Permission refusée",
) {
  if (!hasAccountPermission(user, permission)) {
    throw new AuthorizationError(message);
  }
}

export async function requireAppSectionAccess(
  section: AppSection,
  options?: { redirectOnFailure?: boolean },
) {
  const user = await requireUser();
  if (!canAccessAppSection(user, section)) {
    if (options?.redirectOnFailure) {
      redirect(resolveDefaultAppHref(user));
    }
    throw new AuthorizationError(
      `Accès ${APP_SECTION_LABELS[section]} refusé`,
    );
  }
  return user;
}

export async function requireAccountPermission(
  permission: AccountPermission,
  options?: { message?: string; redirectOnFailure?: boolean },
) {
  const user = await requireUser();
  if (!hasAccountPermission(user, permission)) {
    if (options?.redirectOnFailure) {
      redirect(resolveDefaultAppHref(user));
    }
    throw new AuthorizationError(options?.message ?? "Permission refusée");
  }
  return user;
}
