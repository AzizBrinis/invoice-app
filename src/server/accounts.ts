import { createHash, randomBytes } from "node:crypto";
import {
  AccountInvitationStatus,
  AccountMembershipRole,
  AccountPermission,
  AccountType,
  Prisma,
} from "@/lib/db/prisma-server";
import { prisma } from "@/lib/db";

const DEFAULT_INVITATION_TTL_DAYS = parseInt(
  process.env.ACCOUNT_INVITATION_TTL_DAYS ?? "14",
  10,
);

const ACCOUNT_ADMIN_ROLES: readonly AccountMembershipRole[] = [
  AccountMembershipRole.OWNER,
  AccountMembershipRole.ADMIN,
];

const IMPLICIT_ROLE_PERMISSIONS: Record<
  AccountMembershipRole,
  readonly AccountPermission[]
> = {
  [AccountMembershipRole.OWNER]: Object.values(AccountPermission),
  [AccountMembershipRole.ADMIN]: Object.values(AccountPermission),
  [AccountMembershipRole.MEMBER]: [],
};

const accountMembershipInclude =
  Prisma.validator<Prisma.AccountMembershipInclude>()({
    account: {
      select: {
        id: true,
        type: true,
        displayName: true,
      },
    },
    permissions: {
      select: {
        permission: true,
      },
      orderBy: {
        permission: "asc",
      },
    },
  });

const accountInvitationInclude =
  Prisma.validator<Prisma.AccountInvitationInclude>()({
    account: {
      select: {
        id: true,
        type: true,
        displayName: true,
      },
    },
    permissions: {
      select: {
        permission: true,
      },
      orderBy: {
        permission: "asc",
      },
    },
  });

const collaboratorMembershipInclude =
  Prisma.validator<Prisma.AccountMembershipInclude>()({
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    permissions: {
      select: {
        permission: true,
      },
      orderBy: {
        permission: "asc",
      },
    },
  });

const collaboratorInvitationInclude =
  Prisma.validator<Prisma.AccountInvitationInclude>()({
    invitedByUser: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    permissions: {
      select: {
        permission: true,
      },
      orderBy: {
        permission: "asc",
      },
    },
  });

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

type AccountMembershipRecord = Prisma.AccountMembershipGetPayload<{
  include: typeof accountMembershipInclude;
}>;

type AccountInvitationRecord = Prisma.AccountInvitationGetPayload<{
  include: typeof accountInvitationInclude;
}>;

type CollaboratorMembershipRecord = Prisma.AccountMembershipGetPayload<{
  include: typeof collaboratorMembershipInclude;
}>;

type CollaboratorInvitationRecord = Prisma.AccountInvitationGetPayload<{
  include: typeof collaboratorInvitationInclude;
}>;

export type AccountContext = {
  accountId: string;
  activeTenantId: string;
  accountType: AccountType;
  accountDisplayName: string | null;
  membershipId: string;
  membershipRole: AccountMembershipRole;
  permissions: AccountPermission[];
};

export type AccountInvitationPreview = {
  id: string;
  accountId: string;
  accountType: AccountType;
  accountDisplayName: string | null;
  email: string;
  role: AccountMembershipRole;
  permissions: AccountPermission[];
  expiresAt: Date;
};

export type CreatedAccountInvitation = {
  rawToken: string;
  invitationId: string;
  accountId: string;
  email: string;
  expiresAt: Date;
  role: AccountMembershipRole;
  permissions: AccountPermission[];
};

export type AccountCollaborator = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  role: AccountMembershipRole;
  permissions: AccountPermission[];
  createdAt: Date;
};

