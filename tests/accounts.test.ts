import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AccountMembershipRole,
  AccountPermission,
  AccountType,
} from "@prisma/client";

let prisma: (typeof import("@/lib/prisma"))["prisma"];
let acceptAccountInvitation: typeof import("@/server/accounts")["acceptAccountInvitation"];
let createAccountInvitation: typeof import("@/server/accounts")["createAccountInvitation"];
let ensureOwnedAccountContext: typeof import("@/server/accounts")["ensureOwnedAccountContext"];
let getPendingAccountInvitation: typeof import("@/server/accounts")["getPendingAccountInvitation"];
let resolveUserAccountContext: typeof import("@/server/accounts")["resolveUserAccountContext"];

let ownerUserId: string;
let existingCollaboratorUserId: string;
let futureCollaboratorUserId: string;
let existingCollaboratorEmail: string;
let futureCollaboratorEmail: string;

const describeAccounts = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeAccounts("account context foundation", () => {
  beforeAll(async () => {
    const prismaModule = await import("@/lib/prisma");
    const accountsModule = await import("@/server/accounts");

    prisma = prismaModule.prisma;
    acceptAccountInvitation = accountsModule.acceptAccountInvitation;
    createAccountInvitation = accountsModule.createAccountInvitation;
    ensureOwnedAccountContext = accountsModule.ensureOwnedAccountContext;
    getPendingAccountInvitation = accountsModule.getPendingAccountInvitation;
    resolveUserAccountContext = accountsModule.resolveUserAccountContext;

    const timestamp = Date.now();

    const owner = await prisma.user.create({
      data: {
        email: `account-owner-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Account Owner",
      },
    });

    const existingCollaborator = await prisma.user.create({
      data: {
        email: `account-collab-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Existing Collaborator",
      },
    });

    ownerUserId = owner.id;
    existingCollaboratorUserId = existingCollaborator.id;
    existingCollaboratorEmail = existingCollaborator.email;
    futureCollaboratorEmail = `future-collab-${timestamp}@example.com`;
  });

  afterAll(async () => {
    const userIds = [
      ownerUserId,
      existingCollaboratorUserId,
      futureCollaboratorUserId,
    ].filter(Boolean);

    await prisma.session.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  });

  it("bootstraps a default full-app owner account on demand", async () => {
    await ensureOwnedAccountContext(ownerUserId);

    const account = await prisma.account.findUnique({
      where: { id: ownerUserId },
      include: {
        memberships: {
          where: {
            userId: ownerUserId,
          },
        },
      },
    });

    expect(account?.type).toBe(AccountType.FULL_APP);
    expect(account?.memberships).toHaveLength(1);
    expect(account?.memberships[0]?.role).toBe(AccountMembershipRole.OWNER);
  });

  it("resolves an existing owner context without mutating membership timestamps", async () => {
    await ensureOwnedAccountContext(ownerUserId);

    const before = await prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId: ownerUserId,
          userId: ownerUserId,
        },
      },
      select: {
        updatedAt: true,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const context = await resolveUserAccountContext(ownerUserId);

    const after = await prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId: ownerUserId,
          userId: ownerUserId,
        },
      },
      select: {
        updatedAt: true,
      },
    });

    expect(context.accountId).toBe(ownerUserId);
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });

  it("creates and accepts an invitation for an existing back-office user", async () => {
    const invitation = await createAccountInvitation({
      accountId: ownerUserId,
      invitedByUserId: ownerUserId,
      email: existingCollaboratorEmail,
      role: AccountMembershipRole.MEMBER,
      permissions: [
        AccountPermission.DASHBOARD_VIEW,
        AccountPermission.CLIENTS_VIEW,
        AccountPermission.CLIENTS_MANAGE,
      ],
    });

    const preview = await getPendingAccountInvitation(invitation.rawToken);
    expect(preview?.email).toBe(existingCollaboratorEmail);
    expect(preview?.permissions).toEqual(
      expect.arrayContaining([
        AccountPermission.DASHBOARD_VIEW,
        AccountPermission.CLIENTS_VIEW,
        AccountPermission.CLIENTS_MANAGE,
      ]),
    );

    const acceptedContext = await acceptAccountInvitation({
      rawToken: invitation.rawToken,
      userId: existingCollaboratorUserId,
    });

    expect(acceptedContext.accountId).toBe(ownerUserId);
    expect(acceptedContext.accountType).toBe(AccountType.FULL_APP);
    expect(acceptedContext.membershipRole).toBe(AccountMembershipRole.MEMBER);
    expect(acceptedContext.permissions).toEqual(
      expect.arrayContaining([
        AccountPermission.DASHBOARD_VIEW,
        AccountPermission.CLIENTS_VIEW,
        AccountPermission.CLIENTS_MANAGE,
      ]),
    );
  });

  it("accepts an invitation after a new user account is created", async () => {
    const invitation = await createAccountInvitation({
      accountId: ownerUserId,
      invitedByUserId: ownerUserId,
      email: futureCollaboratorEmail,
      role: AccountMembershipRole.ADMIN,
    });

    const futureCollaborator = await prisma.user.create({
      data: {
        email: futureCollaboratorEmail,
        passwordHash: "hashed",
        name: "Future Collaborator",
      },
    });
    futureCollaboratorUserId = futureCollaborator.id;

    const acceptedContext = await acceptAccountInvitation({
      rawToken: invitation.rawToken,
      userId: futureCollaboratorUserId,
    });

    expect(acceptedContext.accountId).toBe(ownerUserId);
    expect(acceptedContext.membershipRole).toBe(AccountMembershipRole.ADMIN);
    expect(acceptedContext.permissions).toEqual(
      expect.arrayContaining(Object.values(AccountPermission)),
    );

    const fallbackContext = await resolveUserAccountContext(
      futureCollaboratorUserId,
      "missing-account",
    );
    expect(fallbackContext.accountId).toBe(futureCollaboratorUserId);
    expect(fallbackContext.membershipRole).toBe(AccountMembershipRole.OWNER);
  });
});