export type PendingAccountInvitation = {
  invitationId: string;
  email: string;
  role: AccountMembershipRole;
  permissions: AccountPermission[];
  invitedByName: string | null;
  invitedByEmail: string;
  expiresAt: Date;
  createdAt: Date;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getDefaultAccountDisplayName(user: { email: string; name: string | null }) {
  const fallback = user.email.split("@")[0]?.trim();
  return user.name?.trim() || fallback || user.email;
}

function normalizePermissions(permissions: readonly AccountPermission[] = []) {
  return Array.from(new Set(permissions));
}

function permissionsForRole(
  role: AccountMembershipRole,
  explicitPermissions: readonly AccountPermission[],
) {
  return normalizePermissions([
    ...IMPLICIT_ROLE_PERMISSIONS[role],
    ...explicitPermissions,
  ]);
}

function serializeMembershipContext(
  membership: AccountMembershipRecord,
): AccountContext {
  const explicitPermissions = membership.permissions.map(
    (entry) => entry.permission,
  );

  return {
    accountId: membership.accountId,
    activeTenantId: membership.accountId,
    accountType: membership.account.type,
    accountDisplayName: membership.account.displayName ?? null,
    membershipId: membership.id,
    membershipRole: membership.role,
    permissions: permissionsForRole(membership.role, explicitPermissions),
  };
}

function serializeCollaboratorMembership(
  membership: CollaboratorMembershipRecord,
): AccountCollaborator {
  return {
    membershipId: membership.id,
    userId: membership.userId,
    name: membership.user.name?.trim() ?? null,
    email: membership.user.email,
    role: membership.role,
    permissions: permissionsForRole(
      membership.role,
      membership.permissions.map((entry) => entry.permission),
    ),
    createdAt: membership.createdAt,
  };
}

function serializePendingInvitation(
  invitation: CollaboratorInvitationRecord,
): PendingAccountInvitation {
  return {
    invitationId: invitation.id,
    email: invitation.email,
    role: invitation.role,
    permissions: permissionsForRole(
      invitation.role,
      invitation.permissions.map((entry) => entry.permission),
    ),
    invitedByName: invitation.invitedByUser.name?.trim() ?? null,
    invitedByEmail: invitation.invitedByUser.email,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

async function findUserOrThrow(userId: string, db: DatabaseClient) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  return user;
}

async function getMembership(
  userId: string,
  accountId: string,
  db: DatabaseClient,
) {
  return db.accountMembership.findUnique({
    where: {
      accountId_userId: {
        accountId,
        userId,
      },
    },
    include: accountMembershipInclude,
  });
}

async function markInvitationExpiredIfNeeded(
  invitation: Pick<
    AccountInvitationRecord,
    "id" | "status" | "expiresAt"
  >,
  db: DatabaseClient,
) {
  if (
    invitation.status === AccountInvitationStatus.PENDING &&
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    await db.accountInvitation.update({
      where: { id: invitation.id },
      data: {
        status: AccountInvitationStatus.EXPIRED,
      },
    });
    return true;
  }

  return false;
}

export function isAccountAdminRole(role: AccountMembershipRole) {
  return ACCOUNT_ADMIN_ROLES.includes(role);
}

export async function ensureOwnedAccountContext(
  userId: string,
  db: DatabaseClient = prisma,
) {
  const [existingAccount, existingMembership] = await Promise.all([
    db.account.findUnique({
      where: { id: userId },
      select: { id: true },
    }),
    db.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId: userId,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    }),
  ]);

  if (
    existingAccount &&
    existingMembership?.role === AccountMembershipRole.OWNER
  ) {
    return;
  }

  const user = await findUserOrThrow(userId, db);

  if (!existingAccount) {
    await db.account.create({
      data: {
        id: user.id,
        type: AccountType.FULL_APP,
        displayName: getDefaultAccountDisplayName(user),
      },
    });
  }

  if (!existingMembership || existingMembership.role !== AccountMembershipRole.OWNER) {
    await db.accountMembership.upsert({
      where: {
        accountId_userId: {
          accountId: user.id,
          userId: user.id,
        },
      },
      create: {
        accountId: user.id,
        userId: user.id,
        role: AccountMembershipRole.OWNER,
      },
      update: {
        role: AccountMembershipRole.OWNER,
      },
    });
  }
}

export async function resolveUserAccountContext(
  userId: string,
  requestedAccountId?: string | null,
  db: DatabaseClient = prisma,
): Promise<AccountContext> {
  const preferredAccountId = requestedAccountId ?? userId;
  const loadMembership = async () => {
    let membership = await getMembership(userId, preferredAccountId, db);

    if (!membership && preferredAccountId !== userId) {
      membership = await getMembership(userId, userId, db);
    }

    return membership;
  };

  let membership = await loadMembership();
  if (!membership) {
    await ensureOwnedAccountContext(userId, db);
    membership = await loadMembership();
  }

  if (!membership) {
    throw new Error("Contexte de compte introuvable");
  }

  return serializeMembershipContext(membership);
}

export async function listAccessibleAccounts(userId: string) {
  await ensureOwnedAccountContext(userId);

  const memberships = await prisma.accountMembership.findMany({
    where: { userId },
    include: accountMembershipInclude,
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships
    .map(serializeMembershipContext)
    .sort((left, right) =>
      (left.accountDisplayName ?? "").localeCompare(
        right.accountDisplayName ?? "",
      ),
    );
}

export async function listAccountCollaborators(
  accountId: string,
  actorUserId: string,
) {
  await ensureOwnedAccountContext(actorUserId);

  const membership = await getMembership(actorUserId, accountId, prisma);
  if (!membership) {
    throw new Error("Accès compte refusé");
  }

  const memberships = await prisma.accountMembership.findMany({
    where: {
      accountId,
    },
    include: collaboratorMembershipInclude,
    orderBy: [
      { createdAt: "asc" },
      { user: { email: "asc" } },
    ],
  });

  return memberships.map(serializeCollaboratorMembership);
}

export async function listPendingAccountInvitations(
  accountId: string,
  actorUserId: string,
) {
  await ensureOwnedAccountContext(actorUserId);

  const membership = await getMembership(actorUserId, accountId, prisma);
  if (!membership || !isAccountAdminRole(membership.role)) {
    throw new Error("Accès invitation refusé");
  }

  const invitations = await prisma.accountInvitation.findMany({
    where: {
      accountId,
      status: AccountInvitationStatus.PENDING,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: collaboratorInvitationInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return invitations.map(serializePendingInvitation);
}

export async function setSessionActiveTenant(
  sessionId: string,
  userId: string,
  accountId: string,
) {
  const context = await resolveUserAccountContext(userId, accountId);

  await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
    },
    data: {
      activeTenantId: context.accountId,
    },
  });

  return context;
}

export async function createAccountInvitation(input: {
  accountId: string;
  invitedByUserId: string;
  email: string;
  role?: AccountMembershipRole;
  permissions?: readonly AccountPermission[];
  expiresAt?: Date;
}) {
  const role = input.role ?? AccountMembershipRole.MEMBER;
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Adresse e-mail invalide");
  }
  const permissions = normalizePermissions(input.permissions ?? []);
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + DEFAULT_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    await ensureOwnedAccountContext(input.invitedByUserId, tx);

    const inviterMembership = await getMembership(
      input.invitedByUserId,
      input.accountId,
      tx,
    );

    if (!inviterMembership || !isAccountAdminRole(inviterMembership.role)) {
      throw new Error("Accès invitation refusé");
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      const existingMembership = await tx.accountMembership.findUnique({
        where: {
          accountId_userId: {
            accountId: input.accountId,
            userId: existingUser.id,
          },
        },
        select: { id: true },
      });

      if (existingMembership) {
        throw new Error("Cet utilisateur appartient déjà à ce compte");
      }
    }

    await tx.accountInvitation.updateMany({
      where: {
        accountId: input.accountId,
        email,
        status: AccountInvitationStatus.PENDING,
      },
      data: {
        status: AccountInvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    const invitation = await tx.accountInvitation.create({
      data: {
        accountId: input.accountId,
        email,
        invitedByUserId: input.invitedByUserId,
        role,
        tokenHash,
        expiresAt,
        permissions: permissions.length
          ? {
              create: permissions.map((permission) => ({
                permission,
              })),
            }
          : undefined,
      },
      include: accountInvitationInclude,
    });

    return {
      rawToken,
      invitationId: invitation.id,
      accountId: invitation.accountId,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      role: invitation.role,
      permissions: permissionsForRole(
        invitation.role,
        invitation.permissions.map((entry) => entry.permission),
      ),
    } satisfies CreatedAccountInvitation;
  });
}

export async function getPendingAccountInvitation(rawToken: string) {
  const token = rawToken.trim();
  if (!token) {
    return null;
  }

  const invitation = await prisma.accountInvitation.findUnique({
    where: {
      tokenHash: hashOpaqueToken(token),
    },
    include: accountInvitationInclude,
  });

  if (!invitation) {
    return null;
  }

  const expired = await markInvitationExpiredIfNeeded(invitation, prisma);
  if (expired || invitation.status !== AccountInvitationStatus.PENDING) {
    return null;
  }

  return {
    id: invitation.id,
    accountId: invitation.accountId,
    accountType: invitation.account.type,
    accountDisplayName: invitation.account.displayName ?? null,
    email: invitation.email,
    role: invitation.role,
    permissions: permissionsForRole(
      invitation.role,
      invitation.permissions.map((entry) => entry.permission),
    ),
    expiresAt: invitation.expiresAt,
  } satisfies AccountInvitationPreview;
}

export async function acceptAccountInvitation(input: {
  rawToken: string;
  userId: string;
}) {
  const token = input.rawToken.trim();
  if (!token) {
    throw new Error("Invitation introuvable");
  }

  return prisma.$transaction(async (tx) => {
    await ensureOwnedAccountContext(input.userId, tx);

    const invitation = await tx.accountInvitation.findUnique({
      where: {
        tokenHash: hashOpaqueToken(token),
      },
      include: accountInvitationInclude,
    });

    if (!invitation) {
      throw new Error("Invitation introuvable");
    }

    const expired = await markInvitationExpiredIfNeeded(invitation, tx);
    if (expired || invitation.status === AccountInvitationStatus.EXPIRED) {
      throw new Error("Invitation expirée");
    }

    if (invitation.status === AccountInvitationStatus.REVOKED) {
      throw new Error("Invitation révoquée");
    }

    const user = await findUserOrThrow(input.userId, tx);
    if (normalizeEmail(user.email) !== invitation.email) {
      throw new Error("Cette invitation ne correspond pas à cette adresse e-mail");
    }

    const existingMembership = await getMembership(
      input.userId,
      invitation.accountId,
      tx,
    );

    let membership = existingMembership;

    if (!membership) {
      const createdMembership = await tx.accountMembership.create({
        data: {
          accountId: invitation.accountId,
          userId: input.userId,
          role: invitation.role,
          permissions: invitation.permissions.length
            ? {
                create: invitation.permissions.map((entry) => ({
                  permission: entry.permission,
                })),
              }
            : undefined,
        },
        include: accountMembershipInclude,
      });
      membership = createdMembership;
    }

    if (
      invitation.status === AccountInvitationStatus.ACCEPTED &&
      invitation.acceptedByUserId &&
      invitation.acceptedByUserId !== input.userId
    ) {
      throw new Error("Invitation déjà utilisée");
    }

    if (invitation.status !== AccountInvitationStatus.ACCEPTED) {
      await tx.accountInvitation.update({
        where: { id: invitation.id },
        data: {
          status: AccountInvitationStatus.ACCEPTED,
          acceptedByUserId: input.userId,
          acceptedAt: new Date(),
        },
      });
    }

    return serializeMembershipContext(membership);
  });
}
